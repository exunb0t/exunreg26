import type { AppContext } from '../types'
import { getDb, type Db } from '../db/client'
import * as queries from '../db/queries'
import type { EventRow } from '../db/queries'
import { hashPassword, generateAuthToken } from '../lib/crypto'
import { slugify } from '../lib/slug'
import { isAdminEmail } from '../lib/admin'
import { jsonOk, jsonError } from '../lib/response'
import { getEmailFromCookie } from '../middleware/auth'
import { setCookie } from 'hono/cookie'
import type { UserInsert } from '../db/queries'
import { verifyOTP } from './auth'
export async function healthCheck(c: AppContext) {
    return jsonOk(c, { timestamp: new Date().toISOString() }, 'Server is running')
}

export async function signup(c:AppContext) {
    const payload = await c.req.json<{ email?: string; password?: string }>().catch(() => null)
    if (!payload?.email) {
        return jsonError(c, 'Email required', 400);
    }
    if (!payload.password) {
        return jsonError(c, 'password required', 400);

    }
    // verify if email is actually email
    const emailRegex = /^[^@]+@[a-zA-Z]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(payload.email)) {
        return jsonError(c, 'Invalid email', 400);
    }
    //check if user exists
    const db = getDb(c.env)
    const user_email = await queries.getUserByEmail(db, payload.email);
    if (user_email) {
        return jsonError(c, 'user already exists', 400);
    }

    const salty_boi = c.env.AUTH_SALT;
    const hashed_password = await hashPassword(payload.password, salty_boi);

    const user: UserInsert = {
        email: payload.email,
        username: payload.email,
        passwordHash: hashed_password,
    }

    await queries.createUser(db, user)
    const authToken = generateAuthToken()

    const cookieSecure = c.env.COOKIE_SECURE === 'true'
    const cookieOpts = { path: '/', httpOnly: true, secure: cookieSecure, sameSite: 'Lax' as const, maxAge: 60 * 60 * 24 }
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    setCookie(c, 'email', payload.email, cookieOpts)
    setCookie(c, 'auth_token', authToken, cookieOpts)
    await queries.createSession(db, payload.email, authToken, expiresAt)
    return jsonOk(c, { email: payload.email, token: authToken }, 'Signed up')
}

export async function login(c: AppContext) {
    const payload = await c.req.json<{ email?: string; password?: string; otp?: string }>().catch(() => null)
    if (!payload?.email) {
        return jsonError(c, 'Email required', 400)
    }

    if (payload.otp) {
        return verifyOTP(c)
    }

    if (!payload.password) {
        return jsonError(c, 'Password or OTP required', 400)
    }

    const db = getDb(c.env)
    const user = await queries.getUserByEmail(db, payload.email)
    if (!user) {
        return jsonError(c, 'Invalid email', 401)
    }

    if (!user.passwordHash) {
        return jsonError(c, 'Password login not configured for this account', 401)
    }

    const salt = c.env.AUTH_SALT || ''
    const hashed = await hashPassword(payload.password, salt)
    if (hashed !== user.passwordHash) {

        return jsonError(c, 'Invalid password', 401)
    }

    const authToken = generateAuthToken()

    const cookieSecure = c.env.COOKIE_SECURE === 'true'
    const cookieOpts = { path: '/', httpOnly: true, secure: cookieSecure, sameSite: 'Lax' as const, maxAge: 60 * 60 * 24 }

    setCookie(c, 'email', payload.email, cookieOpts)
    setCookie(c, 'auth_token', authToken, cookieOpts)
    await queries.createSession(db, payload.email, authToken, new Date(Date.now() + 86400 * 1000).toISOString())

    return jsonOk(c, { email: payload.email, token: authToken }, 'Logged in')
}

export async function getProfile(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)

    const user = await queries.getUserByEmail(db, email)

    if (!user) {
        return jsonError(c, 'User not found', 404)
    }

    return jsonOk(c, user, 'User profile retrieved successfully')
}

export async function getAllEventsData(db: Db): Promise<EventRow[]> {
    return queries.getAllEvents(db)
}

export async function getAllEventsForUser(db: Db, email: string): Promise<EventRow[]> {
    const events = await getAllEventsData(db)
    if (!email) return events

    const user = await queries.getUserByEmail(db, email);
    if (!user || !user.individual) return events

    return events.filter((ev) => ev.independentRegistration)
}

function toEventPayload(ev: EventRow, registrationCount?: number) {
    return {
        id: ev.id,
        name: ev.name,
        image: ev.image,
        slug: ev.id,
        description_short: ev.descriptionShort,
        description_long: ev.descriptionLong,
        participants: ev.participants,
        mode: ev.mode,
        points: ev.points,
        individual: ev.independentRegistration,
        eligibility: ev.eligibility,
        open_to_all: ev.openToAll,
        dates: ev.dates,
        ...(registrationCount !== undefined ? { registrations: registrationCount } : {}),
    }
}

export async function getAllEvents(c: AppContext) {
    const email = getEmailFromCookie(c)
    const db = getDb(c.env)

    const eventsList = isAdminEmail(email, c.env) ? await getAllEventsData(db) : await getAllEventsForUser(db, email)
    const regCounts = await queries.getRegistrationCountsByEvent(db)

    const data = eventsList.map((ev) => toEventPayload(ev, regCounts.get(ev.id) ?? 0))

    return jsonOk(c, data, 'Events retrieved successfully')
}

export async function getEvent(c: AppContext) {
    const eventId = c.req.query('id')
    if (!eventId) {
        return jsonError(c, 'Event ID parameter required', 400)
    }

    const db = getDb(c.env)
    const direct = await queries.getEventById(db, eventId)
    if (direct) {
        return jsonOk(c, toEventPayload(direct), 'Event retrieved successfully')
    }

    const all = await queries.getAllEvents(db)
    const found = all.find((ev) => ev.id === eventId || slugify(ev.name) === eventId)
    if (found) {
        return jsonOk(c, toEventPayload(found), 'Event retrieved successfully')
    }

    return jsonError(c, 'Event not found', 404)
}


// chatbot

export { chatHandler } from './Chat'
