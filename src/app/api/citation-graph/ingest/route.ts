import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'
import {
  ingestAuthorWorks,
  ingestByDOI,
  ingestByTopic,
  logIngestion,
} from '@/lib/citation-graph/ingestion-service'
import type { CitationSource } from '@/types/citation-graph'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function randomJobId() {
  return `cg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export async function POST(req: NextRequest) {
  const started = Date.now()

  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const body = await req.json() as {
      type?: 'doi' | 'topic' | 'author' | 'arxiv'
      query?: string
      options?: {
        includeReferences?: boolean
        includeCitations?: boolean
        year_min?: number
        year_max?: number
        limit?: number
        sources?: CitationSource[]
      }
      action?: string
      limit?: number
    }

    // Backward compatibility for existing action payloads used by early UI.
    if (body.action === 'ingest_search_query') {
      const query = String(body.query ?? '').trim()
      if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

      const summary = await ingestByTopic(admin, query, {
        limit: body.limit ?? 50,
        sources: ['openalex', 'crossref'],
      })

      return NextResponse.json({
        papers_ingested: summary.papers_added,
        papers_updated: summary.papers_updated,
        authors_found: summary.authors_added,
      })
    }

    const type = body.type
    const query = String(body.query ?? '').trim()

    if (!type || !query) {
      return NextResponse.json({ error: 'type and query are required' }, { status: 400 })
    }

    const jobId = randomJobId()

    let summary
    if (type === 'doi') {
      summary = await ingestByDOI(admin, query, {
        includeReferences: Boolean(body.options?.includeReferences),
        includeCitations: Boolean(body.options?.includeCitations),
      })
    } else if (type === 'topic' || type === 'arxiv') {
      summary = await ingestByTopic(admin, query, {
        year_min: body.options?.year_min,
        year_max: body.options?.year_max,
        limit: body.options?.limit,
        sources: type === 'arxiv'
          ? ['arxiv']
          : (body.options?.sources?.length ? body.options.sources : ['openalex', 'crossref']),
      })
    } else if (type === 'author') {
      const isOrcid = /\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i.test(query)
      summary = await ingestAuthorWorks(admin, {
        orcid: isOrcid ? query : undefined,
        name: isOrcid ? undefined : query,
      }, {
        limit: body.options?.limit,
      })
    } else {
      return NextResponse.json({ error: `Unsupported ingest type: ${type}` }, { status: 400 })
    }

    await logIngestion(admin, {
      data_source: type,
      endpoint: '/api/citation-graph/ingest',
      request_params: {
        type,
        query,
        options: body.options ?? {},
      },
      status: 'success',
      records_fetched: summary.papers_added + summary.papers_updated,
      records_inserted: summary.papers_added + summary.authors_added + summary.citations_added,
      records_updated: summary.papers_updated,
      response_time_ms: Date.now() - started,
    })

    return NextResponse.json({
      job_id: jobId,
      status: 'completed',
      papers_queued: summary.papers_added + summary.papers_updated,
      estimated_time: 0,
      summary,
    })
  } catch (err) {
    try {
      const auth = await requireCitationGraphAccess(req)
      if (!('error' in auth)) {
        await logIngestion(auth.admin, {
          data_source: 'unknown',
          endpoint: '/api/citation-graph/ingest',
          request_params: {},
          status: 'failed',
          records_fetched: 0,
          records_inserted: 0,
          records_updated: 0,
          error_message: err instanceof Error ? err.message : 'unknown ingestion error',
          response_time_ms: Date.now() - started,
        })
      }
    } catch {
      // no-op
    }

    return apiError(err)
  }
}
