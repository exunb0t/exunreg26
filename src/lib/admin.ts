import type { Bindings } from '../types'
import type { Db } from '../db/client'
import { getUserByEmail } from '../db/queries'

export function isAdminEmail(email: string | undefined, env: Bindings): boolean {
    if (!email) return false
    const admins = env.ADMIN_EMAILS ?? ''
    return admins
        .split(',')
        .map((a) => a.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/["']/g, '').trim())
        .filter((a) => a.length > 0)
        .includes(email.toLowerCase())
}

export async function isAdmin(db: Db, email: string | undefined, env: Bindings): Promise<boolean> {
    if (!email) return false
    if (isAdminEmail(email, env)) return true
    const user = await getUserByEmail(db, email)
    return user?.role === 'admin'
}
