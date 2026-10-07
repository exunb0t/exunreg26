import { NodeHtmlMarkdown } from 'node-html-markdown'

export function extractGoogleDocId(url: string): string | null {
    const pub = url.match(/\/document\/(?:u\/\d+\/)?d\/e\/([a-zA-Z0-9_-]+)/)
    if (pub) return `pub:${pub[1]}`
    const match = url.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
}

export async function resolveGoogleDocId(url: string): Promise<string | null> {
    const direct = extractGoogleDocId(url)
    if (direct) return direct

    try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) })
        const finalUrl = res.url || url
        return extractGoogleDocId(finalUrl)
    } catch {
        return null
    }
}

export interface FetchedDoc {
    html: string
    title: string
}

const MAX_DOC_BYTES = 3 * 1024 * 1024

export async function fetchGoogleDocHtml(docId: string): Promise<FetchedDoc> {
    const url = docId.startsWith('pub:')
        ? `https://docs.google.com/document/d/e/${docId.slice(4)}/pub`
        : `https://docs.google.com/document/d/${docId}/export?format=html`
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })

    if (!res.ok) {
        throw new Error(`Failed to fetch Google Doc (status ${res.status}). Make sure link sharing is set to "Anyone with the link can view".`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('html')) {
        throw new Error(`Unexpected Google Doc content type: ${contentType || 'unknown'}`)
    }
    const length = Number(res.headers.get('content-length') ?? 0)
    if (Number.isFinite(length) && length > MAX_DOC_BYTES) {
        throw new Error('Google Doc is too large to sync')
    }

    const html = await res.text()
    if (html.length > MAX_DOC_BYTES) {
        throw new Error('Google Doc is too large to sync')
    }
    const titleMatch = html.match(/<title>(.*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"') : docId

    return { html, title }
}

export function googleDocHtmlToMarkdown(html: string): string {
    const markdown = NodeHtmlMarkdown.translate(html, {
        ignore: ['style', 'script'],
    })
    if (markdown.trim().length < 200) {
        throw new Error('Google Doc converted to almost no text; refusing to sync')
    }
    return markdown
}

export async function hashContent(content: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
