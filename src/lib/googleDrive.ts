import type { Bindings } from '../types'
import type { Db } from '../db/client'
import * as queries from '../db/queries'
import { decryptSecret, encryptSecret } from './tokenCrypto'

export async function getOAuthAccessToken(db: Db, env: Bindings): Promise<string> {
    const token = await queries.getOAuthToken(db, 'google_drive')
    if (!token) throw new Error('Google account not connected')

    const salt = (env.AUTH_SALT ?? '').trim()
    if (!salt) throw new Error('Server misconfigured')
    let accessToken: string
    try {
        accessToken = await decryptSecret(token.accessToken, salt, 'google_drive')
    } catch {
        throw new Error('Stored Google credentials are invalid. Please reconnect.')
    }

    const refreshToken = token.refreshToken ? await decryptSecret(token.refreshToken, salt, 'google_drive').catch(() => null) : null
    const expTime = token.expiresAt ? new Date(token.expiresAt).getTime() : NaN

    if ((!Number.isFinite(expTime) || expTime <= Date.now()) && refreshToken) {
        const clientId = env.GOOGLE_CLIENT_ID
        const clientSecret = env.GOOGLE_CLIENT_SECRET
        if (!clientId || !clientSecret) {
            throw new Error('Google Client credentials not configured on server to refresh token')
        }

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
            signal: AbortSignal.timeout(15000),
        })
        if (!tokenRes.ok) throw new Error(`Failed to refresh Google token: ${await tokenRes.text()}`)

        const refreshed = await tokenRes.json<{ access_token: string; expires_in?: number }>()
        accessToken = refreshed.access_token
        await queries.upsertOAuthToken(db, {
            provider: 'google_drive',
            accessToken: await encryptSecret(accessToken, salt, 'google_drive'),
            refreshToken: token.refreshToken,
            scope: token.scope,
            tokenType: token.tokenType,
            expiresAt: refreshed.expires_in
                ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
                : null,
        })
    }

    return accessToken
}

export interface DriveFile {
    id: string
    name: string
    description?: string
    createdTime?: string
}

async function driveFetch(token: string, path: string, init?: RequestInit): Promise<any> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`Drive API ${path} failed (${res.status}): ${await res.text()}`)
    if (res.status === 204) return null
    return res.json()
}

export async function listBackups(token: string, folderId: string): Promise<DriveFile[]> {
    const q = `'${folderId}' in parents and name contains 'exunreg26-backup' and trashed = false`
    const data = await driveFetch(
        token,
        `files?q=${encodeURIComponent(q)}&fields=files(id,name,description,createdTime)&orderBy=createdTime desc&pageSize=20`
    )
    return (data.files ?? []) as DriveFile[]
}

export async function uploadBackup(
    token: string,
    folderId: string,
    name: string,
    hash: string,
    content: string
): Promise<string> {
    const boundary = `exunreg26-${Date.now().toString(36)}`
    const metadata = JSON.stringify({ name, parents: [folderId], description: hash, mimeType: 'application/json' })
    const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n` +
        `--${boundary}--`

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
        signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error(`Drive upload failed (${res.status}): ${await res.text()}`)
    const data = await res.json<{ id: string }>()
    return data.id
}

export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
    await driveFetch(token, `files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }).catch(() => null)
}
