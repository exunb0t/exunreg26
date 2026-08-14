import { drizzle } from 'drizzle-orm/d1'
import type { Bindings } from '../types'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

export function getDb(env: Bindings): Db {
    return drizzle(env.DB, { schema })

}
