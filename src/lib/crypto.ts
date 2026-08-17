function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bufferToHex(digest)
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(salt + password)
}

export function generateAuthToken(): string {
    const bytes = new Uint8Array(32)

    crypto.getRandomValues(bytes)

    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}
