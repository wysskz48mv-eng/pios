import type { SupabaseClient } from '@supabase/supabase-js'
import { getCrossrefByDOI, searchCrossref } from '@/lib/citation-graph/crossref-client'
import { searchOpenAlex } from '@/lib/citation-graph/openalex-client'
import { searchSemanticScholar, getPaperDetails } from '@/lib/citation-graph/semantic-scholar-client'
import { searchArxiv } from '@/lib/citation-graph/arxiv-client'
import type { ExternalAuthor, ExternalPaper } from '@/lib/citation-graph/models'
import type { CitationSource, IngestSummary } from '@/types/citation-graph'

function normaliseDoi(doi?: string | null) {
  if (!doi) return null
  return doi.trim().replace(/^https?:\/\/doi.org\//i, '') || null
}

function paperSearchText(paper: ExternalPaper) {
  return `${paper.title ?? ''} ${(paper.abstract ?? '').slice(0, 2000)} ${paper.venue ?? ''}`
}

async function upsertPaper(client: SupabaseClient, paper: ExternalPaper): Promise<{ id: string | null; inserted: boolean; updated: boolean }> {
  const doi = normaliseDoi(paper.doi)

  let existing: { id: string } | null = null

  if (doi) {
    const { data } = await client
      .from('pios_papers')
      .select('id')
      .eq('doi', doi)
      .maybeSingle()
    existing = (data as { id: string } | null) ?? null
  }

  if (!existing) {
    const { data } = await client
      .from('pios_papers')
      .select('id')
      .eq('title', paper.title)
      .eq('publication_year', paper.publication_year ?? null)
      .limit(1)
      .maybeSingle()
    existing = (data as { id: string } | null) ?? null
  }

  const payload = {
    doi,
    arxiv_id: paper.arxiv_id ?? null,
    pubmed_id: paper.pubmed_id ?? null,
    title: paper.title,
    abstract: paper.abstract ?? null,
    publication_date: paper.publication_date ?? null,
    publication_year: paper.publication_year ?? null,
    venue: paper.venue ?? null,
    venue_type: paper.venue_type ?? null,
    oa_status: paper.oa_status ?? null,
    oa_url: paper.oa_url ?? null,
    pdf_url: paper.pdf_url ?? null,
    citation_count: paper.citation_count ?? 0,
    reference_count: paper.reference_count ?? 0,
    data_source: paper.source,
    external_id: paper.external_id ?? null,
    raw_data: paper.raw_data ?? null,
  }

  if (existing?.id) {
    const { error } = await client
      .from('pios_papers')
      .update(payload)
      .eq('id', existing.id)

    if (error) throw error
    return { id: existing.id, inserted: false, updated: true }
  }

  const { data, error } = await client
    .from('pios_papers')
    .insert(payload)
    .select('id')
    .single()

  if (error) throw error
  return { id: String(data.id), inserted: true, updated: false }
}

async function upsertAuthor(client: SupabaseClient, author: ExternalAuthor, dataSource: CitationSource): Promise<{ id: string | null; inserted: boolean }> {
  const fullName = author.full_name.trim()
  if (!fullName) return { id: null, inserted: false }

  if (author.orcid) {
    const { data } = await client.from('pios_authors').select('id').eq('orcid', author.orcid).maybeSingle()
    if (data?.id) {
      const { error } = await client
        .from('pios_authors')
        .update({
          full_name: fullName,
          display_name: fullName,
          affiliation: author.affiliation ?? null,
          affiliation_country: author.affiliation_country ?? null,
          openalex_id: author.openalex_id ?? null,
          semantic_scholar_id: author.semantic_scholar_id ?? null,
          data_source: dataSource,
        })
        .eq('id', data.id)
      if (error) throw error
      return { id: String(data.id), inserted: false }
    }
  }

  const { data: existing } = await client
    .from('pios_authors')
    .select('id')
    .ilike('full_name', fullName)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await client
      .from('pios_authors')
      .update({
        display_name: fullName,
        affiliation: author.affiliation ?? null,
        affiliation_country: author.affiliation_country ?? null,
        orcid: author.orcid ?? null,
        openalex_id: author.openalex_id ?? null,
        semantic_scholar_id: author.semantic_scholar_id ?? null,
        data_source: dataSource,
      })
      .eq('id', existing.id)

    if (error) throw error
    return { id: String(existing.id), inserted: false }
  }

  const { data, error } = await client
    .from('pios_authors')
    .insert({
      orcid: author.orcid ?? null,
      openalex_id: author.openalex_id ?? null,
      semantic_scholar_id: author.semantic_scholar_id ?? null,
      full_name: fullName,
      display_name: fullName,
      affiliation: author.affiliation ?? null,
      affiliation_country: author.affiliation_country ?? null,
      data_source: dataSource,
    })
    .select('id')
    .single()

  if (error) throw error
  return { id: String(data.id), inserted: true }
}

