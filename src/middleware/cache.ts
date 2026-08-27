import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings } from '../types'

interface CacheEntry {
    body: string
    contentType: string
    status: number
    expiresAt: number
}

const responseCache = new Map<string, CacheEntry>()

export function cacheMiddleware(ttlSeconds: number = 60): MiddlewareHandler<{ Bindings: Bindings }> {
    return async (c, next) => {
        // we only caching get requests
        if (c.req.method !== 'GET') {
            await next()
            return
        }

        const email = getCookie(c, 'email') || ''
        const cacheKey = `${c.req.url}:${email}`
        const cached = responseCache.get(cacheKey)
        const now = Date.now()

        if (cached && cached.expiresAt > now) {
            c.header('Cache-Control', `private, max-age=${ttlSeconds}`)
            c.header('X-Cache', 'HIT')
            return c.text(cached.body, cached.status as any, {
                'Content-Type': cached.contentType || 'application/json',
            })
        }

        await next()

        if (c.res.status === 200) {
            const bodyText = await c.res.clone().text()
            const contentType = c.res.headers.get('Content-Type') || 'application/json'

            responseCache.set(cacheKey, {
                body: bodyText,
                contentType,
                status: c.res.status,
                expiresAt: now + ttlSeconds * 1000,
            })

            c.header('Cache-Control', `private, max-age=${ttlSeconds}`)
            c.header('X-Cache', 'MISS')
        }
    }
}

export function clearResponseCache() {
    responseCache.clear()
}
