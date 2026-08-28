import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'
import { sendEmail } from '../lib/sendemail'

export async function listTickets(c: AppContext) {
    const db = getDb(c.env)
    const status = c.req.query('status')

    const tickets = await queries.getAllTickets(db, status || undefined)

    return jsonOk(c, tickets, 'Tickets retrieved')
}

export async function getTicket(c: AppContext) {
    const db = getDb(c.env)
    const id = Number(c.req.param('id'))

    const ticket = await queries.getTicketById(db, id)
    if (!ticket) return jsonError(c, 'Ticket not found', 404)

    const messages = ticket.conversationId
        ? await queries.getMessagesByConversation(db, ticket.conversationId)
        : []

    return jsonOk(c, { ticket, messages }, 'Ticket retrieved')
}

export async function replyTicket(c: AppContext) {
    const db = getDb(c.env)
    const id = Number(c.req.param('id'))
    const adminEmail = getEmailFromCookie(c)

    const ticket = await queries.getTicketById(db, id)
    if (!ticket) return jsonError(c, 'Ticket not found', 404)

    const payload = await c.req.json<{ message?: string }>().catch(() => null)
    const message = payload?.message?.trim()

    if (!message) return jsonError(c, 'Reply message required', 400)

    const updated = await queries.updateTicket(db, id, {
        adminReply: message,
        repliedBy: adminEmail,
        repliedAt: new Date().toISOString(),
        status: 'answered',
    })

    if (ticket.conversationId) {
        await queries.createChatMessage(db, {
            conversationId: ticket.conversationId,
            role: 'admin',
            content: message,
        })
    }

    await sendEmail(
        ticket.userEmail,
        `Re: ${ticket.subject}`,
        `${message}\n\n---\nThis is a reply to your support ticket #${ticket.id} on the Exun 2026 registration platform.`,
        c.env
    )

    return jsonOk(c, updated, 'Reply sent')
}

export async function updateTicketStatus(c: AppContext) {
    const db = getDb(c.env)
    const id = Number(c.req.param('id'))

    const payload = await c.req.json<{ status?: string }>().catch(() => null)
    if (!payload?.status || !['open', 'answered', 'closed'].includes(payload.status)) {
        return jsonError(c, 'Valid status required (open, answered, closed)', 400)
    }

    const ticket = await queries.getTicketById(db, id)
    if (!ticket) return jsonError(c, 'Ticket not found', 404)

    const updated = await queries.updateTicket(db, id, { status: payload.status })

    return jsonOk(c, updated, 'Ticket updated')
}
