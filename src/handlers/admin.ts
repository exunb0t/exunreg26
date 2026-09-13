import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import type { EventInsert } from '../db/queries'
import { sendEmail } from '../lib/sendemail'
import { clearResponseCache } from '../middleware/cache'
import { parseLimit } from '../lib/paging'

const EVENT_TEXT_FIELDS = ['name', 'image', 'eligibility', 'mode', 'dates', 'descriptionLong', 'descriptionShort'] as const
const EVENT_BOOL_FIELDS = ['openToAll', 'independentRegistration'] as const
const EVENT_NUM_FIELDS = ['participants', 'points'] as const

function pickEventFields(payload: unknown): { ok: true; data: EventInsert } | { ok: false; error: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, error: 'Invalid event data' }
    }

    const input = payload as Record<string, unknown>
    const data: Record<string, unknown> = {}

    for (const field of EVENT_TEXT_FIELDS) {
        if (input[field] !== undefined) {
            if (typeof input[field] !== 'string') return { ok: false, error: `Field ${field} must be a string` }
            data[field] = input[field]
        }
    }

    for (const field of EVENT_BOOL_FIELDS) {
        if (input[field] !== undefined) {
            if (typeof input[field] !== 'boolean') return { ok: false, error: `Field ${field} must be a boolean` }
            data[field] = input[field]
        }
    }

    for (const field of EVENT_NUM_FIELDS) {
        if (input[field] !== undefined) {
            if (typeof input[field] !== 'number' || !Number.isFinite(input[field]) || (input[field] as number) < 0) {
                return { ok: false, error: `Field ${field} must be a non-negative number` }
            }
            data[field] = input[field]
        }
    }

    return { ok: true, data: data as EventInsert }
}

export async function getAdminStats(c: AppContext) {

    const db = getDb(c.env)

    const [userCount, eventCount, registrationCount] = await Promise.all([
        queries.countUsers(db),
        queries.countEvents(db),
        queries.countRegistrations(db),
    ])

    return jsonOk(
        c,
        {
            users: userCount,
            events: eventCount,
            registrations: registrationCount,
        },
        'Admin Stats'
    )
}

export async function getAdminConfig(c: AppContext) {

    return jsonOk(
        c,
        {
            admin_emails: c.env.ADMIN_EMAILS
        },
        'Admin Emails'
    )
}

export async function createEvent(c: AppContext) {

    const db = getDb(c.env)

    const payload = await c.req
        .json()
        .catch(() => null)

    const picked = pickEventFields(payload)
    if (!picked.ok) {
        return jsonError(
            c,
            picked.error,
            400
        )
    }

    if (typeof payload.id !== 'string' || !payload.id) {
        return jsonError(
            c,
            'Event id is required',
            400
        )
    }

    if (typeof picked.data.name !== 'string' || !picked.data.name.trim()) {
        return jsonError(
            c,
            'Event name is required',
            400
        )
    }

    const event = await queries.createEvent(
        db,
        { ...picked.data, id: payload.id }
    )

    clearResponseCache()

    return jsonOk(
        c,
        event,
        'Event created'
    )
}

export async function getAdminEvent(c: AppContext) {

    const db = getDb(c.env)

    const id = c.req.param('id')

    if (!id) {
    return jsonError(
        c,
        'Event ID required',
        400
      )
     }


    const event = await queries.getEventById(
        db,
        id
    )


    if (!event) {
        return jsonError(
            c,
            'Event not found',
            404
        )
    }


    return jsonOk(
        c,
        event,
        'Event found'
    )
}

export async function updateEvent(c: AppContext) {

    const db = getDb(c.env)

    const id = c.req.param('id')

    if (!id) {
    return jsonError(
        c,
        'Event ID required',
        400
     )
    }

    const payload = await c.req
        .json()
        .catch(() => null)


    const picked = pickEventFields(payload)
    if (!picked.ok) {
        return jsonError(
            c,
            picked.error,
            400
        )
    }

    if (Object.keys(picked.data).length === 0) {
        return jsonError(
            c,
            'No event fields provided',
            400
        )
    }


    const event = await queries.updateEvent(
        db,
        id,
        picked.data
    )


    if (!event) {
        return jsonError(
            c,
            'Event not found',
            404
        )
    }

    clearResponseCache()

    return jsonOk(
        c,
        event,
        'Event updated'
    )
}

