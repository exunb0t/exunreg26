import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { sql } from 'drizzle-orm'
import { getEmailFromCookie } from '../middleware/auth'
import { parseLimit } from '../lib/paging'
import { retrieveContext, buildContextBlock, buildRosterBlock } from '../lib/rag'
import systemPromptTemplate from '../prompts/system-prompt.md' with { type: 'text' }
import { getChatCompletion, streamChatCompletion, type ChatMessage } from '../lib/llm'
import { openTicket } from '../lib/tickets'
import { slugify } from '../lib/slug'
import type { EventRow } from '../db/queries'

const MAX_MESSAGES_PER_CONVERSATION = 40
const CONTEXT_MESSAGE_WINDOW = 12
const MAX_MESSAGE_LENGTH = 4000
const ESCALATE_MARKER = '[[ESCALATE]]'

interface Suggestion {
    label: string
    message?: string
    navigate?: string
    dest?: string
}

function findEvent(events: EventRow[], text: string): EventRow | undefined {
    const t = text.toLowerCase()
    const sorted = [...events].sort((a, b) => b.name.length - a.name.length)
    for (const ev of sorted) {
        if (t.includes(ev.name.toLowerCase())) return ev
    }
    for (const ev of sorted) {
        const slug = slugify(ev.name)
        if (slug && t.replace(/[^a-z0-9]+/g, '').includes(slug.replace(/-/g, ''))) return ev
    }
    return undefined
}

function destinationFor(text: string): { label: string; navigate: string; dest: string } | undefined {
    const t = text.toLowerCase()
    if (t.includes('event') && (t.includes('list') || t.includes('all') || t.includes('browse') || t.includes('page'))) return { label: 'Open events page', navigate: '/events', dest: 'events page' }
    if (t.includes('summary') || t.includes('registration') && (t.includes('status') || t.includes('my') || t.includes('view'))) return { label: 'Open registration summary', navigate: '/summary', dest: 'registration summary' }
    if (t.includes('profile') || t.includes('account') || t.includes('complete')) return { label: 'Open profile page', navigate: '/complete', dest: 'profile page' }
    if (t.includes('brochure') || t.includes('invite')) return { label: 'Open brochure', navigate: '/brochure', dest: 'brochure' }
    if (t.includes('ticket') || t.includes('support') || t.includes('query') || t.includes('queries') || t.includes('contact') || t.includes('human') || t.includes('help')) return { label: 'Create a support ticket', navigate: '/ticket', dest: 'support ticket page' }
    if (t.includes('home') || t.includes('main') || t.includes('landing')) return { label: 'Open home page', navigate: '/', dest: 'home page' }
    if (t.includes('login') || t.includes('sign in') || t.includes('log in')) return { label: 'Open login page', navigate: '/login', dest: 'login page' }
    return undefined
}

function buildSuggestions(events: EventRow[], userMessage: string, reply: string): Suggestion[] {
    const out: Suggestion[] = []
    const navIntent = /(take me to|open|go to|show me|navigate to|visit|bring me to)\b/i.test(userMessage)
    const ev = findEvent(events, userMessage) || findEvent(events, reply)
    if (ev) {
        const url = `/event/${slugify(ev.name)}?id=${encodeURIComponent(ev.id)}`
        if (navIntent) {
            out.push({ label: `Open ${ev.name}`, navigate: url, dest: `${ev.name} page` })
        } else {
            out.push({ label: `Take me to ${ev.name}`, navigate: url, dest: `${ev.name} page` })
        }
        out.push({ label: `How many participants in ${ev.name}?`, message: `How many participants are allowed in ${ev.name}?` })
        out.push(ev.independentRegistration
            ? { label: 'Which events allow individual registration?', message: 'Which events allow individual registration?' }
            : { label: 'Which events are team-only?', message: 'Which events are team-only?' })
        return out.slice(0, 3)
    }
    if (navIntent) {
        const dest = destinationFor(userMessage) || destinationFor(reply)
        if (dest) out.push(dest)
    }
    if (out.length === 0) {
        out.push(
            { label: 'What events can I register for?', message: 'What events can I register for?' },
            { label: 'How do I complete my profile?', message: 'How do I complete my profile?' },
            { label: 'Take me to the events page', navigate: '/events', dest: 'events page' }
        )
    } else {
        const fallback: Suggestion[] = [
            { label: 'What events can I register for?', message: 'What events can I register for?' },
            { label: 'Take me to the events page', navigate: '/events', dest: 'events page' },
        ]
        for (const f of fallback) {
            if (out.length >= 3) break
            if (!out.some((s) => s.navigate === f.navigate && s.message === f.message)) out.push(f)
        }
    }
    return out.slice(0, 3)
}

