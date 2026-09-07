import type { AppContext } from '../types'
import { jsonOk, jsonError } from '../lib/response'
import { getDb } from '../db/client'
import * as queries from '../db/queries'
import { extractGoogleDocId } from '../lib/googleDocs'
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

    for (const url of urls) {
        const docId = extractGoogleDocId(url)
        if (!docId) continue

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

    return jsonOk(c, { added: created.length, results }, 'Sources added and synced')
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

    const results = await syncAllKbSources(db, c.env)
    return jsonOk(c, results, 'All sources synced')
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

    for (const url of urls) {
        const docId = extractGoogleDocId(url)
        if (!docId) continue

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

    return jsonOk(c, { added: created.length, results }, 'Seeded from GOOGLE_DOC_URLS')
}
