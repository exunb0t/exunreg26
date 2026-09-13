import { and, asc, desc, eq, lt, sql, type SQL } from 'drizzle-orm'
import type { Db } from './client'
import { users, events, registrations, individualRegistrations, logs, oauthTokens, passwordResetOtps, authSessions, queries, conversations, chatMessages, kbSources, kbChunks, tickets, ticketReplies, usrRegs } from './schema'
import type { Participant } from '../types'

export type UserRow = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert
export type EventRow = typeof events.$inferSelect

export type EventInsert = typeof events.$inferInsert

export type RegistrationRow = typeof registrations.$inferSelect
export type RegistrationInsert = typeof registrations.$inferInsert
export type IndividualRegistrationRow = typeof individualRegistrations.$inferSelect
export type IndividualRegistrationInsert = typeof individualRegistrations.$inferInsert
export type LogRow = typeof logs.$inferSelect
export type OAuthTokenRow = typeof oauthTokens.$inferSelect
export type OAuthTokenInsert = typeof oauthTokens.$inferInsert

export type AuthSessionRow = typeof authSessions.$inferSelect
export type AuthSessionInsert = typeof authSessions.$inferInsert

// Password reset OTPs
export type PasswordResetOtpRow = typeof passwordResetOtps.$inferSelect
export type PasswordResetOtpInsert = typeof passwordResetOtps.$inferInsert

export function parseRegistrations(raw: string): Record<string, Participant[]> {
    if (!raw || raw === '{}') return {}
    try {
        return JSON.parse(raw) as Record<string, Participant[]>
    } catch {
        return {}
    }
}

export function stringifyRegistrations(regs: Record<string, Participant[]> | undefined): string {
    if (!regs) return '{}'
    return JSON.stringify(regs)
}

// ---- usrs ---
/*
export async function checkIfUserExists(db: Db, email: string) : Promise<boolean> {
    const 
}*/

export async function getUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
    return rows[0]
}


export async function getUserById(db: Db, id: number): Promise<UserRow | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return rows[0]
}
export async function getUserByUsername(db: Db, username: string): Promise<UserRow | undefined> {
    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1)
    return rows[0]
}


export async function getAllUsers(db: Db, limit: number): Promise<UserRow[]> {
    return db.select().from(users).limit(limit)
}

export async function createUser(db: Db, data: UserInsert): Promise<UserRow> {
    const rows = await db.insert(users).values(data).returning()
    return rows[0]
}

export async function updateUser(db: Db, email: string, data: Partial<UserInsert>): Promise<UserRow | undefined> {
    const rows = await db
        .update(users)
        .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(users.email, email))
        .returning()
    return rows[0]
}

export async function deleteUserByEmail(db: Db, email: string): Promise<void> {
    await db.delete(users).where(eq(users.email, email))
}

// ---- events ----
//
export async function getEventById(db: Db, id: string): Promise<EventRow | undefined> {
    const rows = await db.select().from(events).where(eq(events.id, id)).limit(1)
    return rows[0]
}

export async function getAllEvents(db: Db, limit: number): Promise<EventRow[]> {
    return db.select().from(events).limit(limit)
}

export async function createEvent(db: Db, data: EventInsert): Promise<EventRow> {
    const rows = await db.insert(events).values(data).returning()
    return rows[0]
}

export async function updateEvent(db: Db, id: string, data: Partial<EventInsert>): Promise<EventRow | undefined> {
    const rows = await db
        .update(events)
        .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(events.id, id))
        .returning()
    return rows[0]
}

export async function deleteEvent(db: Db, id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id))
}

// ---- registrations ----

export async function getRegistrationById(db: Db, id: number): Promise<RegistrationRow | undefined> {
    const rows = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1)
    return rows[0]
}

export async function getAllRegistrations(db: Db, limit: number): Promise<RegistrationRow[]> {
    return db.select().from(registrations).limit(limit)
}

export async function getRegistrationCountsByEvent(db: Db): Promise<Map<string, number>> {
    const rows = await db
        .select({ eventId: registrations.eventId, count: sql<number>`count(*)` })
        .from(registrations)
        .groupBy(registrations.eventId)
    return new Map(rows.map((r) => [r.eventId, r.count]))
}

export async function createRegistration(db: Db, data: RegistrationInsert): Promise<RegistrationRow> {
    const rows = await db.insert(registrations).values(data).returning()
    return rows[0]
}

export async function updateRegistration(
    db: Db,
    id: number,
    data: Partial<RegistrationInsert>
): Promise<RegistrationRow | undefined> {
    const rows = await db
        .update(registrations)
        .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(registrations.id, id))
        .returning()
    return rows[0]
}

export async function deleteRegistration(db: Db, id: number): Promise<void> {
    await db.delete(registrations).where(eq(registrations.id, id))
}

