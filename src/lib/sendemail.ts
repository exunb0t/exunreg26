import { WorkerMailer } from '@eoao/nworker-mailer'
import type { Env } from '../types'

export async function sendEmail(
    to: string,
    subject: string,
    body: string,
    env: Env
) {
    const email = env.GMAIL_EMAIL
    const password = env.GMAIL_APP_PASSWORD

    if (!email || !password) {
        throw new Error('GMAIL_EMAIL or GMAIL_APP_PASSWORD is missing')
    }

    const mailer = await WorkerMailer.connect({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        credentials: {
            username: email,
            password,
        },
        authType: 'plain',
    })

    await mailer.send({
        from: email,
        to,
        subject,
        text: body,
    })
}