import type { Bindings } from '../types'
import type { Db } from '../db/client'
import * as queries from '../db/queries'
import type { KbSourceRow } from '../db/queries'
import { fetchGoogleDocHtml, googleDocHtmlToMarkdown, hashContent } from './googleDocs'
import { chunkMarkdown } from './chunk'
import { embedTexts } from './embeddings'
import { chunkPointId, ensureCollection, upsertChunkVectors, deleteChunkVectors } from './qdrant'

const EMBED_BATCH_SIZE = 20

export interface SyncResult {
    sourceId: number
    success: boolean
    skipped?: boolean
    chunkCount?: number
    error?: string
}

export async function syncKbSource(db: Db, env: Bindings, source: KbSourceRow): Promise<SyncResult> {
    try {
        await ensureCollection(env)

        const { html, title } = await fetchGoogleDocHtml(source.docId)
        const contentHash = await hashContent(html)

        if (contentHash === source.contentHash) {
            await queries.updateKbSource(db, source.id, {
                status: 'synced',
                lastSyncedAt: new Date().toISOString(),
                title,
            })
            return { sourceId: source.id, success: true, skipped: true, chunkCount: source.chunkCount }
        }

        const markdown = googleDocHtmlToMarkdown(html)
        const chunks = chunkMarkdown(markdown)

        const oldChunks = await queries.getKbChunksBySource(db, source.id)
        if (oldChunks.length > 0) {
            await deleteChunkVectors(env, oldChunks.map((c) => c.vectorId))
            await queries.deleteKbChunksBySource(db, source.id)
        }

        const vectors: { id: string; values: number[]; sourceId: number; title: string; text: string }[] = []

        for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
            const batch = chunks.slice(i, i + EMBED_BATCH_SIZE)
            const embeddings = await embedTexts(env, batch.map((c) => (c.heading ? `${c.heading}\n${c.text}` : c.text)))

            batch.forEach((chunk, j) => {
                const chunkIndex = i + j
                vectors.push({
                    id: chunkPointId(source.id, chunkIndex),
                    values: embeddings[j],
                    sourceId: source.id,
                    title: chunk.heading ? `${title} — ${chunk.heading}` : title,
                    text: chunk.text,
                })
            })
        }

        await upsertChunkVectors(env, vectors)

        await queries.createKbChunks(
            db,
            vectors.map((v, idx) => ({
                sourceId: source.id,
                chunkIndex: idx,
                vectorId: v.id,
                content: v.text,
            }))
        )

        await queries.updateKbSource(db, source.id, {
            title,
            contentHash,
            chunkCount: chunks.length,
            status: 'synced',
            errorMessage: null,
            lastSyncedAt: new Date().toISOString(),
        })

        return { sourceId: source.id, success: true, chunkCount: chunks.length }
    } catch (err: any) {
        await queries.updateKbSource(db, source.id, {
            status: 'error',
            errorMessage: err.message ?? 'Unknown error',
        })
        return { sourceId: source.id, success: false, error: err.message ?? 'Unknown error' }
    }
}

export async function syncAllKbSources(db: Db, env: Bindings): Promise<SyncResult[]> {
    const sources = await queries.getAllKbSources(db)
    const results: SyncResult[] = []

    for (const source of sources) {
        results.push(await syncKbSource(db, env, source))
    }

    return results
}

export function parseSeedUrls(raw: string | undefined): string[] {
    if (!raw) return []
    return raw
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter((u) => u.length > 0)
}
