import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { deleteCookie, setCookie } from 'hono/cookie'

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
    const payload = await c.req
        .json<{ email?: string }>()
        .catch(() => null)

    if (!payload?.email) {
        return jsonError(c, 'Email required', 400)
    }

    const db = getDb(c.env)

    const today = new Date().toISOString().slice(0, 10)

    const existingOtp = await queries.getPasswordResetOtp(
        db,
        payload.email
    )

    let requestCount = 1

    if (existingOtp?.requestDay === today) {
        requestCount = existingOtp.requestCount + 1
    }

    if (requestCount > 10) {
        return jsonError(
            c,
            'Daily OTP request limit reached. Try again tomorrow.',
            429
        )
    }

    // Check whether the account exists
    const user = await queries.getUserByEmail(db, payload.email)

    if (!user) {
        return jsonError(c, 'User not found', 404)
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(
        100000 + Math.random() * 900000
    ).toString()

    // Hash OTP before storing it
    const otpHash = await sha256Hex(otp)

    // OTP expires after 10 minutes
    const expiresAt = new Date(
        Date.now() + 10 * 60 * 1000
    ).toISOString()


    // Update existing OTP or create a new OTP
    if (existingOtp) {
        await queries.updatePasswordResetOtp(
            db,
            payload.email,
            {
                otpHash,
                expiresAt,
                requestCount,
                requestDay: today,
                attemptCount: 0,
            }
        )
    } else {
        await queries.createPasswordResetOtp(
            db,
            {
                email: payload.email,
                otpHash,
                expiresAt,
                requestCount,
                requestDay: today,
                attemptCount: 0,
            }
        )
    }


    // Testing only
    console.log('OTP:', otp)

    // Email sending can remain a placeholder for now
    await sendEmail(
        payload.email,
        'Exun Login OTP',
        `Your Exun login OTP is ${otp}`,
        c.env
    )

    return jsonOk(c, null, 'OTP sent successfully')
}



// Verify OTP and log in user

export async function verifyOTP(c: AppContext) {
    const payload = await c.req
        .json<{
            email?: string
            otp?: string
        }>()
        .catch(() => null)

    if (!payload?.email || !payload?.otp) {
        return jsonError(c, 'Email and OTP required', 400)
    }

    const db = getDb(c.env)

    // Make sure the account exists
    const user = await queries.getUserByEmail(db, payload.email)

    if (!user) {
        return jsonError(c, 'User not found', 404)
    }

    // Get the OTP stored for this email
    const storedOtp = await queries.getPasswordResetOtp(
        db,
        payload.email
    )

    if (!storedOtp) {
        return jsonError(c, 'No OTP found. Please request a new one', 400)
    }

    // Check expiration
    const expiresAt = new Date(
        storedOtp.expiresAt
    ).getTime()

    if (Date.now() > expiresAt) {
        await queries.deletePasswordResetOtp(
            db,
            payload.email
        )

        return jsonError(c, 'OTP has expired', 400)
    }


    // Hash the OTP entered by the user
    const otpHash = await sha256Hex(payload.otp)


    // Compare hashes so verify otp
    if (otpHash !== storedOtp.otpHash) {

        const newAttemptCount = storedOtp.attemptCount + 1

        if (newAttemptCount >= 10) {
            await queries.deletePasswordResetOtp(
                db,
                payload.email
            )

            return jsonError(
                c,
                'Too many incorrect OTP attempts. Please request a new OTP.',
                429
            )
        }

        await queries.updatePasswordResetOtpAttempts(
            db,
            payload.email,
            newAttemptCount
        )

        return jsonError(
            c,
            `Invalid OTP. ${10 - newAttemptCount} attempts remaining.`,
            401
        )
    }


    // OTP has now been used, so delete it
    await queries.deletePasswordResetOtp(
        db,
        payload.email
    )


    // Create a new random login token
    const authToken = generateAuthToken()


    await queries.createSession(
        db,
        payload.email,
        authToken,
        new Date(
            Date.now() + 24 * 60 * 60 * 1000
        ).toISOString()
    )


    // Store authentication cookies
    setCookie(c, 'email', payload.email, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 86400,
    })

setCookie(c, 'auth_token', authToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 86400,
    })


    return jsonOk(
        c,
        { email: payload.email },
        'Login successful'
    )
}