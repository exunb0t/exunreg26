import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'


export async function getUserSummary(c: AppContext) {

    const db = getDb(c.env)

    const email = getEmailFromCookie(c)

    if (!email) {
        return jsonError(
            c,
            'Authentication required',
            401
        )
    }


    const user = await queries.getUserByEmail(
        db,
        email
    )


    if (!user) {
        return jsonError(
            c,
            'User not found',
            404
        )
    }


    const registrations =
        await queries.getAllIndividualRegistrationsByUser(
            db,
            user.id
        )


    return jsonOk(
        c,
        {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullname: user.fullname,
                schoolCode: user.schoolCode,
                institutionName: user.institutionName,
            },

            registrations
        },
        'User summary fetched'
    )
}