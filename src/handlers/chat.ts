import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'
import { retrieveContext, buildContextBlock } from '../lib/rag'
import { getChatCompletion, type ChatMessage } from '../lib/llm'
import { openTicket } from '../lib/tickets'

const MAX_MESSAGES_PER_CONVERSATION = 40
const CONTEXT_MESSAGE_WINDOW = 12
const MAX_MESSAGE_LENGTH = 4000
const ESCALATE_MARKER = '[[ESCALATE]]'

function buildSystemPrompt(contextBlock: string): string {
    return `You are the support assistant for the Exun 2026 registration platform. Answer questions using ONLY the context below, which comes from the official event documentation. Be concise and friendly.

If the context does not contain enough information to answer confidently, say so honestly and end your reply on a new line with the exact text ${ESCALATE_MARKER}, so it can be forwarded to a human admin.

Context:
${contextBlock}`
}

export async function createConversation(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)

    const user = await queries.getUserByEmail(db, email)
    if (!user) return jsonError(c, 'User not found', 404)

    const conversation = await queries.createConversation(db, {
        id: crypto.randomUUID(),
        userId: user.id,
        email,
        title: 'New conversation',
        status: 'active',
        messageCount: 0,
    })

    return jsonOk(c, conversation, 'Conversation created')
}

export async function listConversations(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)

    const user = await queries.getUserByEmail(db, email)
    if (!user) return jsonError(c, 'User not found', 404)

    const list = await queries.getConversationsByUser(db, user.id)
    return jsonOk(c, list, 'Conversations retrieved')
}

export async function getConversation(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)
    const id = c.req.param('id')
    if (!id) return jsonError(c, 'Conversation id required', 400)

    const conversation = await queries.getConversationById(db, id)
    if (!conversation || conversation.email !== email) {
        return jsonError(c, 'Conversation not found', 404)
    }

    const messages = await queries.getMessagesByConversation(db, id)
    return jsonOk(c, { conversation, messages }, 'Conversation retrieved')
}

export async function deleteConversation(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)
    const id = c.req.param('id')
    if (!id) return jsonError(c, 'Conversation id required', 400)

    const conversation = await queries.getConversationById(db, id)
    if (!conversation || conversation.email !== email) {
        return jsonError(c, 'Conversation not found', 404)
    }

    await queries.deleteConversation(db, id)
    return jsonOk(c, null, 'Conversation deleted')
}

export async function sendMessage(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)
    const id = c.req.param('id')
    if (!id) return jsonError(c, 'Conversation id required', 400)

    const conversation = await queries.getConversationById(db, id)
    if (!conversation || conversation.email !== email) {
        return jsonError(c, 'Conversation not found', 404)
    }

    if (conversation.status === 'full') {
        return jsonError(c, 'This conversation has reached its message limit. Please start a new conversation.', 409)
    }

    const payload = await c.req.json<{ message?: string }>().catch(() => null)
    const userMessage = payload?.message?.trim()

    if (!userMessage) {
        return jsonError(c, 'Message required', 400)
    }

    if (userMessage.length > MAX_MESSAGE_LENGTH) {
        return jsonError(c, 'Message is too long', 400)
    }

    await queries.createChatMessage(db, { conversationId: id, role: 'user', content: userMessage })

    const { matches, lowConfidence } = await retrieveContext(c.env, userMessage)
    const contextBlock = buildContextBlock(matches)

    const history = await queries.getRecentMessages(db, id, CONTEXT_MESSAGE_WINDOW)
    const chatMessages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(contextBlock) },
        ...history
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    let reply: string
    try {
        reply = await getChatCompletion(c.env, chatMessages)
    } catch {
        return jsonError(c, 'The chat assistant is temporarily unavailable. Please try again shortly.', 502)
    }

    const shouldEscalate = lowConfidence || reply.includes(ESCALATE_MARKER)
    const cleanReply = reply.replace(ESCALATE_MARKER, '').trim()

    await queries.createChatMessage(db, { conversationId: id, role: 'assistant', content: cleanReply })

    const newMessageCount = conversation.messageCount + 2
    const nextStatus = newMessageCount >= MAX_MESSAGES_PER_CONVERSATION ? 'full' : 'active'

    await queries.updateConversation(db, id, {
        messageCount: newMessageCount,
        status: nextStatus,
        ...(conversation.messageCount === 0 ? { title: userMessage.slice(0, 60) } : {}),
    })

    let ticketId: number | undefined

    if (shouldEscalate) {
        const existingTicket = await queries.getOpenTicketByConversation(db, id)

        if (!existingTicket) {
            const ticket = await openTicket(db, c.env, {
                conversationId: id,
                userEmail: email,
                subject: `Chatbot escalation: ${userMessage.slice(0, 80)}`,
                message: `User question:\n${userMessage}\n\nAssistant reply:\n${cleanReply}`,
                createdBy: 'ai',
            })

            ticketId = ticket.id

            await queries.createChatMessage(db, {
                conversationId: id,
                role: 'system',
                content: 'This question has been forwarded to a human admin. You will be notified here and by email once they respond.',
            })
        } else {
            ticketId = existingTicket.id
        }
    }

    return jsonOk(
        c,
        {
            reply: cleanReply,
            escalated: shouldEscalate,
            ticketId,
            conversationStatus: nextStatus,
        },
        'Message sent'
    )
}

export async function escalateConversation(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)
    const id = c.req.param('id')
    if (!id) return jsonError(c, 'Conversation id required', 400)

    const conversation = await queries.getConversationById(db, id)
    if (!conversation || conversation.email !== email) {
        return jsonError(c, 'Conversation not found', 404)
    }

    const existingTicket = await queries.getOpenTicketByConversation(db, id)
    if (existingTicket) {
        return jsonOk(c, { ticketId: existingTicket.id }, 'A ticket is already open for this conversation')
    }

    const payload = await c.req.json<{ message?: string }>().catch(() => null)
    const messages = await queries.getMessagesByConversation(db, id)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? 'No message provided'
    const ticketMessage = payload?.message?.trim() || lastUserMessage

    const ticket = await openTicket(db, c.env, {
        conversationId: id,
        userEmail: email,
        subject: `Help request: ${ticketMessage.slice(0, 80)}`,
        message: ticketMessage,
        createdBy: 'user',
    })

    await queries.createChatMessage(db, {
        conversationId: id,
        role: 'system',
        content: 'A human admin has been notified and will follow up here and by email.',
    })

    return jsonOk(c, { ticketId: ticket.id }, 'Ticket created')
}
