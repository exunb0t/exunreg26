import type { MiddlewareHandler } from 'hono'
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

        const url = c.req.url
        const cached = responseCache.get(url)
        const now = Date.now()

        if (cached && cached.expiresAt > now) {
            c.header('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds * 5}`)
            c.header('X-Cache', 'HIT')
            return c.text(cached.body, cached.status as any, {
                'Content-Type': cached.contentType || 'application/json',
            })
        }

        await next()

        if (c.res.status === 200) {
            const bodyText = await c.res.clone().text()
            const contentType = c.res.headers.get('Content-Type') || 'application/json'

            responseCache.set(url, {
                body: bodyText,
                contentType,
                status: c.res.status,
                expiresAt: now + ttlSeconds * 1000,
            })

            c.header('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds * 5}`)
            c.header('X-Cache', 'MISS')
        }
    }
}

export function clearResponseCache() {
    responseCache.clear()
}
