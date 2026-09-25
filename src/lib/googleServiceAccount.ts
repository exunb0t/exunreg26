import type { Bindings } from '../types'

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

let cachedToken: { token: string; expiresAt: number } | null = null

function b64url(input: string | ArrayBuffer): string {
    let bin: string
    if (typeof input === 'string') {
        bin = btoa(unescape(encodeURIComponent(input)))
    } else {
        const bytes = new Uint8Array(input)
        let s = ''
        for (let i = 0; i < bytes.length; i += 0x8000) {
            s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        }
        bin = btoa(s)
    }
    return bin.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): ArrayBuffer {
    const b64 = pem
        .replace(/-----[^-]+-----/g, '')
        .replace(/\s/g, '')
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes.buffer
}

export function getServiceAccountEmail(env: Bindings): string | null {
    try {
        const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '') as { client_email?: string }
        return creds.client_email ?? null
    } catch {
        return null
    }
}

export async function buildServiceAccountAssertion(
    env: Bindings,
    nowSec = Math.floor(Date.now() / 1000)
): Promise<{ assertion: string; email: string }> {

    const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured')

    let creds: { client_email: string; private_key: string }
    try {
        creds = JSON.parse(raw)
    } catch {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON')
    }
    if (!creds.client_email || !creds.private_key) {
        throw new Error('Service account JSON missing client_email/private_key')
    }

    const now = nowSec
    const signingInput = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
        JSON.stringify({
            iss: creds.client_email,
            scope: SHEETS_SCOPE,
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
        })
    )}`

    const key = await crypto.subtle.importKey(
        'pkcs8',
        pemToDer(creds.private_key),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const sig = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(signingInput)
    )

    return { assertion: `${signingInput}.${b64url(sig)}`, email: creds.client_email }
}

export async function getServiceAccountToken(env: Bindings): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token

    const { assertion } = await buildServiceAccountAssertion(env)

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
        signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Service account token exchange failed: ${await res.text()}`)

    const data = await res.json<{ access_token: string; expires_in?: number }>()
    cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    }
    return data.access_token
}
