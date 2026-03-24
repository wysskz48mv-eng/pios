/**
 * PIOS Citation Guard — Anti-hallucination layer for academic AI outputs
 *
 * Applies the same 6-step verification pipeline used in InvestiScript:
 *   Step 1: DOI existence check via CrossRef API
 *   Step 2: Wayback Machine snapshot availability
 *   Step 3: Metadata cross-check (title/author vs CrossRef record)
 *   Step 4: Confidence scoring (0–100)
 *   Step 5: HITL gate — flag anything < threshold for human review
 *   Step 6: Structured output with explicit provenance labels
 *
 * Used in: literature API, research/search API, academic module AI summaries
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */

export interface CitationInput {
  title:   string
  authors: string[]
  year?:   number
  journal?: string
  doi?:    string
  url?:    string
}

export interface VerifiedCitation {
  // Original input
  input: CitationInput

  // Step 1: DOI check
  doi_verified:        boolean
  doi_exists:          boolean | null   // null if no DOI provided
  crossref_title?:     string           // Actual title from CrossRef
  crossref_authors?:   string[]
  crossref_year?:      number
  crossref_journal?:   string

  // Step 2: URL/archive check
  url_accessible:      boolean | null   // null if no URL
  wayback_url?:        string

  // Step 3: Metadata match
  title_match:         'exact' | 'close' | 'mismatch' | 'unverified'
  author_match:        'confirmed' | 'partial' | 'mismatch' | 'unverified'
  year_match:          boolean | null

  // Step 4: Confidence
  confidence:          number           // 0–100
  confidence_label:    'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIABLE'

  // Step 5: HITL
  requires_hitl:       boolean
  hitl_reason?:        string

  // Step 6: Provenance
  provenance_label:    'AI_VERIFIED' | 'AI_UNVERIFIED' | 'USER_PROVIDED' | 'FABRICATED_RISK'
  verification_note:   string
  verified_at:         string
}

export interface GuardReport {
  total:          number
  verified:       number   // confidence >= 70
  needs_review:   number   // confidence 40–69
  fabricated_risk: number  // confidence < 40 or title mismatch
  hitl_required:  boolean
  results:        VerifiedCitation[]
  warning?:       string
}

