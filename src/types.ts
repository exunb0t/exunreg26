import type { Context } from 'hono'

export interface Bindings {
    DB: D1Database
    ASSETS: Fetcher
    AUTH_SALT: string
    COOKIE_SECURE: string
    ADMIN_EMAILS: string
    SMTP_HOST: string
    SMTP_PORT: string

    SMTP_USERNAME: string
    SMTP_PASSWORD: string
    FROM_EMAIL: string
    FROM_NAME: string

    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
}

export type AppContext = Context<{ Bindings: Bindings }>

export interface ApiResponse<T = unknown> {
    status: 'success' | 'error'
    message?: string
    data?: T

    error?: string
}

export interface Participant {
    name: string
    email: string
    class: number
    phone: string
}
