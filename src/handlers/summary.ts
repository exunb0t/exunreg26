import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'

export async function getUserSummary(c: AppContext) {
    const db = getDb(c.env)
    const email = getEmailFromCookie(c)
    if (!email) {
        return jsonError(c, 'Authentication required', 401)
    }
    const user = await queries.getUserByEmail(db, email)
    if (!user) {
        return jsonError(c, 'User not found', 404)
    }
    const regs = await queries.getRegistrationsByUser(db, user.id, 1000)
    const events = await queries.getAllEvents(db, 500)
    const eventById = new Map(events.map((e) => [e.id, e]))
    const registrations = []
    for (const reg of regs) {
        const ev = eventById.get(reg.eventId)
        const members = await queries.getIndividualRegistrationsByEventUser(db, reg.eventId, user.id)
        registrations.push({
            id: reg.id,
            eventId: reg.eventId,
            eventName: ev?.name || reg.eventId,
            teamName: reg.teamName,
            status: reg.status,
            createdAt: reg.createdAt,
            capacity: ev?.participants || 1,
            participants: members.map((m) => ({
                name: m.fullname,
                email: m.userEmail,
                phone: m.phoneNumber,
                class: m.className,
            })),
        })
    }
    return jsonOk(
        c,
        {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullname: user.fullname,
                schoolCode: user.schoolCode,
                institutionName: user.institutionName,
                phoneNumber: user.phoneNumber,
                principalsEmail: user.principalsEmail,
                principalsName: user.principalsName,
                address: user.address,
                individual: user.individual,
            },
            registrations,
            events: registrations,
        },
        'User summary fetched'
    )
}
