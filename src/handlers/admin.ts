import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'


// GET /api/admin/stats
export async function getAdminStats(c: AppContext) {

    const db = getDb(c.env)

    const users = await queries.getAllUsers(db)
    const events = await queries.getAllEvents(db)
    const registrations = await queries.getAllRegistrations(db)

    return jsonOk(
        c,
        {
            users: users.length,
            events: events.length,
            registrations: registrations.length,
        },
        'Admin Stats'
    )
}



// Get Admin Config

export async function getAdminConfig(c: AppContext) {

    return jsonOk(
        c,
        {
            admin_emails: c.env.ADMIN_EMAILS
        },
        'Admin Emails'
    )
}



//POST /api/admin/events

export async function createEvent(c: AppContext) {

    const db = getDb(c.env)

    const payload = await c.req
        .json()
        .catch(() => null)

    if (!payload) {
        return jsonError(
            c,
            'Invalid event data',
            400
        )
    }


    const event = await queries.createEvent(
        db,
        payload
    )


    return jsonOk(
        c,
        event,
        'Event created'
    )
}



// GET /api/admin/events/:id

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



// PUT /api/admin/events/:id

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


    if (!payload) {
        return jsonError(
            c,
            'Invalid event data',
            400
        )
    }


    const event = await queries.updateEvent(
        db,
        id,
        payload
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
        'Event updated'
    )
}



//DELETE /api/admin/events/:id

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


    await queries.deleteEvent(
        db,
        id
    )


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


    return jsonOk(
        c,
        user,
        'User details'
    )
}



export async function getEventRegistrations(c: AppContext) {

    const db = getDb(c.env)

    const eventId = c.req.param('id')


    const registrations =
        await queries.getAllRegistrations(db)


    const filtered =
        registrations.filter(
            r => r.eventId === eventId
        )


    return jsonOk(
        c,
        filtered,
        'Event registrations'
    )
}



// Export all data

export async function exportData(c: AppContext) {

    const db = getDb(c.env)

    const users =
        await queries.getAllUsers(db)

    const registrations =
        await queries.getAllRegistrations(db)

    const events =
        await queries.getAllEvents(db)


    return jsonOk(
        c,
        {
            users,
            events,
            registrations
        },
        'Export data'
    )
}



// Send Invite

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


    // TODO: connect email service here
    // This will send admin invitation emails later


    return jsonOk(
        c,
        {
            email: payload.email,
            message: payload.message ?? ''
        },
        'Invite created'
    )
}



// Import events

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


    for (const event of payload.events) {

        const created =
            await queries.createEvent(
                db,
                event
            )

        createdEvents.push(created)
    }


    return jsonOk(
        c,
        {
            imported: createdEvents.length,
            events: createdEvents
        },
        'Events imported'
    )
}



// Sync Google Sheets

export async function syncSheets(c: AppContext) {

    const db = getDb(c.env)


    const token =
        await queries.getOAuthToken(
            db,
            'google_drive'
        )


    if (!token) {

        return jsonError(
            c,
            'Google account not connected',
            400
        )
    }


    // TODO:
    // 1. Fetch Google Sheet data
    // 2. Convert rows into registrations
    // 3. Update database


    return jsonOk(
        c,
        {
            connected: true
        },
        'Google Sheets sync ready'
    )
}