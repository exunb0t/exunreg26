import type { MiddlewareHandler } from 'hono'
import type { Bindings } from '../types'
import { jsonError } from '../lib/response'

interface RateLimitEntry {
    count: number
    resetTime: number
}

const store: Record<string, RateLimitEntry> = {}

export function rateLimiter(options: { windowMs: number; maxRequests: number; bindingName?: 'API_RATE_LIMITER' | 'AUTH_RATE_LIMITER' }): MiddlewareHandler<{ Bindings: Bindings }> {
    return async (c, next) => {
        const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown-ip'

        // native cf rate limiting binding check
        const cfBinding = options.bindingName ? c.env[options.bindingName] : c.env.API_RATE_LIMITER
        if (cfBinding && typeof cfBinding.limit === 'function') {
            const { success } = await cfBinding.limit({ key: ip })
            if (!success) {
                return jsonError(c, 'Too many rquests. Please try again later', 429)
            }
            await next()
            return
        }

        const now = Date.now()

        // prevent mem leak by cleaning up
        for (const k in store) {
            if (store[k].resetTime < now) {
                delete store[k]
            }
        }

        if (!store[ip] || store[ip].resetTime < now) {
            store[ip] = { count: 1, resetTime: now + options.windowMs }
        } else {
            store[ip].count++
        }

        const remaining = Math.max(0, options.maxRequests - store[ip].count)
        const resetSeconds = Math.ceil((store[ip].resetTime - now) / 1000)

        c.header('X-RateLimit-Limit', options.maxRequests.toString())
        c.header('X-RateLimit-Remaining', remaining.toString())
        c.header('X-RateLimit-Reset', resetSeconds.toString())

        if (store[ip].count > options.maxRequests) {
            c.header('Retry-After', resetSeconds.toString())
            return jsonError(c, 'Too many rquests. Please try again later', 429)
        }

        await next()
    }
}

// 100 reqs per min
export const apiRateLimiter = rateLimiter({ windowMs: 60 * 1000, maxRequests: 100, bindingName: 'API_RATE_LIMITER' })

// 10 reqs per min for auth
export const authRateLimiter = rateLimiter({ windowMs: 60 * 1000, maxRequests: 10, bindingName: 'AUTH_RATE_LIMITER' })