// ---- indi_regs ----

export async function getIndividualRegistrationById(
    db: Db,
    id: number
): Promise<IndividualRegistrationRow | undefined> {
    const rows = await db.select().from(individualRegistrations).where(eq(individualRegistrations.id, id)).limit(1)
    return rows[0]
}

export async function getIndividualRegistrationByUser(
    db: Db,
    userId: number
): Promise<IndividualRegistrationRow | undefined> {
    const rows = await db
        .select()
        .from(individualRegistrations)
        .where(eq(individualRegistrations.userId, userId))
        .limit(1)
    return rows[0]
}

export async function getAllIndividualRegistrations(db: Db): Promise<IndividualRegistrationRow[]> {
    return db.select().from(individualRegistrations)
}

export async function createIndividualRegistration(
    db: Db,
    data: IndividualRegistrationInsert
): Promise<IndividualRegistrationRow> {
    const rows = await db.insert(individualRegistrations).values(data).returning()
    return rows[0]
}

export async function deleteIndividualRegistrationsByUser(db: Db, userId: number): Promise<void> {
    await db.delete(individualRegistrations).where(eq(individualRegistrations.userId, userId))
}

export async function getAllIndividualRegistrationsByUser(
    db: Db,
    userId: number,
    limit: number
): Promise<IndividualRegistrationRow[]> {

    return await db
        .select()
        .from(individualRegistrations)
        .where(eq(individualRegistrations.userId, userId))
        .limit(limit)
}

// ---- logs ----

export async function createLog(db: Db, reason: string, content: string): Promise<void> {
    await db.insert(logs).values({ reason, content })
}

export async function getAllLogs(db: Db): Promise<LogRow[]> {
    return db.select().from(logs).orderBy(sql`created_at DESC`)
}


// ---- oauth_tokens ----

export async function getOAuthToken(db: Db, provider: string): Promise<OAuthTokenRow | undefined> {
    const rows = await db.select().from(oauthTokens).where(eq(oauthTokens.provider, provider)).limit(1)
    return rows[0]
}

export async function upsertOAuthToken(db: Db, data: OAuthTokenInsert): Promise<OAuthTokenRow> {
    const rows = await db
        .insert(oauthTokens)
        .values(data)
        .onConflictDoUpdate({
            target: oauthTokens.provider,
            set: {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                scope: data.scope,

                tokenType: data.tokenType,
                expiresAt: data.expiresAt,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            },
        })
        .returning()


    return rows[0]
}

// ---- password reset OTPs ----

export async function createPasswordResetOtp(
    db: Db,
    data: PasswordResetOtpInsert
): Promise<PasswordResetOtpRow> {
    const rows = await db
        .insert(passwordResetOtps)
        .values(data)
        .returning()

    return rows[0]
}



export async function getPasswordResetOtp(
    db: Db,
    email: string
): Promise<PasswordResetOtpRow | undefined> {
    const rows = await db
        .select()
        .from(passwordResetOtps)
        .where(eq(passwordResetOtps.email, email))
        .limit(1)

    return rows[0]
}

export async function deletePasswordResetOtp(
    db: Db,
    email: string
): Promise<void> {
    await db
        .delete(passwordResetOtps)
        .where(eq(passwordResetOtps.email, email))
}

export async function updatePasswordResetOtpAttempts(
    db: Db,
    email: string,
    attemptCount: number
): Promise<void> {
    await db
        .update(passwordResetOtps)
        .set({ attemptCount })
        .where(eq(passwordResetOtps.email, email))
}

export async function updatePasswordResetOtp(
    db: Db,
    email: string,
    data: Partial<PasswordResetOtpInsert>
): Promise<PasswordResetOtpRow | undefined> {
    const rows = await db
        .update(passwordResetOtps)
        .set(data)
        .where(eq(passwordResetOtps.email, email))
        .returning()

    return rows[0]
}

// ---- auth sessions ----

export async function createSession(
    db: Db,
    email: string,
    token: string,
    expiresAt: string
): Promise<AuthSessionRow> {

    const rows = await db
        .insert(authSessions)
        .values({
            email,
            token,
            expiresAt,
        })
        .returning()

    return rows[0]
}


export async function getSessionByToken(
    db: Db,
    token: string
): Promise<AuthSessionRow | undefined> {

    const rows = await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.token, token))
        .limit(1)

    return rows[0]
}


export async function deleteSession(
    db: Db,
    token: string
): Promise<void> {

    await db
        .delete(authSessions)
        .where(eq(authSessions.token, token))
}

// Query.ts Handlerß∂

export type QueryRow = typeof queries.$inferSelect
export type QueryInsert = typeof queries.$inferInsert


export async function createQuery(
    db: Db,
    data: QueryInsert
): Promise<QueryRow> {

    const rows = await db
        .insert(queries)
        .values(data)
        .returning()

    return rows[0]
}

