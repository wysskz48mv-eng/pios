import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/cron/market-intelligence
 * Overnight market intelligence agent — runs at 05:00 UTC daily (before 06:00 brief)
 *
 * For each opted-in user:
 * 1. Reads NemoClaw™ calibration profile
 * 2. Reads active OKRs, open decisions, active proposals, stakeholder sectors
 * 3. Builds personalised search queries from profile
 * 4. Calls Claude with web_search tool to gather live intelligence
 * 5. Structures findings into market_intelligence table
 * 6. Morning brief cron at 06:00 reads and includes this intelligence
 *
 * Intelligence categories:
 *   - sector_news:    industry news relevant to user's domain
 *   - client_intel:   news about named clients/stakeholders
 *   - competitor_intel: activity from known competitors
 *   - opportunity:    new tenders, contracts, funding announcements
 *   - regulatory:     regulatory changes in user's sector
 *   - research:       relevant academic/industry research
 *
 * PRIVACY + OPT-IN:
 *   - Only runs for users with intel_enabled = true in exec_intelligence_config
 *   - User controls which categories are active
 *   - User can switch off at any time from Settings → Intelligence
 *   - Data retained for 30 days then auto-deleted
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 120

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all opted-in users
  const { data: configs } = await admin
    .from('exec_intelligence_config')
    .select('user_id, intel_enabled, intel_categories, intel_depth')
    .eq('intel_enabled', true)
    .eq('brief_enabled', true)

  if (!configs?.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No opted-in users' })
  }

  const results: string[] = []
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  for (const config of configs) {
    try {
      const uid = config.user_id
      const categories: string[] = config.intel_categories ?? [
        'sector_news', 'opportunity', 'regulatory'
      ]
      const depth = config.intel_depth ?? 'standard' // standard | deep

      // 1. Load user profile
      const [calibResult, okrResult, decResult, stakeResult, propResult] = await Promise.allSettled([
        admin.from('nemoclaw_calibration').select(
          'seniority_level,primary_industry,industries,employers,calibration_summary'
        ).eq('user_id', uid).single(),
        admin.from('executive_okrs').select('objective,progress').eq('user_id', uid).eq('status','active').limit(3),
        admin.from('executive_decisions').select('title,context').eq('user_id', uid).eq('status','open').limit(3),
        admin.from('stakeholders').select('name,organisation,role').eq('user_id', uid).limit(10),
        admin.from('proposals').select('title,template').eq('user_id', uid).eq('status','sent').limit(5),
      ])

      const calib    = calibResult.status    === 'fulfilled' ? calibResult.value.data    : null
      const okrs     = okrResult.status      === 'fulfilled' ? okrResult.value.data      : []
      const decisions= decResult.status      === 'fulfilled' ? decResult.value.data      : []
      const stakes   = stakeResult.status    === 'fulfilled' ? stakeResult.value.data    : []
      const proposals= propResult.status     === 'fulfilled' ? propResult.value.data     : []

      if (!calib) { results.push(`${uid}: no calibration — skip`); continue }

      // 2. Build intelligence queries from profile
      const industry   = calib.primary_industry ?? 'management consulting'
      const industries = (calib.industries as string[] ?? []).slice(0, 3)
      const employers  = (calib.employers as string[]  ?? []).slice(0, 2)
      const seniority  = calib.seniority_level ?? 'Senior'

      const activeOKRTitles = (okrs as {objective:string}[]  ?? []).map(o => o.objective).join('; ')
      const openDecTitles   = (decisions as {title:string}[] ?? []).map(d => d.title).join('; ')
      const clientOrgs      = (stakes as {organisation:string}[] ?? []).map(s => s.organisation).filter(Boolean).slice(0, 5).join(', ')
      const activePropTypes = (proposals as {template:string}[] ?? []).map(p => p.template).filter(Boolean).join(', ')

      // 3. Personalised intelligence prompt
      const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

      const systemPrompt = `You are a professional market intelligence analyst.
Your task: gather today's most relevant intelligence for a ${seniority} professional in ${industry}.
Be specific, factual, and actionable. Cite sources. No padding.
Today's date: ${today}.
Only include intelligence from the last 48 hours unless specifically researching trends.`

      const userPrompt = buildIntelPrompt({
        industry, industries, employers, clientOrgs,
        activeOKRTitles, openDecTitles, activePropTypes,
        categories, depth,
      })

      // 4. Run web-search-enabled Claude
      const message = await client.messages.create({
        model:      'claude-sonnet-4-5-20251001',
        max_tokens: depth === 'deep' ? 3000 : 1500,
        system:     systemPrompt,
        tools: [{
          type: 'web_search_20250305' as const,
          name: 'web_search',
        }],
        messages: [{ role: 'user', content: userPrompt }],
      })

      // 5. Extract text content from response
      const intelText = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')

      if (!intelText.trim()) {
        results.push(`${uid}: no intelligence generated`)
        continue
      }

      // 6. Parse structured sections from response
      const sections = parseIntelSections(intelText, categories)

      // 7. Store in market_intelligence table
      const { error: insertErr } = await admin.from('market_intelligence').upsert({
        user_id:       uid,
        date:          new Date().toISOString().split('T')[0],
        raw_content:   intelText,
        sections:      sections,
        categories:    categories,
        depth:         depth,
        model_used:    'claude-sonnet-4-5-20251001',
        generated_at:  new Date().toISOString(),
      }, { onConflict: 'user_id,date' })

      if (insertErr) {
        results.push(`${uid}: insert error — ${insertErr.message}`)
      } else {
        // Deduct AI credits
        await admin.from('exec_intelligence_config')
          .update({ ai_calls_used: (admin as unknown as { rpc: (fn: string, args: unknown) => unknown }).rpc('increment_by', { row_id: uid, amount: 2 }) as unknown as number })
          .eq('user_id', uid)
        results.push(`${uid}: ✓ ${sections.length} intel sections saved`)
      }

    } catch (err) {
      results.push(`${config.user_id}: error — ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  // Clean up intelligence older than 30 days
  await admin.from('market_intelligence')
    .delete()
    .lt('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])

  return NextResponse.json({
    ok:        true,
    processed: configs.length,
    results,
    timestamp: new Date().toISOString(),
  })
}

/* ── Prompt builder ─────────────────────────────────────────── */
function buildIntelPrompt(params: {
  industry: string; industries: string[]; employers: string[]
  clientOrgs: string; activeOKRTitles: string; openDecTitles: string
  activePropTypes: string; categories: string[]; depth: string
}): string {
  const {
    industry, industries, employers, clientOrgs,
    activeOKRTitles, openDecTitles, activePropTypes,
    categories, depth,
  } = params

  const sections: string[] = []

  sections.push(`USER CONTEXT:
Primary industry: ${industry}
Also active in: ${industries.join(', ') || 'n/a'}
Key organisations: ${employers.join(', ') || 'n/a'}
Current client/stakeholder organisations: ${clientOrgs || 'n/a'}
Active OKRs: ${activeOKRTitles || 'n/a'}
Open decisions: ${openDecTitles || 'n/a'}
Active proposal types: ${activePropTypes || 'n/a'}`)

  sections.push(`RESEARCH REQUIRED (${depth === 'deep' ? 'deep analysis' : 'standard briefing'}):`)

  if (categories.includes('sector_news')) {
    sections.push(`## Sector news
Search for: latest news in ${industry} sector in the last 24-48 hours
Include: major announcements, market movements, leadership changes, contracts awarded
Format: bullet points with source and date. Max 5 items.`)
  }

  if (categories.includes('client_intel') && clientOrgs) {
    sections.push(`## Client / stakeholder intelligence
Search for: recent news about these organisations: ${clientOrgs}
Include: procurement announcements, financial results, leadership changes, strategic moves
Format: one paragraph per organisation. Only include if news found.`)
  }

  if (categories.includes('opportunity')) {
    sections.push(`## Opportunities and tenders
Search for: new contracts, tenders, RFPs in ${industry} published in the last 7 days
Include: value, deadline, requirements, issuing organisation
Format: bullet points. Max 5 items. Include links where available.`)
  }

  if (categories.includes('regulatory')) {
    sections.push(`## Regulatory and policy intelligence
Search for: regulatory changes, policy announcements, consultation papers in ${industry}
Include: what changed, who it affects, timeline, compliance implications
Format: bullet points. Max 3 items.`)
  }

  if (categories.includes('competitor_intel')) {
    sections.push(`## Market and competitor activity
Search for: competitor moves, new entrants, M&A activity, product launches in ${industry}
Include: strategic implications for a ${industry} practitioner
Format: bullet points. Max 3 items.`)
  }

  if (categories.includes('research')) {
    sections.push(`## Relevant research and thought leadership
Search for: recent reports, research papers, industry surveys published in ${industry} this month
Include: key findings, implications, source
Format: bullet points. Max 3 items.`)
  }

  sections.push(`IMPORTANT:
- Use web search for each section
- Cite sources with URLs where possible
- If no relevant news found for a section, write "No significant developments today"
- Be direct and factual — this is a professional briefing, not a news article
- Prioritise news directly relevant to the user's active OKRs and open decisions`)

  return sections.join('\n\n')
}

/* ── Section parser ─────────────────────────────────────────── */
function parseIntelSections(text: string, categories: string[]): {
  category: string; content: string; items_found: number
}[] {
  const sections: { category: string; content: string; items_found: number }[] = []

  const categoryMap: Record<string, string[]> = {
    sector_news:     ['## Sector news', '## Sector'],
    client_intel:    ['## Client', '## Stakeholder'],
    opportunity:     ['## Opportunit', '## Tender'],
    regulatory:      ['## Regulatory', '## Policy'],
    competitor_intel:['## Market', '## Competitor'],
    research:        ['## Research', '## Thought leadership'],
  }

  for (const cat of categories) {
    const headers = categoryMap[cat] ?? []
    for (const header of headers) {
      const idx = text.indexOf(header)
      if (idx === -1) continue

      // Find next section
      const nextIdx = text.indexOf('\n## ', idx + 1)
      const sectionText = nextIdx > -1
        ? text.slice(idx, nextIdx).trim()
        : text.slice(idx).trim()

      const items = (sectionText.match(/^[-•*]/gm) ?? []).length

      if (!sectionText.includes('No significant developments')) {
        sections.push({ category: cat, content: sectionText, items_found: items })
      }
      break
    }
  }

  return sections
}
