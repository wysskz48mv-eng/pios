import { fetchJsonWithRetry, sanitiseDoi, SimpleRateLimiter } from '@/lib/citation-graph/http'
import type { ExternalPaper } from '@/lib/citation-graph/models'

const BASE_URL = 'https://api.crossref.org'
const EMAIL = process.env.CITATION_GRAPH_CONTACT_EMAIL ?? 'support@veritasiq.io'

const limiter = new SimpleRateLimiter(30) // < 50 req/s polite pool

type CrossrefWork = Record<string, unknown>

type CrossrefResponse = {
  message?: {
    items?: CrossrefWork[]
  }
}

function parseDate(work: CrossrefWork): { publication_date: string | null; publication_year: number | null } {
  const datePart = (work['published-print'] ?? work['published-online']) as { 'date-parts'?: number[][] } | undefined
  const part = datePart?.['date-parts']?.[0]
  if (!part?.[0]) return { publication_date: null, publication_year: null }
  const [y, m = 1, d = 1] = part
  const publication_date = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
  return { publication_date, publication_year: y }
}

function mapCrossrefWork(work: CrossrefWork): ExternalPaper | null {
  const title = ((work.title as string[] | undefined)?.[0] ?? '').trim()
  if (!title) return null

  const doiRaw = (work.DOI as string | undefined) ?? null
  const doi = doiRaw ? sanitiseDoi(doiRaw) : null
  const { publication_date, publication_year } = parseDate(work)

  const authors = ((work.author as Array<Record<string, unknown>> | undefined) ?? [])
    .map((author) => {
      const given = String(author.given ?? '').trim()
      const family = String(author.family ?? '').trim()
      const full_name = [given, family].filter(Boolean).join(' ').trim()
      if (!full_name) return null
      return {
        full_name,
        orcid: author.ORCID ? String(author.ORCID).replace(/^https?:\/\/orcid.org\//i, '') : null,
        affiliation: Array.isArray(author.affiliation)
          ? String((author.affiliation[0] as Record<string, unknown> | undefined)?.name ?? '').trim() || null
          : null,
      }
    })
    .filter((a): a is NonNullable<typeof a> => Boolean(a))

  const type = String(work.type ?? '').toLowerCase()
  const venueType = type.includes('journal')
    ? 'journal'
    : type.includes('proceedings') || type.includes('conference')
      ? 'conference'
      : undefined

  return {
    source: 'crossref',
    external_id: String(work.member ?? '') || null,
    doi,
    title,
    abstract: work.abstract ? String(work.abstract).slice(0, 5000) : null,
    publication_date,
    publication_year,
    venue: ((work['container-title'] as string[] | undefined)?.[0] ?? null),
    venue_type: venueType,
    citation_count: Number(work['is-referenced-by-count'] ?? 0) || 0,
    reference_count: Number(work.references_count ?? 0) || 0,
    authors,
    raw_data: work,
  }
}

export async function searchCrossref(
  query: string,
  options?: {
    rows?: number
    offset?: number
    filter?: {
      from_pub_date?: string
      until_pub_date?: string
      type?: string
    }
  },
): Promise<ExternalPaper[]> {
  const rows = Math.min(100, Math.max(1, options?.rows ?? 25))
  const offset = Math.max(0, options?.offset ?? 0)

  const params = new URLSearchParams({
    query,
    rows: String(rows),
    offset: String(offset),
    mailto: EMAIL,
  })

  if (options?.filter) {
    const filter = Object.entries(options.filter)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `${key}:${value}`)
      .join(',')
    if (filter) params.set('filter', filter)
  }

  const response = await fetchJsonWithRetry<CrossrefResponse>(`${BASE_URL}/works?${params.toString()}`, undefined, {
    retries: 2,
    limiter,
  })

  return (response.message?.items ?? [])
    .map(mapCrossrefWork)
    .filter((item): item is ExternalPaper => Boolean(item))
}

export async function getCrossrefByDOI(doi: string): Promise<ExternalPaper | null> {
  const cleanDoi = sanitiseDoi(doi)
  const response = await fetchJsonWithRetry<{ message?: CrossrefWork }>(
    `${BASE_URL}/works/${encodeURIComponent(cleanDoi)}?mailto=${encodeURIComponent(EMAIL)}`,
    undefined,
    { retries: 2, limiter },
  )

  if (!response.message) return null
  return mapCrossrefWork(response.message)
}
