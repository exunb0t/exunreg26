import type { AppContext } from '../types'

export function parseLimit(c: AppContext, def: number, max: number): number {
    const raw = c.req.query('limit')
    if (!raw) return def
    const n = Number(raw)
    if (!Number.isInteger(n) || n <= 0) return def
    return Math.min(n, max)
}
