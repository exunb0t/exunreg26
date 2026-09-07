async function getEncKey(salt: string): Promise<CryptoKey> {
    const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`token-enc:${salt}`))
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
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

export async function encryptSecret(plain: string, salt: string): Promise<string> {
    const key = await getEncKey(salt)
    const iv = new Uint8Array(12)
    crypto.getRandomValues(iv)
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
    return `enc1$${b64encode(iv)}$${b64encode(new Uint8Array(ct))}`
}

export async function decryptSecret(stored: string, salt: string): Promise<string> {
    if (!stored.startsWith('enc1$')) return stored
    const parts = stored.split('$')
    if (parts.length !== 3 || !parts[1] || !parts[2]) throw new Error('Malformed encrypted token')
    const key = await getEncKey(salt)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64decode(parts[1]) }, key, b64decode(parts[2]))
    return new TextDecoder().decode(pt)
}
