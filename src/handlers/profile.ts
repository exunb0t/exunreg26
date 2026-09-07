import { getDb } from '../db/client'
import { jsonError, jsonOk } from '../lib/response'
import { getEmailFromCookie } from '../middleware/auth'
import * as queries from '../db/queries'
import type { AppContext } from '../types'
import { newPasswordHash } from '../lib/crypto'

interface UpdateProfileBody {
    username?: string
    password?: string
    schoolCode?: string
    fullname?: string
    phoneNumber?: string
    principalsEmail?: string
    individual?: boolean
    institutionName?: string
    address?: string
    principalsName?: string
}

const emailRegex = /^[^@]+@[a-zA-Z]+\.[a-zA-Z]{2,}$/

export async function updateProfile(c: AppContext) {
    const email = getEmailFromCookie(c)
    const pl = await c.req.json<UpdateProfileBody>().catch(() => null)
    if (!pl) return jsonError(c, `Invalid request body`, 400)

    const db = getDb(c.env)
    const user = await queries.getUserByEmail(db, email)
    if (!user) return jsonError(c, 'User not found', 404)

    const patch: Record<string, unknown> = {}

    if (pl.fullname !== undefined) patch.fullname = pl.fullname.trim().toUpperCase()
    if (pl.phoneNumber !== undefined) patch.phoneNumber = pl.phoneNumber.trim()
    if (pl.schoolCode !== undefined) patch.schoolCode = pl.schoolCode.trim()
    if (pl.institutionName !== undefined) patch.institutionName = pl.institutionName.trim().toUpperCase()
    if (pl.principalsName !== undefined) patch.principalsName = pl.principalsName.trim().toUpperCase()
    if (pl.address !== undefined) patch.address = pl.address.trim().toUpperCase()

    if (pl.username !== undefined) {
        const username = pl.username.trim()
        if (!username) return jsonError(c, 'Username cannot be empty', 400)
        if (username !== user.username) {
            const taken = await queries.getUserByUsername(db, username)
            if (taken) return jsonError(c, 'Username is already taken', 409)
            patch.username = username
        }
    }

    if (pl.password !== undefined) {
        if (pl.password.length < 8) return jsonError(c, 'Password must be at least 8 characters', 400)
        patch.passwordHash = await newPasswordHash(pl.password)
    }

    if (pl.principalsEmail !== undefined) {
        const principalsEmail = pl.principalsEmail.trim()
        if (principalsEmail && !emailRegex.test(principalsEmail)) {
            return jsonError(c, 'Invalid principals email', 400)
        }
        patch.principalsEmail = principalsEmail
    }

    if (pl.individual !== undefined) {
        const wsIndi = user.individual
        patch.individual = pl.individual
        if (pl.individual && !wsIndi) {
            await queries.deleteIndividualRegistrationsByUser(db, user.id)
            await queries.createIndividualRegistration(db, {
                userId: user.id,
                fullname: (pl.fullname ?? user.fullname) || '',
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
