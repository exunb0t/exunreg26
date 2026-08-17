import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { getEmailFromCookie } from '../middleware/auth'


export async function submitRegistrations(c: AppContext) {

    const db = getDb(c.env)

    const email = getEmailFromCookie(c)

    if (!email) {
        return jsonError(
            c,
            'Authentication required',
            401
        )
    }


    const payload = await c.req
        .json<{
            eventId?: string

            schoolName?: string
            schoolCode?: string
            address?: string

            principalName?: string
            principalEmail?: string

            teamName?: string

            students?: {
                fullname: string
                email: string
                phone?: string
                class?: string
            }[]

        }>()
        .catch(() => null)


    if (!payload?.eventId) {
        return jsonError(
            c,
            'Event ID required',
            400
        )
    }


    const user = await queries.getUserByEmail(
        db,
        email
    )


    if (!user) {
        return jsonError(
            c,
            'User not found',
            404
        )
    }


    const event = await queries.getEventById(
        db,
        payload.eventId
    )


    if (!event) {
        return jsonError(
            c,
            'Event not found',
            404
        )
    }


    // Store school/account information
    await queries.updateUser(
        db,
        email,
        {
            institutionName: payload.schoolName,
            schoolCode: payload.schoolCode,
            address: payload.address,
            principalsName: payload.principalName,
            principalsEmail: payload.principalEmail,
        }
    )


    // Create event registration
    const registration = await queries.createRegistration(
        db,
        {
            eventId: payload.eventId,
            userId: user.id,
            teamName: payload.teamName,
            status: 'pending',
        }
    )


    // Store every student participant
    if (payload.students) {

        for (const student of payload.students) {

            await queries.createIndividualRegistration(
                db,
                {
                    userId: user.id,

                    fullname: student.fullname,
                    userEmail: student.email,

                    phoneNumber: student.phone,
                    className: student.class,

                    schoolName: payload.schoolName,
                    schoolCode: payload.schoolCode,
                    address: payload.address,
                }
            )

        }
    }


    return jsonOk(
        c,
        {
            registrationId: registration.id
        },
        'Registration submitted successfully'
    )
}