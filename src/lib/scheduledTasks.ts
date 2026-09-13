import type { Bindings } from '../types'
import type { Db } from '../db/client'
import * as queries from '../db/queries'
import {
    buildUsersTable,
    buildRegistrationsTable,
    buildIndividualTable,
    backupDatabase,
} from '../handlers/export'
import { ensureTabs, writeTab, freezeHeaderRow } from './googleSheets'

export async function exportSheetsToConfigured(db: Db, env: Bindings): Promise<void> {
    const spreadsheetId = (env.SPREADSHEET_ID ?? '').trim()
    if (!spreadsheetId) return

    const [userRows, regRows, indivRows, eventRows] = await Promise.all([
        queries.getAllUsers(db, 100000),
        queries.getAllRegistrations(db, 100000),
        queries.getAllIndividualRegistrations(db),
        queries.getAllEvents(db, 1000),
    ])

    await ensureTabs(env, spreadsheetId, ['Users', 'Registrations', 'Individual'])
    await writeTab(env, spreadsheetId, 'Users', buildUsersTable(userRows))
    await writeTab(env, spreadsheetId, 'Registrations', buildRegistrationsTable(userRows, regRows, eventRows))
    await writeTab(env, spreadsheetId, 'Individual', buildIndividualTable(indivRows, userRows))
    await Promise.all([
        freezeHeaderRow(env, spreadsheetId, 'Users'),
        freezeHeaderRow(env, spreadsheetId, 'Registrations'),
        freezeHeaderRow(env, spreadsheetId, 'Individual'),
    ])
}

export async function backupDatabaseToConfigured(db: Db, env: Bindings): Promise<void> {
    const result = await backupDatabase(db, env)
    if (!result.uploaded) {
        console.log(`drive backup skipped: ${result.reason ?? 'unknown'}`)
    } else {
        console.log(`drive backup uploaded: ${result.fileId ?? ''}`)
    }
}
