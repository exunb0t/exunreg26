import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'


export async function queryHandler(c: AppContext) {

    const db = getDb(c.env)

    const email = getEmailFromCookie(c)

    if (!email) {
        return jsonError(
            c,
            'Authentication required',
            401
        )
    }


    const payload = await c.req
        .json<{
            subject?: string
            message?: string
        }>()
        .catch(() => null)


    if (!payload?.subject || !payload?.message) {
        return jsonError(
            c,
            'Subject and message required',
            400
        )
    }


    const ticket = await queries.createQuery(
        db,
        {
            email,
            subject: payload.subject,
            message: payload.message,
            status: 'open',
        }
    )


    return jsonOk(
        c,
        {
            id: ticket.id,
            status: ticket.status,
        },
        'Query submitted successfully'
    )
}