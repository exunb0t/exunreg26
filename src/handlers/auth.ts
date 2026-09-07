import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { sha256Hex, generateAuthToken } from '../lib/crypto'
import { setAuthCookies, authCookieOpts } from '../lib/cookies'
import { getEmailFromCookie, isAuthenticated } from '../middleware/auth'
import { isAdminEmail } from '../lib/admin'
import { sendEmail } from '../lib/sendemail'

const OTP_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_TTL_S = 30 * 24 * 60 * 60
const emailRegex = /^[^@]+@[a-zA-Z]+\.[a-zA-Z]{2,}$/

export async function logout(c: AppContext) {
    const db = getDb(c.env)
    const authToken = getCookie(c, 'auth_token')
    if (authToken) {
        await queries.deleteSession(db, authToken)
    }
    deleteCookie(c, 'email', { path: '/' })
    deleteCookie(c, 'auth_token', { path: '/' })
    return jsonOk(c, null, 'Logged out')
}

export async function getSession(c: AppContext) {
    const authenticated = await isAuthenticated(c)
    if (!authenticated) {
        return jsonOk(c, { authenticated: false, email: null, isAdmin: false }, 'No active session')
    }
    const email = getEmailFromCookie(c)
    return jsonOk(c, { authenticated: true, email, isAdmin: isAdminEmail(email, c.env) }, 'Active session')
}

export async function sendOTP(c: AppContext) {
    const payload = await c.req.json<{ email?: string; resend?: boolean }>().catch(() => null)
    if (!payload?.email || !emailRegex.test(payload.email.trim())) {
        return jsonError(c, 'Valid email required', 400)
    }
    const email = payload.email.trim()
    const forceResend = payload.resend === true
    const db = getDb(c.env)
    const now = Date.now()
    const existingOtp = await queries.getPasswordResetOtp(db, email)
    if (existingOtp && new Date(existingOtp.expiresAt).getTime() > now && !forceResend) {
        const existingUser = await queries.getUserByEmail(db, email)
        return jsonOk(c, { email, reused: true, expiresAt: existingOtp.expiresAt, isNewUser: !existingUser }, 'OTP already sent. Please check your email.')
    }
    const today = new Date().toISOString().slice(0, 10)
    let requestCount = 1
    if (existingOtp?.requestDay === today) {
        requestCount = existingOtp.requestCount + 1
    }
    if (requestCount > 10) {
        return jsonError(c, 'Daily OTP request limit reached. Try again tomorrow.', 429)
    }
    const randBuf = new Uint32Array(1)
    crypto.getRandomValues(randBuf)
    const otp = String(100000 + (randBuf[0] % 900000))
    const otpHash = await sha256Hex(otp)
    const expiresAt = new Date(now + OTP_TTL_MS).toISOString()
    if (existingOtp) {
        await queries.updatePasswordResetOtp(db, email, {
            otpHash,
            expiresAt,
            requestCount,
            requestDay: today,
            attemptCount: 0,
        })
    } else {
        await queries.createPasswordResetOtp(db, {
            email,
            otpHash,
            expiresAt,
            requestCount,
            requestDay: today,
            attemptCount: 0,
        })
    }
    const existingUser = await queries.getUserByEmail(db, email)
    try {
        await sendEmail(email, 'Exun 2026 Login OTP', `Your Exun 2026 login OTP is ${otp}. It is valid for 10 minutes.`, c.env)
    } catch {
        return jsonError(c, 'Failed to send OTP email. Please try again.', 502)
    }
    return jsonOk(c, { email, reused: false, expiresAt, isNewUser: !existingUser }, existingUser ? 'OTP sent. Welcome back.' : 'OTP sent. A new account will be created on verification.')
}

export async function verifyOTP(c: AppContext) {
    const payload = await c.req.json<{ email?: string; otp?: string }>().catch(() => null)
    if (!payload?.email || !payload?.otp) {
        return jsonError(c, 'Email and OTP required', 400)
    }
    const db = getDb(c.env)
    const storedOtp = await queries.getPasswordResetOtp(db, payload.email)
    if (!storedOtp) {
        return jsonError(c, 'No OTP found. Please request a new one', 400)
    }
    if (Date.now() > new Date(storedOtp.expiresAt).getTime()) {
        await queries.deletePasswordResetOtp(db, payload.email)
        return jsonError(c, 'OTP has expired. Please request a new one.', 400)
    }
    const otpHash = await sha256Hex(payload.otp)
    if (otpHash !== storedOtp.otpHash) {
        const newAttemptCount = storedOtp.attemptCount + 1
        if (newAttemptCount >= 10) {
            await queries.deletePasswordResetOtp(db, payload.email)
            return jsonError(c, 'Too many incorrect OTP attempts. Please request a new OTP.', 429)
        }
        await queries.updatePasswordResetOtpAttempts(db, payload.email, newAttemptCount)
        return jsonError(c, `Invalid OTP. ${10 - newAttemptCount} attempts remaining.`, 401)
    }
    await queries.deletePasswordResetOtp(db, payload.email)
    let user = await queries.getUserByEmail(db, payload.email)
    const isNewUser = !user
    if (!user) {
        user = await queries.createUser(db, { email: payload.email, username: payload.email })
    }
    const authToken = generateAuthToken()
    await queries.createSession(db, payload.email, authToken, new Date(Date.now() + SESSION_TTL_MS).toISOString())
    setAuthCookies(c, payload.email, authToken, SESSION_TTL_S)
    return jsonOk(c, { email: payload.email, isNewUser }, isNewUser ? 'Account created. Welcome to Exun 2026.' : 'Login successful. Welcome back.')
}

export async function startGoogleOAuth(c: AppContext) {
    const clientId = c.env.GOOGLE_CLIENT_ID
    if (!clientId) return jsonError(c, 'GOOGLE_CLIENT_ID not configured', 500)
    const state = crypto.randomUUID()
    setCookie(c, 'google_oauth_state', state, authCookieOpts(c, 300))
    const redirectUri = new URL('/api/auth/google/callback', c.req.url).toString()
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('state', state)
    return c.redirect(url.toString(), 302)
}

export async function handleGoogleOAuthCback(c: AppContext) {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const expectedState = getCookie(c, 'google_oauth_state')
    deleteCookie(c, 'google_oauth_state', { path: '/' })
    if (!state || !expectedState || state !== expectedState || !code) {
        return jsonError(c, 'Invalid OAuth state or code', 400)
    }
    const clientId = c.env.GOOGLE_CLIENT_ID
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) return jsonError(c, 'Google OAuth credentials not configured', 500)
    const redirectUri = new URL('/api/auth/google/callback', c.req.url).toString()
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    })
    if (!tokenRes.ok) return jsonError(c, 'Failed token exchange with Google', 502)
    const tokenData = await tokenRes.json<{ access_token: string }>()
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    if (!userRes.ok) {
        return jsonError(c, 'Failed to fetch Google profile', 502)
    }
    const googleUser = await userRes.json<{ email?: string }>()
    if (!googleUser.email) return jsonError(c, 'Google email missing', 400)
    const db = getDb(c.env)
    let user = await queries.getUserByEmail(db, googleUser.email)
    if (!user) {
        user = await queries.createUser(db, { email: googleUser.email, username: googleUser.email })
    }
    const authToken = generateAuthToken()
    await queries.createSession(db, googleUser.email, authToken, new Date(Date.now() + SESSION_TTL_MS).toISOString())
    setAuthCookies(c, googleUser.email, authToken, SESSION_TTL_S)
    return c.redirect('/', 302)
}