async function linkAuthorPaper(client: SupabaseClient, authorId: string, paperId: string, authorPosition: number) {
  const { error } = await client
    .from('pios_author_papers')
    .upsert({
      author_id: authorId,
      paper_id: paperId,
      author_position: authorPosition,
    }, { onConflict: 'author_id,paper_id' })
  if (error) throw error
}

async function upsertPaperWithAuthors(client: SupabaseClient, paper: ExternalPaper, summary: IngestSummary) {
  const paperResult = await upsertPaper(client, paper)
  if (!paperResult.id) return null

  if (paperResult.inserted) summary.papers_added += 1
  if (paperResult.updated) summary.papers_updated += 1

  for (let index = 0; index < paper.authors.length; index += 1) {
    const author = paper.authors[index]
    const authorResult = await upsertAuthor(client, author, paper.source)
    if (!authorResult.id) continue

    if (authorResult.inserted) {
      summary.authors_added += 1
    }

    await linkAuthorPaper(client, authorResult.id, paperResult.id, index + 1)
    summary.author_links_added += 1
  }

  return paperResult.id
}

async function ingestCitationsForPaper(client: SupabaseClient, paper: ExternalPaper, paperId: string, summary: IngestSummary) {
  if (paper.source !== 'semantic_scholar' || !paper.external_id) return

  const details = await getPaperDetails(paper.external_id)

  const processOneCitation = async (
    input: { citing_external_id?: string | null; cited_external_id?: string | null; citing_doi?: string | null; cited_doi?: string | null; intent?: string | null },
  ) => {
    if (!input.cited_external_id && !input.cited_doi) return

    let citedPaperId: string | null = null
    if (input.cited_doi) {
      const { data } = await client.from('pios_papers').select('id').eq('doi', normaliseDoi(input.cited_doi)).maybeSingle()
      citedPaperId = data?.id ? String(data.id) : null
    }

    if (!citedPaperId && input.cited_external_id) {
      const { data } = await client.from('pios_papers').select('id').eq('external_id', input.cited_external_id).maybeSingle()
      citedPaperId = data?.id ? String(data.id) : null
    }

    if (!citedPaperId) return

    const { error } = await client
      .from('pios_citations')
      .upsert({
        citing_paper_id: paperId,
        cited_paper_id: citedPaperId,
        intent: input.intent ?? null,
      }, { onConflict: 'citing_paper_id,cited_paper_id' })

    if (error) throw error
    summary.citations_added += 1
  }

  for (const citation of details.citations) {
    await processOneCitation(citation)
  }
}

async function ingestPapers(client: SupabaseClient, papers: ExternalPaper[], options?: { includeCitations?: boolean }) {
  const summary: IngestSummary = {
    papers_added: 0,
    papers_updated: 0,
    citations_added: 0,
    authors_added: 0,
    author_links_added: 0,
  }

  for (const paper of papers) {
    if (!paper.title?.trim()) continue
    const paperId = await upsertPaperWithAuthors(client, paper, summary)
    if (paperId && options?.includeCitations) {
      await ingestCitationsForPaper(client, paper, paperId, summary)
    }
  }

  return summary
}

export async function ingestByDOI(
  client: SupabaseClient,
  doi: string,
  options?: {
    includeReferences?: boolean
    includeCitations?: boolean
  },
): Promise<IngestSummary> {
  const [crossrefPaper, semanticMatches, openAlexMatches] = await Promise.all([
    getCrossrefByDOI(doi).catch(() => null),
    searchSemanticScholar(doi).catch(() => []),
    searchOpenAlex(doi, { per_page: 5 }).catch(() => []),
  ])

  const papers = [crossrefPaper, ...semanticMatches, ...openAlexMatches]
    .filter((paper): paper is ExternalPaper => Boolean(paper))
    .filter((paper, idx, arr) => idx === arr.findIndex((candidate) => normaliseDoi(candidate.doi) === normaliseDoi(paper.doi) || candidate.title === paper.title))

  if (papers.length === 0) {
    throw new Error('No paper found for DOI')
  }

  return ingestPapers(client, papers, { includeCitations: options?.includeCitations })
}

