function esc(s: unknown): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function priorityBadge(priority: string): string {
    const p = String(priority || 'medium').toLowerCase()
    const colors =
        p === 'high'
            ? 'color: #dc2626; background: #fef2f2; border: 1px solid #fecaca;'
            : p === 'low'
              ? 'color: #4b5563; background: #f4f5f7; border: 1px solid #e2e6ee;'
              : 'color: #1f66d6; background: rgba(41, 119, 245, 0.1); border: 1px solid rgba(41, 119, 245, 0.35);'
    const label = p.charAt(0).toUpperCase() + p.slice(1)
    return `<span style="display: inline-block; padding: 0.3rem 0.9rem; border-radius: 999px; font-size: 0.8rem; font-weight: 700; ${colors} font-family: 'Trebuchet MS', Arial, sans-serif;">${esc(label)} priority</span>`
}

function shell(heading: string, intro: string, body: string, cta?: { href: string; label: string }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin: 0; padding: 0; background: #f4f5f7; font-family: 'Trebuchet MS', Arial, sans-serif;">
    <table role="presentation" style="width: 100%; background: #f4f5f7; font-family: 'Trebuchet MS', Arial, sans-serif;" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center" style="padding: 2rem 1rem;">
                <table role="presentation" style="width: 100%; max-width: 600px; background: #ffffff; border-radius: 1rem; overflow: hidden;" cellpadding="0" cellspacing="0">
                    <tr>
                        <td align="center" style="background: #2977f5; padding: 1.75rem 1.5rem 1.5rem;">
                            <img src="https://exunclan.com/logo.png" style="width: 7rem; background: #ffffff; border-radius: 0.5rem; padding: 0.4rem 0.8rem;" alt="Exun Clan logo" />
                            <p style="margin: 0.75rem 0 0; font-size: 1.1rem; font-weight: 700; letter-spacing: 0.25em; color: #ffffff; font-family: 'Trebuchet MS', Arial, sans-serif;">EXUN 2026 · SUPPORT</p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 1.75rem 2rem 0.5rem;">
                            <h1 style="margin: 0; font-size: 1.5rem; font-weight: 700; color: #111827; font-family: 'Trebuchet MS', Arial, sans-serif;">${heading}</h1>
                            <p style="margin: 0.5rem 0 0; font-size: 0.9rem; line-height: 1.5; color: #4b5563;">${intro}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 1rem 2rem 0;">
                            ${body}
                        </td>
                    </tr>
                    ${
                        cta
                            ? `<tr>
                        <td align="center" style="padding: 1.5rem 2rem 0;">
                            <a href="${cta.href}" style="display: inline-block; background: #2977f5; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 1rem; padding: 0.85rem 2.25rem; border-radius: 999px; font-family: 'Trebuchet MS', Arial, sans-serif;">${cta.label} &rarr;</a>
                        </td>
                    </tr>`
                            : ''
                    }
                    <tr>
                        <td align="center" style="padding: 1.75rem 2rem 1.5rem; font-size: 0.75rem; color: #9ca3af;">
                            <p style="margin: 0;">&copy; Exun Clan · The Technology Club of Delhi Public School, R.K. Puram</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

function heroId(displayId: string): string {
    return `<table role="presentation" style="width: 100%; background: rgba(41, 119, 245, 0.07); border-radius: 0.75rem;" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center" style="padding: 1rem;">
                <p style="margin: 0; font-size: 0.75rem; letter-spacing: 0.2em; font-weight: 700; color: #6b7280;">TICKET ID</p>
                <p style="margin: 0.25rem 0 0; font-size: 1.9rem; font-weight: 700; color: #2977f5; letter-spacing: 0.04em;">${esc(displayId)}</p>
            </td>
        </tr>
    </table>`
}

function facts(category: string, priority: string, email?: string): string {
    return `<table role="presentation" style="width: 100%; margin-top: 1rem;" cellpadding="0" cellspacing="0">
        <tr>
            <td style="font-size: 0.8rem; font-weight: 700; color: #6b7280; padding-bottom: 0.25rem;">CATEGORY</td>
            <td style="font-size: 0.8rem; font-weight: 700; color: #6b7280; padding-bottom: 0.25rem;">PRIORITY</td>
        </tr>
        <tr>
            <td style="font-size: 0.95rem; color: #111827; padding-bottom: 0.75rem;">${esc(category)}</td>
            <td style="padding-bottom: 0.75rem;">${priorityBadge(priority)}</td>
        </tr>
        ${
            email
                ? `<tr><td colspan="2" style="font-size: 0.8rem; font-weight: 700; color: #6b7280; padding-bottom: 0.25rem;">FROM</td></tr>
        <tr><td colspan="2" style="font-size: 0.95rem; color: #111827; padding-bottom: 0.75rem;">${esc(email)}</td></tr>`
                : ''
        }
    </table>`
}

function messageBox(subject: string, message: string): string {
    return `<p style="margin: 0.5rem 0 0; font-size: 1.05rem; font-weight: 700; color: #111827;">${esc(subject)}</p>
    <div style="margin-top: 0.5rem; background: #f4f5f7; border-radius: 0.75rem; padding: 1rem 1.25rem; font-size: 0.9rem; line-height: 1.6; color: #1f2937;">${esc(message).replace(/\n/g, '<br />')}</div>`
}

export interface TicketMailData {
    displayId: string
    email: string
    subject: string
    category: string
    priority: string
    message: string
}

export function renderTicketAdminEmail(t: TicketMailData, adminUrl?: string): string {
    return shell(
        'New support ticket',
        'A user just opened a support ticket. Review it below and reply from the admin panel.',
        heroId(t.displayId) + facts(t.category, t.priority, t.email) + messageBox(t.subject, t.message),
        adminUrl ? { href: adminUrl, label: 'View & reply in admin panel' } : undefined
    )
}

export function renderTicketUserEmail(t: TicketMailData): string {
    return shell(
        'Ticket received',
        'Thanks for reaching out. Our team will get back to you by email shortly.',
        heroId(t.displayId) + facts(t.category, t.priority) + messageBox(t.subject, t.message)
    )
}
