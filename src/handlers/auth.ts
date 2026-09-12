import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { deleteCookie, getCookie } from 'hono/cookie'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { sha256Hex, generateAuthToken } from '../lib/crypto'
import { setAuthCookies } from '../lib/cookies'
import { getEmailFromCookie, isAuthenticated } from '../middleware/auth'
import { isAdminEmail } from '../lib/admin'
import { sendEmail } from '../lib/sendemail'
import { renderOtpEmail } from '../lib/otpEmail'

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
    const existingUser = await queries.getUserByEmail(db, email)
    try {
        await sendEmail(email, 'Exun 2026 Login OTP', `Your Exun 2026 login OTP is ${otp}. It is valid for 10 minutes.`, c.env, renderOtpEmail(otp))
    } catch (err) {
        console.error(`sendOTP email failed for ${email}: ${err instanceof Error ? err.message : String(err)}`)
        return jsonError(c, 'Failed to send OTP email. Please try again.', 502)
    }
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

