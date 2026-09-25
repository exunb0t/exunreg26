import type { AppContext } from '../types'
import type { Bindings } from '../types'
import type { Db } from '../db/client'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import type { UserRow, RegistrationRow, IndividualRegistrationRow, EventRow } from '../db/queries'
import { users, events, registrations, individualRegistrations, logs, oauthTokens, queries as queriesTable, conversations, chatMessages, kbSources, kbChunks, tickets, usrRegs } from '../db/schema'
import { jsonOk, jsonError } from '../lib/response'
import { ensureTabs, writeTab, freezeHeaderRow } from '../lib/googleSheets'
import { getOAuthAccessToken, listBackups, uploadBackup, deleteDriveFile } from '../lib/googleDrive'
import { hashContent } from '../lib/googleDocs'
import { sheetsSafeCell } from '../lib/validation'

export const MAX_EXPORT_PARTICIPANTS = 8

interface Participant {
    name?: string
    email?: string
    class?: string | number
    phone?: string | number
}

function cell(v: unknown): string {
    return sheetsSafeCell(v)
}

function parseUserRegistrations(raw: unknown): Record<string, Participant[]> {
    if (!raw || typeof raw !== 'string') return {}
    try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, Participant[]>
        }
    } catch {
    }
    return {}
}

export function buildUsersTable(userRows: UserRow[]): string[][] {
    const header = ['id', 'username', 'email', 'fullname', 'phone', 'institution', 'individual', 'school_code', 'address', 'principals_name', 'principals_email', 'created_at', 'updated_at']
    const rows = userRows.map((u) => [
        cell(u.id),
        cell(u.username),
        cell(u.email),
        cell(u.fullname),
        cell(u.phoneNumber),
        cell(u.institutionName),
        cell(u.individual),
        cell(u.schoolCode),
        cell(u.address),
        cell(u.principalsName),
        cell(u.principalsEmail),
        cell(u.createdAt),
        cell(u.updatedAt),
    ])
    return [header, ...rows]
}

export function buildRegistrationsTable(
    userRows: UserRow[],
    regRows: RegistrationRow[],
    eventRows: EventRow[]
): string[][] {
    const header = ['username', 'email', 'fullname', 'institution', 'event_id', 'event_name', 'team_name', 'status', 'registered_at']
    for (let i = 1; i <= MAX_EXPORT_PARTICIPANTS; i++) {
        header.push(`p${i}_name`, `p${i}_email`, `p${i}_class`, `p${i}_phone`)
    }

    const eventsById = new Map(eventRows.map((e) => [String(e.id), e.name ?? String(e.id)]))
    const teamByUserEvent = new Map(regRows.map((r) => [`${r.userId}:${r.eventId}`, r]))

    const out: string[][] = [header]
    for (const u of userRows) {
        const regs = parseUserRegistrations(u.registrations)
        for (const [eventId, parts] of Object.entries(regs)) {
            const list = Array.isArray(parts) ? parts : []
            if (list.length === 0) continue
            const team = teamByUserEvent.get(`${u.id}:${eventId}`)
            const row = [
                cell(u.username),
                cell(u.email),
                cell(u.fullname),
                cell(u.institutionName),
                cell(eventId),
                cell(eventsById.get(String(eventId)) ?? eventId),
                cell(team?.teamName),
                cell(team?.status),
                cell(team?.createdAt),
            ]
            for (let i = 0; i < MAX_EXPORT_PARTICIPANTS; i++) {
                const p = list[i]
                row.push(cell(p?.name), cell(p?.email), cell(p?.class), cell(p?.phone))
            }
            out.push(row)
        }
    }
    return out
}

export function buildIndividualTable(
    indivRows: IndividualRegistrationRow[],
    userRows: UserRow[]
): string[][] {
    const header = ['id', 'username', 'email', 'event_id', 'fullname', 'phone', 'class', 'school', 'created_at', 'updated_at']
    const emailByUserId = new Map(userRows.map((u) => [u.id, u.email ?? '']))
    const rows = indivRows.map((r) => [
        cell(r.id),
        cell(emailByUserId.get(r.userId) ?? ''),
        cell(r.userEmail),
        cell(r.eventId),
        cell(r.fullname),
        cell(r.phoneNumber),
        cell(r.className),
        cell(r.schoolName),
        cell(r.createdAt),
        cell(r.updatedAt),
    ])
    return [header, ...rows]
}

