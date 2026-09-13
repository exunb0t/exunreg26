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
        const res = await fetch(url, { redirect: 'follow' })
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

export async function fetchGoogleDocHtml(docId: string): Promise<FetchedDoc> {
    const url = docId.startsWith('pub:')
        ? `https://docs.google.com/document/d/e/${docId.slice(4)}/pub`
        : `https://docs.google.com/document/d/${docId}/export?format=html`
    const res = await fetch(url)

    if (!res.ok) {
        throw new Error(`Failed to fetch Google Doc (status ${res.status}). Make sure link sharing is set to "Anyone with the link can view".`)
    }

    const html = await res.text()
    const titleMatch = html.match(/<title>(.*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"') : docId

    return { html, title }
}

export function googleDocHtmlToMarkdown(html: string): string {
    return NodeHtmlMarkdown.translate(html, {
        ignore: ['style', 'script'],
    })
}

export async function hashContent(content: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
