import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { isAdminEmail } from '../lib/admin'
import type { Context } from 'hono'

import type { Bindings, ApiResponse } from '../types'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { hashSessionToken } from '../lib/crypto'
import { normalizeEmail } from '../lib/validation'


export function getEmailFromCookie(c: Context<{ Bindings: Bindings }>): string {
    return normalizeEmail(getCookie(c, 'email') ?? '')
}

function getPepper(c: Context<{ Bindings: Bindings }>): string {
    return (c.env.AUTH_SALT ?? '').trim()
}

function isExpired(expiresAt: string): boolean {
    const t = new Date(expiresAt).getTime()
    if (!Number.isFinite(t)) return true
    return t < Date.now()
}


export async function isAuthenticated(
    c: Context<{ Bindings: Bindings }>
): Promise<boolean> {

    const email = getEmailFromCookie(c)
    const token = getCookie(c, 'auth_token')

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

    if (session) {
        if (isExpired(session.expiresAt)) {
            await queries.deleteSession(
                db,
                hashed
            )

            return false
        }

        return normalizeEmail(session.email) === email
    }

    const legacy = await queries.getSessionByToken(db, token)
    if (!legacy) {
        return false
    }
    if (isExpired(legacy.expiresAt)) {
        await queries.deleteSession(db, token)
        return false
    }
    if (normalizeEmail(legacy.email) !== email) {
        return false
    }
    try {
        await queries.deleteSession(db, token)
        await queries.createSession(db, legacy.email, hashed, legacy.expiresAt)
    } catch {
        const retry = await queries.getSessionByToken(db, hashed)
        if (!retry) return false
        if (isExpired(retry.expiresAt)) return false
        return normalizeEmail(retry.email) === email
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
        if (!isAdminEmail(email, c.env)) {
            const body: ApiResponse = {
                status: 'error',
                error: 'Not admin'
            }
            return c.json(body, 403)
        }

        await next()
    }
)