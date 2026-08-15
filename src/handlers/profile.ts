import type { AppContext } from '../types'
import { notImplemented } from './_stub'

import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'
import { jsonOk, jsonError } from '../lib/response'



// Update Profile by verifying the user and updating the profile fields in the database
export async function updateProfile(c: AppContext) {
    
    const payload = await c.req
        .json<{
            fullname?: string
            phoneNumber?: string
            schoolCode?: string
            principalsEmail?: string
            institutionName?: string
            address?: string
            principalsName?: string
        }>()
        .catch(() => null)

    if (!payload) {
        return jsonError(c, 'Invalid JSON body', 400)
    }

    const email = getEmailFromCookie(c)
    const db = getDb(c.env)

    const user = await queries.getUserByEmail(db, email)

    if (!user) {
        return jsonError(c, 'User not found', 404)
    }

    const updates: Record<string, string> = {}

    if (payload.fullname !== undefined) {
        updates.fullname = payload.fullname
    }

    if (payload.phoneNumber !== undefined) {
        updates.phoneNumber = payload.phoneNumber
    }

    if (payload.schoolCode !== undefined) {
        updates.schoolCode = payload.schoolCode
    }

    if (payload.principalsEmail !== undefined) {
        updates.principalsEmail = payload.principalsEmail
    }

    if (payload.institutionName !== undefined) {
        updates.institutionName = payload.institutionName
    }

    if (payload.address !== undefined) {
        updates.address = payload.address
    }

    if (payload.principalsName !== undefined) {
        updates.principalsName = payload.principalsName
    }

    if (Object.keys(updates).length === 0) {
        return jsonError(c, 'No profile fields provided', 400)
    }

    const updatedUser = await queries.updateUser(db, email, updates)

    if (!updatedUser) {
        return jsonError(c, 'Failed to update profile', 500)
    }

    return jsonOk(c, updatedUser, 'Profile updated successfully')
}