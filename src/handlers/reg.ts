import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import type { UserInsert } from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'

const emailRegex = /^[^@]+@[a-zA-Z]+\.[a-zA-Z]{2,}$/
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
        if (!student || !student.fullname || !student.fullname.trim()) {
            return { ok: false, error: `Student at index ${i}: fullname is required` }
        }
        if (!student.email || !emailRegex.test(student.email)) {
            return { ok: false, error: `Student at index ${i}: valid email is required` }
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
    if (payload.principalEmail && !emailRegex.test(payload.principalEmail)) {
        return jsonError(c, 'Invalid principal email', 400)
    }
    const accountUpdates: Partial<UserInsert> = {}
    if (payload.schoolName !== undefined) accountUpdates.institutionName = payload.schoolName
    if (payload.schoolCode !== undefined) accountUpdates.schoolCode = payload.schoolCode
    if (payload.address !== undefined) accountUpdates.address = payload.address
    if (payload.principalName !== undefined) accountUpdates.principalsName = payload.principalName
    if (payload.principalEmail !== undefined) accountUpdates.principalsEmail = payload.principalEmail
    if (Object.keys(accountUpdates).length > 0) {
        await queries.updateUser(db, email, accountUpdates)
    }
    const registration = await queries.createRegistration(db, {
        eventId: payload.eventId,
        userId: user.id,
        teamName: payload.teamName,
        status: 'pending',
    })
    for (const student of students) {
        await queries.createIndividualRegistration(db, {
            userId: user.id,
            eventId: payload.eventId,
            fullname: student.fullname.trim(),
            userEmail: student.email.trim(),
            phoneNumber: student.phone,
            className: student.class,
            schoolName: payload.schoolName,
            schoolCode: payload.schoolCode,
            address: payload.address,
        })
    }
    return jsonOk(c, { registrationId: registration.id }, 'Registration submitted successfully')
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
    if (payload.principalEmail && !emailRegex.test(payload.principalEmail)) {
        return jsonError(c, 'Invalid principal email', 400)
    }
    const accountUpdates: Partial<UserInsert> = {}
    if (payload.schoolName !== undefined) accountUpdates.institutionName = payload.schoolName
    if (payload.schoolCode !== undefined) accountUpdates.schoolCode = payload.schoolCode
    if (payload.address !== undefined) accountUpdates.address = payload.address
    if (payload.principalName !== undefined) accountUpdates.principalsName = payload.principalName
    if (payload.principalEmail !== undefined) accountUpdates.principalsEmail = payload.principalEmail
    if (Object.keys(accountUpdates).length > 0) {
        await queries.updateUser(db, email, accountUpdates)
    }
    await queries.updateRegistration(db, existing.id, {
        teamName: payload.teamName ?? existing.teamName,
    })
    await queries.deleteIndividualRegistrationsByEventUser(db, payload.eventId, user.id)
    for (const student of students) {
        await queries.createIndividualRegistration(db, {
            userId: user.id,
            eventId: payload.eventId,
            fullname: student.fullname.trim(),
            userEmail: student.email.trim(),
            phoneNumber: student.phone,
            className: student.class,
            schoolName: payload.schoolName,
            schoolCode: payload.schoolCode,
            address: payload.address,
        })
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
    await queries.deleteIndividualRegistrationsByEventUser(db, eventId, user.id)
    await queries.deleteRegistration(db, existing.id)
    return jsonOk(c, null, 'Registration deleted successfully')
}
