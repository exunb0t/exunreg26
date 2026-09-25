function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bufferToHex(digest)
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export const PBKDF2_ITERATIONS = 25000

async function pbkdf2Hex(password: string, saltHex: string, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    keyMaterial,
    256
  )
  return bufferToHex(bits)
}

export async function newPasswordHash(password: string, pepper = ''): Promise<string> {
  const saltBytes = new Uint8Array(16)
  crypto.getRandomValues(saltBytes)
  const salt = [...saltBytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  const saltMixed = await sha256Hex(`${salt}:${pepper}`)
  const hash = await pbkdf2Hex(password, saltMixed.slice(0, 64), PBKDF2_ITERATIONS)
  return `v3$${PBKDF2_ITERATIONS}$${salt}$${hash}`
}

export function isLegacyPasswordHash(stored: string): boolean {
  return !stored.startsWith('v2$') && !stored.startsWith('v3$')
}

function isV2Hash(stored: string): boolean {
  return stored.startsWith('v2$')
}

export async function verifyPassword(password: string, stored: string, pepper: string): Promise<boolean> {
  if (!stored.startsWith('v2$') && !stored.startsWith('v3$')) {
    return timingSafeEqual(await sha256Hex(pepper + password), stored)
  }
  if (isV2Hash(stored)) {
    const parts = stored.split('$')
    if (parts.length !== 3 || !parts[1] || !parts[2]) return false
    return timingSafeEqual(await sha256Hex(parts[1] + password), parts[2])
  }
  const parts = stored.split('$')
  if (parts.length !== 4 || !parts[1] || !parts[2] || !parts[3]) return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations <= 0 || iterations > 1000000) return false
  const saltMixed = await sha256Hex(`${parts[2]}:${pepper}`)
  const recomputed = await pbkdf2Hex(password, saltMixed.slice(0, 64), iterations)
  return timingSafeEqual(recomputed, parts[3])
}

export function isV3PasswordHash(stored: string): boolean {
  return stored.startsWith('v3$')
}

export async function hashSessionToken(token: string, pepper: string): Promise<string> {
  return sha256Hex(`sess:${pepper}:${token}`)
}

export async function hashOtp(email: string, otp: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`otp:${pepper}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${email.toLowerCase()}:${otp}`))
  return bufferToHex(sig)
}

export async function verifyOtpHash(email: string, otp: string, stored: string, pepper: string): Promise<boolean> {
  const fresh = await hashOtp(email, otp, pepper)
  if (timingSafeEqual(fresh, stored)) return true
  return timingSafeEqual(await sha256Hex(otp), stored)
}

export function generateOtp6(): string {
  const buf = new Uint32Array(1)
  const range = 900000
  const limit = Math.floor(0xffffffff / range) * range
  let x = 0
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= limit)
  return String(100000 + (x % range))
}

export function generateAuthToken(): string {
    const bytes = new Uint8Array(32)

    crypto.getRandomValues(bytes)

    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}
