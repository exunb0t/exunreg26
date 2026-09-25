import type { Bindings } from '../types'
import type { Db } from '../db/client'
import * as queries from '../db/queries'
import type { TicketRow } from '../db/queries'
import { sendEmail } from './sendemail'
import { sanitizeSubject, TICKET_MESSAGE_MAX, TICKET_SUBJECT_MAX } from './validation'

export function ticketDisplayId(id: number): string {
    return `#Ex-${1000 + id}`
}

export async function openTicket(
    db: Db,
    env: Bindings,
    data: {
        conversationId: string | null
        userEmail: string
        subject: string
        message: string
        createdBy: 'user' | 'ai'
    },
    waitUntil?: (promise: Promise<unknown>) => void
): Promise<TicketRow> {
    const subject = sanitizeSubject(data.subject).slice(0, TICKET_SUBJECT_MAX)
    const message = data.message.trim().slice(0, TICKET_MESSAGE_MAX)
    if (!subject || !message) throw new Error('Subject and message required')
    const ticket = await queries.createTicket(db, {
        conversationId: data.conversationId,
        userEmail: data.userEmail,
        subject,
        message,
        createdBy: data.createdBy,
        status: 'open',
    })

    if (env.TICKET_NOTIFY_EMAIL) {
        const notify = (async () => {
            try {
                await sendEmail(
                    env.TICKET_NOTIFY_EMAIL,
                    `New support ticket #${ticket.id}: ${subject}`,
                    `From: ${data.userEmail}\nOpened by: ${data.createdBy === 'ai' ? 'chatbot (low confidence answer)' : 'user request'}\n\n${message}`,
                    env
                )
            } catch (err: any) {
                await queries.createLog(db, 'ticket-notify-email-failed', `ticket ${ticket.id}: ${err.message ?? 'unknown error'}`)
            }
        })().catch(() => null)
        if (waitUntil) waitUntil(notify)
        else await notify
    }

    return ticket
}
