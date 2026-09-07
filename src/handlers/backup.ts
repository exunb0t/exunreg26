import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { AppContext } from '../types'
import { getDb } from '../db/client'
import { upsertOAuthToken } from '../db/queries'
import { jsonOk, jsonError } from '../lib/response'
import { authCookieOpts } from '../lib/cookies'
import { encryptSecret } from '../lib/tokenCrypto'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const STATE_COOKIE = 'oauth_state'

function redirectUri(c: AppContext) {
    return new URL('/oauth2callback', c.req.url).toString()
}

export async function startOAuth2(c: AppContext) {
    const clientId = c.env.GOOGLE_CLIENT_ID
    if (!clientId) {
        return jsonError(c, 'GOOGLE_CLIENT_ID not configured', 500)
    }

    const state = crypto.randomUUID()
    setCookie(c, STATE_COOKIE, state, authCookieOpts(c, 300))

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri(c))
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', DRIVE_SCOPE)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('state', state)

    return c.redirect(url.toString(), 302)
}

export async function handleOAuth2Callback(c: AppContext) {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const expectedState = getCookie(c, STATE_COOKIE)

    deleteCookie(c, STATE_COOKIE, { path: '/' })

    if (!state || !expectedState || state !== expectedState) {
        return jsonError(c, 'state mismatch', 400)
    }
    if (!code) {
        return jsonError(c, 'missing code', 400)
    }

    const clientId = c.env.GOOGLE_CLIENT_ID
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
        return jsonError(c, 'Google OAuth credentials not configured', 500)
    }

    const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(c),
        grant_type: 'authorization_code',
    })

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    })

    if (!tokenRes.ok) {
        const errText = await tokenRes.text()
        return jsonError(c, `tok exchange failed: ${errText}`, 502)
    }

    const token = await tokenRes.json<{
        access_token: string
        refresh_token?: string
        scope?: string
        token_type?: string
        expires_in?: number
    }>()

    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null

    const db = getDb(c.env)
    const salt = c.env.AUTH_SALT || ''
    await upsertOAuthToken(db, {
        provider: 'google_drive',
        accessToken: await encryptSecret(token.access_token, salt),
        refreshToken: token.refresh_token ? await encryptSecret(token.refresh_token, salt) : token.refresh_token,
        scope: token.scope,
        tokenType: token.token_type,
        expiresAt,
    })

    return jsonOk(c, { connected: true }, 'Google Drive connected')
}
