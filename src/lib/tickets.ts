import type { Bindings } from '../types'
import type { Db } from '../db/client'
import * as queries from '../db/queries'
import type { TicketRow } from '../db/queries'
import { sendEmail } from './sendemail'

export async function openTicket(
    db: Db,
    env: Bindings,
    data: {
        conversationId: string | null
        userEmail: string
        subject: string
        message: string
        createdBy: 'user' | 'ai'
    }
): Promise<TicketRow> {
    const ticket = await queries.createTicket(db, {
        conversationId: data.conversationId,
        userEmail: data.userEmail,
        subject: data.subject,
        message: data.message,
        createdBy: data.createdBy,
        status: 'open',
    })

    if (env.TICKET_NOTIFY_EMAIL) {
        await sendEmail(
            env.TICKET_NOTIFY_EMAIL,
            `New support ticket #${ticket.id}: ${data.subject}`,
            `From: ${data.userEmail}\nOpened by: ${data.createdBy === 'ai' ? 'chatbot (low confidence answer)' : 'user request'}\n\n${data.message}`,
            env
        )
    }

    return ticket
}
