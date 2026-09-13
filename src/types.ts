import type { Context } from 'hono'

export interface RateLimitBinding {
    limit(options: { key: string }): Promise<{ success: boolean }>
}

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

    SPREADSHEET_ID?: string
    DRIVE_FOLDER_ID?: string
    GOOGLE_SERVICE_ACCOUNT_JSON?: string
    PUBLIC_URL?: string

    OPENROUTER_API_KEY: string;
    GROQ_API_KEY: string;

    TICKET_NOTIFY_EMAIL: string
    GOOGLE_DOC_URLS: string

    QDRANT_URL: string
    QDRANT_API_KEY: string
    QDRANT_COLLECTION: string

    AI: Ai

    ALLOWED_ORIGINS?: string

    API_RATE_LIMITER?: RateLimitBinding
    AUTH_RATE_LIMITER?: RateLimitBinding
    CHAT_RATE_LIMITER?: RateLimitBinding
}

export type AppContext = Context<any>


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

export interface Env {
    DB: D1Database
    ASSETS: Fetcher

    SMTP_HOST: string
    SMTP_PORT: string
    SMTP_USERNAME: string
    SMTP_PASSWORD: string
    FROM_EMAIL: string
    FROM_NAME: string
    TICKET_NOTIFY_EMAIL: string
}
