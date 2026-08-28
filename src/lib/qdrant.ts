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
    return String(sourceId * 1_000_000 + chunkIndex)
}

export async function ensureCollection(env: Bindings): Promise<void> {
    const check = await fetch(collectionUrl(env), { headers: qdrantHeaders(env) })
    if (check.ok) return

    const create = await fetch(collectionUrl(env), {
        method: 'PUT',
        headers: qdrantHeaders(env),
        body: JSON.stringify({
            vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' },
        }),
    })

    if (!create.ok) {
        throw new Error(`Failed to create Qdrant collection: ${await create.text()}`)
    }
}

export async function upsertChunkVectors(
    env: Bindings,
    vectors: { id: string; values: number[]; sourceId: number; title: string; text: string }[]
): Promise<void> {
    if (vectors.length === 0) return

    const res = await fetch(`${collectionUrl(env, '/points')}?wait=true`, {
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

    const res = await fetch(`${collectionUrl(env, '/points/delete')}?wait=true`, {
        method: 'POST',
        headers: qdrantHeaders(env),
        body: JSON.stringify({ points: ids.map((id) => Number(id)) }),
    })

    if (!res.ok) {
        throw new Error(`Qdrant delete failed: ${await res.text()}`)
    }
}

export async function queryKnowledgeBase(env: Bindings, queryVector: number[], topK: number): Promise<KbMatch[]> {
    const res = await fetch(collectionUrl(env, '/points/search'), {
        method: 'POST',
        headers: qdrantHeaders(env),
        body: JSON.stringify({
            vector: queryVector,
            limit: topK,
            with_payload: true,
        }),
    })

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
