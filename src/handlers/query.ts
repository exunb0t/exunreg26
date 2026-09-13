import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'
import { openTicket } from '../lib/tickets'
import { parseLimit } from '../lib/paging'


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


    const ticket = await openTicket(
        db,
        c.env,
        {
            conversationId: null,
            userEmail: email,
            subject: payload.subject,
            message: payload.message,
            createdBy: 'user',
        },
        (promise) => c.executionCtx.waitUntil(promise)
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


export async function listMyTickets(c: AppContext) {

    const db = getDb(c.env)

    const email = getEmailFromCookie(c)

    if (!email) {
        return jsonError(
            c,
            'Authentication required',
            401
        )
    }


    const list = await queries.getTicketsByUserEmail(
        db,
        email,
        parseLimit(c, 50, 200)
    )

    const withReplies = await Promise.all(
        list.map(async (t) => ({
            ...t,
            replies: await queries.getTicketReplies(db, t.id),
        }))
    )


    return jsonOk(
        c,
        withReplies,
        'Tickets retrieved'
    )
}
