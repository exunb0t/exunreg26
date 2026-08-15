import type { Env } from '../types'

export async function sendEmail(
    to: string,
    subject: string,
    body: string,
    env: Env
) {
    const email = env.GMAIL_EMAIL
    const password = env.GMAIL_APP_PASSWORD

    console.log("SMTP account:", email)
    console.log("Sending to:", to)

    // SMTP sending code later
}