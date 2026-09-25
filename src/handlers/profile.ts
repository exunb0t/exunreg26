import { getDb } from '../db/client'
import { jsonError, jsonOk } from '../lib/response'
import { getEmailFromCookie } from '../middleware/auth'
import * as queries from '../db/queries'
import type { AppContext } from '../types'
import { newPasswordHash } from '../lib/crypto'
import { ADDRESS_MAX, CLASS_MAX, NAME_MAX, PHONE_REGEX, SCHOOL_MAX, TEAM_MAX, capLength, isValidEmail, isValidPhone, normalizeEmail } from '../lib/validation'

export async function updateProfile(c: AppContext) {
    const email = getEmailFromCookie(c)
    const pl = await c.req.json<Record<string, unknown>>().catch(() => null)
    if (!pl) return jsonError(c, `Invalid request body`, 400)

    const db = getDb(c.env)
    const user = await queries.getUserByEmail(db, email)
    if (!user) return jsonError(c, 'User not found', 404)

    const patch: Record<string, unknown> = {}

    if (pl.fullname !== undefined) {
        const v = capLength(String(pl.fullname ?? ''), NAME_MAX)
        if (!v) return jsonError(c, 'Fullname cannot be empty', 400)
        patch.fullname = v.toUpperCase()
    }
    if (pl.phoneNumber !== undefined) {
        const v = String(pl.phoneNumber ?? '').trim()
        if (v && !isValidPhone(v)) return jsonError(c, 'Invalid phone number', 400)
        if (v.length > 32) return jsonError(c, 'Phone number too long', 400)
        patch.phoneNumber = v
    }
    if (pl.schoolCode !== undefined) patch.schoolCode = capLength(String(pl.schoolCode ?? ''), SCHOOL_MAX)
    if (pl.institutionName !== undefined) patch.institutionName = capLength(String(pl.institutionName ?? ''), SCHOOL_MAX).toUpperCase()
    if (pl.principalsName !== undefined) patch.principalsName = capLength(String(pl.principalsName ?? ''), NAME_MAX).toUpperCase()
    if (pl.address !== undefined) patch.address = capLength(String(pl.address ?? ''), ADDRESS_MAX).toUpperCase()

    if (pl.username !== undefined) {
        const username = String(pl.username ?? '').trim()
        if (!username) return jsonError(c, 'Username cannot be empty', 400)
        if (username.length > NAME_MAX) return jsonError(c, 'Username too long', 400)
        if (username !== user.username) {
            const taken = await queries.getUserByUsername(db, username)
            if (taken) return jsonError(c, 'Username is already taken', 409)
            patch.username = username
        }
    }

    if (pl.password !== undefined) {
        const pw = String(pl.password ?? '')
        if (pw.length < 8) return jsonError(c, 'Password must be at least 8 characters', 400)
        if (pw.length > 200) return jsonError(c, 'Password too long', 400)
        const pepper = (c.env.AUTH_SALT ?? '').trim()
        if (!pepper) return jsonError(c, 'Server misconfigured', 500)
        patch.passwordHash = await newPasswordHash(pw, pepper)
    }

    if (pl.principalsEmail !== undefined) {
        const principalsEmail = normalizeEmail(String(pl.principalsEmail ?? ''))
        if (principalsEmail && !isValidEmail(principalsEmail)) {
            return jsonError(c, 'Invalid principals email', 400)
        }
        patch.principalsEmail = principalsEmail
    }

    if (pl.individual !== undefined) {
        const wsIndi = user.individual
        patch.individual = Boolean(pl.individual)
        if (pl.individual && !wsIndi) {
            await queries.deleteIndividualRegistrationsByUser(db, user.id)
            await queries.createIndividualRegistration(db, {
                userId: user.id,
                fullname: capLength(String(pl.fullname ?? user.fullname ?? ''), NAME_MAX) || '',
                userEmail: email,
            })
            patch.institutionName = ""
            patch.schoolCode = ""
            patch.principalsName = ""
            patch.principalsEmail = ""
        } else if (!pl.individual && wsIndi) {
            await queries.deleteIndividualRegistrationsByUser(db, user.id)
        }
    }

    if (Object.keys(patch).length === 0) {
        return jsonError(c, 'No profile fields provided', 400)
    }

    const updated = await queries.updateUser(db, email, patch)
    if (!updated) return jsonError(c, 'Failed to update profile', 500)

    const { passwordHash: _removed, ...safeUser } = updated
    return jsonOk(c, safeUser, "Profile update successfully")
}
