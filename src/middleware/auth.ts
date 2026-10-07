import { createMiddleware } from 'hono/factory'
import { isAdmin } from '../lib/admin'
import type { Context } from 'hono'

import type { Bindings, ApiResponse } from '../types'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { hashSessionToken } from '../lib/crypto'
import { normalizeEmail } from '../lib/validation'
import { getAuthTokenCookie, getEmailCookie } from '../lib/cookies'

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000


export function getEmailFromCookie(c: Context<{ Bindings: Bindings }>): string {
    return normalizeEmail(getEmailCookie(c) ?? '')
}

function getPepper(c: Context<{ Bindings: Bindings }>): string {
    return (c.env.AUTH_SALT ?? '').trim()
}

function isExpired(expiresAt: string): boolean {
    const t = new Date(expiresAt).getTime()
    if (!Number.isFinite(t)) return true
    return t < Date.now()
}

function isAdminExpired(createdAt: string): boolean {
    const t = new Date(createdAt).getTime()
    if (!Number.isFinite(t)) return true
    return Date.now() - t > ADMIN_SESSION_TTL_MS
}


export async function isAuthenticated(
    c: Context<{ Bindings: Bindings }>
): Promise<boolean> {

    const email = getEmailFromCookie(c)
    const token = getAuthTokenCookie(c)

    if (!email || !token) {
        return false
    }

    const pepper = getPepper(c)
    if (!pepper) {
        return false
    }

    const db = getDb(c.env)

    const hashed = await hashSessionToken(token, pepper)
    const session = await queries.getSessionByToken(
        db,
        hashed
    )

    if (!session) {
        return false
    }

    if (isExpired(session.expiresAt)) {
        await queries.deleteSession(
            db,
            hashed
        )

        return false
    }

    if (normalizeEmail(session.email) !== email) {
        return false
    }

    if (await isAdmin(db, email, c.env)) {
        if (isAdminExpired(session.createdAt)) {
            await queries.deleteSession(db, hashed)
            return false
        }
    }

    return true
}

export async function getAuthenticatedEmail(
    c: Context<{ Bindings: Bindings }>
): Promise<string> {
    const ok = await isAuthenticated(c)
    if (!ok) return ''
    return getEmailFromCookie(c)
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

export const adminRequired = createMiddleware<{ Bindings: Bindings}>(
    async (c, next) => {
        const authenticated = await isAuthenticated(c)

        if (!authenticated) {
            const body: ApiResponse = {
                status: 'error',
                error: 'Authentication required'
            }
            return c.json(body, 401)
        }

        const email = getEmailFromCookie(c)
        const db = getDb(c.env)
        if (!(await isAdmin(db, email, c.env))) {
            const body: ApiResponse = {
                status: 'error',
                error: 'Not admin'
            }
            return c.json(body, 403)
        }

        await next()
    }
)