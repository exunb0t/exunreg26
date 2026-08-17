import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'

import type { Context } from 'hono'

import type { Bindings, ApiResponse } from '../types'
import { getDb } from '../db/client'
import * as queries from '../db/queries'


export function getEmailFromCookie(c: Context<{ Bindings: Bindings }>): string {
    return getCookie(c, 'email') ?? ''
}


export async function isAuthenticated(
    c: Context<{ Bindings: Bindings }>
): Promise<boolean> {

    const email = getCookie(c, 'email')
    const token = getCookie(c, 'auth_token')

    if (!email || !token) {
        return false
    }

    const db = getDb(c.env)

    const session = await queries.getSessionByToken(
        db,
        token
    )

    if (!session) {
        return false
    }

    if (new Date(session.expiresAt) < new Date()) {
        await queries.deleteSession(
            db,
            token
        )

        return false
    }

    return session.email === email
}


export const authRequired = createMiddleware<{ Bindings: Bindings }>(
    async (c, next) => {

        const authenticated = await isAuthenticated(c)

        if (!authenticated) {

            const body: ApiResponse = {
                status: 'error',
                error: 'Authentication required'
            }

            return c.json(body, 401)
        }

        await next()
    }
)