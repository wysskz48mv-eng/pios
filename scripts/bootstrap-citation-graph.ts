/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type PaperSeed = {
  title: string
  doi: string | null
  year: number | null
  journal: string | null
  abstract_excerpt: string | null
  authors: string[]
  citation_count: number
  sources: string[]
}

function loadEnvFile(fileName: string) {
  const p = path.join(process.cwd(), fileName)
  if (!fs.existsSync(p)) return
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const k = line.slice(0, idx).trim()
    const v = line.slice(idx + 1).trim().replace(/^"|"$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function inferField(title: string, journal: string | null): string {
  const text = `${title} ${journal ?? ''}`.toLowerCase()
  if (text.includes('facility') || text.includes('maintenance')) return 'Facility Management'
  if (text.includes('forecast') || text.includes('machine learning') || text.includes('artificial intelligence')) return 'AI & Forecasting'
  if (text.includes('engineering')) return 'Engineering'
  if (text.includes('medical') || text.includes('biomed')) return 'Medicine'
  return 'General'
}

function extractKeywords(title: string): string[] {
  return [...new Set(norm(title).split(' ').filter((w) => w.length >= 4))].slice(0, 10)
}

async function searchCrossref(query: string, limit: number): Promise<PaperSeed[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&mailto=support@veritasiq.io`
    const r = await fetch(url)
    if (!r.ok) return []
    const data = (await r.json()) as { message?: { items?: Record<string, unknown>[] } }

    return (data.message?.items ?? []).map((item) => {
      const title = ((item.title as string[]) ?? [])[0] ?? ''
      const pub = (item['published-print'] ?? item['published-online']) as { 'date-parts'?: number[][] } | null
      const year = pub?.['date-parts']?.[0]?.[0] ?? null
      const authors = ((item.author as { given?: string; family?: string }[]) ?? [])
        .map((a) => [a.given, a.family].filter(Boolean).join(' '))
        .filter(Boolean)

      return {
        title,
        doi: (item.DOI as string) ?? null,
        year,
        journal: ((item['container-title'] as string[]) ?? [])[0] ?? null,
        abstract_excerpt: ((item.abstract as string) ?? null)?.slice(0, 1200) ?? null,
        authors,
        citation_count: (item['is-referenced-by-count'] as number) ?? 0,
        sources: ['crossref'],
      }
    }).filter((p) => p.title)
  } catch {
    return []
  }
}

async function searchOpenAlex(query: string, limit: number): Promise<PaperSeed[]> {
  try {
    const select = 'title,doi,publication_year,authorships,primary_location,cited_by_count'
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&select=${select}&mailto=support@veritasiq.io`
    const r = await fetch(url)
    if (!r.ok) return []
    const data = (await r.json()) as { results?: Record<string, unknown>[] }

    return (data.results ?? []).map((item) => {
      const title = (item.title as string) ?? ''
      const authors = ((item.authorships as { author?: { display_name?: string } }[]) ?? [])
        .map((a) => a.author?.display_name ?? '')
        .filter(Boolean)
      const loc = (item.primary_location as { source?: { display_name?: string } } | null)

      return {
        title,
        doi: (item.doi as string) ?? null,
        year: (item.publication_year as number) ?? null,
        journal: loc?.source?.display_name ?? null,
        abstract_excerpt: null,
        authors,
        citation_count: (item.cited_by_count as number) ?? 0,
        sources: ['openalex'],
      }
    }).filter((p) => p.title)
  } catch {
    return []
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const defaultQueries = [
    'AI forecasting facility management',
    'digital twins in facilities management',
    'predictive maintenance machine learning buildings',
    'lifecycle costing facilities management GCC',
    'smart building IoT maintenance analytics',
    'energy optimization commercial buildings AI',
    'asset lifecycle management predictive analytics',
    'facilities management digital transformation GCC',
  ]

  const queries = (process.env.CITATION_GRAPH_BOOTSTRAP_QUERIES ?? '')
    .split(',')
    .map((q) => q.trim())
    .filter(Boolean)

  const effectiveQueries = queries.length > 0 ? queries : defaultQueries
  const perSourceLimit = Math.min(100, Math.max(20, Number(process.env.CITATION_GRAPH_QUERY_LIMIT ?? 80)))
  const targetPapers = Math.max(100, Number(process.env.CITATION_GRAPH_TARGET_PAPERS ?? 500))

  console.log(`[bootstrap] queries=${effectiveQueries.length}, perSourceLimit=${perSourceLimit}, targetPapers=${targetPapers}`)

  const merged: PaperSeed[] = []
  const seen = new Set<string>()

  for (const query of effectiveQueries) {
    const [crossref, openalex] = await Promise.all([
      searchCrossref(query, perSourceLimit),
      searchOpenAlex(query, perSourceLimit),
    ])

    const batch = [...crossref, ...openalex]
    let added = 0

    for (const p of batch) {
      const key = p.doi ?? norm(p.title)
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(p)
      added += 1
      if (merged.length >= targetPapers) break
    }

    console.log(`[bootstrap] query="${query}" fetched=${batch.length} added=${added} total=${merged.length}`)
    if (merged.length >= targetPapers) break
  }

  let papersUpserted = 0
  let authorsUpserted = 0
  let linksUpserted = 0
  let paperErrors = 0
  let authorErrors = 0
  let linkErrors = 0
  let scoreErrors = 0
  let trendErrors = 0

  const seenErrors = new Set<string>()
  const unsupportedPaperColumns = new Set<string>()
  const unsupportedAuthorColumns = new Set<string>()
  let paperWriteMode: 'upsert' | 'insert' = 'upsert'
  let authorWriteMode: 'upsert' | 'insert' = 'upsert'
  const logErrorOnce = (prefix: string, message: string) => {
    const key = `${prefix}:${message}`
    if (seenErrors.has(key)) return
    seenErrors.add(key)
    if (seenErrors.size <= 10) console.error(`[bootstrap] ${prefix}: ${message}`)
  }

  const upsertPaper = async (payload: Record<string, unknown>) => {
    const safePayload = { ...payload }
    for (const col of unsupportedPaperColumns) {
      delete safePayload[col]
    }

    if (paperWriteMode === 'insert') {
      let attempt = await admin.from('pios_papers').insert(safePayload).select('id').single()
      let guard = 0
      while (attempt.error && guard < 5) {
        const m = /Could not find the '([^']+)' column|column "([^"]+)" does not exist/.exec(attempt.error.message)
        const missing = m?.[1] ?? m?.[2]
        if (!missing) break
        unsupportedPaperColumns.add(missing)
        delete safePayload[missing]
        attempt = await admin.from('pios_papers').insert(safePayload).select('id').single()
        guard += 1
      }
      return attempt
    }

    const firstTry = await admin
      .from('pios_papers')
      .upsert(safePayload, { onConflict: 'title_normalized' })
      .select('id')
      .single()

    if (!firstTry.error) return firstTry

    if (/title_normalized/.test(firstTry.error.message) && /does not exist|Could not find/.test(firstTry.error.message)) {
      paperWriteMode = 'insert'
      delete safePayload.title_normalized
      const retryInsert = await admin.from('pios_papers').insert(safePayload).select('id').single()
      if (!retryInsert.error) logErrorOnce('paper schema fallback', 'Switched to insert mode (missing title_normalized)')
      return retryInsert
    }

    const m = /Could not find the '([^']+)' column/.exec(firstTry.error.message)
    if (!m) return firstTry

    const missing = m[1]
    unsupportedPaperColumns.add(missing)
    delete safePayload[missing]

    const secondTry = await admin
      .from('pios_papers')
      .upsert(safePayload, { onConflict: 'title_normalized' })
      .select('id')
      .single()

    if (secondTry.error) return secondTry
    logErrorOnce('paper schema fallback', `Removed unsupported column: ${missing}`)
    return secondTry
  }

  const upsertAuthor = async (payload: Record<string, unknown>) => {
    const safePayload = { ...payload }
    for (const col of unsupportedAuthorColumns) {
      delete safePayload[col]
    }

    if (authorWriteMode === 'insert') {
      return admin.from('pios_authors').insert(safePayload).select('id').single()
    }

    const firstTry = await admin
      .from('pios_authors')
      .upsert(safePayload, { onConflict: 'normalized_name' })
      .select('id')
      .single()

    if (!firstTry.error) return firstTry

    if (/normalized_name/.test(firstTry.error.message) && /does not exist|Could not find/.test(firstTry.error.message)) {
      authorWriteMode = 'insert'
      delete safePayload.normalized_name
      const retryInsert = await admin.from('pios_authors').insert(safePayload).select('id').single()
      if (!retryInsert.error) logErrorOnce('author schema fallback', 'Switched to insert mode (missing normalized_name)')
      return retryInsert
    }

    const m = /Could not find the '([^']+)' column/.exec(firstTry.error.message)
    if (!m) return firstTry

    const missing = m[1]
    unsupportedAuthorColumns.add(missing)
    delete safePayload[missing]

    const secondTry = await admin
      .from('pios_authors')
      .upsert(safePayload, { onConflict: 'normalized_name' })
      .select('id')
      .single()

    if (secondTry.error) return secondTry
    logErrorOnce('author schema fallback', `Removed unsupported column: ${missing}`)
    return secondTry
  }

  for (const p of merged) {
    const field = inferField(p.title, p.journal)
    const keywords = extractKeywords(p.title)

    const { data: paper, error: paperErr } = await upsertPaper({
      doi: p.doi,
      title: p.title,
      title_normalized: norm(p.title),
      authors: p.authors,
      publication_year: p.year,
      journal: p.journal,
      abstract_excerpt: p.abstract_excerpt,
      field_classifications: [field],
      keywords,
      open_access: false,
      citation_count: p.citation_count,
      sources: p.sources,
    })

    if (paperErr || !paper?.id) {
      paperErrors += 1
      if (paperErr) logErrorOnce('paper upsert failed', paperErr.message)
      continue
    }
    papersUpserted += 1

    for (let i = 0; i < p.authors.length; i += 1) {
      const name = p.authors[i]
      const normalized = norm(name)
      if (!normalized) continue

      const { data: author, error: authorErr } = await upsertAuthor({ name, normalized_name: normalized })

      if (authorErr || !author?.id) {
        authorErrors += 1
        if (authorErr) logErrorOnce('author upsert failed', authorErr.message)
        continue
      }
      authorsUpserted += 1

      const { error: linkErr } = await admin
        .from('pios_author_papers')
        .upsert({ author_id: author.id, paper_id: paper.id, author_position: i + 1 }, { onConflict: 'author_id,paper_id' })

      if (!linkErr) {
        linksUpserted += 1
      } else {
        linkErrors += 1
        logErrorOnce('author-paper link upsert failed', linkErr.message)
      }
    }
  }

  const { data: papers } = await admin
    .from('pios_papers')
    .select('id,publication_year,citation_count')
    .limit(50000)

  const nowYear = new Date().getFullYear()
  let papersScored = 0

  for (const p of papers ?? []) {
    const year = (p.publication_year as number | null) ?? nowYear
    const age = Math.max(0, nowYear - year)
    const recency = age <= 1 ? 1.5 : age <= 3 ? 1.35 : age <= 5 ? 1.15 : 1.0
    const citations = (p.citation_count as number | null) ?? 0
    const influence = Math.round(citations * recency * 1000) / 1000

    const { error } = await admin.from('pios_papers').update({ influence_score: influence }).eq('id', p.id)
    if (!error) {
      papersScored += 1
    } else {
      scoreErrors += 1
      logErrorOnce('influence score update failed', error.message)
    }
  }

  const fields = ['Facility Management', 'AI & Forecasting', 'Engineering', 'Medicine', 'General']
  let trendRowsRefreshed = 0

  const { data: allPapers } = await admin
    .from('pios_papers')
    .select('publication_year,citation_count,field_classifications')

  for (const field of fields) {
    const filtered = (allPapers ?? []).filter((p) => ((p.field_classifications as string[] | null) ?? []).includes(field))
    const byYear = new Map<number, { papers: number; citations: number }>()

    for (const p of filtered) {
      const year = (p.publication_year as number | null)
      if (!year) continue
      const e = byYear.get(year) ?? { papers: 0, citations: 0 }
      e.papers += 1
      e.citations += (p.citation_count as number | null) ?? 0
      byYear.set(year, e)
    }

    const years = [...byYear.keys()].sort((a, b) => a - b)
    let prev = 0

    for (const y of years) {
      const s = byYear.get(y)
      if (!s) continue
      const growth = prev > 0 ? ((s.papers - prev) / prev) * 100 : 0
      prev = s.papers

      const { error } = await admin.from('pios_research_trends').upsert({
        field,
        keyword: '__all__',
        year: y,
        paper_count: s.papers,
        citation_growth: Number(growth.toFixed(3)),
        emerging: growth >= 20,
      }, { onConflict: 'field,keyword,year' })

      if (!error) {
        trendRowsRefreshed += 1
      } else {
        trendErrors += 1
        logErrorOnce('trend upsert failed', error.message)
      }
    }
  }

  const actorId = process.env.CITATION_GRAPH_CRON_ACTOR_USER_ID?.trim()
  if (actorId) {
    try {
      await admin.from('pios_ingestion_events').insert({
        user_id: actorId,
        source: 'bootstrap_citation_graph',
        papers_considered: merged.length,
        papers_upserted: papersUpserted,
        authors_upserted: authorsUpserted,
        links_upserted: linksUpserted,
        completed_at: new Date().toISOString(),
        status: 'success',
        notes: `queries=${effectiveQueries.join(' | ')}`,
      })
    } catch {
      // Optional logging only.
    }
  }

  console.log('[bootstrap] completed')
  console.log(JSON.stringify({
    ok: true,
    target_papers: targetPapers,
    unique_seeded_candidates: merged.length,
    papers_upserted: papersUpserted,
    authors_upserted: authorsUpserted,
    links_upserted: linksUpserted,
    paper_errors: paperErrors,
    author_errors: authorErrors,
    link_errors: linkErrors,
    papers_scored: papersScored,
    score_errors: scoreErrors,
    trend_rows_refreshed: trendRowsRefreshed,
    trend_errors: trendErrors,
    event_logging_enabled: Boolean(actorId),
  }, null, 2))
}

main().catch((err: unknown) => {
  console.error('[bootstrap] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
