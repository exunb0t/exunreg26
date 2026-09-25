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
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
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

app.route('/', setupRoutes())

app.notFound((c) => notFoundHandler(c as AppContext))

app.onError((err, c) => {
    console.error(JSON.stringify({ path: c.req.path, message: err instanceof Error ? err.message : String(err) }))
    return c.json({ status: 'error', error: 'Internal server error' }, 500)
})

export default {
    fetch: app.fetch,
    async scheduled(_event: ScheduledEvent, env: Bindings) {
        const db = getDb(env)
        const nowIso = new Date().toISOString()
        try {
            await queries.deleteExpiredSessions(db, nowIso)
        } catch (err) {
            console.error(JSON.stringify({ job: 'deleteExpiredSessions', message: err instanceof Error ? err.message : String(err) }))
        }
        try {
            await queries.deleteExpiredOtps(db, nowIso)
        } catch (err) {
            console.error(JSON.stringify({ job: 'deleteExpiredOtps', message: err instanceof Error ? err.message : String(err) }))
        }
        try {
            await syncAllKbSources(db, env)
        } catch (err) {
            console.error(JSON.stringify({ job: 'syncAllKbSources', message: err instanceof Error ? err.message : String(err) }))
        }
        await exportSheetsToConfigured(db, env).catch((err) => console.error(JSON.stringify({ job: 'sheetsExport', message: err instanceof Error ? err.message : String(err) })))
        await backupDatabaseToConfigured(db, env).catch((err) => console.error(JSON.stringify({ job: 'driveBackup', message: err instanceof Error ? err.message : String(err) })))
    },
}
