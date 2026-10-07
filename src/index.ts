import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Bindings, AppContext } from './types'
import { logger } from './middleware/logger'
import { setupRoutes, notFoundHandler } from './routes/routes'
import { getDb } from './db/client'
import * as queries from './db/queries'
import { syncAllKbSources } from './lib/kb'
import { exportSheetsToConfigured, backupDatabaseToConfigured } from './lib/scheduledTasks'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger)
app.use('*', cors({
    origin: (origin, c: AppContext) => {
        if (!origin) return undefined as unknown as string
        try {
            const reqUrl = new URL(c.req.url)
            if (origin === `${reqUrl.protocol}//${reqUrl.host}`) return origin
        } catch {
            return undefined as unknown as string
        }
        const allowed = ((c.env.ALLOWED_ORIGINS ?? '') as string)
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        return (allowed.includes(origin) ? origin : undefined) as unknown as string
    },
    credentials: true,
}))
app.use('*', secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
    },
    permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
    },
}))
app.use('/api/auth/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
})

const NO_STORE_PREFIXES = ['/api/profile', '/api/summary', '/api/tickets', '/api/chat', '/api/admin', '/api/query']
app.use('/api/*', async (c, next) => {
    await next()
    const pathname = new URL(c.req.url).pathname
    if (NO_STORE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        c.header('Cache-Control', 'no-store')
    }
})

function isSameOrigin(c: AppContext): boolean {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) return true
    let reqUrl: URL
    try {
        reqUrl = new URL(c.req.url)
    } catch {
        return false
    }
    const origin = c.req.header('Origin')
    const referer = c.req.header('Referer')
    const candidates = [origin, referer].filter((v): v is string => !!v)
    if (candidates.length === 0) return reqUrl.protocol !== 'https:'
    const allowed = ((c.env.ALLOWED_ORIGINS ?? '') as string)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    return candidates.some((raw) => {
        let u: URL
        try {
            u = new URL(raw)
        } catch {
            return false
        }
        if (u.origin === reqUrl.origin) return true
        return allowed.includes(u.origin)
    })
}

app.use('/api/*', async (c, next) => {
    if (!isSameOrigin(c)) {
        return c.json({ status: 'error', error: 'Forbidden' }, 403)
    }
    await next()
})

app.route('/', setupRoutes())

app.notFound((c) => notFoundHandler(c as AppContext))

app.onError((err, c) => {
    console.error(JSON.stringify({ path: c.req.path, message: err instanceof Error ? err.message : String(err) }))
    return c.json({ status: 'error', error: 'Internal server error' }, 500)
})

export default {
    fetch: app.fetch,
    async scheduled(_event: ScheduledEvent, env: Bindings) {
        const started = Date.now()
        const db = getDb(env)
        const step = async (job: string, fn: () => Promise<unknown>) => {
            const t = Date.now()
            try {
                await fn()
                console.log(JSON.stringify({ job, ok: true, durationMs: Date.now() - t }))
            } catch (err) {
                console.error(JSON.stringify({ job, ok: false, durationMs: Date.now() - t, message: err instanceof Error ? err.message : String(err) }))
            }
        }
        await step('deleteExpiredSessions', () => queries.deleteExpiredSessions(db))
        await step('deleteExpiredOtps', () => queries.deleteExpiredOtps(db))
        await step('deleteOldLogs', () => queries.deleteOldLogs(db, 30))
        await step('deleteOldRateCounters', () => queries.deleteOldRateCounters(db, 2))
        await step('syncAllKbSources', () => syncAllKbSources(db, env).then(() => undefined))
        await step('exportSheetsToConfigured', () => exportSheetsToConfigured(db, env))
        await step('backupDatabaseToConfigured', () => backupDatabaseToConfigured(db, env))
        console.log(JSON.stringify({ job: 'scheduled', ok: true, durationMs: Date.now() - started }))
    },
}
