import type { CitationSource, OpenAccessStatus } from '@/types/citation-graph'

export interface ExternalAuthor {
  full_name: string
  orcid?: string | null
  openalex_id?: string | null
  semantic_scholar_id?: string | null
  affiliation?: string | null
  affiliation_country?: string | null
}

export interface ExternalPaper {
  source: CitationSource
  external_id?: string | null
  doi?: string | null
  arxiv_id?: string | null
  pubmed_id?: string | null
  title: string
  abstract?: string | null
  publication_date?: string | null
  publication_year?: number | null
  venue?: string | null
  venue_type?: 'journal' | 'conference' | 'preprint'
  oa_status?: OpenAccessStatus
  oa_url?: string | null
  pdf_url?: string | null
  citation_count?: number
  reference_count?: number
  authors: ExternalAuthor[]
  raw_data?: Record<string, unknown>
}

export interface ExternalCitation {
  citing_external_id?: string | null
  cited_external_id?: string | null
  citing_doi?: string | null
  cited_doi?: string | null
  context_snippet?: string | null
  intent?: string | null
}
