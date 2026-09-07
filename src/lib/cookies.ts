import { setCookie } from 'hono/cookie'
import type { AppContext } from '../types'

export function cookieSecure(c: AppContext): boolean {
    if (c.env.COOKIE_SECURE === 'true') return true
    try {
        return new URL(c.req.url).protocol === 'https:'
    } catch {
        return false
    }
}

export function authCookieOpts(c: AppContext, maxAge: number) {
    return {
        path: '/',
        httpOnly: true,
        secure: cookieSecure(c),
        sameSite: 'Lax' as const,
        maxAge,
    }
}

export function setAuthCookies(c: AppContext, email: string, token: string, maxAge: number) {
    const opts = authCookieOpts(c, maxAge)
    setCookie(c, 'email', email, opts)
    setCookie(c, 'auth_token', token, opts)
}
