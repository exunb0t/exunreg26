import { Context } from 'hono'
import OpenAI from 'openai'
import type { Bindings } from '../types'

const LIMITS = {
    MAX_MESSAGE_LENGTH: 2000,
    MAX_SYSTEM_PROMPT_LENGTH: 1000,
}

export async function chatHandler(c: Context<{ Bindings: Bindings }>) {
    try {
        const body = await c.req.json<{ userMessage: string; customSystemPrompt?: string }>()
        const { userMessage, customSystemPrompt } = body

        if (!userMessage) {
            return c.json({ error: 'Missing userMessage' }, 400)
        }

        // Enforcing safety character limits
        if (userMessage.length > LIMITS.MAX_MESSAGE_LENGTH) {
            return c.json({ error: 'User message is too long.' }, 400)
        }
        if (customSystemPrompt && customSystemPrompt.length > LIMITS.MAX_SYSTEM_PROMPT_LENGTH) {
            return c.json({ error: 'System prompt is too long.' }, 400)
        }

        // Connecting to OpenRouter using the wrangler secret
        const openai = new OpenAI({
            baseURL: 'https://openrouter.ai',
            apiKey: c.env.OPENROUTER_API_KEY,
        })

        // Sending limits and custom system prompt directly to Groq (Llama 3)
        const completion = await openai.chat.completions.create({
            model: 'meta-llama/llama-3-70b-instruct:groq',

            messages: [
                { role: 'system', content: customSystemPrompt || 'You are a helpful AI Thats Going to be used for queries and tickets handling along iwth solving user doubts. Blah Blah .' },
                { role: 'user', content: userMessage }
            ],
        })

        return c.json({ reply: completion.choices[0]?.message?.content || 'No response.' }, 200)

    } catch (error: any) {
        return c.json({ error: error.message }, 500)
    }
}
