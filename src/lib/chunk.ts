export interface MarkdownChunk {
    heading: string
    text: string
}

const MAX_CHUNK_CHARS = 1500
const MIN_CHUNK_CHARS = 200

function splitBlocks(markdown: string): string[] {
    const lines = markdown.split('\n')
    const blocks: string[] = []
    let current: string[] = []
    let inTable = false

    const flush = () => {
        if (current.length) {
            blocks.push(current.join('\n').trim())
            current = []
        }
    }

    for (const line of lines) {
        const isTableLine = /^\s*\|/.test(line)

        if (isTableLine) {
            inTable = true
            current.push(line)
            continue
        }

        if (line.trim() === '') {
            inTable = false
            flush()
            continue
        }

        current.push(line)
    }

    flush()
    return blocks.filter((b) => b.length > 0)
}

export function chunkMarkdown(markdown: string): MarkdownChunk[] {
    const blocks = splitBlocks(markdown)
    const chunks: MarkdownChunk[] = []

    let currentHeading = ''
    let buffer: string[] = []
    let bufferLen = 0

    const flush = () => {
        const text = buffer.join('\n\n').trim()
        buffer = []
        bufferLen = 0

        if (!text) return

        if (text.length < MIN_CHUNK_CHARS && chunks.length > 0) {
            chunks[chunks.length - 1].text += '\n\n' + text
            return
        }

        chunks.push({ heading: currentHeading, text })
    }

    for (const block of blocks) {
        const headingMatch = block.match(/^(#{1,6})\s+(.*)$/)

        if (headingMatch) {
            flush()
            currentHeading = headingMatch[2].trim()
            buffer.push(block)
            bufferLen += block.length
            continue
        }

        const isTable = block.split('\n').every((l) => /^\s*\|/.test(l))

        if (!isTable && buffer.length > 0 && bufferLen + block.length > MAX_CHUNK_CHARS) {
            flush()
        }

        buffer.push(block)
        bufferLen += block.length

        if (isTable && bufferLen > MAX_CHUNK_CHARS) {
            flush()
        }
    }

    flush()
    return chunks
}