// ── Step 1: CrossRef DOI lookup ───────────────────────────────────────────────
async function checkCrossRef(doi: string): Promise<{
  found: boolean
  title?: string
  authors?: string[]
  year?: number
  journal?: string
}> {
  try {
    const clean = doi.replace(/^https?:\/\/doi\.org\//i, '').trim()
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, {
      headers: { 'User-Agent': 'PIOS-CitationGuard/1.0 (mailto:info@veritasiq.tech)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return { found: false }
    const data = await res.json()
    const w = data.message
    return {
      found:   true,
      title:   w.title?.[0],
      authors: w.author?.slice(0,4).map((a: Record<string, unknown>) => `${a.family ?? ''}, ${(a.given ?? '')[0] ?? ''}.`.trim()) ?? [],
      year:    w.published?.['date-parts']?.[0]?.[0],
      journal: w['container-title']?.[0],
    }
  } catch {
    return { found: false }
  }
}

// ── Step 2: Wayback Machine check ────────────────────────────────────────────
async function checkWayback(url: string): Promise<{ available: boolean; snapshot?: string }> {
  try {
    const res = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json()
    const snap = data?.archived_snapshots?.closest
    return {
      available: snap?.available === true,
      snapshot:  snap?.url,
    }
  } catch {
    return { available: false }
  }
}

// ── Step 3: Fuzzy title match ─────────────────────────────────────────────────
function titleMatchScore(a: string, b: string): 'exact' | 'close' | 'mismatch' {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  const na = norm(a), nb = norm(b)
  if (na === nb) return 'exact'
  // Word overlap
  const wa = new Set(na.split(' ')), wb = new Set(nb.split(' '))
  const overlap = Array.from(wa).filter(w => wb.has(w) && w.length > 3).length
  const minLen = Math.min(wa.size, wb.size)
  if (minLen > 0 && overlap / minLen >= 0.6) return 'close'
  return 'mismatch'
}

// ── Main: verify a single citation ───────────────────────────────────────────
async function verifyCitation(input: CitationInput): Promise<VerifiedCitation> {
  const base: VerifiedCitation = {
    input,
    doi_verified: false, doi_exists: null,
    url_accessible: null,
    title_match: 'unverified', author_match: 'unverified', year_match: null,
    confidence: 0, confidence_label: 'UNVERIFIABLE',
    requires_hitl: false,
    provenance_label: 'AI_UNVERIFIED',
    verification_note: '',
    verified_at: new Date().toISOString(),
  }

  let score = 0
  const notes: string[] = []

  // Step 1: DOI
  if (input.doi) {
    const cr = await checkCrossRef(input.doi)
    base.doi_exists = cr.found
    if (cr.found) {
      base.crossref_title   = cr.title
      base.crossref_authors = cr.authors
      base.crossref_year    = cr.year
      base.crossref_journal = cr.journal
      score += 40
      notes.push('DOI exists in CrossRef')

      // Step 3: metadata match
      if (cr.title && input.title) {
        base.title_match = titleMatchScore(input.title, cr.title)
        if      (base.title_match === 'exact') { score += 30; notes.push('Title exactly matches CrossRef') }
        else if (base.title_match === 'close') { score += 15; notes.push('Title closely matches CrossRef') }
        else { score -= 20; notes.push(`⚠ Title mismatch: CrossRef has "${cr.title?.slice(0,60)}…"`) }
      }

      if (cr.year && input.year) {
        base.year_match = cr.year === input.year
        if (base.year_match) score += 10
        else notes.push(`⚠ Year mismatch: CrossRef says ${cr.year}, input says ${input.year}`)
      }

      if (cr.authors?.length && input.authors?.length) {
        const crNorm = cr.authors.map(a => a.split(',')[0].toLowerCase())
        const inNorm = input.authors.map(a => a.split(',')[0].toLowerCase())
        const overlap = inNorm.filter(a => crNorm.some(c => c.includes(a) || a.includes(c))).length
        if   (overlap === inNorm.length) { base.author_match = 'confirmed'; score += 15 }
        else if (overlap > 0)            { base.author_match = 'partial';   score += 5; notes.push('Partial author match') }
        else                             { base.author_match = 'mismatch';  score -= 15; notes.push('⚠ Author mismatch') }
      }

      base.doi_verified = base.title_match !== 'mismatch' && base.author_match !== 'mismatch'
    } else {
      notes.push('⚠ DOI not found in CrossRef')
      score -= 10
    }
  } else {
    notes.push('No DOI provided — cannot verify via CrossRef')
  }

  // Step 2: URL/Wayback
  if (input.url) {
    const wb = await checkWayback(input.url)
    base.url_accessible = wb.available
    if (wb.available) {
      base.wayback_url = wb.snapshot
      score += 10
      notes.push('URL archived in Wayback Machine')
    }
  }

  // No DOI and no URL — AI-only, max score 20
  if (!input.doi && !input.url) {
    score = Math.min(score, 20)
    notes.push('⚠ No DOI or URL — cannot verify existence')
  }

  const finalScore = Math.max(0, Math.min(100, score))
  base.confidence = finalScore
  base.confidence_label =
    finalScore >= 70 ? 'HIGH' :
    finalScore >= 40 ? 'MEDIUM' :
    finalScore >= 20 ? 'LOW' : 'UNVERIFIABLE'

  // Step 5: HITL gate
  if (base.title_match === 'mismatch' || base.author_match === 'mismatch') {
    base.requires_hitl = true
    base.hitl_reason   = 'Metadata mismatch between AI output and CrossRef record'
    base.provenance_label = 'FABRICATED_RISK'
  } else if (finalScore < 40 && input.doi) {
    base.requires_hitl = true
    base.hitl_reason   = 'Low confidence — DOI not found or significant discrepancies'
    base.provenance_label = 'AI_UNVERIFIED'
  } else if (finalScore >= 70) {
    base.provenance_label = 'AI_VERIFIED'
  }

  base.verification_note = notes.join('. ')
  return base
}

// ── Batch verify ──────────────────────────────────────────────────────────────
export async function verifyCitations(citations: CitationInput[]): Promise<GuardReport> {
  const results = await Promise.all(citations.map(c => verifyCitation(c)))

  const verified       = results.filter(r => r.confidence >= 70).length
  const needs_review   = results.filter(r => r.confidence >= 40 && r.confidence < 70).length
  const fabricated_risk = results.filter(r => r.confidence < 40 || r.provenance_label === 'FABRICATED_RISK').length
  const hitl_required  = results.some(r => r.requires_hitl)

  const warning = fabricated_risk > 0
    ? `${fabricated_risk} citation(s) could not be verified — review before saving or citing`
    : hitl_required
    ? 'Some citations have metadata mismatches — human review required'
    : undefined

  return { total: citations.length, verified, needs_review, fabricated_risk, hitl_required, results, warning }
}

// ── Provenance badge helper (for UI rendering) ────────────────────────────────
export function provenanceBadge(label: VerifiedCitation['provenance_label']): {
  text: string; colour: string; bg: string
} {
  switch (label) {
    case 'AI_VERIFIED':    return { text: '✓ AI-Verified',      colour: '#22c55e', bg: 'rgba(34,197,94,0.1)' }
    case 'AI_UNVERIFIED':  return { text: '⚠ Unverified',       colour: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    case 'FABRICATED_RISK': return { text: '✗ Verify manually', colour: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    case 'USER_PROVIDED':  return { text: '✓ User-provided',    colour: '#6c8eff', bg: 'rgba(108,142,255,0.1)' }
  }
}
