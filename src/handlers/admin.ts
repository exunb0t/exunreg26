import type { AppContext } from '../types'
import { notImplemented } from './_stub'
import { jsonOk } from '../lib/response'

export async function getAdminStats(c: AppContext) {
    return notImplemented(c)
}

// Get Admin Config
export async function getAdminConfig(c: AppContext) {
    return jsonOk(c, {admin_emails: c.env.ADMIN_EMAILS}, 'Admin Emails')
}

//POST /api/admin/events
export async function createEvent(c: AppContext) {
    return notImplemented(c)
}

// GET /api/admin/events/:id
export async function getAdminEvent(c: AppContext) {
    return notImplemented(c)
}

// PUT /api/admin/events/:id

export async function updateEvent(c: AppContext) {
    return notImplemented(c)
}

//DELETE /api/admin/events/:id
export async function deleteEvent(c: AppContext) {
    return notImplemented(c)
}

export async function getUserDetails(c: AppContext) {
    return notImplemented(c)
}

export async function getEventRegistrations(c: AppContext) {
    return notImplemented(c)
}

export async function exportData(c: AppContext) {
    return notImplemented(c)
}

export async function sendInvite(c: AppContext) {
    return notImplemented(c)
}

export async function importEvents(c: AppContext) {
    return notImplemented(c)
}

export async function syncSheets(c: AppContext) {
    return notImplemented(c)
}
