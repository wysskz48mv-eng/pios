/**
 * POST /api/intelligence/briefing
 * Generates an AI-powered domain intelligence briefing for a given sector.
 * Returns structured items + NemoClaw synthesis.
 * PIOS v3.0 | Sprint 75 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

export const runtime    = 'nodejs'
export const dynamic    = 'force-dynamic'
export const maxDuration = 45

// ─── Domain prompts ───────────────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<string, { label: string; prompt: string }> = {
  fm_industry: {
    label: 'FM & Real Estate',
    prompt: `You are a senior intelligence analyst specialising in Facilities Management, real estate, and property technology.
Generate a current intelligence briefing (5 items) covering:
- FM industry news: CAFM platforms, service charge legislation, IFRS 16/RICS updates
- GCC real estate: Saudi giga-projects (NEOM, Qiddiya, KSP), UAE PropTech, Abu Dhabi developments
- Sustainability: LEED/BREEAM, carbon reporting mandates, ESG in FM contracts
- M&A and market moves: FM companies, PropTech funding, platform consolidation
Focus on developments relevant to a UK/GCC FM consultancy and SaaS platform founder.`,
  },
  academic: {
    label: 'Academic & DBA',
    prompt: `You are a senior intelligence analyst specialising in business management research, doctoral education, and knowledge management.
Generate a current intelligence briefing (5 items) covering:
- DBA/PhD programme trends: executive doctoral research, research methodology advances
- Business management research: strategy, organisational behaviour, leadership, FM academia
- Academic publishing: key journals (IJFM, Facilities, RICS Research), open access trends
- AI in academic research: LLM tools for literature review, systematic reviews, data analysis
- CPD and professional body news: RICS, BIFM, CIPD, CMI developments
Focus on developments relevant to an executive DBA candidate in FM/business management.`,
  },
  saas: {
    label: 'SaaS & PropTech',
    prompt: `You are a senior intelligence analyst specialising in B2B SaaS, PropTech, and AI-powered business tools.
Generate a current intelligence briefing (5 items) covering:
- B2B SaaS: pricing trends, PLG vs enterprise motion, vertical SaaS consolidation
- PropTech: service charge platforms, CAFM/IWMS, lease management, tenant experience tech
- AI tooling: LLM integration in enterprise software, agentic workflows, Claude/OpenAI API use cases
- Funding and M&A: PropTech rounds, SaaS acquisitions, UK/GCC tech investment
- Regulatory tech: GDPR tooling, Companies House digital, Supabase/Vercel ecosystem
Focus on developments relevant to a founder building AI-powered FM and investigative journalism SaaS.`,
  },
  regulatory: {
    label: 'Regulatory & Legal',
    prompt: `You are a senior intelligence analyst specialising in UK and GCC regulatory affairs, property law, and compliance.
Generate a current intelligence briefing (5 items) covering:
- UK property law: Leasehold Reform, service charge legislation (LTA 1985), Building Safety Act
- UK company law: Companies House reforms, director obligations, data protection (ICO)
- GCC regulatory: Saudi Vision 2030 regulations, UAE company law, DIFC/ADGM fintech rules
- IP and trademark law: UK IPO developments, AI and copyright, software patent trends
- Financial compliance: FCA updates, anti-money laundering, Stripe/payment regulations
Focus on developments relevant to a UK-registered technology holding company operating in GCC markets.`,
  },
  gcc_market: {
    label: 'GCC Market',
    prompt: `You are a senior intelligence analyst specialising in Gulf Cooperation Council markets, Saudi Arabia, and UAE business environment.
Generate a current intelligence briefing (5 items) covering:
- Saudi Arabia: Vision 2030 progress, giga-project updates (NEOM, Qiddiya, Diriyah, KSP), Aramco/sovereign wealth
- UAE: Abu Dhabi investment, Dubai real estate, ADNOC diversification, Masdar City developments
- GCC macro: oil price impact, sovereign wealth deployment, infrastructure spend, tech localisation (Nitaqat)
- FM and real estate: CBRE/JLL GCC research, service charge frameworks, master community management
- Technology procurement: digital transformation tenders, GCC government tech spending, AI regulation in Gulf
Focus on developments relevant to a UK FM consultancy targeting GCC institutional clients and giga-projects.`,
  },
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body   = await req.json()
  const domain = (body.domain as string) ?? 'fm_industry'

  const config = DOMAIN_CONFIG[domain]
  if (!config) return NextResponse.json({ error: `Unknown domain: ${domain}` }, { status: 400 })

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const system = `${config.prompt}

Today is ${today}. Return ONLY valid JSON — no markdown fences, no preamble:
{
  "items": [
    {
      "headline": "Concise headline max 15 words",
      "summary": "2-3 sentences covering the development and why it matters",
      "source": "Publication or organisation name",
      "source_url": "https://plausible-realistic-url.com/article",
      "published_relative": "Today / Yesterday / 2 days ago / This week",
      "category_tag": "Policy / Research / Market / Technology / Regulatory",
      "relevance": 1-5,
      "so_what": "1 sentence on what this means for a UK/GCC FM consultancy and SaaS founder"
    }
  ],
  "synthesis": "2-3 sentence NemoClaw strategic synthesis across all 5 items — patterns, opportunities, risks"
}`

  try {
    const raw = await callClaude(
      [{ role: 'user', content: `Generate a ${config.label} intelligence briefing for today.` }],
      system,
      1800
    )

    const clean   = raw.replace(/```json|```/g, '').trim()
    const parsed  = JSON.parse(clean)
    const items   = (parsed.items ?? []).slice(0, 5)
    const synthesis = parsed.synthesis ?? null

    return NextResponse.json({
      domain,
      label: config.label,
      items,
      synthesis,
      generated_at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }, { headers: { 'Cache-Control': 'no-store' } })

  } catch (e: unknown) {
    console.error('[intelligence/briefing]', e)
    return NextResponse.json({ error: 'Briefing generation failed' }, { status: 500 })
  }
}
