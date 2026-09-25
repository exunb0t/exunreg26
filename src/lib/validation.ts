export function normalizeEmail(email: string | undefined | null): string {
    return (email ?? '').trim().toLowerCase()
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email: string): boolean {
    const v = email.trim()
    if (v.length > 254) return false
    return EMAIL_REGEX.test(v)
}

export const PHONE_REGEX = /^[+()\d\s-]{5,32}$/
export function isValidPhone(phone: string): boolean {
    return PHONE_REGEX.test(phone.trim())
}

export const TICKET_SUBJECT_MAX = 200
export const TICKET_MESSAGE_MAX = 2000
export const TICKET_CATEGORIES = [
    'Registration',
    'Events & Schedule',
    'Account & Login',
    'Technical Issue',
    'Other',
]
export const TICKET_PRIORITIES = ['low', 'medium', 'high']

export function sanitizeSubject(subject: string): string {
    return subject.replace(/[\r\n]+/g, ' ').trim()
}

export function validateTicketInput(input: {
    subject?: unknown
    message?: unknown
    category?: unknown
    priority?: unknown
}): { ok: true; subject: string; message: string } | { ok: false; error: string } {
    const subject = sanitizeSubject(String(input.subject ?? ''))
    const message = String(input.message ?? '').trim()
    if (!subject) return { ok: false, error: 'Subject is required' }
    if (subject.length > TICKET_SUBJECT_MAX) return { ok: false, error: 'Subject is too long' }
    if (!message) return { ok: false, error: 'Description is required' }
    if (message.length > TICKET_MESSAGE_MAX) return { ok: false, error: 'Description is too long (max 2000 characters)' }
    if (input.category !== undefined && !TICKET_CATEGORIES.includes(String(input.category))) {
        return { ok: false, error: 'Please choose a category' }
    }
    if (input.priority !== undefined && !TICKET_PRIORITIES.includes(String(input.priority).toLowerCase())) {
        return { ok: false, error: 'Please choose a priority' }
    }
    return { ok: true, subject, message }
}

export const NAME_MAX = 120
export const TEAM_MAX = 80
export const CLASS_MAX = 32
export const SCHOOL_MAX = 160
export const ADDRESS_MAX = 500

export function capLength(s: string, max: number): string {
    const t = s.trim()
    return t.length > max ? t.slice(0, max) : t
}

export function isSafeStoredText(s: string, max: number): boolean {
    return s.trim().length > 0 && s.trim().length <= max
}

export function sheetsSafeCell(v: unknown): string {
    if (v === null || v === undefined) return ''
    if (typeof v === 'boolean') return v ? 'yes' : 'no'
    const s = String(v)
    if (/^[=+\-@\t\r]/.test(s)) return `'${s}`
    return s
}

export function redactEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (!domain) return '[redacted]'
    const l = local.length <= 2 ? `${local[0] ?? ''}*` : `${local.slice(0, 2)}***`
    return `${l}@${domain}`
}
