import { eq, sql } from 'drizzle-orm'
import type { Db } from './client'
import { users, events, registrations, individualRegistrations, logs, oauthTokens, passwordResetOtps, authSessions, queries } from './schema'
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

export async function getUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
    return rows[0]
}


export async function getUserById(db: Db, id: number): Promise<UserRow | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return rows[0]
}

export async function getAllUsers(db: Db): Promise<UserRow[]> {
    return db.select().from(users)
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

export async function getAllEvents(db: Db): Promise<EventRow[]> {
    return db.select().from(events)
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

export async function getAllRegistrations(db: Db): Promise<RegistrationRow[]> {
    return db.select().from(registrations)
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
    userId: number
): Promise<IndividualRegistrationRow[]> {

    return await db
        .select()
        .from(individualRegistrations)
        .where(eq(individualRegistrations.userId, userId))
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