import type { Bindings } from '../types'

export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
export const EMBEDDING_DIMENSIONS = 768
export const EMBEDDING_MODEL_VERSION = 'bge-v1.5-768'
const EMBED_INPUT_MAX = 1500

export async function embedTexts(env: Bindings, texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const trimmed = texts.map((t) => t.slice(0, EMBED_INPUT_MAX))
    const result = await env.AI.run(EMBEDDING_MODEL, { text: trimmed }) as { data: number[][] }
    return result.data
}

export async function embedText(env: Bindings, text: string): Promise<number[]> {
    const [vector] = await embedTexts(env, [text])
    return vector
}
