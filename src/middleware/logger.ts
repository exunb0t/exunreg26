import { createMiddleware } from 'hono/factory'
import type { Bindings } from '../types'

export const logger = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const start = Date.now()
    const requestId = crypto.randomUUID()
    c.header('X-Request-Id', requestId)
    await next()
    const duration = Date.now() - start
    console.log(JSON.stringify({ requestId, method: c.req.method, path: c.req.path, status: c.res.status, duration }))
})
