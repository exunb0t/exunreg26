import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { resolveGoogleDocId } from '../lib/googleDocs'
import { syncKbSource, syncAllKbSources, parseSeedUrls } from '../lib/kb'
import { deleteChunkVectors } from '../lib/qdrant'
import { parseLimit } from '../lib/paging'

export async function listSources(c: AppContext) {
    const db = getDb(c.env)
    const sources = await queries.getAllKbSources(db, 100)
    return jsonOk(c, sources, 'Knowledge base sources retrieved')
}

export async function addSources(c: AppContext) {
    const db = getDb(c.env)

    const payload = await c.req.json<{ url?: string; urls?: string[] }>().catch(() => null)
    const urls = payload?.urls ?? (payload?.url ? [payload.url] : [])

    if (urls.length === 0) {
        return jsonError(c, 'At least one url required', 400)
    }

    if (urls.length > 20) {
        return jsonError(c, 'At most 20 urls per request', 400)
    }

    const created = []
    const failed: string[] = []

    for (const url of urls) {
        const docId = await resolveGoogleDocId(url)
        if (!docId) {
            failed.push(url)
            continue
        }

        const existing = await queries.getKbSourceByUrl(db, url)
        if (existing) continue

        const source = await queries.createKbSource(db, {
            url,
            docId,
            status: 'pending',
        })

        created.push(source)
    }

    const results = []
    for (const source of created) {
        results.push(await syncKbSource(db, c.env, source))
    }

    return jsonOk(c, { added: created.length, results, failed }, 'Sources added and synced')
}

export async function deleteSource(c: AppContext) {
    const db = getDb(c.env)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return jsonError(c, 'Valid source ID required', 400)

    const source = await queries.getKbSourceById(db, id)
    if (!source) return jsonError(c, 'Source not found', 404)

    const chunks = await queries.getKbChunksBySource(db, id, 10000)
    if (chunks.length > 0) {
        await deleteChunkVectors(c.env, chunks.map((ch) => ch.vectorId))
    }

    await queries.deleteKbSource(db, id)

    return jsonOk(c, null, 'Source deleted')
}

export async function syncSources(c: AppContext) {
    const db = getDb(c.env)

    const payload = await c.req.json<{ sourceId?: number }>().catch(() => null)

    if (payload?.sourceId) {
        const source = await queries.getKbSourceById(db, payload.sourceId)
        if (!source) return jsonError(c, 'Source not found', 404)

        const result = await syncKbSource(db, c.env, source)
        return jsonOk(c, result, 'Source synced')
    }

    c.executionCtx.waitUntil(syncAllKbSources(db, c.env))
    return jsonOk(c, { started: true }, 'Sync started in background')
}

export async function toggleSource(c: AppContext) {
    const db = getDb(c.env)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return jsonError(c, 'Valid source ID required', 400)

    const source = await queries.getKbSourceById(db, id)
    if (!source) return jsonError(c, 'Source not found', 404)

    const updated = await queries.updateKbSource(db, id, { enabled: source.enabled ? 0 : 1 })
    return jsonOk(c, updated, updated?.enabled ? 'Source enabled' : 'Source disabled')
}

export async function getSourceChunks(c: AppContext) {
    const db = getDb(c.env)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return jsonError(c, 'Valid source ID required', 400)

    const source = await queries.getKbSourceById(db, id)
    if (!source) return jsonError(c, 'Source not found', 404)

    const chunks = await queries.getKbChunksBySource(db, id, parseLimit(c, 200, 1000))

    return jsonOk(c, { source, chunks }, 'Chunks retrieved')
}

export async function seedFromEnv(c: AppContext) {
    const db = getDb(c.env)
    const urls = parseSeedUrls(c.env.GOOGLE_DOC_URLS)

    const created = []
    const failed: string[] = []

    for (const url of urls) {
        const docId = await resolveGoogleDocId(url)
        if (!docId) {
            failed.push(url)
            continue
        }

        const existing = await queries.getKbSourceByUrl(db, url)
        if (existing) continue

        const source = await queries.createKbSource(db, {
            url,
            docId,
            status: 'pending',
        })

        created.push(source)
    }

    const results = []
    for (const source of created) {
        results.push(syncKbSource(db, c.env, source))
    }

    c.executionCtx.waitUntil(Promise.all(results))
    return jsonOk(c, { added: created.length, failed, started: true }, 'Seeded from GOOGLE_DOC_URLS, sync running in background')
}
