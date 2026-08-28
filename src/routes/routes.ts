import { Hono } from 'hono'
import type { Bindings } from '../types'
import { adminRequired, authRequired, getEmailFromCookie } from '../middleware/auth'
import { apiRateLimiter, authRateLimiter } from '../middleware/rateLimit'
import { cacheMiddleware } from '../middleware/cache'
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
import * as chatHandlers from '../handlers/chat'
import * as adminTicketHandlers from '../handlers/adminTickets'
import * as adminKbHandlers from '../handlers/adminKb'



export function setupRoutes() {
    const app = new Hono<{ Bindings: Bindings }>()

    app.use('/api/*', apiRateLimiter)
    app.use('/api/auth/*', authRateLimiter)

    app.get('/api/health', handlers.healthCheck)

    app.get('/api/admin/oauth2/start', adminRequired, backupHandlers.startOAuth2)
    app.get('/oauth2callback', backupHandlers.handleOAuth2Callback)

    app.post('/api/auth/send-otp', authHandlers.sendOTP)
    app.post('/api/auth/login', handlers.login)
    app.post('/api/auth/signup', handlers.signup)
    app.post('/api/auth/verify-otp', authHandlers.verifyOTP)
    app.get('/api/auth/google', authHandlers.startGoogleOAuth)
    app.get('/api/auth/google/callback', authHandlers.handleGoogleOAuthCback)

    app.post('/api/auth/logout', authHandlers.logout)

    app.get('/api/profile', authRequired, handlers.getProfile)
    app.patch('/api/profile', authRequired, profileHandlers.updateProfile)

    app.get('/api/events', cacheMiddleware(60), handlers.getAllEvents)
    app.get('/api/events/*', cacheMiddleware(60), handlers.getEvent)
    
    // Chatbot
    app.post('/api/query', authRequired, queryHandlers.queryHandler)

    app.post('/api/chat/conversations', authRequired, chatHandlers.createConversation)
    app.get('/api/chat/conversations', authRequired, chatHandlers.listConversations)
    app.get('/api/chat/conversations/:id', authRequired, chatHandlers.getConversation)
    app.delete('/api/chat/conversations/:id', authRequired, chatHandlers.deleteConversation)
    app.post('/api/chat/conversations/:id/messages', authRequired, chatHandlers.sendMessage)
    app.post('/api/chat/conversations/:id/escalate', authRequired, chatHandlers.escalateConversation)


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
    
    app.post('/api/admin/sync-sheets', adminRequired, adminHandlers.syncSheets)

    app.get('/api/admin/tickets', adminRequired, adminTicketHandlers.listTickets)
    app.get('/api/admin/tickets/:id', adminRequired, adminTicketHandlers.getTicket)
    app.post('/api/admin/tickets/:id/reply', adminRequired, adminTicketHandlers.replyTicket)
    app.patch('/api/admin/tickets/:id', adminRequired, adminTicketHandlers.updateTicketStatus)

    app.get('/api/admin/kb/sources', adminRequired, adminKbHandlers.listSources)
    app.post('/api/admin/kb/sources', adminRequired, adminKbHandlers.addSources)
    app.post('/api/admin/kb/sources/seed', adminRequired, adminKbHandlers.seedFromEnv)
    app.delete('/api/admin/kb/sources/:id', adminRequired, adminKbHandlers.deleteSource)
    app.get('/api/admin/kb/sources/:id/chunks', adminRequired, adminKbHandlers.getSourceChunks)
    app.post('/api/admin/kb/sync', adminRequired, adminKbHandlers.syncSources)

    return app
}