export async function deleteEvent(c: AppContext) {

    const db = getDb(c.env)

    const id = c.req.param('id')

    if (!id) {
        return jsonError(
        c,
        'Event ID required',
        400
      )
     }


    const existing = await queries.getEventById(
        db,
        id
    )

    if (!existing) {
        return jsonError(
            c,
            'Event not found',
            404
        )
    }

    await queries.deleteRegistrationsByEvent(
        db,
        id
    )

    await queries.deleteUsrRegsByEvent(
        db,
        id
    )

    await queries.deleteEvent(
        db,
        id
    )

    clearResponseCache()

    return jsonOk(
        c,
        null,
        'Event deleted'
    )
}



export async function getUserDetails(c: AppContext) {

    const db = getDb(c.env)

    const id = Number(
        c.req.param('id')
    )

    if (!Number.isInteger(id)) {
        return jsonError(
            c,
            'Valid user ID required',
            400
        )
    }


    const user = await queries.getUserById(
        db,
        id
    )


    if (!user) {
        return jsonError(
            c,
            'User not found',
            404
        )
    }


    const { passwordHash: _removed, ...safeUser } = user
    return jsonOk(
        c,
        safeUser,
        'User details'
    )
}



export async function getEventRegistrations(c: AppContext) {

    const db = getDb(c.env)

    const eventId = c.req.param('id')

    if (!eventId) {
        return jsonError(
            c,
            'Event ID required',
            400
        )
    }


    const registrations =
        await queries.getRegistrationsByEvent(db, eventId, parseLimit(c, 500, 2000))


    return jsonOk(
        c,
        registrations,
        'Event registrations'
    )
}

export async function exportData(c: AppContext) {

    const db = getDb(c.env)

    const limit = parseLimit(c, 1000, 5000)

    const users =
        await queries.getAllUsers(db, limit)

    const registrations =
        await queries.getAllRegistrations(db, limit)

    const events =
        await queries.getAllEvents(db, limit)


    return jsonOk(
        c,
        {
            users: users.map((u) => {
                const { passwordHash: _removed, ...safeUser } = u
                return safeUser
            }),
            events,
            registrations
        },
        'Export data'
    )
}

export async function sendInvite(c: AppContext) {

    const payload = await c.req
        .json<{
            email?: string
            message?: string
        }>()
        .catch(() => null)


    if (!payload?.email) {
        return jsonError(
            c,
            'Email required',
            400
        )
    }

    const emailRegex = /^[^@]+@[a-zA-Z]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(payload.email)) {
        return jsonError(
            c,
            'Invalid email',
            400
        )
    }


    const inviteMessage = payload.message || 'You have been invited to the portal of Exun reg platform 2026.'
    await sendEmail(payload.email, 'Exun 2026 Registration Platform Admin Invitation', inviteMessage, c.env)

    return jsonOk(
        c,
        {
            email: payload.email,
            message: payload.message ?? ''
        },
        'Invite sent successfully!'
    )
}

export async function importEvents(c: AppContext) {

    const db = getDb(c.env)


    const payload = await c.req
        .json<{
            events?: any[]
        }>()
        .catch(() => null)


    if (!payload?.events || !Array.isArray(payload.events)) {

        return jsonError(
            c,
            'Events array required',
            400
        )
    }


    const createdEvents = []
    const pending: { id: string; data: EventInsert }[] = []


    for (let i = 0; i < payload.events.length; i++) {
        const event = payload.events[i]

        const picked = pickEventFields(event)
        if (!picked.ok) {
            return jsonError(
                c,
                `Event at index ${i}: ${picked.error}`,
                400
            )
        }

        if (typeof event.id !== 'string' || !event.id) {
            return jsonError(
                c,
                `Event at index ${i}: id is required`,
                400
            )
        }

        if (typeof picked.data.name !== 'string' || !picked.data.name.trim()) {
            return jsonError(
                c,
                `Event at index ${i}: name is required`,
                400
            )
        }

        pending.push({ id: event.id, data: picked.data })
    }

    for (const event of pending) {

        const created =
            await queries.createEvent(
                db,
                { ...event.data, id: event.id }
            )

        createdEvents.push(created)
    }

    clearResponseCache()

    return jsonOk(
        c,
        {
            imported: createdEvents.length,
            events: createdEvents
        },
        'Events imported'
    )
}