export type ConversationRow = typeof conversations.$inferSelect
export type ConversationInsert = typeof conversations.$inferInsert
export type ChatMessageRow = typeof chatMessages.$inferSelect
export type ChatMessageInsert = typeof chatMessages.$inferInsert

export async function createConversation(db: Db, data: ConversationInsert): Promise<ConversationRow> {
    const rows = await db.insert(conversations).values(data).returning()
    return rows[0]
}

export async function getConversationById(db: Db, id: string): Promise<ConversationRow | undefined> {
    const rows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
    return rows[0]
}

export async function getConversationsByUser(db: Db, userId: number, limit: number): Promise<ConversationRow[]> {
    return db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt))
        .limit(limit)
}

export async function updateConversation(
    db: Db,
    id: string,
    data: Omit<Partial<ConversationInsert>, 'messageCount'> & { messageCount?: number | SQL }
): Promise<ConversationRow | undefined> {
    const rows = await db
        .update(conversations)
        .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(conversations.id, id))
        .returning()
    return rows[0]
}

export async function deleteConversation(db: Db, id: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, id))
    await db.delete(conversations).where(eq(conversations.id, id))
}

export async function createChatMessage(db: Db, data: ChatMessageInsert): Promise<ChatMessageRow> {
    const rows = await db.insert(chatMessages).values(data).returning()
    return rows[0]
}

export async function getChatMessageById(db: Db, id: number): Promise<ChatMessageRow | undefined> {
    const rows = await db.select().from(chatMessages).where(eq(chatMessages.id, id)).limit(1)
    return rows[0]
}

export async function updateChatMessageContent(db: Db, id: number, content: string, editsJson: string): Promise<ChatMessageRow | undefined> {
    const rows = await db
        .update(chatMessages)
        .set({ content, edits: editsJson })
        .where(eq(chatMessages.id, id))
        .returning()
    return rows[0]
}

export async function getMessagesByConversation(db: Db, conversationId: string, limit: number): Promise<ChatMessageRow[]> {
    return db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversationId))
        .orderBy(chatMessages.id)
        .limit(limit)
}

export async function getRecentMessages(db: Db, conversationId: string, limit: number): Promise<ChatMessageRow[]> {
    const rows = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversationId))
        .orderBy(desc(chatMessages.id))
        .limit(limit)
    return rows.reverse()
}

export type KbSourceRow = typeof kbSources.$inferSelect
export type KbSourceInsert = typeof kbSources.$inferInsert
export type KbChunkRow = typeof kbChunks.$inferSelect
export type KbChunkInsert = typeof kbChunks.$inferInsert

export async function createKbSource(db: Db, data: KbSourceInsert): Promise<KbSourceRow> {
    const rows = await db.insert(kbSources).values(data).returning()
    return rows[0]
}

export async function getKbSourceByUrl(db: Db, url: string): Promise<KbSourceRow | undefined> {
    const rows = await db.select().from(kbSources).where(eq(kbSources.url, url)).limit(1)
    return rows[0]
}

export async function getKbSourceById(db: Db, id: number): Promise<KbSourceRow | undefined> {
    const rows = await db.select().from(kbSources).where(eq(kbSources.id, id)).limit(1)
    return rows[0]
}

export async function getAllKbSources(db: Db, limit: number): Promise<KbSourceRow[]> {
    return db.select().from(kbSources).orderBy(kbSources.id).limit(limit)
}

export async function updateKbSource(
    db: Db,
    id: number,
    data: Partial<KbSourceInsert>
): Promise<KbSourceRow | undefined> {
    const rows = await db
        .update(kbSources)
        .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(kbSources.id, id))
        .returning()
    return rows[0]
}

export async function deleteKbSource(db: Db, id: number): Promise<void> {
    await db.delete(kbChunks).where(eq(kbChunks.sourceId, id))
    await db.delete(kbSources).where(eq(kbSources.id, id))
}

export async function getKbChunksBySource(db: Db, sourceId: number, limit: number): Promise<KbChunkRow[]> {
    return db.select().from(kbChunks).where(eq(kbChunks.sourceId, sourceId)).orderBy(kbChunks.chunkIndex).limit(limit)
}

export async function createKbChunks(db: Db, data: KbChunkInsert[]): Promise<void> {
    if (data.length === 0) return
    await db.insert(kbChunks).values(data)
}

export async function deleteKbChunksBySource(db: Db, sourceId: number): Promise<void> {
    await db.delete(kbChunks).where(eq(kbChunks.sourceId, sourceId))
}

export type TicketRow = typeof tickets.$inferSelect
export type TicketInsert = typeof tickets.$inferInsert

