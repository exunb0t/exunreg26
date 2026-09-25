import type { Bindings } from '../types'
import { EMBEDDING_DIMENSIONS } from './embeddings'

export interface KbMatch {
    vectorId: string
    score: number
    sourceId: number
    title: string
    text: string
}

function qdrantHeaders(env: Bindings): HeadersInit {
    return {
        'Content-Type': 'application/json',
        'api-key': env.QDRANT_API_KEY,
    }
}

function collectionUrl(env: Bindings, path = ''): string {
    return `${env.QDRANT_URL}/collections/${env.QDRANT_COLLECTION}${path}`
}

export function chunkPointId(sourceId: number, chunkIndex: number): string {
    const id = sourceId * 1_000_000 + chunkIndex
    if (!Number.isSafeInteger(id)) throw new Error('Chunk point id overflow')
    return String(id)
}

async function qdrantFetch(env: Bindings, url: string, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
            if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
                lastErr = new Error(`Qdrant transient ${res.status}`)
                await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
                continue
            }
            return res
        } catch (err) {
            lastErr = err
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Qdrant request failed')
}

export async function ensureCollection(env: Bindings): Promise<void> {
    const check = await qdrantFetch(env, collectionUrl(env), { headers: qdrantHeaders(env) }, 10000)
    if (check.ok) {
        try {
            const info = await check.json<{ result?: { config?: { params?: { vectors?: { size?: number } } } } }>()
            const size = info.result?.config?.params?.vectors?.size
            if (typeof size === 'number' && size !== EMBEDDING_DIMENSIONS) {
                throw new Error(`Qdrant dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${size}`)
            }
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('Qdrant dimension mismatch')) throw err
        }
        return
    }

    const create = await qdrantFetch(env, collectionUrl(env), {
        method: 'PUT',
        headers: qdrantHeaders(env),
        body: JSON.stringify({
            vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' },
        }),
    }, 15000)

    if (!create.ok) {
        throw new Error(`Failed to create Qdrant collection: ${await create.text()}`)
    }
}

export async function upsertChunkVectors(
    env: Bindings,
    vectors: { id: string; values: number[]; sourceId: number; title: string; text: string }[]
): Promise<void> {
    if (vectors.length === 0) return

    const res = await qdrantFetch(env, `${collectionUrl(env, '/points')}?wait=true`, {
        method: 'PUT',
        headers: qdrantHeaders(env),
        body: JSON.stringify({
            points: vectors.map((v) => ({
                id: Number(v.id),
                vector: v.values,
                payload: {
                    sourceId: v.sourceId,
                    title: v.title,
                    text: v.text,
                },
            })),
        }),
    })

    if (!res.ok) {
        throw new Error(`Qdrant upsert failed: ${await res.text()}`)
    }
}

export async function deleteChunkVectors(env: Bindings, ids: string[]): Promise<void> {
    if (ids.length === 0) return

    const res = await qdrantFetch(env, `${collectionUrl(env, '/points/delete')}?wait=true`, {
        method: 'POST',
        headers: qdrantHeaders(env),
        body: JSON.stringify({ points: ids.map((id) => Number(id)) }),
    })

    if (!res.ok) {
        throw new Error(`Qdrant delete failed: ${await res.text()}`)
    }
}

export async function queryKnowledgeBase(env: Bindings, queryVector: number[], topK: number, excludeSourceIds: number[] = []): Promise<KbMatch[]> {
    const res = await qdrantFetch(env, collectionUrl(env, '/points/search'), {
        method: 'POST',
        headers: qdrantHeaders(env),
        body: JSON.stringify({
            vector: queryVector,
            limit: topK,
            with_payload: true,
            ...(excludeSourceIds.length > 0
                ? { filter: { must_not: [{ key: 'sourceId', match: { any: excludeSourceIds } }] } }
                : {}),
        }),
    }, 10000)

    if (!res.ok) {
        throw new Error(`Qdrant search failed: ${await res.text()}`)
    }

    const data = await res.json<{ result: { id: number; score: number; payload: Record<string, unknown> }[] }>()

    return data.result.map((m) => ({
        vectorId: String(m.id),
        score: m.score,
        sourceId: Number(m.payload?.sourceId ?? 0),
        title: String(m.payload?.title ?? ''),
        text: String(m.payload?.text ?? ''),
    }))
}
