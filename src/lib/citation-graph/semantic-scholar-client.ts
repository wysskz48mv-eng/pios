import { fetchJsonWithRetry, sanitiseDoi, SimpleRateLimiter } from '@/lib/citation-graph/http'
import type { ExternalCitation, ExternalPaper } from '@/lib/citation-graph/models'

const BASE_URL = 'https://api.semanticscholar.org/graph/v1'
const API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY
const limiter = new SimpleRateLimiter(API_KEY ? 110 : 1200)

type SSPaper = Record<string, unknown>

function authHeaders(): Record<string, string> {
  if (!API_KEY) return {}
  return { 'x-api-key': API_KEY }
}

function mapS2Paper(paper: SSPaper): ExternalPaper | null {
  const title = String(paper.title ?? '').trim()
  if (!title) return null

  const externalIds = (paper.externalIds as Record<string, unknown> | undefined) ?? {}
  const doiRaw = String(externalIds.DOI ?? '').trim()

  const year = Number(paper.year ?? 0) || null

  const authors = ((paper.authors as Array<Record<string, unknown>> | undefined) ?? []).map((author) => ({
    full_name: String(author.name ?? '').trim(),
    semantic_scholar_id: String(author.authorId ?? '').trim() || null,
  })).filter((a) => Boolean(a.full_name))

  return {
    source: 'semantic_scholar',
    external_id: String(paper.paperId ?? '').trim() || null,
    doi: doiRaw ? sanitiseDoi(doiRaw) : null,
    arxiv_id: String(externalIds.ArXiv ?? '').trim() || null,
    pubmed_id: String(externalIds.PubMed ?? '').trim() || null,
    title,
    abstract: String(paper.abstract ?? '').trim() || null,
    publication_year: year,
    venue: String(paper.venue ?? '').trim() || null,
    venue_type: String(paper.publicationTypes ?? '').toLowerCase().includes('journal') ? 'journal' : undefined,
    citation_count: Number(paper.citationCount ?? 0) || 0,
    reference_count: Number(paper.referenceCount ?? 0) || 0,
    authors,
    raw_data: paper,
  }
}

export async function searchSemanticScholar(query: string): Promise<ExternalPaper[]> {
  const params = new URLSearchParams({
    query,
    limit: '25',
    fields: 'paperId,title,abstract,year,venue,citationCount,referenceCount,externalIds,authors',
  })

  const response = await fetchJsonWithRetry<{ data?: SSPaper[] }>(`${BASE_URL}/paper/search?${params.toString()}`, {
    headers: authHeaders(),
  }, {
    retries: 2,
    limiter,
  })

  return (response.data ?? [])
    .map(mapS2Paper)
    .filter((paper): paper is ExternalPaper => Boolean(paper))
}

export async function getPaperDetails(
  paperId: string,
  options?: {
    fields?: string[]
  },
): Promise<{ paper: ExternalPaper | null; citations: ExternalCitation[]; references: ExternalCitation[] }> {
  const fields = options?.fields?.length
    ? options.fields.join(',')
    : 'paperId,title,abstract,year,venue,citationCount,referenceCount,externalIds,authors,citations.paperId,citations.externalIds,citations.title,citations.year,citations.intent,references.paperId,references.externalIds,references.title,references.year,references.intent'

  const response = await fetchJsonWithRetry<SSPaper>(
    `${BASE_URL}/paper/${encodeURIComponent(paperId)}?fields=${encodeURIComponent(fields)}`,
    { headers: authHeaders() },
    { retries: 2, limiter },
  )

  const citations = ((response.citations as Array<Record<string, unknown>> | undefined) ?? []).map((item) => {
    const ext = (item.externalIds as Record<string, unknown> | undefined) ?? {}
    return {
      citing_external_id: String(response.paperId ?? '').trim() || null,
      cited_external_id: String(item.paperId ?? '').trim() || null,
      citing_doi: String((response.externalIds as Record<string, unknown> | undefined)?.DOI ?? '').trim() || null,
      cited_doi: String(ext.DOI ?? '').trim() || null,
      intent: Array.isArray(item.intent) ? String(item.intent[0] ?? '') || null : null,
    }
  })

  const references = ((response.references as Array<Record<string, unknown>> | undefined) ?? []).map((item) => {
    const ext = (item.externalIds as Record<string, unknown> | undefined) ?? {}
    return {
      citing_external_id: String(item.paperId ?? '').trim() || null,
      cited_external_id: String(response.paperId ?? '').trim() || null,
      citing_doi: String(ext.DOI ?? '').trim() || null,
      cited_doi: String((response.externalIds as Record<string, unknown> | undefined)?.DOI ?? '').trim() || null,
      intent: Array.isArray(item.intent) ? String(item.intent[0] ?? '') || null : null,
    }
  })

  return {
    paper: mapS2Paper(response),
    citations,
    references,
  }
}
