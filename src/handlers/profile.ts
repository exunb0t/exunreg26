import { getDb } from '../db/client'
import { jsonError, jsonOk } from '../lib/response'
import { getEmailFromCookie } from '../middleware/auth'
import * as queries from '../db/queries'
import type { AppContext } from '../types'
import { hashPassword } from '../lib/crypto'

interface UpdateProfileBody {
    id?: string
    username?: string
    email?: string
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

// Update Profile by verifying the user and updating the profile fields in the database
export async function updateProfile(c: AppContext) {
    const email = getEmailFromCookie(c)
    const pl = await c.req.json<UpdateProfileBody>().catch(() => null)
    if (!pl) return jsonError(c, `Invalid request body`, 400)

    const db = getDb(c.env)
    const user = await queries.getUserByEmail(db, email)
    if (!user) return jsonError(c, 'User not found', 404)

    const patch: Record<string, unknown> = {}

    if (pl.fullname !== undefined) patch.fullname = pl.fullname.trim().toUpperCase()
    if (pl.username !== undefined) patch.username = pl.username
    if (pl.password !== undefined) patch.passwordHash = await hashPassword(pl.password, c.env.AUTH_SALT || '')
    if (pl.phoneNumber !== undefined) patch.phoneNumber = pl.phoneNumber.trim()
    if (pl.institutionName !== undefined) patch.institutionName = pl.institutionName.trim().toUpperCase()
    if (pl.principalsEmail !== undefined) patch.principalsEmail = pl.principalsEmail.trim()
    if (pl.principalsName !== undefined) patch.principalsName = pl.principalsName.trim().toUpperCase()
    if (pl.address !== undefined) patch.address = pl.address.trim().toUpperCase()

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

    const updated = await queries.updateUser(db, email, patch)
    return jsonOk(c, updated, "Profile update successfully")

}