export async function ingestByTopic(
  client: SupabaseClient,
  topic: string,
  options?: {
    year_min?: number
    year_max?: number
    limit?: number
    sources?: CitationSource[]
  },
): Promise<IngestSummary> {
  const limit = Math.max(1, Math.min(100, options?.limit ?? 25))
  const sources = options?.sources?.length ? options.sources : ['openalex', 'crossref']

  const tasks: Promise<ExternalPaper[]>[] = []

  if (sources.includes('openalex')) {
    const yearsFilter = options?.year_min && options?.year_max
      ? `${options.year_min}-${options.year_max}`
      : options?.year_min
        ? `${options.year_min}-`
        : options?.year_max
          ? `-${options.year_max}`
          : undefined

    tasks.push(searchOpenAlex(topic, {
      per_page: limit,
      filter: {
        publication_year: yearsFilter,
      },
    }))
  }

  if (sources.includes('crossref')) {
    tasks.push(searchCrossref(topic, {
      rows: limit,
      filter: {
        from_pub_date: options?.year_min ? `${options.year_min}-01-01` : undefined,
        until_pub_date: options?.year_max ? `${options.year_max}-12-31` : undefined,
      },
    }))
  }

  if (sources.includes('semantic_scholar')) {
    tasks.push(searchSemanticScholar(topic))
  }

  if (sources.includes('arxiv')) {
    tasks.push(searchArxiv(topic, { max_results: limit }))
  }

  const all = (await Promise.all(tasks)).flat()

  const deduped = all
    .filter((paper) => Boolean(paper.title))
    .filter((paper, idx, arr) => idx === arr.findIndex((candidate) => {
      const paperDoi = normaliseDoi(paper.doi)
      const candidateDoi = normaliseDoi(candidate.doi)
      if (paperDoi && candidateDoi) return paperDoi === candidateDoi
      return candidate.title.toLowerCase() === paper.title.toLowerCase()
    }))
    .slice(0, limit)

  return ingestPapers(client, deduped, { includeCitations: sources.includes('semantic_scholar') })
}

export async function ingestAuthorWorks(
  client: SupabaseClient,
  identifier: {
    orcid?: string
    name?: string
  },
  options?: {
    limit?: number
  },
): Promise<IngestSummary> {
  const limit = Math.max(1, Math.min(100, options?.limit ?? 25))
  const authorQuery = (identifier.orcid ?? identifier.name ?? '').trim()
  if (!authorQuery) throw new Error('Author identifier is required')

  const [openAlexPapers, semanticPapers] = await Promise.all([
    searchOpenAlex(authorQuery, { per_page: limit }),
    searchSemanticScholar(authorQuery),
  ])

  const papers = [...openAlexPapers, ...semanticPapers]
    .filter((paper) => paper.authors.some((author) => {
      const hay = author.full_name.toLowerCase()
      return identifier.orcid
        ? (author.orcid ?? '').toLowerCase() === identifier.orcid.toLowerCase()
        : hay.includes(authorQuery.toLowerCase())
    }))
    .slice(0, limit)

  return ingestPapers(client, papers, { includeCitations: true })
}

export async function logIngestion(
  client: SupabaseClient,
  input: {
    data_source: string
    endpoint: string
    request_params?: Record<string, unknown>
    status: 'success' | 'partial' | 'failed'
    records_fetched: number
    records_inserted: number
    records_updated: number
    error_message?: string
    response_time_ms?: number
  },
) {
  const { error } = await client
    .from('pios_ingestion_log')
    .insert({
      data_source: input.data_source,
      endpoint: input.endpoint,
      request_params: input.request_params ?? {},
      status: input.status,
      records_fetched: input.records_fetched,
      records_inserted: input.records_inserted,
      records_updated: input.records_updated,
      error_message: input.error_message ?? null,
      response_time_ms: input.response_time_ms ?? null,
    })

  if (error) throw error
}

export function buildRelevanceScore(query: string, paper: Pick<ExternalPaper, 'title' | 'abstract' | 'citation_count' | 'publication_year'>): number {
  const q = query.toLowerCase()
  const text = `${paper.title ?? ''} ${paper.abstract ?? ''}`.toLowerCase()
  const contains = text.includes(q) ? 0.5 : 0.15

  const tokenHits = q.split(/\s+/g).filter(Boolean).reduce((acc, token) => acc + (text.includes(token) ? 1 : 0), 0)
  const tokenScore = Math.min(0.25, tokenHits * 0.05)

  const citationScore = Math.min(0.15, Math.log10((paper.citation_count ?? 0) + 1) / 10)

  const year = paper.publication_year ?? 2000
  const recencyScore = Math.max(0, Math.min(0.1, (year - 2000) / 260))

  return Number((contains + tokenScore + citationScore + recencyScore).toFixed(4))
}

export function rankTopicFromPaper(paper: Pick<ExternalPaper, 'title' | 'abstract'>): string {
  const text = `${paper.title} ${paper.abstract ?? ''}`.toLowerCase()
  if (/(facility|fm|maintenance|asset)/.test(text)) return 'Facilities Management'
  if (/(machine learning|artificial intelligence|deep learning|llm)/.test(text)) return 'Artificial Intelligence'
  if (/(energy|sustainab|carbon|net zero)/.test(text)) return 'Sustainability'
  if (/(operations|workflow|service quality)/.test(text)) return 'Operations'
  return 'General Research'
}

export function toSearchVectorText(paper: ExternalPaper): string {
  return paperSearchText(paper)
}
