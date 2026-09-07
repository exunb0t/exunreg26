import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Bindings, AppContext } from './types'
import { logger } from './middleware/logger'
import { setupRoutes, notFoundHandler } from './routes/routes'
import { getDb } from './db/client'
import * as queries from './db/queries'
import { syncAllKbSources } from './lib/kb'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger)
app.use('*', cors({
    origin: (origin, c: AppContext) => {
        if (!origin) return ''
        try {
            const reqUrl = new URL(c.req.url)
            if (origin === `${reqUrl.protocol}//${reqUrl.host}`) return origin
        } catch {
            return ''
        }
        const allowed = ((c.env.ALLOWED_ORIGINS ?? '') as string)
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        return allowed.includes(origin) ? origin : ''
    },
    credentials: true,
}))
app.use('*', secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
}))

app.route('/', setupRoutes())

app.notFound((c) => notFoundHandler(c as AppContext))

app.onError((err, c) => {
    console.error(err)
    return c.json({ status: 'error', error: 'Internal server error' }, 500)
})

export default {
    fetch: app.fetch,
    async scheduled(_event: ScheduledEvent, env: Bindings) {
        const db = getDb(env)
        const nowIso = new Date().toISOString()
        await queries.deleteExpiredSessions(db, nowIso)
        await queries.deleteExpiredOtps(db, nowIso)
        await syncAllKbSources(db, env)
    },
}
