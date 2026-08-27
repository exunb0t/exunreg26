import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { usrRegs } from '../db/schema'
import { sql } from 'drizzle-orm'
import { sendEmail } from '../lib/sendemail'


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

    const payload = await c.req.json<{spreadsheetId?: string, range?: string}>().catch(() => null)

    if (!payload?.spreadsheetId) {
        return jsonError(c, 'spreadsheetId is required', 400)
    }

    const range = payload.range || 0;

    const token = await queries.getOAuthToken(db, 'google_drive')
    if (!token) {
        return jsonError(c, 'Google account not connected', 400)
    }

    let accessToken = token.accessToken
    const now = new Date()
    const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null

    if (expiresAt && expiresAt.getTime() <= now.getTime() && token.refreshToken) {

        const clientId = c.env.GOOGLE_CLIENT_ID
        const clientSecret = c.env.GOOGLE_CLIENT_SECRET
        if (!clientId || !clientSecret) {
            return jsonError(c, 'Google Client credentials not configured on server to refresh token', 500)
        }

        const refreshBody = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token',
        })

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: refreshBody,
        })

        if (tokenRes.ok) {
            const refreshed = await tokenRes.json<{access_token: string, expires_in?: number}>()
            accessToken = refreshed.access_token
            const newExpiresAt = refreshed.expires_in
                ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
                : null
            await queries.upsertOAuthToken(db, {
                provider: 'google_drive',
                accessToken: accessToken,
                refreshToken: token.refreshToken,
                scope: token.scope,
                tokenType: token.tokenType,
                expiresAt: newExpiresAt,
            })
        } else {
            const errText = await tokenRes.text()
            return jsonError(c, `Failed to refresh Google token: ${errText}`, 502)
        }
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${payload.spreadsheetId}/values/${encodeURIComponent(range)}`
    const sheetRes = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    if (!sheetRes.ok) {
        const errText = await sheetRes.text()
        return jsonError(c, `Failed to fetch Google Sheet: ${errText}`, sheetRes.status as any)
    }

    const data = await sheetRes.json<{values?: string[][]}>()

    if (!data.values || data.values.length === 0) {
        return jsonOk(c,
            {
                imported: 0,
            },
            'Google Sheet is empty'
        )
    }

    const rows = data.values
    const headerRow = rows[0]
    const normalizeKey = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    const headerIndices: Record<string, number> = {}
    headerRow.forEach((val, idx) => {
        headerIndices[normalizeKey(val)] = idx
    })

    const getIndex = (keys: string[]) => {
        for (const k of keys) {
            const norm = normalizeKey(k)
            if (headerIndices[norm] !== undefined) {
                return headerIndices[norm]
            }
        }
        return -1
    }

    const usernameIdx = getIndex(['username', 'user'])
    const institutionIdx = getIndex(['institution', 'institutionname', 'school', 'schoolname'])
    const eventIdIdx = getIndex(['eventid', 'event_id', 'event'])

    const participantIdxs: { name: number; email: number; class: number; phone: number }[] = []
    for (let i = 1; i <= 8; i++) {
        participantIdxs.push({
            name: getIndex([`p${i}name`, `participant${i}name`, `p${i}fullname`, `participant${i}fullname`]),
            email: getIndex([`p${i}email`, `participant${i}email`]),
            class: getIndex([`p${i}class`, `participant${i}class`]),
            phone: getIndex([`p${i}phone`, `participant${i}phone`, `p${i}number`, `participant${i}number`]),
        })
    }

    let importedCount = 0

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        const getValue = (idx: number) => {
            if (idx === -1 || idx >= row.length) return null
            const val = row[idx]
            return val !== undefined && val !== '' ? val : null
        }

        const username = getValue(usernameIdx)
        const eventId = getValue(eventIdIdx)

        if (!username || !eventId) {
            continue
        }

        const insertData: any = {
            username,
            eventId,
            institution: getValue(institutionIdx),
        }

        for (let i = 1; i <= 8; i++) {
            const idxs = participantIdxs[i - 1]
            insertData[`p${i}Name`] = getValue(idxs.name)
            insertData[`p${i}Email`] = getValue(idxs.email)
            insertData[`p${i}Class`] = getValue(idxs.class)
            insertData[`p${i}Phone`] = getValue(idxs.phone)
        }

        await (db
            .insert(usrRegs)
            .values(insertData) as any)
            .onConflictDoUpdate({
                target: [usrRegs.username, usrRegs.eventId],
                set: {
                    institution: insertData.institution,
                    p1Name: insertData.p1Name,
                    p1Email: insertData.p1Email,
                    p1Class: insertData.p1Class,
                    p1Phone: insertData.p1Phone,
                    p2Name: insertData.p2Name,
                    p2Email: insertData.p2Email,
                    p2Class: insertData.p2Class,
                    p2Phone: insertData.p2Phone,
                    p3Name: insertData.p3Name,
                    p3Email: insertData.p3Email,
                    p3Class: insertData.p3Class,
                    p3Phone: insertData.p3Phone,
                    p4Name: insertData.p4Name,
                    p4Email: insertData.p4Email,
                    p4Class: insertData.p4Class,
                    p4Phone: insertData.p4Phone,
                    p5Name: insertData.p5Name,
                    p5Email: insertData.p5Email,
                    p5Class: insertData.p5Class,
                    p5Phone: insertData.p5Phone,
                    p6Name: insertData.p6Name,
                    p6Email: insertData.p6Email,
                    p6Class: insertData.p6Class,
                    p6Phone: insertData.p6Phone,
                    p7Name: insertData.p7Name,
                    p7Email: insertData.p7Email,
                    p7Class: insertData.p7Class,
                    p7Phone: insertData.p7Phone,
                    p8Name: insertData.p8Name,
                    p8Email: insertData.p8Email,
                    p8Class: insertData.p8Class,
                    p8Phone: insertData.p8Phone,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                } as any,
            })

        importedCount++
    }

    return jsonOk(
        c,
        {
            connected: true,
            imported: importedCount,
        },
        `google sheets synced successfully ${importedCount} registrations processed`
    )
}