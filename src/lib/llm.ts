import OpenAI from 'openai'
import type { Bindings } from '../types'

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

const GROQ_MODEL = 'llama-3.3-70b-versatile'
const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct'

async function callGroq(env: Bindings, messages: ChatMessage[]): Promise<string> {
    const client = new OpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: env.GROQ_API_KEY,
    })

    const completion = await client.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from Groq')
    return content
}

async function callOpenRouter(env: Bindings, messages: ChatMessage[]): Promise<string> {
    const client = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: env.OPENROUTER_API_KEY,
    })

    const completion = await client.chat.completions.create({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.3,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenRouter')
    return content
}

export async function getChatCompletion(env: Bindings, messages: ChatMessage[]): Promise<string> {
    if (env.GROQ_API_KEY) {
        try {
            return await callGroq(env, messages)
        } catch {
            if (!env.OPENROUTER_API_KEY) throw new Error('Groq request failed and no OpenRouter fallback configured')
        }
    }

    if (env.OPENROUTER_API_KEY) {
        return callOpenRouter(env, messages)
    }

    throw new Error('No chat provider configured')
}
