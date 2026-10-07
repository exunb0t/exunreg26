import type { AppContext } from '../types'
import { getDb, type Db } from '../db/client'
import * as queries from '../db/queries'
import type { EventRow } from '../db/queries'
import { newPasswordHash, verifyPassword, isLegacyPasswordHash, isV3PasswordHash, generateAuthToken, hashSessionToken } from '../lib/crypto'
import { setAuthCookies } from '../lib/cookies'
import { slugify } from '../lib/slug'
import { isAdmin } from '../lib/admin'
import { jsonOk, jsonError } from '../lib/response'
import { getAuthenticatedEmail, getEmailFromCookie } from '../middleware/auth'
import type { UserInsert } from '../db/queries'
import { verifyOTP } from './auth'
import { isValidEmail, normalizeEmail } from '../lib/validation'
import { quarterHourBucket } from '../lib/rateStore'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_TTL_S = 30 * 24 * 60 * 60

export async function healthCheck(c: AppContext) {
    const started = Date.now()
    try {
        const db = getDb(c.env)
        await queries.getAllEvents(db, 1)
        return jsonOk(c, { timestamp: new Date().toISOString(), db: 'ok', latencyMs: Date.now() - started }, 'Server is running')
    } catch {
        return jsonError(c, 'Service unavailable', 503)
    }
}

export async function signup(c: AppContext) {
    const payload = await c.req.json<{ email?: string; password?: string }>().catch(() => null)
    const email = normalizeEmail(payload?.email)
    if (!email) {
        return jsonError(c, 'Email required', 400)
    }
    if (!payload?.password) {
        return jsonError(c, 'password required', 400)
    }
    if (payload.password.length < 8) {
        return jsonError(c, 'Password must be at least 8 characters', 400)
    }
    if (!isValidEmail(email)) {
        return jsonError(c, 'Invalid email', 400)
    }
    const pepper = (c.env.AUTH_SALT ?? '').trim()
    if (!pepper) {
        return jsonError(c, 'Server misconfigured', 500)
    }
    const db = getDb(c.env)
    const user_email = await queries.getUserByEmail(db, email)
    if (user_email) {
        return jsonError(c, 'user already exists', 409)
    }
    const hashed_password = await newPasswordHash(payload.password, pepper)
    const user: UserInsert = {
        email,
        username: email,
        passwordHash: hashed_password,
    }
    await queries.createUser(db, user)
    const authToken = generateAuthToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
    setAuthCookies(c, email, authToken, SESSION_TTL_S)
    await queries.createSession(db, email, await hashSessionToken(authToken, pepper), expiresAt)
    return jsonOk(c, { email }, 'Signed up')
}

export async function login(c: AppContext) {
    const payload = await c.req.json<{ email?: string; password?: string; otp?: string }>().catch(() => null)
    const email = normalizeEmail(payload?.email)
    if (!email) {
        return jsonError(c, 'Email required', 400)
    }
    if (payload?.otp) {
        return verifyOTP(c)
    }
    if (!payload?.password) {
        return jsonError(c, 'Password or OTP required', 400)
    }
    const failKey = `login-fail:${email}:${quarterHourBucket()}`
    const db = getDb(c.env)
    if ((await queries.getRateCount(db, failKey)) >= 10) {
        return jsonError(c, 'Too many login attempts. Try again later.', 429)
    }
    const pepper = (c.env.AUTH_SALT ?? '').trim()
    if (!pepper) {
        return jsonError(c, 'Server misconfigured', 500)
    }
    const user = await queries.getUserByEmail(db, email)
    if (!user || !user.passwordHash) {
        await queries.bumpRateCounter(db, failKey)
        return jsonError(c, 'Invalid email or password', 401)
    }
    const valid = await verifyPassword(payload.password, user.passwordHash, pepper)
    if (!valid) {
        await queries.bumpRateCounter(db, failKey)
        return jsonError(c, 'Invalid email or password', 401)
    }
    if (isLegacyPasswordHash(user.passwordHash) || !isV3PasswordHash(user.passwordHash)) {
        await queries.updateUser(db, email, { passwordHash: await newPasswordHash(payload.password, pepper) })
    }
    const authToken = generateAuthToken()
    setAuthCookies(c, email, authToken, SESSION_TTL_S)
    await queries.createSession(db, email, await hashSessionToken(authToken, pepper), new Date(Date.now() + SESSION_TTL_MS).toISOString())
    return jsonOk(c, { email }, 'Logged in')
}

export async function getProfile(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)
    const user = await queries.getUserByEmail(db, email)
    if (!user) {
        return jsonError(c, 'User not found', 404)
    }
    const { passwordHash: _removed, ...safeUser } = user
    return jsonOk(c, safeUser, 'User profile retrieved successfully')
}

export async function getAllEventsData(db: Db, limit: number): Promise<EventRow[]> {
    return queries.getAllEvents(db, limit)
}

export async function getAllEventsForUser(db: Db, email: string, limit: number): Promise<EventRow[]> {
    const events = await getAllEventsData(db, limit)
    if (!email) return events
    const user = await queries.getUserByEmail(db, email)
    if (!user || !user.individual) return events
    return events.filter((ev) => ev.independentRegistration)
}

function toEventPayload(ev: EventRow, registrationCount?: number) {
    const participantsText = String(ev.participants ?? 1)
    return {
        id: ev.id,
        name: ev.name,
        image: ev.image,
        slug: slugify(ev.name),
        description_short: ev.descriptionShort,
        description_long: ev.descriptionLong,
        descriptionShort: ev.descriptionShort,
        descriptionLong: ev.descriptionLong,
        participants: ev.participants,
        display_participants: participantsText,
        displayParticipants: participantsText,
        mode: ev.mode,
        points: ev.points,
        individual: ev.independentRegistration,
        independentRegistration: ev.independentRegistration,
        independent_registration: ev.independentRegistration,
        eligibility: ev.eligibility,
        open_to_all: ev.openToAll,
        openToAll: ev.openToAll,
        dates: ev.dates,
        ...(registrationCount !== undefined ? { registrations: registrationCount } : {}),
    }
}

export async function getAllEvents(c: AppContext) {
    const email = await getAuthenticatedEmail(c)
    const db = getDb(c.env)
    const eventsList = email && (await isAdmin(db, email, c.env)) ? await getAllEventsData(db, 500) : await getAllEventsForUser(db, email, 500)
    const regCounts = await queries.getRegistrationCountsByEvent(db)
    const data = eventsList.map((ev) => toEventPayload(ev, regCounts.get(ev.id) ?? 0))
    return jsonOk(c, data, 'Events retrieved successfully')
}

export async function getEvent(c: AppContext) {
    const queryId = c.req.query('id')
    let paramId = ''
    try {
        paramId = c.req.param('id') || ''
    } catch {
        paramId = ''
    }
    let wildcard = ''
    try {
        wildcard = (c.req.param() as Record<string, string>)['*'] || ''
    } catch {
        wildcard = ''
    }
    const eventId = (queryId || paramId || wildcard || '').trim()
    if (!eventId) {
        return jsonError(c, 'Event ID parameter required', 400)
    }
    const db = getDb(c.env)
    const direct = await queries.getEventById(db, eventId)
    if (direct) {
        return jsonOk(c, toEventPayload(direct), 'Event retrieved successfully')
    }
    const all = await queries.getAllEvents(db, 500)
    const found = all.find((ev) => ev.id === eventId || slugify(ev.name) === slugify(eventId))
    if (found) {
        return jsonOk(c, toEventPayload(found), 'Event retrieved successfully')
    }
    return jsonError(c, 'Event not found', 404)
}
