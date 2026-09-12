import { WorkerMailer } from '@eoao/nworker-mailer'
import type { Env } from '../types'

export async function sendEmail(
    to: string,
    subject: string,
    body: string,
    env: Env,
    html?: string
) {
    const host = env.SMTP_HOST
    const port = Number(env.SMTP_PORT || 587)
    const username = env.SMTP_USERNAME
    const password = env.SMTP_PASSWORD

    if (!host || !username || !password) {
        throw new Error('SMTP_HOST, SMTP_USERNAME or SMTP_PASSWORD is missing')
    }

    const mailer = await WorkerMailer.connect({
        host,
        port,
        secure: port === 465,
        credentials: {
            username,
            password,
        },
        authType: 'plain',
    })

    await mailer.send({
        from: env.FROM_EMAIL || username,
        to,
        subject,
        text: body,
        ...(html ? { html } : {}),
    })
}
