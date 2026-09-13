import type { Bindings } from '../types'

export function isAdminEmail(email: string | undefined, env: Bindings): boolean {
    if (!email) return false
    const admins = env.ADMIN_EMAILS ?? ''
    return admins
        .split(',')
        .map((a) => a.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/["']/g, '').trim())
        .filter((a) => a.length > 0)
        .includes(email.toLowerCase())
}
