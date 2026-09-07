function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bufferToHex(digest)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function newPasswordHash(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16)
  crypto.getRandomValues(saltBytes)
  const salt = [...saltBytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  const hash = await sha256Hex(salt + password)
  return `v2$${salt}$${hash}`
}

export function isLegacyPasswordHash(stored: string): boolean {
  return !stored.startsWith('v2$')
}

export async function verifyPassword(password: string, stored: string, legacySalt: string): Promise<boolean> {
  if (!stored.startsWith('v2$')) {
    return timingSafeEqual(await sha256Hex(legacySalt + password), stored)
  }
  const parts = stored.split('$')
  if (parts.length !== 3 || !parts[1] || !parts[2]) return false
  return timingSafeEqual(await sha256Hex(parts[1] + password), parts[2])
}

export function generateAuthToken(): string {
    const bytes = new Uint8Array(32)

    crypto.getRandomValues(bytes)

    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}
