import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/content/review-agent
 * Runs the AI crawl review agent on Blood Oath Chronicles episodes.
 * 
 * Job types:
 *   single_review     — full quality + strategy review of one episode
 *   batch_compare     — compare manuscript vs published for ep range
 *   consistency_audit — check continuity, character, timeline across range
 *   strategy_check    — score against Matryoshka storytelling strategy
 * 
 * GET /api/content/review-agent — list recent jobs
 * 
 * VeritasIQ Technologies Ltd · Content Pipeline
 */

export const runtime     = 'nodejs'
export const maxDuration = 120

// ── Blood Oath Chronicles story bible (hardcoded for now, moves to DB) ────
const BAC_BIBLE = `
BLOOD OATH CHRONICLES — STORY BIBLE v1.0

PROTAGONIST: Kaelo Mthembu
- Former special forces / intelligence operative, South African
- Power: can read true intention behind spoken words (impossible to deceive)
- Core wound: betrayed by his own unit, framed for crimes he didn't commit
- Voice: quiet, observational, precise. Never shouts. Never panics.
- Physical: late 30s, lean, unremarkable until he moves

ANTAGONIST LAYER 1 (ep 1-300): Hendrik van der Merwe
- Afrikaner corporate heir concealing a 200-year colonial secret
- Motivated by legacy preservation, not simple greed
- Has Pieter's diary (1818-1831) which contains the Blood Oath origin

WORLD RULES:
- The Blood Oath is real — a binding pact between a Hlubi warrior and a Van der Merwe ancestor, 1822
- It creates a generational curse: every generation of both bloodlines must face each other
- Supernatural elements are grounded in Southern African traditions (not Western fantasy)
- Tokoloshe: messenger spirits, not monsters. Cannot lie in the presence of Kaelo's gift.

NARRATIVE LAYERS (Matryoshka):
- Layer 1 (ep 1-300): Regional revenge — Kaelo vs local mercenary/corporate conspiracy
- Layer 2 (ep 301-800): Continental — the Blood Oath connects to a pan-African secret council
- Layer 3 (ep 801-2000): Cosmic — the Blood Oath is a pact with an ancient entity

TONE RULES:
- African supernatural thriller, NOT Western fantasy
- Literary realism first: the supernatural earns its place through grounded detail
- Violence is consequence, not spectacle
- Women are strategic agents, not accessories
- History is present-tense: the past is actively shaping the plot

POCKET FM FORMAT:
- 1,300–1,450 words per episode (hard limits — under 1,300 is too thin, over 1,450 loses audio pacing)
- One complete scene per episode — a full dramatic unit with setup, tension, and resolution/cliffhanger
- Cliffhanger or revelation at the end of EVERY episode — non-negotiable for Pocket FM retention
- Audio-first prose: short paragraphs (2–4 sentences), strong sensory anchors, no dense description blocks
- Sentence rhythm varies: short punchy sentences for action/tension, longer flowing sentences for atmosphere
- Every 5 episodes: a B-plot episode (secondary character POV — approximately 1 per 5)
- Episode arc: each episode must move one of these: plot, character revelation, or mystery forward

CURRENT POSITION: Episode 71
- Kaelo has defeated the first mercenary cell
- Hendrik knows Kaelo exists but has not yet identified him
- The blood oath mark has appeared on Kaelo's wrist (ep 50)
- Zola (ally) has gone silent after ep 44
`

// ── System prompts per job type ─────────────────────────────────────────────
function buildSystemPrompt(jobType: string): string {
  const base = `You are a professional story editor and continuity analyst for Blood Oath Chronicles, a serialised supernatural thriller published on Pocket FM. You have the complete series bible and story rules memorised.\n\n${BAC_BIBLE}`

  const prompts: Record<string, string> = {
    single_review: `${base}

Review the provided episode. Return a JSON object with:
{
  "overall_score": <0-100>,
  "consistency_score": <0-100>,
  "summary": "<2-3 sentence editorial summary>",
  "findings": [
    {
      "type": "<continuity|strategy|format|voice|quality>",
      "severity": "<critical|major|minor|suggestion>",
      "description": "<what the issue is>",
      "recommendation": "<specific fix to make>"
    }
  ]
}

Score against: story bible accuracy, Pocket FM format (1,300–1,450 words, one complete scene, cliffhanger), Kaelo's voice, narrative layer consistency, tone rules. Flag any episode under 1,300 or over 1,450 words as a format violation.`,

    consistency_audit: `${base}

You are given multiple episodes to audit for consistency. Check:
1. Character facts (does Kaelo behave consistently? Are antagonist details stable?)
2. Timeline (do dates/timeframes make sense across episodes?)
3. Supernatural rules (is the Blood Oath system applied consistently?)
4. Continuity errors (does anything contradict established facts?)

Return JSON:
{
  "overall_score": <0-100>,
  "summary": "<editorial summary of consistency health>",
  "findings": [
    {
      "episode": <number>,
      "type": "continuity|character|timeline|supernatural",
      "severity": "<critical|major|minor>",
      "description": "<what contradicts what>",
      "recommendation": "<how to fix it>"
    }
  ]
}`,

    strategy_check: `${base}

You are evaluating whether the provided episodes are executing the Matryoshka narrative strategy correctly. Check:
1. Is the current narrative layer appropriate for this episode range?
2. Are B-plot rotation episodes appearing approximately every 5 episodes?
3. Are tactical power-ups being handled correctly (not just "getting stronger")?
4. Is filler being avoided — does each episode advance plot, character, or mystery?
5. Are the Pocket FM retention hooks (cliffhangers, revelations) landing correctly?
6. FORMAT CHECK: Is each episode 1,300–1,450 words? Flag any episode outside this range.
7. Is the audio-first prose style maintained (short paragraphs, sensory anchors, varied sentence rhythm)?

Return JSON:
{
  "overall_score": <0-100>,
  "strategy_compliance": <0-100>,
  "format_compliance": <0-100>,
  "summary": "<strategic assessment>",
  "findings": [
    {
      "episode": <number or null if general>,
      "type": "strategy|pacing|structure|hook|b_plot|format|word_count",
      "severity": "<critical|major|minor|suggestion>",
      "description": "<strategic issue>",
      "recommendation": "<specific correction>"
    }
  ]
}`,

    batch_compare: `${base}

You are comparing manuscript versions against published versions of episodes. For each episode provided, identify:
1. Whether the text differs significantly
2. Which version is stronger (manuscript or published)
3. What specific changes were made and whether they improve or harm the story

Return JSON:
{
  "overall_score": <0-100>,
  "summary": "<summary of comparison findings>",
  "findings": [
    {
      "episode": <number>,
      "type": "manuscript_drift",
      "severity": "<critical|major|minor>",
      "description": "<what changed between manuscript and published>",
      "recommendation": "<which version to keep and why>"
    }
  ]
}`
  }

  return prompts[jobType] ?? prompts.single_review
}

