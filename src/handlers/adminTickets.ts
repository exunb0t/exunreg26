import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'
import { sendEmail } from '../lib/sendemail'
import { parseLimit } from '../lib/paging'
import { ticketDisplayId } from '../lib/tickets'
import { renderReplyThreadEmail, renderReplyThreadText } from '../lib/ticketEmail'

export async function listTickets(c: AppContext) {
    const db = getDb(c.env)
    const status = c.req.query('status')

    if (status && !['open', 'answered', 'closed'].includes(status)) {
        return jsonError(c, 'Valid status required (open, answered, closed)', 400)
    }

    const tickets = await queries.getAllTickets(db, status || undefined, parseLimit(c, 100, 1000))

    return jsonOk(c, tickets, 'Tickets retrieved')
}

export async function getTicket(c: AppContext) {
    const db = getDb(c.env)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return jsonError(c, 'Valid ticket ID required', 400)

    const ticket = await queries.getTicketById(db, id)
    if (!ticket) return jsonError(c, 'Ticket not found', 404)

    const messages = ticket.conversationId
        ? await queries.getMessagesByConversation(db, ticket.conversationId, 1000)
        : []

    const replies = await queries.getTicketReplies(db, id)

    return jsonOk(c, { ticket, messages, replies }, 'Ticket retrieved')
}

export async function replyTicket(c: AppContext) {
    const db = getDb(c.env)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return jsonError(c, 'Valid ticket ID required', 400)
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

    await queries.createTicketReply(db, {
        ticketId: id,
        message,
        repliedBy: adminEmail,
    })

    const replies = await queries.getTicketReplies(db, id)

    if (ticket.conversationId) {
        await queries.createChatMessage(db, {
            conversationId: ticket.conversationId,
            role: 'admin',
            content: message,
        })
    }

    const displayId = ticketDisplayId(ticket.id)
    const baseUrl = (c.env.PUBLIC_URL ?? '').replace(/\/$/, '')
    const threadUrl = baseUrl ? `${baseUrl}/query#tickets-section` : undefined
    const mailData = {
        displayId,
        email: ticket.userEmail,
        subject: ticket.subject,
        category: ticket.category ?? 'Other',
        priority: ticket.priority ?? 'medium',
        message: ticket.message,
    }
    c.executionCtx.waitUntil(
        (async () => {
            try {
                await sendEmail(
                    ticket.userEmail,
                    `Re: ${ticket.subject}`,
                    renderReplyThreadText(mailData, replies),
                    c.env,
                    renderReplyThreadEmail(mailData, replies, threadUrl)
                )
            } catch (err: any) {
                await queries.createLog(db, 'ticket-reply-email-failed', `ticket ${ticket.id}: ${err.message ?? 'unknown error'}`)
            }
        })().catch(() => null)
    )

    return jsonOk(c, { ...updated, replies }, 'Reply sent')
}

export async function updateTicketStatus(c: AppContext) {
    const db = getDb(c.env)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return jsonError(c, 'Valid ticket ID required', 400)

    const payload = await c.req.json<{ status?: string }>().catch(() => null)
    if (!payload?.status || !['open', 'answered', 'closed'].includes(payload.status)) {
        return jsonError(c, 'Valid status required (open, answered, closed)', 400)
    }

    const ticket = await queries.getTicketById(db, id)
    if (!ticket) return jsonError(c, 'Ticket not found', 404)

    const updated = await queries.updateTicket(db, id, { status: payload.status })

    return jsonOk(c, updated, 'Ticket updated')
}
