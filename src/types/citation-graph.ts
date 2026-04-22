export type CitationSource = 'crossref' | 'openalex' | 'semantic_scholar' | 'arxiv'

export type OpenAccessStatus = 'gold' | 'green' | 'hybrid' | 'bronze' | 'closed'

export interface PiosAuthor {
  id: string
  orcid?: string | null
  openalex_id?: string | null
  semantic_scholar_id?: string | null
  full_name: string
  display_name?: string | null
  affiliation?: string | null
  affiliation_country?: string | null
  h_index?: number | null
  paper_count: number
  citation_count: number
  data_source: CitationSource
}

export interface PiosPaper {
  id: string
  doi?: string | null
  arxiv_id?: string | null
  pubmed_id?: string | null
  title: string
  abstract?: string | null
  publication_date?: string | null
  publication_year?: number | null
  venue?: string | null
  venue_type?: 'journal' | 'conference' | 'preprint' | null
  oa_status?: OpenAccessStatus | null
  oa_url?: string | null
  pdf_url?: string | null
  citation_count: number
  reference_count: number
  data_source: CitationSource
  external_id?: string | null
  raw_data?: Record<string, unknown> | null
  authors?: PiosAuthor[]
}

export interface PiosCitation {
  id?: string
  citing_paper_id: string
  cited_paper_id: string
  context_snippet?: string | null
  intent?: string | null
}

export interface ResearchLandscape {
  id: string
  tenant_id: string
  user_id: string
  name: string
  description?: string | null
  topic_keywords: string[]
  topic_cluster?: Record<string, unknown>
  paper_ids: string[]
  last_refreshed_at?: string | null
  refresh_frequency: 'daily' | 'weekly' | 'monthly'
  created_at?: string
  updated_at?: string
}

export interface PaperSearchFilters {
  year_min?: number
  year_max?: number
  oa_only?: boolean
  source?: CitationSource
  venue_type?: 'journal' | 'conference' | 'preprint'
}

export interface PaperSearchResult {
  paper: PiosPaper
  relevance_score: number
}

export interface IngestSummary {
  papers_added: number
  papers_updated: number
  citations_added: number
  authors_added: number
  author_links_added: number
}

export interface CitationNode {
  id: string
  label: string
  year?: number | null
  citation_count?: number
  type: 'paper'
}

export interface CitationEdge {
  source: string
  target: string
  intent?: string | null
}

export interface CitationGraphResponse {
  nodes: CitationNode[]
  edges: CitationEdge[]
}
