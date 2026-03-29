/**
 * POST /api/viva — PIOS™ Viva Preparation Engine
 *
 * Modes:
 *   standard    — UKCGE/Oxbridge question bank, typical UK PhD/DBA viva
 *   examiner    — Simulates specific examiner based on their publication profile
 *   stress      — Adversarial mode: probes weaknesses, demands evidence, follows up
 *   feedback    — Evaluates a submitted answer and gives structured critique
 *   profile     — Generates examiner profile from name + institution
 *   summary     — Generates chapter summary from provided text
 *
 * Body: { mode, answer?, examiner?, chapter?, question?, thesisContext?, sessionId? }
 *
 * PIOS™ v3.2.5 | Sprint D | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import Anthropic                     from '@anthropic-ai/sdk'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic()

// ── Portsmouth DBA context (injected into all examiner simulations) ──────────
const PORTSMOUTH_DBA_CONTEXT = `
You are operating within the University of Portsmouth DBA (Doctor of Business Administration) context.
Key facts:
- Programme: DBA at Portsmouth Centre for Enterprise, Governance and Development (CEGD)
- Supervisors: Dr Ozlem Bak (First Supervisor) and Dr Raja Sreedharan (Second Supervisor)
- Research focus: AI-enabled FM cost forecasting and governance in GCC mixed-use developments
- Theoretical framework: Socio-technical systems theory + sensemaking (Weick, Klein)
- Research strategy: Strategy 3 — additive contextual specification
- GCC context: Saudi Arabia (King Salman Park, Qiddiya), MOMRA/REGA regulatory frameworks
- Key IP: VeritasEdge™ platform as practitioner case study (with approval)
- Portsmouth viva format: DBA viva preceded by a presentation (panel or open audience)
- Examination criteria: QAA Level 8 descriptors, originality, methodological rigour, practitioner impact
- Likely outcome categories: Pass, Minor corrections (3 months), Major corrections (6 months), Resubmission (1 year)
`

// ── Standard viva question bank (50 questions across 8 categories) ───────────
const QUESTION_BANK = {
  originality: [
    "What is the original contribution of your thesis to knowledge?",
    "How does your research advance the current state of understanding in FM cost forecasting?",
    "What would we not know without your research?",
    "Which specific claims in your thesis are distinctly your own?",
    "How does your contribution differ from existing benchmarking approaches like RICS?",
  ],
  methodology: [
    "Why did you choose socio-technical systems theory as your theoretical lens?",
    "Why sensemaking rather than, say, institutional theory or actor-network theory?",
    "Defend your epistemological position — why interpretivism rather than positivism?",
    "How did you ensure rigour in your qualitative data collection?",
    "What are the limitations of your chosen research strategy?",
    "How did you address potential researcher bias given your practitioner background?",
    "Why abductive reasoning — and how did you move between induction and deduction?",
  ],
  literature: [
    "How has the field of FM cost governance changed since you began your research?",
    "Why did you not engage more deeply with [CAFM systems literature / Planon / IBM Maximo]?",
    "How does your work relate to Weick's sensemaking versus Klein's data/frame model?",
    "Where does your research sit in relation to the broader GCC PropTech literature?",
    "Which authors would most challenge your findings and how would you respond?",
    "What literature did you consider but decide not to include, and why?",
  ],
  findings: [
    "Walk me through your key findings in under two minutes.",
    "What surprised you most about your findings?",
    "Are there alternative explanations for what you found?",
    "How confident are you in the generalisability of your findings beyond KSP?",
    "What would change your conclusions?",
    "How do your findings relate to the MOMRA 2024 regulatory framework?",
  ],
  limitations: [
    "What are the main limitations of your research?",
    "How did access constraints at KSP affect the quality of your data?",
    "To what extent can your GCC-specific findings be applied in other jurisdictions?",
    "How does the practitioner-researcher dual role affect the credibility of your work?",
    "What would you do differently if you were starting this research again?",
  ],
  significance: [
    "Why does this research matter? Who benefits from it?",
    "What are the practical implications for FM professionals in the GCC?",
    "What are the theoretical implications for the socio-technical systems field?",
    "How should policymakers at MOMRA or PIF use your findings?",
    "What is your publication plan following the award?",
  ],
  professional_doctorate: [
    "How does your research bridge academic theory and FM practice?",
    "What has changed in your professional practice as a result of this research?",
    "How is the DBA different from a PhD, and how does your work reflect that?",
    "Describe the presentation you gave before this viva — what were the key points?",
    "How does VeritasEdge™ embody the findings of your research in practice?",
  ],
  technical: [
    "Explain your SE-CAFX™ arid climate adjustment factors — how were they derived?",
    "How does HDCA™ differ from standard lifecycle costing methodologies?",
    "Justify your VE-BENCH™ cost database construction methodology.",
    "How did you validate your AI-enabled cost forecasting model against real FM data?",
    "Walk me through the technical architecture of your research instrument.",
  ],
}

// ── Examiner profiles ─────────────────────────────────────────────────────────
const EXAMINER_PROFILES: Record<string, string> = {
  'ozlem_bak': `Dr Ozlem Bak — First Supervisor, Portsmouth CEGD.
Research interests: organisational learning, knowledge management, SME development, international business strategy.
Likely angle: Will probe knowledge creation processes in FM organisations. Interested in how tacit knowledge is made explicit through the VeritasEdge™ platform. May push on organisational sensemaking (Weick) vs individual sense-making. Will want to see clear linkage between academic theory and practitioner impact.
Typical challenge questions: "How do FM professionals actually make sense of the cost data your tool produces?" "What is the knowledge transfer mechanism from your platform to the industry?" "How does this research contribute to organisational learning theory?"`,

  'raja_sreedharan': `Dr Raja Sreedharan — Second Supervisor, Portsmouth CEGD.
Research interests: quality management, process improvement, Lean/Six Sigma in service sectors, sustainability.
Likely angle: Will focus on research rigour, process validation, and the replicability of the methodology. Interested in how the SE-CAFX™ factors were derived and whether they meet quality thresholds. May push on data quality and the robustness of the benchmarking approach.
Typical challenge questions: "How did you validate the reliability of your climate adjustment factors?" "What quality assurance processes governed your data collection?" "Is your methodology replicable by another researcher in a different GCC context?"`,
}

// ── Helper: pick a random question from a category ───────────────────────────
function pickQuestion(category?: string): { question: string; category: string } {
  const cats = Object.keys(QUESTION_BANK)
  const cat  = (category && QUESTION_BANK[category as keyof typeof QUESTION_BANK])
    ? category
    : cats[Math.floor(Math.random() * cats.length)]
  const questions = QUESTION_BANK[cat as keyof typeof QUESTION_BANK]
  return { question: questions[Math.floor(Math.random() * questions.length)], category: cat }
}

// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { mode, answer, examiner, question, thesisContext, category } = body

    // ── Mode: profile — generate examiner profile ─────────────────────────
    if (mode === 'profile') {
      const examinerName = body.examinerName ?? ''
      const institution  = body.institution  ?? ''
      const builtIn = EXAMINER_PROFILES[examiner as string]
      if (builtIn) {
        return NextResponse.json({ ok: true, profile: builtIn, source: 'built_in' })
      }
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 600,
        messages: [{ role: 'user', content:
          `${PORTSMOUTH_DBA_CONTEXT}\n\nGenerate a viva examiner profile for: ${examinerName}, ${institution}.\n` +
          `Include: research interests, likely question angle for a DBA on AI-enabled FM cost forecasting in GCC, ` +
          `and 3 typical challenge questions they would ask. Be specific and academically grounded.`
        }],
      })
      const profile = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ ok: true, profile, source: 'generated' })
    }

    // ── Mode: summary — chapter summary from text ─────────────────────────
    if (mode === 'summary') {
      const chapterText = body.chapterText ?? ''
      const chapterNum  = body.chapterNum  ?? 1
      if (!chapterText) return NextResponse.json({ error: 'chapterText required' }, { status: 400 })
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 500,
        messages: [{ role: 'user', content:
          `${PORTSMOUTH_DBA_CONTEXT}\n\nGenerate a one-page viva preparation summary for Chapter ${chapterNum} of this DBA thesis.\n\n` +
          `Include: (1) Core argument in 1 sentence, (2) Key contributions (3 bullets), ` +
          `(3) Likely examiner questions for this chapter (3 questions), (4) Weaknesses to acknowledge proactively.\n\n` +
          `Chapter text:\n${chapterText.slice(0, 4000)}`
        }],
      })
      const summary = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ ok: true, summary, chapterNum })
    }

    // ── Mode: feedback — evaluate a submitted answer ──────────────────────
    if (mode === 'feedback') {
      if (!question || !answer) return NextResponse.json({ error: 'question and answer required' }, { status: 400 })
      const examinerProfile = examiner ? (EXAMINER_PROFILES[examiner] ?? '') : ''
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 700,
        messages: [{ role: 'user', content:
          `${PORTSMOUTH_DBA_CONTEXT}\n${examinerProfile ? `\nExaminer profile:\n${examinerProfile}\n` : ''}` +
          `\nThesis context: ${thesisContext ?? 'DBA on AI-enabled FM cost forecasting in GCC master communities'}\n` +
          `\nViva question: "${question}"\n` +
          `\nCandidate answer: "${answer}"\n` +
          `\nProvide structured feedback as a Portsmouth DBA examiner:\n` +
          `1. SCORE (1-5 stars) with one-line rationale\n` +
          `2. STRENGTHS (2-3 bullets)\n` +
          `3. WEAKNESSES (2-3 bullets — be direct, not diplomatic)\n` +
          `4. IMPROVED ANSWER — rewrite the answer as the ideal response (3-5 sentences)\n` +
          `5. FOLLOW-UP — one probing follow-up question the examiner would ask next\n` +
          `Be rigorous and honest. Do not soften genuine weaknesses.`
        }],
      })
      const feedback = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ ok: true, feedback, question })
    }

    // ── Mode: standard / examiner / stress — generate question ───────────
    const { question: pickedQ, category: pickedCat } = pickQuestion(category)
    const currentQuestion = question ?? pickedQ
    const examinerProfile = examiner ? (EXAMINER_PROFILES[examiner as string] ?? '') : ''

    const modeInstructions: Record<string, string> = {
      standard: `You are a fair but rigorous DBA examiner at the University of Portsmouth. Ask the viva question below in a professional, non-confrontational tone. After the candidate answers, you will probe with one follow-up.`,
      examiner: `${examinerProfile}\n\nYou are role-playing as this specific examiner. Ask the viva question below in their characteristic style. Stay in character throughout.`,
      stress: `You are a demanding external examiner who is sceptical of practitioner-research. You will ask the question below and regardless of the answer, probe for weaknesses, demand specific evidence, and challenge generalisability. Do not accept vague answers. Push hard but remain professional.`,
    }

    const systemPrompt = `${PORTSMOUTH_DBA_CONTEXT}\n\n${modeInstructions[mode] ?? modeInstructions.standard}\n\nThesis context: ${thesisContext ?? 'DBA on AI-enabled FM cost forecasting in GCC master communities (VeritasEdge™ as practitioner case)'}`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content:
        answer
          ? `The candidate answered: "${answer}"\n\nNow provide ONE probing follow-up question. Stay in character. Do not provide the answer. Just ask the follow-up.`
          : `Ask this viva question to the candidate: "${currentQuestion}"\n\nFrame it naturally as an examiner would in a real viva. Do not add preamble. Just ask the question.`
      }],
    })

    const response = msg.content[0]?.type === 'text' ? msg.content[0].text : ''

    return NextResponse.json({
      ok:       true,
      mode,
      question: currentQuestion,
      category: pickedCat,
      response,
      examiner: examiner ?? null,
    })

  } catch (err: any) {
    console.error('[PIOS viva]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}

// GET — question bank stats + examiner profiles available
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const categories = Object.entries(QUESTION_BANK).map(([cat, qs]) => ({
      category: cat,
      count:    qs.length,
    }))
    const totalQuestions = Object.values(QUESTION_BANK).reduce((s, qs) => s + qs.length, 0)

    return NextResponse.json({
      ok:              true,
      total_questions: totalQuestions,
      categories,
      examiners_available: Object.keys(EXAMINER_PROFILES),
      modes: ['standard', 'examiner', 'stress', 'feedback', 'profile', 'summary'],
    })
  } catch (err: any) {
    console.error('[PIOS viva GET]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
