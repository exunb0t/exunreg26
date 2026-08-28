import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { AppContext, ApiResponse } from '../types'

export function jsonOk<T>(c: AppContext, data?: T, message?: string, status: ContentfulStatusCode = 200) {
    const body: ApiResponse<T> = { status: 'success', message, data }
    return c.json(body, status)
}

export function jsonError(c: AppContext, error: string, status: ContentfulStatusCode) {
    const body: ApiResponse = { status: 'error', error }
    return c.json(body, status)
}
