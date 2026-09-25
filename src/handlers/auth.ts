import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { deleteCookie, getCookie } from 'hono/cookie'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { generateAuthToken, generateOtp6, hashOtp, hashSessionToken, verifyOtpHash } from '../lib/crypto'
import { authCookieOpts, setAuthCookies } from '../lib/cookies'
import { getEmailFromCookie, isAuthenticated } from '../middleware/auth'
import { isAdminEmail } from '../lib/admin'
import { sendEmail } from '../lib/sendemail'
import { renderOtpEmail } from '../lib/otpEmail'
import { isValidEmail, normalizeEmail, redactEmail } from '../lib/validation'

const OTP_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_TTL_S = 30 * 24 * 60 * 60

export async function logout(c: AppContext) {
    const db = getDb(c.env)
    const authToken = getCookie(c, 'auth_token')
    const pepper = (c.env.AUTH_SALT ?? '').trim()
    if (authToken && pepper) {
        const hashed = await hashSessionToken(authToken, pepper)
        await queries.deleteSession(db, hashed)
        await queries.deleteSession(db, authToken)
    }
    const clearOpts = { ...authCookieOpts(c, 0), maxAge: 0 }
    deleteCookie(c, 'email', { path: clearOpts.path, secure: clearOpts.secure, sameSite: clearOpts.sameSite, httpOnly: clearOpts.httpOnly })
    deleteCookie(c, 'auth_token', { path: clearOpts.path, secure: clearOpts.secure, sameSite: clearOpts.sameSite, httpOnly: clearOpts.httpOnly })
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
    const email = normalizeEmail(payload?.email)
    if (!email || !isValidEmail(email)) {
        return jsonError(c, 'Valid email required', 400)
    }
    const pepper = (c.env.AUTH_SALT ?? '').trim()
    if (!pepper) {
        return jsonError(c, 'Server misconfigured', 500)
    }
    const forceResend = payload?.resend === true
    const db = getDb(c.env)
    const now = Date.now()
    const existingOtp = await queries.getPasswordResetOtp(db, email)
    if (existingOtp) {
        const exp = new Date(existingOtp.expiresAt).getTime()
        if (Number.isFinite(exp) && exp > now && !forceResend) {
            const existingUser = await queries.getUserByEmail(db, email)
            return jsonOk(c, { email, reused: true, expiresAt: existingOtp.expiresAt, isNewUser: !existingUser }, 'OTP already sent. Please check your email.')
        }
    }
    const today = new Date().toISOString().slice(0, 10)
    let requestCount = 1
    if (existingOtp?.requestDay === today) {
        requestCount = existingOtp.requestCount + 1
    }
    if (requestCount > 10) {
        return jsonError(c, 'Daily OTP request limit reached. Try again tomorrow.', 429)
    }
    const otp = generateOtp6()
    const otpHash = await hashOtp(email, otp, pepper)
    const expiresAt = new Date(now + OTP_TTL_MS).toISOString()
    const existingUser = await queries.getUserByEmail(db, email)
    try {
        await sendEmail(email, 'Exun 2026 Login OTP', `Your Exun 2026 login OTP is ${otp}. It is valid for 10 minutes.`, c.env, renderOtpEmail(otp))
    } catch (err) {
        console.error(`sendOTP email failed for ${redactEmail(email)}: ${err instanceof Error ? err.message : String(err)}`)
        return jsonError(c, 'Failed to send OTP email. Please try again.', 502)
    }
    const preservedAttempts = existingOtp ? existingOtp.attemptCount : 0
    if (existingOtp) {
        await queries.updatePasswordResetOtp(db, email, {
            otpHash,
            expiresAt,
            requestCount,
            requestDay: today,
            attemptCount: preservedAttempts,
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
    const email = normalizeEmail(payload?.email)
    const otp = (payload?.otp ?? '').trim()
    if (!email || !otp) {
        return jsonError(c, 'Email and OTP required', 400)
    }
    const pepper = (c.env.AUTH_SALT ?? '').trim()
    if (!pepper) {
        return jsonError(c, 'Server misconfigured', 500)
    }
    const db = getDb(c.env)
    const storedOtp = await queries.getPasswordResetOtp(db, email)
    if (!storedOtp) {
        return jsonError(c, 'No OTP found. Please request a new one', 400)
    }
    const exp = new Date(storedOtp.expiresAt).getTime()
    if (!Number.isFinite(exp) || Date.now() > exp) {
        await queries.deletePasswordResetOtp(db, email)
        return jsonError(c, 'OTP has expired. Please request a new one.', 410)
    }
    const candidateHash = await hashOtp(email, otp, pepper)
    const consumed = await queries.consumePasswordResetOtp(db, email, candidateHash)
    if (!consumed) {
        const legacyOk = await verifyOtpHash(email, otp, storedOtp.otpHash, pepper)
        if (!legacyOk) {
            const newAttemptCount = storedOtp.attemptCount + 1
            if (newAttemptCount >= 10) {
                await queries.deletePasswordResetOtp(db, email)
                return jsonError(c, 'Too many incorrect OTP attempts. Please request a new OTP.', 429)
            }
            await queries.updatePasswordResetOtpAttempts(db, email, newAttemptCount)
            return jsonError(c, `Invalid OTP. ${10 - newAttemptCount} attempts remaining.`, 401)
        }
        await queries.deletePasswordResetOtp(db, email)
    }
    let user = await queries.getUserByEmail(db, email)
    const isNewUser = !user
    if (!user) {
        try {
            user = await queries.createUser(db, { email, username: email })
        } catch {
            user = await queries.getUserByEmail(db, email)
            if (!user) return jsonError(c, 'Failed to create account', 500)
        }
    }
    const authToken = generateAuthToken()
    const hashed = await hashSessionToken(authToken, pepper)
    await queries.createSession(db, email, hashed, new Date(Date.now() + SESSION_TTL_MS).toISOString())
    setAuthCookies(c, email, authToken, SESSION_TTL_S)
    return jsonOk(c, { email, isNewUser }, isNewUser ? 'Account created. Welcome to Exun 2026.' : 'Login successful. Welcome back.')
}

