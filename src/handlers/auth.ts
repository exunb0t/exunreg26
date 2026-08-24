import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { getDb } from '../db/client'
import * as queries from '../db/queries'

// Getting passwords hehe
import { sha256Hex, generateAuthToken  } from '../lib/crypto'
import { getEmailFromCookie } from '../middleware/auth'
import { sendEmail } from '../lib/sendemail'



// Log Out user by deleting the auth_token and email cookies cause apparently thats how u log out someone didnt know that before

export async function logout(c: AppContext) {

    const db = getDb(c.env)

    const authToken = c.req.header('Cookie')
        ?.match(/auth_token=([^;]+)/)?.[1]

    // Delete session from database first
    if (authToken) {
        await queries.deleteSession(
            db,
            authToken
        )
    }

    // Remove authentication cookies
    deleteCookie(c, 'email')
    deleteCookie(c, 'auth_token')
     
    return jsonOk(c, { email: getEmailFromCookie(c) }, 'Logged out')
    }

// SEND OTP EMAIL

export async function sendOTP(c: AppContext) {
    const payload = await c.req.json<{ email?: string }>().catch(() => null)
    if (!payload?.email) {
        return jsonError(c, 'Email required', 400)
    }

    const db = getDb(c.env)
    const today = new Date().toISOString().slice(0, 10)
    const existingOtp = await queries.getPasswordResetOtp(db, payload.email)

    let requestCount = 1
    if (existingOtp?.requestDay === today) {
        requestCount = existingOtp.requestCount + 1
    }

    if (requestCount > 10) {
        return jsonError(c, 'Daily OTP request limit reached. Try again tomorrow.', 429)
    }

    const now = Date.now()
    const randBuf = new Uint32Array(1)

    crypto.getRandomValues(randBuf)

    const otp = String(
        100000 + (randBuf[0] % 900000)
    )

    const otpHash = await sha256Hex(otp)

    // expire after 15mins
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString()

    if (existingOtp) {
        await queries.updatePasswordResetOtp(db, payload.email, {
            otpHash,
            expiresAt,
            requestCount,
            requestDay: today,
            attemptCount: 0,
        })
    } else {
        await queries.createPasswordResetOtp(db, {
            email: payload.email,
            otpHash,
            expiresAt,
            requestCount,
            requestDay: today,
            attemptCount: 0,
        })
    }

    await sendEmail(payload.email, 'Exun Login OTP', `Your Exun login OTP is ${otp}`, c.env)
    return jsonOk(c, null, 'OTP sent successfully')
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
        return jsonError(c, 'OTP has expired', 400)
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
    if (!user) {
        user = await queries.createUser(db, { email: payload.email, username: payload.email })
    }

    const authToken = generateAuthToken()
    const cookieSecure = c.env.COOKIE_SECURE === 'true'
    const cookieOpts = { path: '/', httpOnly: true, secure: cookieSecure, sameSite: 'Lax' as const, maxAge: 86400 }

    await queries.createSession(db, payload.email, authToken, new Date(Date.now() + 86400 * 1000).toISOString())
    setCookie(c, 'email', payload.email, cookieOpts)
    setCookie(c, 'auth_token', authToken, cookieOpts)

    return jsonOk(c, { email: payload.email }, 'Login successful')
}

// google oauth
export async function startGoogleOAuth(c: AppContext) {
    const clientId = c.env.GOOGLE_CLIENT_ID
    if (!clientId) return jsonError(c, 'GOOGLE_CLIENT_ID not configured', 500)

    const state = crypto.randomUUID()
    setCookie(c, 'google_oauth_state', state, {
        path: '/',
        httpOnly: true,
        secure: c.env.COOKIE_SECURE === 'true',
        sameSite: 'Lax',
        maxAge: 300,
    })

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
    const cookieSecure = c.env.COOKIE_SECURE === 'true'
    const cookieOpts = { path: '/', httpOnly: true, secure: cookieSecure, sameSite: 'Lax' as const, maxAge: 86400 }

    await queries.createSession(db, googleUser.email, authToken, new Date(Date.now() + 86400 * 1000).toISOString())
    setCookie(c, 'email', googleUser.email, cookieOpts)
    setCookie(c, 'auth_token', authToken, cookieOpts)

    return c.redirect('/', 302)
}