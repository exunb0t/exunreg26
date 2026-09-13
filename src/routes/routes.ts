import { Hono } from 'hono'
import type { Bindings, AppContext } from '../types'
import { jsonError } from '../lib/response'
import { adminRequired, authRequired } from '../middleware/auth'
import { apiRateLimiter, authRateLimiter, chatRateLimiter } from '../middleware/rateLimit'
import { cacheMiddleware } from '../middleware/cache'
import * as handlers from '../handlers/handlers'
import * as authHandlers from '../handlers/auth'
import * as profileHandlers from '../handlers/profile'
import * as queryHandlers from '../handlers/query'
import * as regHandlers from '../handlers/reg'
import * as summaryHandlers from '../handlers/summary'
import * as adminHandlers from '../handlers/admin'
import * as exportHandlers from '../handlers/export'
import * as backupHandlers from '../handlers/backup'
import * as chatHandlers from '../handlers/chat'
import * as adminTicketHandlers from '../handlers/adminTickets'
import * as adminKbHandlers from '../handlers/adminKb'
import * as ticketHandlers from '../handlers/tickets'

export function serveAsset(c: AppContext, path: string) {
    const url = new URL(c.req.url)
    url.pathname = path
    return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
}

export function notFoundHandler(c: AppContext) {
    const pathname = new URL(c.req.url).pathname
    if (pathname.startsWith('/api/')) return jsonError(c, 'Not found', 404)
    const last = pathname.split('/').pop() ?? ''
    if (last.includes('.')) return serveAsset(c, pathname)
    return serveAsset(c, '/404.html')
}

export function setupRoutes() {
    const app = new Hono<{ Bindings: Bindings }>()

    app.use('/api/*', apiRateLimiter)
    app.use('/api/auth/*', authRateLimiter)
    app.use('/api/chat/*', chatRateLimiter)

    app.get('/api/health', handlers.healthCheck)
    app.get('/api/auth/session', authHandlers.getSession)

    app.get('/api/admin/oauth2/start', adminRequired, backupHandlers.startOAuth2)
    app.get('/oauth2callback', backupHandlers.handleOAuth2Callback)

    app.post('/api/auth/send-otp', authHandlers.sendOTP)
    app.post('/api/auth/login', handlers.login)
    app.post('/api/auth/signup', handlers.signup)
    app.post('/api/auth/verify-otp', authHandlers.verifyOTP)

    app.post('/api/auth/logout', authHandlers.logout)

    app.get('/api/profile', authRequired, handlers.getProfile)
    app.patch('/api/profile', authRequired, profileHandlers.updateProfile)

    app.get('/api/events', cacheMiddleware(60), handlers.getAllEvents)
    app.get('/api/events/detail', cacheMiddleware(60), handlers.getEvent)
    app.get('/api/events/:id', cacheMiddleware(60), handlers.getEvent)
    app.get('/api/events/*', cacheMiddleware(60), handlers.getEvent)

    app.post('/api/query', authRequired, queryHandlers.queryHandler)
    app.get('/api/tickets/mine', authRequired, queryHandlers.listMyTickets)
    app.get('/api/tickets/next', authRequired, ticketHandlers.nextTicket)
    app.post('/api/tickets', authRequired, ticketHandlers.createTicket)
    app.get('/ticket', (c) => serveAsset(c, '/ticket.html'))

    app.post('/api/chat/conversations', authRequired, chatHandlers.createConversation)
    app.get('/api/chat/conversations', authRequired, chatHandlers.listConversations)
    app.get('/api/chat/conversations/:id', authRequired, chatHandlers.getConversation)
    app.delete('/api/chat/conversations/:id', authRequired, chatHandlers.deleteConversation)
    app.post('/api/chat/conversations/:id/messages', authRequired, chatHandlers.sendMessage)
    app.patch('/api/chat/conversations/:cid/messages/:mid', authRequired, chatHandlers.updateMessage)
    app.post('/api/chat/conversations/:id/escalate', authRequired, chatHandlers.escalateConversation)

    app.post('/api/submit_registrations', authRequired, regHandlers.submitRegistrations)
    app.put('/api/submit_registrations', authRequired, regHandlers.updateRegistration)
    app.delete('/api/submit_registrations', authRequired, regHandlers.deleteRegistration)
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

    app.post('/api/admin/export-sheets', adminRequired, exportHandlers.exportSheets)
    app.post('/api/admin/backup-now', adminRequired, exportHandlers.backupNow)

    app.get('/api/admin/tickets', adminRequired, adminTicketHandlers.listTickets)
    app.get('/api/admin/tickets/:id', adminRequired, adminTicketHandlers.getTicket)
    app.post('/api/admin/tickets/:id/reply', adminRequired, adminTicketHandlers.replyTicket)
    app.patch('/api/admin/tickets/:id', adminRequired, adminTicketHandlers.updateTicketStatus)

    app.get('/api/admin/kb/sources', adminRequired, adminKbHandlers.listSources)
    app.post('/api/admin/kb/sources', adminRequired, adminKbHandlers.addSources)
    app.post('/api/admin/kb/sources/seed', adminRequired, adminKbHandlers.seedFromEnv)
    app.delete('/api/admin/kb/sources/:id', adminRequired, adminKbHandlers.deleteSource)
    app.post('/api/admin/kb/sources/:id/toggle', adminRequired, adminKbHandlers.toggleSource)
    app.get('/api/admin/kb/sources/:id/chunks', adminRequired, adminKbHandlers.getSourceChunks)
    app.post('/api/admin/kb/sync', adminRequired, adminKbHandlers.syncSources)

    app.get('/', (c) => serveAsset(c, '/index.html'))
    app.get('/events', (c) => serveAsset(c, '/events.html'))
    app.get('/login', (c) => serveAsset(c, '/login.html'))
    app.get('/summary', (c) => serveAsset(c, '/summary.html'))
    app.get('/complete', (c) => serveAsset(c, '/complete.html'))
    app.get('/admin', (c) => serveAsset(c, '/admin.html'))
    app.get('/brochure', (c) => serveAsset(c, '/brochure.html'))
    app.get('/query', (c) => serveAsset(c, '/query.html'))
    app.get('/event-detail', (c) => serveAsset(c, '/event-detail.html'))
    app.get('/event/:slug', (c) => serveAsset(c, '/event-detail.html'))

    return app
}
