import { getDb } from '../db/client'
import { bumpRateCounter } from '../db/queries'
import type { AppContext } from '../types'

export async function checkBucketLimit(
    c: AppContext,
    prefix: string,
    id: string,
    bucket: string,
    limit: number
): Promise<boolean> {
    const db = getDb(c.env)
    const count = await bumpRateCounter(db, `${prefix}:${id}:${bucket}`)
    return count <= limit
}

export function quarterHourBucket(now = Date.now()): string {
    return String(Math.floor(now / (15 * 60 * 1000)))
}

export function dayBucket(now = Date.now()): string {
    return new Date(now).toISOString().slice(0, 10)
}