export async function exportSheets(c: AppContext) {
    const db = getDb(c.env)

    const payload = await c.req.json<{ spreadsheetId?: string }>().catch(() => null)
    const spreadsheetId = payload?.spreadsheetId?.trim() || (c.env.SPREADSHEET_ID ?? '').trim()

    if (!spreadsheetId) {
        return jsonError(c, 'spreadsheetId is required (or set SPREADSHEET_ID)', 400)
    }
    if (!/^[A-Za-z0-9-_]+$/.test(spreadsheetId)) {
        return jsonError(c, 'Invalid spreadsheetId', 400)
    }

    try {
        const [userRows, regRows, indivRows, eventRows] = await Promise.all([
            queries.getAllUsers(db, 100000),
            queries.getAllRegistrations(db, 100000),
            queries.getAllIndividualRegistrations(db),
            queries.getAllEvents(db, 1000),
        ])

        const usersTable = buildUsersTable(userRows)
        const regsTable = buildRegistrationsTable(userRows, regRows, eventRows)
        const indivTable = buildIndividualTable(indivRows, userRows)

        await ensureTabs(c.env, spreadsheetId, ['Users', 'Registrations', 'Individual'])

        const counts = {
            users: await writeTab(c.env, spreadsheetId, 'Users', usersTable),
            registrations: await writeTab(c.env, spreadsheetId, 'Registrations', regsTable),
            individual: await writeTab(c.env, spreadsheetId, 'Individual', indivTable),
        }
        await Promise.all([
            freezeHeaderRow(c.env, spreadsheetId, 'Users'),
            freezeHeaderRow(c.env, spreadsheetId, 'Registrations'),
            freezeHeaderRow(c.env, spreadsheetId, 'Individual'),
        ])

        return jsonOk(c, { ...counts, spreadsheetId }, 'Sheet updated (DB to Sheet)')
    } catch (err: any) {
        return jsonError(c, err?.message ?? 'Export failed', 500)
    }
}

export interface BackupResult {
    uploaded: boolean
    skipped?: boolean
    fileId?: string | null
    reason?: string
    tableCounts?: Record<string, number>
}

export async function backupDatabase(db: Db, env: Bindings): Promise<BackupResult> {
    const folderId = (env.DRIVE_FOLDER_ID ?? '').trim()
    if (!folderId) return { uploaded: false, skipped: true, reason: 'DRIVE_FOLDER_ID not configured' }

    const tables: Record<string, unknown[]> = {
        users: (await db.select().from(users)).map(({ passwordHash: _ph, ...rest }) => rest),
        events: await db.select().from(events),
        registrations: await db.select().from(registrations),
        individual_registrations: await db.select().from(individualRegistrations),
        logs: await db.select().from(logs),
        oauth_tokens: await db.select().from(oauthTokens),
        queries: await db.select().from(queriesTable),
        conversations: await db.select().from(conversations),
        chat_messages: await db.select().from(chatMessages),
        kb_sources: await db.select().from(kbSources),
        kb_chunks: await db.select().from(kbChunks),
        tickets: await db.select().from(tickets),
        usr_regs: await db.select().from(usrRegs),
    }

    const content = JSON.stringify({ exportedAt: new Date().toISOString(), tables })
    const hash = await hashContent(content)
    const tableCounts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]))

    let token: string
    try {
        token = await getOAuthAccessToken(db, env)
    } catch (err: any) {
        return { uploaded: false, skipped: true, reason: err?.message ?? 'Google account not connected', tableCounts }
    }

    const existing = await listBackups(token, folderId)
    if (existing.length > 0 && existing[0].description === hash) {
        return { uploaded: false, skipped: true, reason: 'No changes since last backup', tableCounts }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileId = await uploadBackup(token, folderId, `exunreg26-backup-${stamp}.json`, hash, content)

    for (const old of existing.slice(4)) {
        await deleteDriveFile(token, old.id)
    }

    return { uploaded: true, fileId, tableCounts }
}

export async function backupNow(c: AppContext) {
    const db = getDb(c.env)
    try {
        const result = await backupDatabase(db, c.env)
        return jsonOk(c, result, result.uploaded ? 'Backup uploaded to Drive' : `Backup skipped: ${result.reason ?? 'unknown'}`)
    } catch (err: any) {
        return jsonError(c, err?.message ?? 'Backup failed', 500)
    }
}
