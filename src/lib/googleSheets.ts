import type { Bindings } from '../types'
import { getServiceAccountToken } from './googleServiceAccount'

function sheetsUrl(path: string): string {
    return `https://sheets.googleapis.com/v4/spreadsheets/${path}`
}

async function sheetsFetch(env: Bindings, path: string, init?: RequestInit): Promise<any> {
    const token = await getServiceAccountToken(env)
    const res = await fetch(sheetsUrl(path), {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
    })
    if (!res.ok) throw new Error(`Sheets API ${path} failed (${res.status}): ${await res.text()}`)
    if (res.status === 204) return null
    return res.json()
}

export async function ensureTabs(env: Bindings, spreadsheetId: string, tabs: string[]): Promise<void> {
    const meta = await sheetsFetch(env, `${spreadsheetId}?fields=sheets.properties.title`)
    const existing = new Set((meta.sheets ?? []).map((s: any) => s.properties?.title))
    const missing = tabs.filter((t) => !existing.has(t))
    if (missing.length === 0) return

    await sheetsFetch(env, `${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
            requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
        }),
    })
}

export async function writeTab(
    env: Bindings,
    spreadsheetId: string,
    tab: string,
    values: string[][]
): Promise<number> {
    const range = `'${tab}'!A1:Z`
    await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {
        method: 'POST',
        body: JSON.stringify({}),
    })
    if (values.length === 0) return 0

    await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(`'${tab}'!A1`)}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
    })
    return Math.max(0, values.length - 1)
}

export async function freezeHeaderRow(env: Bindings, spreadsheetId: string, tab: string): Promise<void> {
    const meta = await sheetsFetch(env, `${spreadsheetId}?fields=sheets.properties(title,sheetId)`)
    const match = (meta.sheets ?? []).find((s: any) => s.properties?.title === tab)
    const sheetId = match?.properties?.sheetId
    if (sheetId === undefined || sheetId === null) return

    await sheetsFetch(env, `${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
            requests: [
                {
                    updateSheetProperties: {
                        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                        fields: 'gridProperties.frozenRowCount',
                    },
                },
            ],
        }),
    }).catch(() => null)
}
