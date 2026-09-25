import type { Bindings } from '../types'
import type { Db } from '../db/client'
import * as queries from '../db/queries'
import type { KbSourceRow } from '../db/queries'
import { fetchGoogleDocHtml, googleDocHtmlToMarkdown, hashContent } from './googleDocs'
import { chunkMarkdown, type MarkdownChunk } from './chunk'
import { embedTexts, EMBEDDING_MODEL_VERSION } from './embeddings'
import { chunkPointId, ensureCollection, upsertChunkVectors, deleteChunkVectors } from './qdrant'

const EMBED_BATCH_SIZE = 20
const KB_CHUNKER_VERSION = 'v2'
const MAX_CHUNKS_PER_SOURCE = 200

const REPO_SOURCES = [
    { url: 'repo:events.json', path: '/data/events.json', title: 'Events catalog', kind: 'events-json' },
    { url: 'repo:invite.md', path: '/data/invite.md', title: 'Invite & brochure', kind: 'markdown' },
] as const

export async function ensureRepoSources(db: Db): Promise<KbSourceRow[]> {
    const rows: KbSourceRow[] = []
    for (const r of REPO_SOURCES) {
        const existing = await queries.getKbSourceByUrl(db, r.url)
        if (existing) {
            rows.push(existing)
            continue
        }
        rows.push(
            await queries.createKbSource(db, {
                url: r.url,
                docId: r.url,
                title: r.title,
                status: 'pending',
            })
        )
    }
    return rows
}

export function chunkEventsJson(raw: string): MarkdownChunk[] {
    const data = JSON.parse(raw) as Record<string, any>
    const names: string[] = Object.keys(data.events ?? {})
    if (names.length === 0) return []
    const pick = (obj: unknown, name: string, fallback: unknown) => {
        const v = (obj as Record<string, any> | undefined)?.[name]
        return v === undefined || v === null || v === '' ? fallback : v
    }
    const teamSizeOf = (name: string): string =>
        String(pick(data.display_participants, name, pick(data.participants, name, data.default?.participants ?? 'TBA')))
    const individualOf = (name: string): boolean =>
        !!((data.individual as Record<string, any> | undefined)?.[name])
    const overview: MarkdownChunk = {
        heading: 'All Exun 2026 events — team sizes and individual registration',
        text: names
            .map((name) => `- ${name}: team size up to ${teamSizeOf(name)}, individual registration ${individualOf(name) ? 'yes' : 'no'}, mode ${pick(data.mode, name, data.default?.mode ?? 'TBA')}`)
            .join('\n'),
    }
    const perEvent = names.map((name) => {
        const desc = (data.descriptions?.[name] as { long?: string; short?: string } | undefined) ?? {}
        const lines = [
            `Mode: ${pick(data.mode, name, data.default?.mode ?? 'TBA')}`,
            `Team size: up to ${teamSizeOf(name)}`,
            `Points: ${pick(data.points, name, data.default?.points ?? 'TBA')}`,
            `Eligibility: classes ${JSON.stringify(pick(data.eligibility, name, data.default?.eligibility ?? 'TBA'))}`,
            `Open to all: ${pick(data.open_to_all, name, data.default?.open_to_all ?? false) ? 'yes' : 'no'}`,
            `Individual registrations: ${individualOf(name) ? 'yes' : 'no'}`,
        ]
        const body = [desc.short, desc.long]
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
            .join('\n')
        return { heading: `Event: ${name}`, text: `${lines.join('\n')}${body ? `\n${body}` : ''}` }
    })
    return [overview].concat(perEvent)
}

export function isScheduleDoc(markdown: string): boolean {
    return /(Online|Offline) Events Schedule/.test(markdown)
}

function splitTableRow(line: string): string[] {
    let t = line.trim()
    if (t.startsWith('|')) t = t.slice(1)
    if (t.endsWith('|')) t = t.slice(0, -1)
    return t.split('|').map((c) => c.trim())
}

function isSeparatorRow(cells: string[]): boolean {
    return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c))
}

