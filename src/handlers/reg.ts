import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import type { UserInsert } from '../db/queries'
import { individualRegistrations, registrations, users } from '../db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { getEmailFromCookie } from '../middleware/auth'
import { ADDRESS_MAX, NAME_MAX, SCHOOL_MAX, TEAM_MAX, truncate, isValidEmail, isValidPhone, normalizeEmail } from '../lib/validation'

const MAX_STUDENTS = 25

type StudentInput = {
    fullname: string
    email: string
    phone?: string
    class?: string
}

type RegistrationPayload = {
    eventId?: string
    schoolName?: string
    schoolCode?: string
    address?: string
    principalName?: string
    principalEmail?: string
    teamName?: string
    students?: StudentInput[]
}

function validateStudents(students: unknown, maxAllowed: number): { ok: true; students: StudentInput[] } | { ok: false; error: string } {
    const list = (students as StudentInput[]) ?? []
    if (!Array.isArray(list)) {
        return { ok: false, error: 'Students must be an array' }
    }
    if (list.length > maxAllowed) {
        return { ok: false, error: `This event allows at most ${maxAllowed} participants` }
    }
    for (let i = 0; i < list.length; i++) {
        const student = list[i]
        const rawName = String(student?.fullname ?? '').trim()
        if (!student || !rawName) {
            return { ok: false, error: `Student at index ${i}: fullname is required` }
        }
        if (rawName.length > NAME_MAX) {
            return { ok: false, error: `Student at index ${i}: fullname too long` }
        }
        const semail = normalizeEmail(student.email)
        if (!student.email || !isValidEmail(semail)) {
            return { ok: false, error: `Student at index ${i}: valid email is required` }
        }
        if (student.phone !== undefined && String(student.phone).trim() && !isValidPhone(String(student.phone))) {
            return { ok: false, error: `Student at index ${i}: invalid phone` }
        }
        if (student.class !== undefined && String(student.class).trim().length > 32) {
            return { ok: false, error: `Student at index ${i}: class too long` }
        }
    }
    return { ok: true, students: list }
}

