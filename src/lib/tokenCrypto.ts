import type { Bindings } from '../types'

export function tokenPepper(env: Bindings): string {
    const dedicated = (env.OAUTH_PEPPER ?? '').trim()
    if (dedicated) return dedicated
    return (env.AUTH_SALT ?? '').trim()
}

async function getLegacyEncKey(salt: string): Promise<CryptoKey> {
    const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`token-enc:${salt}`))
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function getEncKey(salt: string, provider: string): Promise<CryptoKey> {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(salt || 'missing-salt'), { name: 'HKDF' }, false, ['deriveKey'])
    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new TextEncoder().encode('token-enc:v2'),
            info: new TextEncoder().encode(`provider:${provider}`),
        },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    )
}

function b64encode(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
}

function b64decode(s: string): Uint8Array {
    const bin = atob(s)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
}

export async function encryptSecret(plain: string, salt: string, provider = 'google_drive'): Promise<string> {
    if (!salt) throw new Error('AUTH_SALT is required for token encryption')
    const key = await getEncKey(salt, provider)
    const iv = new Uint8Array(12)
    crypto.getRandomValues(iv)
    const aad = new TextEncoder().encode(`provider:${provider}`)
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, new TextEncoder().encode(plain))
    return `enc2$${provider}$${b64encode(iv)}$${b64encode(new Uint8Array(ct))}`
}

async function decryptV2(parts: string[], salt: string): Promise<string> {
    const provider = parts[1]
    const key = await getEncKey(salt, provider)
    const aad = new TextEncoder().encode(`provider:${provider}`)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64decode(parts[2]), additionalData: aad }, key, b64decode(parts[3]))
    return new TextDecoder().decode(pt)
}

async function decryptV1(stored: string, salt: string): Promise<string> {
    const parts = stored.split('$')
    if (parts.length !== 3 || !parts[1] || !parts[2]) throw new Error('Malformed encrypted token')
    const key = await getLegacyEncKey(salt)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64decode(parts[1]) }, key, b64decode(parts[2]))
    return new TextDecoder().decode(pt)
}

export async function decryptSecret(stored: string, salt: string, provider = 'google_drive'): Promise<string> {
    if (!stored.startsWith('enc1$') && !stored.startsWith('enc2$')) return stored
    if (stored.startsWith('enc2$')) {
        const parts = stored.split('$')
        if (parts.length !== 4 || !parts[1] || !parts[2] || !parts[3]) throw new Error('Malformed encrypted token')
        try {
            return await decryptV2(parts, salt)
        } catch {
            return decryptV1(`enc1$${parts[2]}$${parts[3]}`, salt).catch(() => {
                throw new Error('Failed to decrypt token')
            })
        }
    }
    try {
        return await decryptV1(stored, salt)
    } catch {
        const parts = stored.split('$')
        if (parts.length === 3 && parts[1] && parts[2]) {
            return decryptV2(['enc2', provider, parts[1], parts[2]], salt)
        }
        throw new Error('Failed to decrypt token')
    }
}
