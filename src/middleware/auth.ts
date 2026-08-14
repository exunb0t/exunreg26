import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'

import type { Context } from 'hono'

import type { Bindings, ApiResponse } from '../types'

export function getEmailFromCookie(c: Context<{ Bindings: Bindings }>): string {
    return getCookie(c, 'email') ?? ''
}

export function isAuthenticated(c: Context<{ Bindings: Bindings }>): boolean {
    const email = getCookie(c, 'email')
    const token = getCookie(c, 'auth_token')
    return Boolean(email && token)
}

export const authRequired = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const email = getCookie(c, 'email')
    const token = getCookie(c, 'auth_token')

    if (!email || !token) {
        const body: ApiResponse = { status: 'error', error: 'Authentication required' }

        return c.json(body, 401)
    }

    await next()
})
