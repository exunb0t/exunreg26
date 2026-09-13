import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'
import { sendEmail } from '../lib/sendemail'
import { ticketDisplayId } from '../lib/tickets'
import { renderTicketAdminEmail, renderTicketUserEmail } from '../lib/ticketEmail'

export const TICKET_CATEGORIES = [
    'Registration',
    'Events & Schedule',
    'Account & Login',
    'Technical Issue',
    'Other',
]

const PRIORITIES = ['low', 'medium', 'high']

export async function nextTicket(c: AppContext) {
    const db = getDb(c.env)
    const maxId = await queries.getMaxTicketId(db)
    return jsonOk(c, { displayId: ticketDisplayId(maxId + 1) }, 'Next ticket id')
}

export async function createTicket(c: AppContext) {
    const db = getDb(c.env)
    const email = getEmailFromCookie(c)
    if (!email) return jsonError(c, 'Authentication required', 401)

    let form: FormData
    try {
        form = await c.req.formData()
    } catch {
        return jsonError(c, 'Invalid form submission', 400)
    }

    const subject = String(form.get('subject') ?? '').trim()
    const category = String(form.get('category') ?? '').trim()
    const priority = String(form.get('priority') ?? '').trim().toLowerCase()
    const message = String(form.get('message') ?? '').trim()

    if (!subject) return jsonError(c, 'Subject is required', 400)
    if (subject.length > 200) return jsonError(c, 'Subject is too long', 400)
    if (!TICKET_CATEGORIES.includes(category)) return jsonError(c, 'Please choose a category', 400)
    if (!PRIORITIES.includes(priority)) return jsonError(c, 'Please choose a priority', 400)
    if (!message) return jsonError(c, 'Description is required', 400)
    if (message.length > 2000) return jsonError(c, 'Description is too long (max 2000 characters)', 400)

    const rawFiles = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
    if (rawFiles.length > 0) return jsonError(c, 'File attachments are no longer accepted', 400)
    const attachments: { key: string; name: string; size: number; type: string; fileId: string }[] = []

    const ticket = await queries.createTicket(db, {
        conversationId: null,
        userEmail: email,
        subject,
        message,
        category,
        priority,
        attachments: JSON.stringify(attachments),
        createdBy: 'user',
        status: 'open',
    })

    const displayId = ticketDisplayId(ticket.id)
    const mailData = {
        displayId,
        email,
        subject,
        category,
        priority,
        message,
    }

    if (c.env.TICKET_NOTIFY_EMAIL) {
        const baseUrl = (c.env.PUBLIC_URL ?? '').replace(/\/$/, '')
        const adminUrl = baseUrl ? `${baseUrl}/admin#ticket-${ticket.id}` : undefined
        c.executionCtx.waitUntil(
            (async () => {
                try {
                    await sendEmail(
                        c.env.TICKET_NOTIFY_EMAIL,
                        `New support ticket ${displayId}: ${subject}`,
                        `From: ${email}\nCategory: ${category}\nPriority: ${priority}\n\n${message}${adminUrl ? `\n\nReply: ${adminUrl}` : ''}`,
                        c.env,
                        renderTicketAdminEmail(mailData, adminUrl)
                    )
                } catch (err: any) {
                    await queries.createLog(db, 'ticket-notify-email-failed', `ticket ${ticket.id}: ${err.message ?? 'unknown error'}`)
                }
            })().catch(() => null)
        )
    }

    c.executionCtx.waitUntil(
        (async () => {
            try {
                await sendEmail(
                    email,
                    `Ticket received ${displayId}: ${subject}`,
                    `Hi,\n\nThanks for reaching out. Our team will get back to you by email shortly.\n\nTicket: ${displayId}\nSubject: ${subject}\nCategory: ${category}\nPriority: ${priority}\n\n${message}\n\n-- Exun Clan`,
                    c.env,
                    renderTicketUserEmail(mailData)
                )
            } catch (err: any) {
                await queries.createLog(db, 'ticket-user-email-failed', `ticket ${ticket.id}: ${err.message ?? 'unknown error'}`)
            }
        })().catch(() => null)
    )

    return jsonOk(
        c,
        {
            id: ticket.id,
            displayId,
            subject: ticket.subject,
            category: ticket.category,
            priority: ticket.priority,
            createdAt: ticket.createdAt,
        },
        'Ticket submitted'
    )
}
