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
   
    // Gmail SMTP credentials
    GMAIL_EMAIL: string
    GMAIL_APP_PASSWORD: string

    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
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

    GMAIL_EMAIL: string
    GMAIL_APP_PASSWORD: string
}