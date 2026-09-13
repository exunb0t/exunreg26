import type { Bindings } from '../types'
import { embedText } from './embeddings'
import { queryKnowledgeBase, type KbMatch } from './qdrant'

export const RAG_TOP_K = 5

export interface RetrievalResult {
    matches: KbMatch[]
}

export async function retrieveContext(env: Bindings, question: string, excludeSourceIds: number[] = []): Promise<RetrievalResult> {
    const vector = await embedText(env, question)
    const matches = await queryKnowledgeBase(env, vector, RAG_TOP_K, excludeSourceIds)

    return { matches }
}

export function buildContextBlock(matches: KbMatch[]): string {
    if (matches.length === 0) return 'No relevant information was found in the knowledge base.'

    return matches.map((m, i) => `[${i + 1}] ${m.title}\n${m.text}`).join('\n\n---\n\n')
}

export function buildRosterBlock(events: { name: string; mode?: string | null; participants?: number | null; independentRegistration?: boolean | null; points?: number | null; eligibility?: string | null; openToAll?: boolean | null; dates?: string | null }[]): string {
    if (events.length === 0) return ''

    const lines = events.map((e) => {
        const bits = [
            `mode: ${e.mode ?? 'TBA'}`,
            `team size up to ${e.participants ?? 'TBA'}`,
            `individual registration: ${e.independentRegistration ? 'yes' : 'no'}`,
            `points: ${e.points ?? 'TBA'}`,
        ]
        if (e.eligibility) bits.push(`eligibility: ${e.eligibility}`)
        if (e.openToAll) bits.push('open to all')
        if (e.dates) bits.push(`dates: ${e.dates}`)
        return `- ${e.name} (${bits.join(', ')})`
    })
    return `Complete event roster (authoritative — use this for any question about which events exist, team sizes, modes, points, eligibility, dates, or individual registration):\n${lines.join('\n')}`
}
