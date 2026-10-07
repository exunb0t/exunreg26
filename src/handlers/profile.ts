import { getDb } from '../db/client'
import { jsonError, jsonOk } from '../lib/response'
import { getEmailFromCookie } from '../middleware/auth'
import * as queries from '../db/queries'
import type { AppContext } from '../types'
import { newPasswordHash, hashSessionToken } from '../lib/crypto'
import { individualRegistrations } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getAuthTokenCookie } from '../lib/cookies'
import { ADDRESS_MAX, NAME_MAX, SCHOOL_MAX, truncate, isValidEmail, isValidPhone, normalizeEmail } from '../lib/validation'

export async function updateProfile(c: AppContext) {
    const email = getEmailFromCookie(c)
    const pl = await c.req.json<Record<string, unknown>>().catch(() => null)
    if (!pl) return jsonError(c, `Invalid request body`, 400)

    const db = getDb(c.env)
    const user = await queries.getUserByEmail(db, email)
    if (!user) return jsonError(c, 'User not found', 404)

    const patch: Record<string, unknown> = {}

    if (pl.fullname !== undefined) {
        const v = truncate(String(pl.fullname ?? ''), NAME_MAX)
        if (!v) return jsonError(c, 'Fullname cannot be empty', 400)
        patch.fullname = v.toUpperCase()
    }
    if (pl.phoneNumber !== undefined) {
        const v = String(pl.phoneNumber ?? '').trim()
        if (v && !isValidPhone(v)) return jsonError(c, 'Invalid phone number', 400)
        if (v.length > 32) return jsonError(c, 'Phone number too long', 400)
        patch.phoneNumber = v
    }
    if (pl.schoolCode !== undefined) patch.schoolCode = truncate(String(pl.schoolCode ?? ''), SCHOOL_MAX)
    if (pl.institutionName !== undefined) patch.institutionName = truncate(String(pl.institutionName ?? ''), SCHOOL_MAX).toUpperCase()
    if (pl.principalsName !== undefined) patch.principalsName = truncate(String(pl.principalsName ?? ''), NAME_MAX).toUpperCase()
    if (pl.address !== undefined) patch.address = truncate(String(pl.address ?? ''), ADDRESS_MAX).toUpperCase()

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
        const currentToken = getAuthTokenCookie(c)
        if (currentToken) {
            c.executionCtx.waitUntil(
                queries.deleteSessionsByEmailExcept(db, email, await hashSessionToken(currentToken, pepper)).catch(() => null)
            )
        } else {
            c.executionCtx.waitUntil(queries.deleteSessionsByEmail(db, email).catch(() => null))
        }
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
            await db.batch([
                db.delete(individualRegistrations).where(eq(individualRegistrations.userId, user.id)),
                db.insert(individualRegistrations).values({
                    userId: user.id,
                    fullname: truncate(String(pl.fullname ?? user.fullname ?? ''), NAME_MAX) || '',
                    userEmail: email,
                }),
            ])
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
