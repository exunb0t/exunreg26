import type { Bindings } from '../types'

export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
export const EMBEDDING_DIMENSIONS = 768

export async function embedTexts(env: Bindings, texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const result = await env.AI.run(EMBEDDING_MODEL, { text: texts }) as { data: number[][] }
    return result.data
}

export async function embedText(env: Bindings, text: string): Promise<number[]> {
    const [vector] = await embedTexts(env, [text])
    return vector
}