function buildSystemPrompt(contextBlock: string): string {
    return systemPromptTemplate
        .replaceAll('{{ESCALATE_MARKER}}', ESCALATE_MARKER)
        .replaceAll('{{CONTEXT}}', contextBlock)
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

    const list = await queries.getConversationsByUser(db, user.id, parseLimit(c, 50, 200))
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

    const messages = await queries.getMessagesByConversation(db, id, parseLimit(c, 200, 1000))
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

    const userMsg = await queries.createChatMessage(db, { conversationId: id, role: 'user', content: userMessage })

    const kbSources = await queries.getAllKbSources(db, 1000)
    const excludedSourceIds = kbSources.filter((s) => !s.enabled).map((s) => s.id)
    const { matches } = await retrieveContext(c.env, userMessage, excludedSourceIds)
    const events = await queries.getAllEvents(db, 1000).catch(() => [])
    const rosterBlock = buildRosterBlock(events)
    const contextBlock = [rosterBlock, matches.length > 0 ? buildContextBlock(matches) : ''].filter((b) => b.length > 0).join('\n\n---\n\n')

    const history = await queries.getRecentMessages(db, id, CONTEXT_MESSAGE_WINDOW)
    const chatMessages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(contextBlock) },
        ...history
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    if (c.req.query('stream') === '1') {
        return streamReply(c, db, id, conversation.messageCount, userMsg.id, userMessage, chatMessages)
    }

    let reply: string
    try {
        reply = await getChatCompletion(c.env, chatMessages)
    } catch {
        return jsonError(c, 'The chat assistant is temporarily unavailable. Please try again shortly.', 502)
    }

    const shouldEscalate = reply.includes(ESCALATE_MARKER)
    const cleanReply = reply.replace(ESCALATE_MARKER, '').trim()

    await queries.createChatMessage(db, { conversationId: id, role: 'assistant', content: cleanReply })

    const newMessageCount = conversation.messageCount + 2
    const nextStatus = newMessageCount >= MAX_MESSAGES_PER_CONVERSATION ? 'full' : 'active'

    await queries.updateConversation(db, id, {
        messageCount: sql`message_count + 2`,
        status: nextStatus,
        ...(conversation.messageCount === 0 ? { title: userMessage.slice(0, 60) } : {}),
    })

    let suggestEscalation = false
    if (shouldEscalate) {
        const existingTicket = await queries.getOpenTicketByConversation(db, id)
        suggestEscalation = !existingTicket
    }

    return jsonOk(
        c,
        {
            reply: cleanReply,
            messageId: userMsg.id,
            suggestEscalation,
            suggestions: buildSuggestions(events, userMessage, cleanReply),
            escalationSubject: `Chatbot escalation: ${userMessage.slice(0, 80)}`,
            conversationStatus: nextStatus,
        },
        'Message sent'
    )
}

async function streamReply(
    c: AppContext,
    db: ReturnType<typeof getDb>,
    id: string,
    messageCount: number,
    userMsgId: number,
    userMessage: string,
    chatMessages: ChatMessage[]
) {
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const send = (obj: unknown) => writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

    const pump = (async () => {
        try {
            const reply = await streamChatCompletion(c.env, chatMessages, (t) => {
                send({ t }).catch(() => null)
            })
            const shouldEscalate = reply.includes(ESCALATE_MARKER)
            const cleanReply = reply.replace(ESCALATE_MARKER, '').trim()
            await queries.createChatMessage(db, { conversationId: id, role: 'assistant', content: cleanReply })
            const newMessageCount = messageCount + 2
            const nextStatus = newMessageCount >= MAX_MESSAGES_PER_CONVERSATION ? 'full' : 'active'
            await queries.updateConversation(db, id, {
                messageCount: sql`message_count + 2`,
                status: nextStatus,
                ...(messageCount === 0 ? { title: userMessage.slice(0, 60) } : {}),
            })
            let suggestEscalation = false
            if (shouldEscalate) {
                const existingTicket = await queries.getOpenTicketByConversation(db, id)
                suggestEscalation = !existingTicket
            }
            const events = await queries.getAllEvents(db, 1000).catch(() => [])
            await send({
                done: true,
                reply: cleanReply,
                messageId: userMsgId,
                suggestEscalation,
                suggestions: buildSuggestions(events, userMessage, cleanReply),
                conversationStatus: nextStatus,
            })
        } catch (err: any) {
            await send({ error: err?.message ?? 'The chat assistant is temporarily unavailable. Please try again shortly.' }).catch(() => null)
        } finally {
            await writer.close().catch(() => null)
        }
    })()

    c.executionCtx.waitUntil(pump.catch(() => null))
    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    })
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
    const messages = await queries.getMessagesByConversation(db, id, 1000)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? 'No message provided'
    const ticketMessage = payload?.message?.trim() || lastUserMessage

    const ticket = await openTicket(db, c.env, {
        conversationId: id,
        userEmail: email,
        subject: `Help request: ${ticketMessage.slice(0, 80)}`,
        message: ticketMessage,
        createdBy: 'user',
    }, (promise) => c.executionCtx.waitUntil(promise))

    await queries.createChatMessage(db, {
        conversationId: id,
        role: 'system',
        content: 'A human admin has been notified and will follow up here and by email.',
    })

    return jsonOk(c, { ticketId: ticket.id }, 'Ticket created')
}

export async function updateMessage(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)
    const id = c.req.param('cid')
    const mid = Number(c.req.param('mid'))
    if (!id) return jsonError(c, 'Conversation id required', 400)
    if (!Number.isInteger(mid)) return jsonError(c, 'Valid message id required', 400)

    const conversation = await queries.getConversationById(db, id)
    if (!conversation || conversation.email !== email) {
        return jsonError(c, 'Conversation not found', 404)
    }

    const msg = await queries.getChatMessageById(db, mid)
    if (!msg || msg.conversationId !== id) {
        return jsonError(c, 'Message not found', 404)
    }

    if (msg.role !== 'user') {
        return jsonError(c, 'Only your messages can be edited', 400)
    }

    const payload = await c.req.json<{ content?: string }>().catch(() => null)
    const content = payload?.content?.trim()

    if (!content) {
        return jsonError(c, 'Content required', 400)
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
        return jsonError(c, 'Message is too long', 400)
    }

    let edits: Array<{ content: string; at: string }> = []
    try {
        const parsed = JSON.parse((msg as { edits?: string }).edits || '[]')
        if (Array.isArray(parsed)) edits = parsed
    } catch {
        edits = []
    }
    edits.push({ content: msg.content, at: new Date().toISOString() })

    const updated = await queries.updateChatMessageContent(db, mid, content, JSON.stringify(edits))
    return jsonOk(c, updated, 'Message updated')
}
