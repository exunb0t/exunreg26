import { createMiddleware } from 'hono/factory'
import type { Bindings } from '../types'

export const logger = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const start = Date.now()
    await next()
    const duration = Date.now() - start
    console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`)
})