// ── GET — list recent jobs ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: jobs } = await supabase
    .from('content_review_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ jobs: jobs ?? [] })
}

// ── POST — run review job ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { job_type, episode_from, episode_to, series_id } = body as {
    job_type:     string
    episode_from: number
    episode_to:   number
    series_id?:   string
  }

  // Create job record
  const { data: job, error: jobErr } = await supabase
    .from('content_review_jobs')
    .insert({
      user_id:       user.id,
      series_id:     series_id ?? null,
      job_type,
      episode_from,
      episode_to,
      status:        'running',
      started_at:    new Date().toISOString(),
    })
    .select()
    .single()

  if (jobErr || !job) return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })

  // Fetch episode content for the range
  const { data: episodes } = await supabase
    .from('content_episodes')
    .select('episode_number, title, manuscript_text, published_text, status, word_count, cliffhanger')
    .eq('user_id', user.id)
    .gte('episode_number', episode_from)
    .lte('episode_number', episode_to)
    .order('episode_number')

  if (!episodes || episodes.length === 0) {
    // Update job as failed
    await supabase.from('content_review_jobs').update({
      status:       'failed',
      completed_at: new Date().toISOString(),
      summary:      'No episodes found in the specified range. Add episode content first.',
    }).eq('id', job.id)

    return NextResponse.json({
      job: { ...job, status: 'failed', summary: 'No episodes found in range.' }
    })
  }

  // Build content for Claude
  const episodeContent = episodes.map((ep: Record<string, unknown>) => {
    const base = `\n--- EPISODE ${ep.episode_number}: ${ep.title} ---\nWord count: ${ep.word_count ?? 'unknown'}\nStatus: ${ep.status}\n\nMANUSCRIPT:\n${ep.manuscript_text ?? '[No manuscript text]'}`
    if (job_type === 'batch_compare' && ep.published_text) {
      return `${base}\n\nPUBLISHED:\n${ep.published_text}`
    }
    return base
  }).join('\n\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2000,
        system:     buildSystemPrompt(job_type),
        messages: [{
          role:    'user',
          content: `Review the following episodes (range ${episode_from}–${episode_to}):\n\n${episodeContent}\n\nReturn ONLY valid JSON, no preamble.`,
        }],
      }),
    })

    const aiData = await res.json()
    const rawText = aiData?.content?.[0]?.text ?? '{}'

    let parsed: { overall_score?: number; summary?: string; findings?: unknown[]; recommendations?: unknown[] } = {}
    try {
      const clean = rawText.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = { summary: rawText, findings: [], overall_score: 0 }
    }

    // Update job with results
    await supabase.from('content_review_jobs').update({
      status:        'complete',
      completed_at:  new Date().toISOString(),
      overall_score: parsed.overall_score ?? 0,
      summary:       parsed.summary ?? '',
      findings:      parsed.findings ?? [],
      recommendations: parsed.recommendations ?? [],
    }).eq('id', job.id)

    // Update individual episode review scores for single reviews
    if (job_type === 'single_review' && episode_from === episode_to) {
      await supabase.from('content_episodes').update({
        review_score: parsed.overall_score,
        review_notes: JSON.stringify(parsed.findings ?? []),
        status:       'review_complete',
        updated_at:   new Date().toISOString(),
      })
        .eq('user_id', user.id)
        .eq('episode_number', episode_from)
    }

    return NextResponse.json({
      job: {
        ...job,
        status:        'complete',
        overall_score: parsed.overall_score,
        summary:       parsed.summary,
        findings:      parsed.findings,
      }
    })
  } catch (err: unknown) {
    await supabase.from('content_review_jobs').update({
      status:       'failed',
      completed_at: new Date().toISOString(),
      summary:      `Agent error: ${err instanceof Error ? err.message : String(err)}`,
    }).eq('id', job.id)

    return NextResponse.json({ error: 'Review agent failed', job }, { status: 500 })
  }
}
