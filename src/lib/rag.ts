import type { Bindings } from '../types'
import { embedText } from './embeddings'
import { queryKnowledgeBase, type KbMatch } from './qdrant'

export const RAG_TOP_K = 5
export const RAG_MIN_SCORE = 0.72

export interface RetrievalResult {
    matches: KbMatch[]
    lowConfidence: boolean
}

export async function retrieveContext(env: Bindings, question: string): Promise<RetrievalResult> {
    const vector = await embedText(env, question)
    const matches = await queryKnowledgeBase(env, vector, RAG_TOP_K)

    const topScore = matches[0]?.score ?? 0
    const lowConfidence = matches.length === 0 || topScore < RAG_MIN_SCORE

    return { matches, lowConfidence }
}

export function buildContextBlock(matches: KbMatch[]): string {
    if (matches.length === 0) return 'No relevant information was found in the knowledge base.'

    return matches.map((m, i) => `[${i + 1}] ${m.title}\n${m.text}`).join('\n\n---\n\n')
}
