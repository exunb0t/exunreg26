import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { deleteCookie } from 'hono/cookie'
import { notImplemented } from './_stub'

import { getDb } from '../db/client'
import * as queries from '../db/queries'

// Getting passwords hehe
import { hashPassword, sha256Hex  } from '../lib/crypto'
import { getEmailFromCookie } from '../middleware/auth'
import { sendEmail } from '../lib/sendemail'

// OTP FOR PASSWORD RESET

export async function sendOTP(c: AppContext) {
    const payload = await c.req
        .json<{ email?: string }>()
        .catch(() => null)

    if (!payload?.email) {
        return jsonError(c, 'Email required', 400)
    }

    const db = getDb(c.env)

    const user = await queries.getUserByEmail(db, payload.email)

    if (!user) {
        return jsonError(c, 'User not found', 404)
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString() // To string cause otp isnt math.

    const otpHash = await sha256Hex(otp)

    const expiresAt = new Date(
        Date.now() + 10 * 60 * 1000 // OTP IS VALID FOR 10 MINUTES
    ).toISOString()  

    await queries.deletePasswordResetOtp(db, payload.email)

    await queries.createPasswordResetOtp(db, {
        email: payload.email,
        otpHash,
        expiresAt,
    })
     
    // Local OTP TESTING REMOVE WHEN DEPLYOED
    console.log("OTP:", otp)
    

    // Main Version of OTP Mailing-
    await sendEmail(
    payload.email,
    "Exun Password Reset OTP",
    `Your OTP is ${otp}`,
    c.env
)

    return jsonOk(c, null, 'OTP sent successfully')
}


// Log Out user by deleting the auth_token and email cookies cause apparently thats how u log out someone didnt know that before

export async function logout(c: AppContext) {
    deleteCookie(c, 'email')
    deleteCookie(c, 'auth_token')

    return jsonOk(c, { email: getEmailFromCookie(c) }, 'Logged out')
}


// Changing Password by verifying the old password from DB and updating the new password in the database


  export async function changePassword(c: AppContext) {
    const payload = await c.req
        .json<{ oldPassword?: string; newPassword?: string }>()
        .catch(() => null)

    if (!payload?.oldPassword || !payload?.newPassword) {
        return jsonError(c, 'Old password and new password required', 400)
    }

    const email = getEmailFromCookie(c)
    const db = getDb(c.env)

    const user = await queries.getUserByEmail(db, email)

    if (!user) {
        return jsonError(c, 'User not found', 404)
    }

    const salt = c.env.AUTH_SALT || ''

    const oldPasswordHash = await hashPassword(payload.oldPassword, salt)

    if (oldPasswordHash !== user.passwordHash) {
        return jsonError(c, 'Current password is incorrect', 401)
    }

    const newPasswordHash = await hashPassword(payload.newPassword, salt)

    await queries.updateUser(db, email, {
        passwordHash: newPasswordHash,
    })

    return jsonOk(c, null, 'Password changed successfully')
}




// Dumb user forgot ur password and now I have to do majdoori to fix it


export async function resetPassword(c: AppContext) {
    const payload = await c.req
        .json<{
            email?: string
            otp?: string
            newPassword?: string
        }>()
        .catch(() => null)

    if (!payload?.email || !payload?.otp || !payload?.newPassword) {
        return jsonError(c, 'Email, OTP and new password required', 400)
    }

    // OTP verification needs to be implemented here

    return notImplemented(c)
}
