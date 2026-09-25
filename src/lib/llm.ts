import OpenAI from 'openai'
import type { Bindings } from '../types'

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

const GROQ_MODEL = 'openai/gpt-oss-120b'
const OPENROUTER_MODEL = 'openai/gpt-oss-120b'

async function callGroq(env: Bindings, messages: ChatMessage[]): Promise<string> {
    const client = new OpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: env.GROQ_API_KEY,
        timeout: 10000,
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
        timeout: 10000,
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
        } catch (err) {
            console.error(JSON.stringify({ provider: 'groq', message: err instanceof Error ? err.message : String(err) }))
            if (!env.OPENROUTER_API_KEY) throw new Error('Groq request failed and no OpenRouter fallback configured')
        }
    }

    if (env.OPENROUTER_API_KEY) {
        return callOpenRouter(env, messages)
    }

    throw new Error('No chat provider configured')
}

export async function streamChatCompletion(
    env: Bindings,
    messages: ChatMessage[],
    onToken: (token: string) => void
): Promise<string> {
    const providers: { baseURL: string; apiKey: string; model: string }[] = []
    if (env.GROQ_API_KEY) {
        providers.push({ baseURL: 'https://api.groq.com/openai/v1', apiKey: env.GROQ_API_KEY, model: GROQ_MODEL })
    }
    if (env.OPENROUTER_API_KEY) {
        providers.push({ baseURL: 'https://openrouter.ai/api/v1', apiKey: env.OPENROUTER_API_KEY, model: OPENROUTER_MODEL })
    }
    if (providers.length === 0) throw new Error('No chat provider configured')

    let lastError: unknown = null
    for (const p of providers) {
        let sentAny = false
        try {
            const client = new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey, timeout: 15000 })
            const stream = await client.chat.completions.create({
                model: p.model,
                messages,
                temperature: 0.3,
                stream: true,
            })
            let full = ''
            for await (const chunk of stream) {
                const t = chunk.choices[0]?.delta?.content || ''
                if (t) {
                    full += t
                    sentAny = true
                    onToken(t)
                }
            }
            if (!full) throw new Error('Empty response from chat provider')
            return full
        } catch (err) {
            if (sentAny) throw err
            lastError = err
        }
    }
    throw lastError
}
