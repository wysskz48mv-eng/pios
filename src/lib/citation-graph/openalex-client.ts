import { fetchJsonWithRetry, sanitiseDoi, SimpleRateLimiter } from '@/lib/citation-graph/http'
import type { ExternalPaper } from '@/lib/citation-graph/models'

const BASE_URL = 'https://api.openalex.org'
const EMAIL = process.env.CITATION_GRAPH_CONTACT_EMAIL ?? 'support@veritasiq.io'
const limiter = new SimpleRateLimiter(120) // ~8 req/s

type OpenAlexWork = Record<string, unknown>

type OpenAlexSearchResponse = {
  results?: OpenAlexWork[]
}

function mapOpenAlexWork(work: OpenAlexWork): ExternalPaper | null {
  const title = String(work.title ?? '').trim()
  if (!title) return null

  const doiRaw = String(work.doi ?? '').trim()
  const doi = doiRaw ? sanitiseDoi(doiRaw) : null

  const oa = work.open_access as Record<string, unknown> | null | undefined
  const primaryLocation = work.primary_location as Record<string, unknown> | null | undefined
  const source = primaryLocation?.source as Record<string, unknown> | undefined

  const oaStatusRaw = String(oa?.oa_status ?? '').toLowerCase()
  const oaStatus = ['gold', 'green', 'hybrid', 'bronze', 'closed'].includes(oaStatusRaw)
    ? (oaStatusRaw as ExternalPaper['oa_status'])
    : undefined

  const publication_year = Number(work.publication_year ?? 0) || null
  const publication_date = String(work.publication_date ?? '').trim() || null

  const authors = ((work.authorships as Array<Record<string, unknown>> | undefined) ?? [])
    .map((authorship) => {
      const author = authorship.author as Record<string, unknown> | undefined
      const institutions = (authorship.institutions as Array<Record<string, unknown>> | undefined) ?? []
      const firstInstitution = institutions[0]
      const full_name = String(author?.display_name ?? '').trim()
      if (!full_name) return null

      return {
        full_name,
        openalex_id: String(author?.id ?? '').replace('https://openalex.org/', '') || null,
        orcid: String(author?.orcid ?? '').replace('https://orcid.org/', '') || null,
        affiliation: String(firstInstitution?.display_name ?? '').trim() || null,
        affiliation_country: String(firstInstitution?.country_code ?? '').trim() || null,
      }
    })
    .filter((a): a is NonNullable<typeof a> => Boolean(a))

  const type = String(work.type ?? '').toLowerCase()
  const venue_type = type.includes('journal')
    ? 'journal'
    : type.includes('proceedings') || type.includes('conference')
      ? 'conference'
      : type.includes('preprint')
        ? 'preprint'
        : undefined

  return {
    source: 'openalex',
    external_id: String(work.id ?? '').replace('https://openalex.org/', '') || null,
    doi,
    title,
    abstract: null,
    publication_date,
    publication_year,
    venue: String(source?.display_name ?? '').trim() || null,
    venue_type,
    oa_status: oaStatus,
    oa_url: String(oa?.oa_url ?? '').trim() || null,
    pdf_url: String(primaryLocation?.pdf_url ?? '').trim() || null,
    citation_count: Number(work.cited_by_count ?? 0) || 0,
    reference_count: Number(work.referenced_works_count ?? 0) || 0,
    authors,
    raw_data: work,
  }
}

export async function searchOpenAlex(
  query: string,
  options?: {
    filter?: {
      publication_year?: string
      open_access?: boolean
    }
    per_page?: number
  },
): Promise<ExternalPaper[]> {
  const perPage = Math.min(200, Math.max(1, options?.per_page ?? 25))

  const params = new URLSearchParams({
    search: query,
    'per-page': String(perPage),
    mailto: EMAIL,
  })

  if (options?.filter?.publication_year) {
    params.set('filter', `publication_year:${options.filter.publication_year}`)
  }

  if (options?.filter?.open_access === true) {
    const current = params.get('filter')
    params.set('filter', current ? `${current},is_oa:true` : 'is_oa:true')
  }

  const response = await fetchJsonWithRetry<OpenAlexSearchResponse>(`${BASE_URL}/works?${params.toString()}`, undefined, {
    retries: 2,
    limiter,
  })

  return (response.results ?? [])
    .map(mapOpenAlexWork)
    .filter((item): item is ExternalPaper => Boolean(item))
}

export async function getOpenAlexWork(id: string): Promise<ExternalPaper | null> {
  const workId = id.startsWith('W') ? id : id.replace('https://openalex.org/', '')
  const response = await fetchJsonWithRetry<OpenAlexWork>(`${BASE_URL}/works/${encodeURIComponent(workId)}?mailto=${encodeURIComponent(EMAIL)}`, undefined, {
    retries: 2,
    limiter,
  })

  return mapOpenAlexWork(response)
}

export async function getOpenAlexAuthor(id: string) {
  const authorId = id.startsWith('A') ? id : id.replace('https://openalex.org/', '')
  return fetchJsonWithRetry<Record<string, unknown>>(
    `${BASE_URL}/authors/${encodeURIComponent(authorId)}?mailto=${encodeURIComponent(EMAIL)}`,
    undefined,
    { retries: 2, limiter },
  )
}
