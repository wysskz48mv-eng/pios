import { SimpleRateLimiter } from '@/lib/citation-graph/http'
import type { ExternalPaper } from '@/lib/citation-graph/models'

const BASE_URL = 'https://export.arxiv.org/api/query'
const limiter = new SimpleRateLimiter(350)

function textBetween(source: string, startTag: string, endTag: string): string {
  const start = source.indexOf(startTag)
  if (start === -1) return ''
  const from = start + startTag.length
  const end = source.indexOf(endTag, from)
  if (end === -1) return ''
  return source.slice(from, end).trim()
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function parseEntries(xml: string): ExternalPaper[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
  return entries.map((entry) => {
    const idUrl = textBetween(entry, '<id>', '</id>')
    const arxiv_id = idUrl.split('/abs/')[1] ?? idUrl

    const title = decodeXml(textBetween(entry, '<title>', '</title>').replace(/\s+/g, ' '))
    const abstract = decodeXml(textBetween(entry, '<summary>', '</summary>').replace(/\s+/g, ' '))
    const published = textBetween(entry, '<published>', '</published>')

    const authorBlocks = entry.match(/<author>[\s\S]*?<\/author>/g) ?? []
    const authors = authorBlocks
      .map((block) => ({ full_name: decodeXml(textBetween(block, '<name>', '</name>')) }))
      .filter((author) => Boolean(author.full_name))

    const year = Number(published.slice(0, 4)) || null

    return {
      source: 'arxiv' as const,
      external_id: arxiv_id,
      arxiv_id,
      title,
      abstract: abstract || null,
      publication_date: published ? published.slice(0, 10) : null,
      publication_year: year,
      venue: 'arXiv',
      venue_type: 'preprint' as const,
      oa_status: 'green' as const,
      oa_url: idUrl || null,
      pdf_url: idUrl ? idUrl.replace('/abs/', '/pdf/') + '.pdf' : null,
      citation_count: 0,
      reference_count: 0,
      authors,
      raw_data: { xml: entry },
    }
  }).filter((paper) => Boolean(paper.title))
}

export async function searchArxiv(
  query: string,
  options?: {
    start?: number
    max_results?: number
    sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate'
  },
): Promise<ExternalPaper[]> {
  await limiter.waitTurn()

  const start = Math.max(0, options?.start ?? 0)
  const maxResults = Math.min(100, Math.max(1, options?.max_results ?? 25))
  const sortBy = options?.sortBy ?? 'relevance'

  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: String(start),
    max_results: String(maxResults),
    sortBy,
  })

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(12000),
  })

  if (!response.ok) {
    throw new Error(`arXiv request failed: ${response.status} ${response.statusText}`)
  }

  const xml = await response.text()
  return parseEntries(xml)
}
