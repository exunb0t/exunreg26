import { Hono } from 'hono'
import type { Bindings } from '../types'
import { adminRequired, authRequired, getEmailFromCookie } from '../middleware/auth'
import { isAdminEmail } from '../lib/admin'
import { jsonError } from '../lib/response'

import * as handlers from '../handlers/handlers'
import * as authHandlers from '../handlers/auth'
import * as profileHandlers from '../handlers/profile'
import * as queryHandlers from '../handlers/query'
import * as regHandlers from '../handlers/reg'
import * as summaryHandlers from '../handlers/summary'
import * as adminHandlers from '../handlers/admin'
import * as backupHandlers from '../handlers/backup'

export function setupRoutes() {
    const app = new Hono<{ Bindings: Bindings }>()

    app.get('/api/health', handlers.healthCheck)

    app.get('/api/admin/oauth2/start', authRequired, async (c) => {
        const email = getEmailFromCookie(c)
        if (!isAdminEmail(email, c.env)) {

            return jsonError(c, 'forbidden', 403)
        }
        return backupHandlers.startOAuth2(c)
    })
    app.get('/oauth2callback', backupHandlers.handleOAuth2Callback)

    app.post('/api/auth/send-otp', authHandlers.sendOTP)
    app.post('/api/auth/login', handlers.login)
    app.post('/api/auth/signup', handlers.signup)
    app.post('/api/auth/verify-otp', authHandlers.verifyOTP)

    app.post('/api/auth/logout', authHandlers.logout)

    app.get('/api/profile', authRequired, handlers.getProfile)
    app.patch('/api/profile', authRequired, profileHandlers.updateProfile)

    app.get('/api/events', handlers.getAllEvents)
    app.get('/api/events/*', handlers.getEvent)

    app.post('/api/query', queryHandlers.queryHandler)

    app.post('/api/submit_registrations', authRequired, regHandlers.submitRegistrations)
    app.get('/api/summary', authRequired, summaryHandlers.getUserSummary)

    app.get('/api/admin/stats', adminRequired, adminHandlers.getAdminStats)
    app.get('/api/admin/config', adminRequired, adminHandlers.getAdminConfig)

    app.post('/api/admin/events', adminRequired, adminHandlers.createEvent)
    app.get('/api/admin/events/:id', adminRequired, adminHandlers.getAdminEvent)

    app.put('/api/admin/events/:id', adminRequired, adminHandlers.updateEvent)
    app.delete('/api/admin/events/:id', adminRequired, adminHandlers.deleteEvent)

    app.get('/api/admin/users/:id', adminRequired, adminHandlers.getUserDetails)

    app.get('/api/admin/events/:id/registrations', adminRequired, adminHandlers.getEventRegistrations)
    app.get('/api/admin/export', adminRequired, adminHandlers.exportData)
    app.post('/api/admin/send-invite', adminRequired, adminHandlers.sendInvite)
    app.post('/api/admin/import_events', adminRequired, adminHandlers.importEvents)
    
    app.post('/api/admin/sync-sheets', authRequired, async (c) => {
        const email = getEmailFromCookie(c)
        if (!isAdminEmail(email, c.env)) {
            return jsonError(c, 'forbidden', 403)
        }

        return adminHandlers.syncSheets(c)
    })

    return app
}