function eventKey(cell: string): string {
    return cell
        .replace(/\*/g, '')
        .replace(/\s*\(.*?\)\s*/g, '')
        .replace(/\s+(Prelims|Finals)$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
}

export function chunkSchedule(markdown: string): MarkdownChunk[] {
    const lines = markdown.split('\n')
    const byEvent = new Map<string, string[]>()
    const prose: string[] = []
    let section = ''
    let i = 0

    const addLine = (event: string, line: string) => {
        const list = byEvent.get(event) ?? []
        if (!list.includes(line)) list.push(line)
        byEvent.set(event, list)
    }

    while (i < lines.length) {
        const line = lines[i]
        if (/^\s*\|/.test(line)) {
            const table: string[][] = []
            while (i < lines.length && /^\s*\|/.test(lines[i])) {
                table.push(splitTableRow(lines[i]))
                i++
            }
            if (table.length >= 2) {
                const header = table[0]
                const rows = table.slice(1).filter((r) => !isSeparatorRow(r))
                const eventCol = header.findIndex((h) => /event/i.test(h))
                if (eventCol !== -1) {
                    for (const r of rows) {
                        const ev = (r[eventCol] ?? '').replace(/\*/g, '').trim()
                        if (!ev) continue
                        const facts = header
                            .map((h, ci) => ({ h: h.trim(), v: (r[ci] ?? '').replace(/\*\*/g, '').trim() }))
                            .filter((c) => c.h && c.v && !/event/i.test(c.h))
                            .map((c) => `${c.h}: ${c.v}`)
                        if (facts.length > 0) {
                            addLine(eventKey(ev), `${section ? `${section} — ` : ''}${ev}: ${facts.join(', ')}`)
                        }
                    }
                } else {
                    const dateCell = (header[0] ?? '').trim()
                    const datePrefix = dateCell ? `${dateCell}, ` : ''
                    for (const r of rows) {
                        const slot = (r[0] ?? '').replace(/\*\*/g, '').trim()
                        if (!slot) continue
                        for (let ci = 1; ci < r.length; ci++) {
                            const cell = (r[ci] ?? '').replace(/\*/g, '').trim()
                            if (!cell) continue
                            const key = eventKey(cell)
                            if (!key) continue
                            addLine(key, `${section ? `${section} — ` : ''}${cell}: ${datePrefix}${slot}`)
                        }
                    }
                }
            }
            continue
        }
        const heading = line.match(/^#{1,3}\s+(.*)$/)
        if (heading) {
            section = heading[1].trim()
        } else if (/^\s*\*\*.+\*\*\s*$/.test(line)) {
            let j = i + 1
            while (j < lines.length && lines[j].trim() === '') j++
            if (j < lines.length && /^\s*\|/.test(lines[j])) {
                section = line.replace(/^\s*\*\*|\*\*\s*$/g, '').trim()
            } else {
                prose.push(line.trim())
            }
        } else if (line.trim() !== '') {
            prose.push(line.trim())
        }
        i++
    }

    const chunks: MarkdownChunk[] = []
    for (const [event, facts] of byEvent) {
        chunks.push({ heading: `Schedule: ${event}`, text: facts.join('\n') })
    }
    if (prose.length > 0) {
        chunks.push({ heading: 'Schedule notes', text: prose.join('\n') })
    }
    return chunks
}

export interface SyncResult {
    sourceId: number
    success: boolean
    skipped?: boolean
    chunkCount?: number
    error?: string
}

export async function syncKbSource(db: Db, env: Bindings, source: KbSourceRow): Promise<SyncResult> {
    if (!source.enabled) {
        return { sourceId: source.id, success: true, skipped: true, chunkCount: source.chunkCount }
    }
    try {
        await ensureCollection(env)

        const repo = REPO_SOURCES.find((r) => r.url === source.url)

        let title: string
        let contentHash: string
        let chunks: MarkdownChunk[]

        if (repo) {
            const res = await env.ASSETS.fetch(new Request(`https://kb.local${repo.path}`))
            if (!res.ok) throw new Error(`Repo asset ${repo.path} returned ${res.status}`)
            const raw = await res.text()
            contentHash = await hashContent(`${KB_CHUNKER_VERSION}\n${EMBEDDING_MODEL_VERSION}\n${raw}`)

            if (contentHash === source.contentHash) {
                await queries.updateKbSource(db, source.id, {
                    status: 'synced',
                    lastSyncedAt: new Date().toISOString(),
                    title: repo.title,
                })
                return { sourceId: source.id, success: true, skipped: true, chunkCount: source.chunkCount }
            }

            title = repo.title
            chunks = repo.kind === 'events-json' ? chunkEventsJson(raw) : chunkMarkdown(raw)
        } else {
            const { html, title: docTitle } = await fetchGoogleDocHtml(source.docId)
            contentHash = await hashContent(`${KB_CHUNKER_VERSION}\n${EMBEDDING_MODEL_VERSION}\n${html}`)

            if (contentHash === source.contentHash) {
                await queries.updateKbSource(db, source.id, {
                    status: 'synced',
                    lastSyncedAt: new Date().toISOString(),
                    title: docTitle,
                })
                return { sourceId: source.id, success: true, skipped: true, chunkCount: source.chunkCount }
            }

            const markdown = googleDocHtmlToMarkdown(html)
            title = docTitle
            chunks = isScheduleDoc(markdown) ? chunkSchedule(markdown) : chunkMarkdown(markdown)
        }

        const capped = chunks.slice(0, MAX_CHUNKS_PER_SOURCE)
        const oldChunks = await queries.getKbChunksBySource(db, source.id, 10000)
        const oldVectorIds = new Set(oldChunks.map((c) => c.vectorId))

        const vectors: { id: string; values: number[]; sourceId: number; title: string; text: string }[] = []

        for (let i = 0; i < capped.length; i += EMBED_BATCH_SIZE) {
            const batch = capped.slice(i, i + EMBED_BATCH_SIZE)
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

        await queries.deleteKbChunksBySource(db, source.id)

        await queries.createKbChunks(
            db,
            vectors.map((v, idx) => ({
                sourceId: source.id,
                chunkIndex: idx,
                vectorId: v.id,
                content: v.text,
            }))
        )

        const newVectorIds = new Set(vectors.map((v) => v.id))
        const staleVectorIds = [...oldVectorIds].filter((id) => !newVectorIds.has(id))
        if (staleVectorIds.length > 0) {
            await deleteChunkVectors(env, staleVectorIds)
        }

        await queries.updateKbSource(db, source.id, {
            title,
            contentHash,
            chunkCount: capped.length,
            status: 'synced',
            errorMessage: null,
            lastSyncedAt: new Date().toISOString(),
        })

        return { sourceId: source.id, success: true, chunkCount: capped.length }
    } catch (err: any) {
        await queries.updateKbSource(db, source.id, {
            status: 'error',
            errorMessage: err.message ?? 'Unknown error',
        })
        return { sourceId: source.id, success: false, error: err.message ?? 'Unknown error' }
    }
}

export async function syncAllKbSources(db: Db, env: Bindings): Promise<SyncResult[]> {
    await ensureRepoSources(db)
    const sources = await queries.getAllKbSources(db, 1000)
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