export async function createTicket(db: Db, data: TicketInsert): Promise<TicketRow> {
    const rows = await db.insert(tickets).values(data).returning()
    return rows[0]
}

export async function getMaxTicketId(db: Db): Promise<number> {
    const rows = await db.select({ m: sql<number | null>`MAX(${tickets.id})` }).from(tickets)
    return rows[0]?.m ?? 0
}

export async function getTicketById(db: Db, id: number): Promise<TicketRow | undefined> {
    const rows = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1)
    return rows[0]
}

export async function getAllTickets(db: Db, status: string | undefined, limit: number): Promise<TicketRow[]> {
    if (status) {
        return db.select().from(tickets).where(eq(tickets.status, status)).orderBy(desc(tickets.createdAt)).limit(limit)
    }
    return db.select().from(tickets).orderBy(desc(tickets.createdAt)).limit(limit)
}

export async function updateTicket(
    db: Db,
    id: number,
    data: Partial<TicketInsert>
): Promise<TicketRow | undefined> {
    const rows = await db
        .update(tickets)
        .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(tickets.id, id))
        .returning()
    return rows[0]
}

export async function getOpenTicketByConversation(db: Db, conversationId: string): Promise<TicketRow | undefined> {
    const rows = await db
        .select()
        .from(tickets)
        .where(and(eq(tickets.conversationId, conversationId), eq(tickets.status, 'open')))
        .limit(1)
    return rows[0]
}

export async function getTicketsByUserEmail(db: Db, email: string, limit: number): Promise<TicketRow[]> {
    return db
        .select()
        .from(tickets)
        .where(eq(tickets.userEmail, email))
        .orderBy(desc(tickets.createdAt))
        .limit(limit)
}

export type TicketReplyRow = typeof ticketReplies.$inferSelect
export type TicketReplyInsert = typeof ticketReplies.$inferInsert

export async function createTicketReply(db: Db, data: TicketReplyInsert): Promise<TicketReplyRow> {
    const rows = await db.insert(ticketReplies).values(data).returning()
    return rows[0]
}

export async function getTicketReplies(db: Db, ticketId: number): Promise<TicketReplyRow[]> {
    return db
        .select()
        .from(ticketReplies)
        .where(eq(ticketReplies.ticketId, ticketId))
        .orderBy(asc(ticketReplies.id))
}

export async function getRegistrationByEventUser(
    db: Db,
    eventId: string,
    userId: number
): Promise<RegistrationRow | undefined> {
    const rows = await db
        .select()
        .from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, userId)))
        .limit(1)
    return rows[0]
}

export async function getRegistrationsByEvent(db: Db, eventId: string, limit: number): Promise<RegistrationRow[]> {
    return db
        .select()
        .from(registrations)
        .where(eq(registrations.eventId, eventId))
        .limit(limit)
}

export async function getRegistrationsByUser(db: Db, userId: number, limit: number): Promise<RegistrationRow[]> {
    return db
        .select()
        .from(registrations)
        .where(eq(registrations.userId, userId))
        .limit(limit)
}

export async function deleteRegistrationByEventUser(db: Db, eventId: string, userId: number): Promise<void> {
    await db.delete(registrations).where(and(eq(registrations.eventId, eventId), eq(registrations.userId, userId)))
}

export async function getIndividualRegistrationsByEventUser(
    db: Db,
    eventId: string,
    userId: number
): Promise<IndividualRegistrationRow[]> {
    return db
        .select()
        .from(individualRegistrations)
        .where(and(eq(individualRegistrations.userId, userId), eq(individualRegistrations.eventId, eventId)))
}

export async function deleteIndividualRegistrationsByEventUser(db: Db, eventId: string, userId: number): Promise<void> {
    await db.delete(individualRegistrations).where(and(eq(individualRegistrations.userId, userId), eq(individualRegistrations.eventId, eventId)))
}

export async function deleteRegistrationsByEvent(db: Db, eventId: string): Promise<void> {
    await db.delete(registrations).where(eq(registrations.eventId, eventId))
}

export async function deleteUsrRegsByEvent(db: Db, eventId: string): Promise<void> {
    await db.delete(usrRegs).where(eq(usrRegs.eventId, eventId))
}

export async function countUsers(db: Db): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(users)
    return rows[0]?.count ?? 0
}

export async function countEvents(db: Db): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(events)
    return rows[0]?.count ?? 0
}

export async function countRegistrations(db: Db): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(registrations)
    return rows[0]?.count ?? 0
}

export async function deleteExpiredSessions(db: Db, nowIso: string): Promise<void> {
    await db.delete(authSessions).where(lt(authSessions.expiresAt, nowIso))
}

export async function deleteExpiredOtps(db: Db, nowIso: string): Promise<void> {
    await db.delete(passwordResetOtps).where(lt(passwordResetOtps.expiresAt, nowIso))
}