export async function submitRegistrations(c: AppContext) {
    const db = getDb(c.env)
    const email = getEmailFromCookie(c)
    if (!email) {
        return jsonError(c, 'Authentication required', 401)
    }
    const payload = await c.req.json<RegistrationPayload>().catch(() => null)
    if (!payload?.eventId) {
        return jsonError(c, 'Event ID required', 400)
    }
    const user = await queries.getUserByEmail(db, email)
    if (!user) {
        return jsonError(c, 'User not found', 404)
    }
    const event = await queries.getEventById(db, payload.eventId)
    if (!event) {
        return jsonError(c, 'Event not found', 404)
    }
    const existing = await queries.getRegistrationByEventUser(db, payload.eventId, user.id)
    if (existing) {
        return jsonError(c, 'Already registered for this event. Use PUT to update or DELETE to remove.', 409)
    }
    const checked = validateStudents(payload.students ?? [], Math.min(event.participants, MAX_STUDENTS))
    if (!checked.ok) {
        return jsonError(c, checked.error, 400)
    }
    const students = checked.students
    if (payload.principalEmail && !isValidEmail(normalizeEmail(payload.principalEmail))) {
        return jsonError(c, 'Invalid principal email', 400)
    }
    if (payload.teamName !== undefined && truncate(String(payload.teamName ?? ''), TEAM_MAX).length > TEAM_MAX) {
        return jsonError(c, 'Team name too long', 400)
    }
    if (payload.schoolName !== undefined && String(payload.schoolName ?? '').trim().length > SCHOOL_MAX) {
        return jsonError(c, 'School name too long', 400)
    }
    if (payload.address !== undefined && String(payload.address ?? '').trim().length > ADDRESS_MAX) {
        return jsonError(c, 'Address too long', 400)
    }
    const accountUpdates: Partial<UserInsert> = {}
    if (payload.schoolName !== undefined) accountUpdates.institutionName = truncate(String(payload.schoolName ?? ''), SCHOOL_MAX)
    if (payload.schoolCode !== undefined) accountUpdates.schoolCode = truncate(String(payload.schoolCode ?? ''), SCHOOL_MAX)
    if (payload.address !== undefined) accountUpdates.address = truncate(String(payload.address ?? ''), ADDRESS_MAX)
    if (payload.principalName !== undefined) accountUpdates.principalsName = truncate(String(payload.principalName ?? ''), NAME_MAX)
    if (payload.principalEmail !== undefined) accountUpdates.principalsEmail = normalizeEmail(payload.principalEmail)
    const individualValues = students.map((student) => ({
        userId: user.id,
        eventId: payload.eventId as string,
        fullname: truncate(String(student.fullname ?? ''), NAME_MAX).trim(),
        userEmail: normalizeEmail(student.email),
        phoneNumber: student.phone !== undefined ? String(student.phone).trim().slice(0, 32) : undefined,
        className: student.class !== undefined ? String(student.class).trim().slice(0, 32) : undefined,
        schoolName: payload.schoolName !== undefined ? truncate(String(payload.schoolName ?? ''), SCHOOL_MAX) : undefined,
        schoolCode: payload.schoolCode !== undefined ? truncate(String(payload.schoolCode ?? ''), SCHOOL_MAX) : undefined,
        address: payload.address !== undefined ? truncate(String(payload.address ?? ''), ADDRESS_MAX) : undefined,
    }))
    let registrationId: number
    try {
        const statements: any[] = []
        if (Object.keys(accountUpdates).length > 0) {
            statements.push(
                db.update(users).set({ ...accountUpdates, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(users.email, email))
            )
        }
        statements.push(
            db.insert(registrations).values({
                eventId: payload.eventId as string,
                userId: user.id,
                teamName: payload.teamName !== undefined ? truncate(String(payload.teamName ?? ''), TEAM_MAX) : undefined,
                status: 'pending',
            }).returning({ id: registrations.id })
        )
        for (const v of individualValues) {
            statements.push(db.insert(individualRegistrations).values(v))
        }
        const results = await db.batch(statements as [any, ...any[]])
        const created = (results.find((r) => Array.isArray(r) && r.length > 0) as { id: number }[] | undefined)?.[0]
        if (!created) throw new Error('Registration failed')
        registrationId = created.id
    } catch {
        return jsonError(c, 'Already registered for this event. Use PUT to update or DELETE to remove.', 409)
    }
    return jsonOk(c, { registrationId }, 'Registration submitted successfully')
}

export async function updateRegistration(c: AppContext) {
    const db = getDb(c.env)
    const email = getEmailFromCookie(c)
    if (!email) {
        return jsonError(c, 'Authentication required', 401)
    }
    const payload = await c.req.json<RegistrationPayload>().catch(() => null)
    if (!payload?.eventId) {
        return jsonError(c, 'Event ID required', 400)
    }
    const user = await queries.getUserByEmail(db, email)
    if (!user) {
        return jsonError(c, 'User not found', 404)
    }
    const event = await queries.getEventById(db, payload.eventId)
    if (!event) {
        return jsonError(c, 'Event not found', 404)
    }
    const existing = await queries.getRegistrationByEventUser(db, payload.eventId, user.id)
    if (!existing) {
        return jsonError(c, 'No existing registration for this event', 404)
    }
    const checked = validateStudents(payload.students ?? [], Math.min(event.participants, MAX_STUDENTS))
    if (!checked.ok) {
        return jsonError(c, checked.error, 400)
    }
    const students = checked.students
    if (payload.principalEmail && !isValidEmail(normalizeEmail(payload.principalEmail))) {
        return jsonError(c, 'Invalid principal email', 400)
    }
    const accountUpdates: Partial<UserInsert> = {}
    if (payload.schoolName !== undefined) accountUpdates.institutionName = truncate(String(payload.schoolName ?? ''), SCHOOL_MAX)
    if (payload.schoolCode !== undefined) accountUpdates.schoolCode = truncate(String(payload.schoolCode ?? ''), SCHOOL_MAX)
    if (payload.address !== undefined) accountUpdates.address = truncate(String(payload.address ?? ''), ADDRESS_MAX)
    if (payload.principalName !== undefined) accountUpdates.principalsName = truncate(String(payload.principalName ?? ''), NAME_MAX)
    if (payload.principalEmail !== undefined) accountUpdates.principalsEmail = normalizeEmail(payload.principalEmail)
    const individualValues = students.map((student) => ({
        userId: user.id,
        eventId: payload.eventId as string,
        fullname: truncate(String(student.fullname ?? ''), NAME_MAX).trim(),
        userEmail: normalizeEmail(student.email),
        phoneNumber: student.phone !== undefined ? String(student.phone).trim().slice(0, 32) : undefined,
        className: student.class !== undefined ? String(student.class).trim().slice(0, 32) : undefined,
        schoolName: payload.schoolName !== undefined ? truncate(String(payload.schoolName ?? ''), SCHOOL_MAX) : undefined,
        schoolCode: payload.schoolCode !== undefined ? truncate(String(payload.schoolCode ?? ''), SCHOOL_MAX) : undefined,
        address: payload.address !== undefined ? truncate(String(payload.address ?? ''), ADDRESS_MAX) : undefined,
    }))
    try {
        const statements: any[] = []
        if (Object.keys(accountUpdates).length > 0) {
            statements.push(
                db.update(users).set({ ...accountUpdates, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(users.email, email))
            )
        }
        statements.push(
            db.update(registrations).set({
                teamName: payload.teamName !== undefined ? truncate(String(payload.teamName ?? ''), TEAM_MAX) : existing.teamName,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            }).where(eq(registrations.id, existing.id))
        )
        statements.push(
            db.delete(individualRegistrations).where(and(eq(individualRegistrations.userId, user.id), eq(individualRegistrations.eventId, payload.eventId as string)))
        )
        for (const v of individualValues) {
            statements.push(db.insert(individualRegistrations).values(v))
        }
        await db.batch(statements as [any, ...any[]])
    } catch {
        return jsonError(c, 'Failed to update registration', 500)
    }
    return jsonOk(c, { registrationId: existing.id }, 'Registration updated successfully')
}

export async function deleteRegistration(c: AppContext) {
    const db = getDb(c.env)
    const email = getEmailFromCookie(c)
    if (!email) {
        return jsonError(c, 'Authentication required', 401)
    }
    const queryId = c.req.query('eventId') || c.req.query('event_id') || c.req.query('id')
    const body = await c.req.json<{ eventId?: string }>().catch(() => null)
    const eventId = (body?.eventId || queryId || '').trim()
    if (!eventId) {
        return jsonError(c, 'Event ID required', 400)
    }
    const user = await queries.getUserByEmail(db, email)
    if (!user) {
        return jsonError(c, 'User not found', 404)
    }
    const existing = await queries.getRegistrationByEventUser(db, eventId, user.id)
    if (!existing) {
        return jsonError(c, 'No existing registration for this event', 404)
    }
    await db.batch([
        db.delete(individualRegistrations).where(and(eq(individualRegistrations.userId, user.id), eq(individualRegistrations.eventId, eventId))),
        db.delete(registrations).where(eq(registrations.id, existing.id)),
    ])
    return jsonOk(c, null, 'Registration deleted successfully')
}
