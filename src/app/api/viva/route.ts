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
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60


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
  sa_specific: [
    "How does your research address South Africa's transformation imperative under B-BBEE?",
    "Did you comply with POPIA (Protection of Personal Information Act) in your data collection — walk me through your consent and storage protocols.",
    "To what extent are your findings Eurocentric? How would your conclusions differ if you applied an Afrocentric epistemological framework?",
    "How does your research contribute to the NQF Level 10 requirement for original knowledge at the frontier of your discipline?",
    "What are the implications of your research for South Africa's development goals — specifically inequality, unemployment, and poverty?",
    "How have you positioned your research within the African context, not just the South African one? Can your findings travel to Nairobi, Lagos, or Accra?",
    "Given SA's colonial history, how do you account for the epistemological assumptions embedded in your chosen theoretical framework?",
    "How does your research engage with Ubuntu philosophy or community-centred research ethics?",
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
    : cats[Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * cats.length)]
  const questions = QUESTION_BANK[cat as keyof typeof QUESTION_BANK]
  return { question: questions[Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * questions.length)], category: cat }
}


// ── South African doctoral examination context ─────────────────────────────
const SA_DOCTORAL_CONTEXT = `
South African Doctoral Examination Landscape (2025-2026):

KEY POLICY SHIFT: South Africa is actively standardising viva voce adoption.
- Council on Higher Education (CHE) is driving standardisation across all 26 public universities
- Universities South Africa (USAf) CoP on Postgraduate Education endorses viva model
- NQF Level 10 doctoral criteria: originality, contribution to knowledge, independent research

INSTITUTION-SPECIFIC RULES:
- UCT (University of Cape Town): Oral exam compulsory from 2026 applicants. 3 international-standard examiners. Confidential process. 5 months typical duration.
- UNISA: Oral defence compulsory from 2022 cohort. Panel of examiners. Also requires 2 peer-reviewed manuscript submissions. Non-Examining Chairperson (NEC) manages process.
- GIBS/UP (Gordon Institute of Business Science, University of Pretoria): DBA requires thesis + oral defence. Practitioner-research focus. Triple Crown accredited (AACSB, EQUIS, AMBA).
- Milpark Education: DBA requires thesis examined by 3 examiners + oral defence (viva voce). Proposal defence phase also required. Practitioner-oriented research.
- Wits (University of the Witwatersrand): PhD by thesis. Oral examination varies by faculty. Business school increasingly using viva for DBA.
- Stellenbosch University: Traditionally written examination. Moving toward viva for doctoral degrees.
- University of Pretoria: Faculty-specific viva requirements. Graduate School of Business and GIBS require viva for DBA.
- MANCOSA/Regent Business School: Online DBA with viva voce component. Part-time professionals.

SA-SPECIFIC EXAMINATION EMPHASES:
- POPIA compliance (Protection of Personal Information Act) — equivalent of GDPR, must be addressed in methodology
- B-BBEE/transformation research context — examiners often ask about transformation implications
- Africa-specific research context: findings must speak to African business/social context
- CHE quality assurance: research must demonstrate doctoral standard per National Qualifications Framework (NQF)
- Decolonisation of knowledge: increasingly, examiners probe epistemological assumptions — whose knowledge? Eurocentric vs Afrocentric frameworks?
- Ubuntu philosophy: community-centred research ethics expected in social science research
- Social transformation: research should demonstrate relevance to SA development challenges

TYPICAL SA DBA VIVA PANEL:
- Internal supervisor (observes, cannot examine)
- 2-3 external examiners (at least one international)
- Independent chairperson (procedural oversight)
- Duration: 1-2 hours typically
- Outcome categories: Pass / Minor corrections (3 months) / Major corrections (6 months) / Resubmission / MPhil downgrade
`

// ── SA University examiner profiles ─────────────────────────────────────────
const SA_EXAMINER_PROFILES: Record<string, string> = {
  'gibs_up': `Gordon Institute of Business Science (GIBS) / University of Pretoria — DBA Examiner Profile.
Programme: DBA (Doctor of Business Administration) — Triple Crown accredited (AACSB, EQUIS, AMBA).
Research culture: Strongly practitioner-research integrated. Examiners expect clear managerial/organisational implications alongside academic rigour.
Typical examiner angle: Will probe the "so what for practice" question heavily. GIBS is known for demanding that research outputs are publishable AND implementable. Expect questions on knowledge transfer to industry.
Likely question areas: How does your research advance African management theory? What is the managerial implication for C-suite decision-makers? How does your methodology meet CHE NQF Level 10 standards?
Key challenge: GIBS examiners frequently push on whether the candidate can articulate a theoretical contribution beyond descriptive practitioner findings.`,

  'uct': `University of Cape Town (UCT) — Doctoral Examiner Profile.
UCT ranks #1 in Africa and operates to international doctoral standards. From 2026, oral exam is compulsory for all PhD candidates.
Examination panel: 3 examiners of "high international standing with relevant and significant academic experience." Candidate identity of examiners is confidential until after examination.
Research culture: UCT examiners are internationally oriented. Strong emphasis on publishability and contribution to global scholarly conversation. Interdisciplinary research is valued.
Likely examiner angle: Will assess whether the thesis holds up to international peer review standards. Expect probing on epistemological rigour, methodological transparency, and literature positioning within global debates.
Key challenge: UCT examiners are particularly sharp on: "How does this speak to a global audience, not just a South African or African one?" Must demonstrate international relevance.`,

  'unisa': `University of South Africa (UNISA) — Doctoral Examiner Profile.
Africa's largest open distance learning institution. Oral defence compulsory from 2022 cohort; also requires 2 peer-reviewed manuscript submissions.
Examination process: Examiners submit reports first; if satisfactory, Non-Examining Chairperson (NEC) arranges viva. Can be conducted online. Results official within one month.
Research culture: UNISA has a strong transformation and social development ethos. Distance-learning student population means research often addresses equity, access, and community-based issues.
Likely examiner angle: Will probe the social relevance and transformation implications of findings. Strong interest in POPIA compliance and research ethics. Ubuntu-oriented research ethics expected.
Key challenge: UNISA examiners also assess whether research contributes to South Africa's development challenges. "What does your research mean for communities who cannot afford the solution you propose?" is a typical probing question.`,

  'stellenbosch': `Stellenbosch University (SU) — Doctoral Examiner Profile.
One of SA's top-ranked universities. Historically Afrikaans-medium but now fully bilingual/multilingual. Strong research output; internationally networked faculty.
Research culture: Rigorous, traditionally conservative academic standards. Strong in quantitative methods, economics, engineering. Business School (USB) increasingly values mixed-methods and African management research.
Likely examiner angle: Will push on methodological rigour and replicability. Stellenbosch examiners are known for detailed thesis engagement — expect page-by-page probing of methodology chapters. Strong on validity and reliability assessment.
Key challenge: "How would your findings change under a different epistemological assumption?" Stellenbosch examiners are particularly sharp on research design robustness.`,

  'wits': `University of the Witwatersrand (Wits) — Doctoral Examiner Profile.
Wits Business School (WBS) and the Graduate School of Governance host DBA/PhD programmes. Wits ranks in top 250 globally.
Research culture: Socially engaged research tradition. Wits has a strong legacy of critical theory, social justice research, and transformative scholarship. Business research must navigate between rigour and social relevance.
Likely examiner angle: Critical theory lens — will probe whether the candidate's theoretical framework adequately accounts for power dynamics, race, and inequality in the South African context. Transformation implications are not optional.
Key challenge: "Whose interests does this research serve?" is a Wits examiner signature question. Candidates must demonstrate reflexivity about their positionality as researchers.`,

  'milpark': `Milpark Education — DBA Examiner Profile.
South Africa's private business school with HEQC-accredited DBA. Thesis assessed by 3 examiners + oral defence before final endorsement.
Research culture: Pragmatic, practitioner-focused. Milpark targets working professionals and senior executives. Research is expected to solve real organisational problems. Ethical and sustainable business focus.
Likely examiner angle: Will probe the practical implementability of findings. "If I'm a CEO, what do I do Monday morning with your findings?" is the spirit of Milpark examination. Strong emphasis on ethical business practices alignment.
Key challenge: Milpark examiners expect candidates to have synthesised scholarly literature AND organisational reality. Pure academic abstraction without organisational grounding will be challenged.`,

  'regent_mancosa': `Regent Business School / MANCOSA — DBA Examiner Profile.
Private business schools offering accredited DBA with distance/online delivery. Target market: working professionals across Africa and diaspora.
Research culture: Access-oriented, practitioner-research focused. Programmes attract students from across Sub-Saharan Africa. African business context is central to curriculum. Online viva capability well established.
Likely examiner angle: Strong on African management theory and continental business context. Will probe whether findings are relevant beyond SA borders to broader African markets. Entrepreneurship, SME development, and development economics often relevant lenses.
Key challenge: "How does your research speak to the African entrepreneur, not just the multinational?" Expect probing on Africa-specific applicability of Western management frameworks.`,
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
      const examinerName   = body.examinerName   ?? ''
      const institution    = body.institution    ?? ''
      const institutionKey = body.institutionKey ?? examiner
      // Check SA profiles first
      const saProfile = SA_EXAMINER_PROFILES[institutionKey as string]
      if (saProfile) {
        return NextResponse.json({ ok: true, profile: saProfile, source: 'sa_built_in', context: SA_DOCTORAL_CONTEXT })
      }
      const builtIn = EXAMINER_PROFILES[examiner as string]
      if (builtIn) {
        return NextResponse.json({ ok: true, profile: builtIn, source: 'built_in' })
      }
      const profile = await callClaude(
        [{ role: 'user', content:
          `${PORTSMOUTH_DBA_CONTEXT}\n\nGenerate a viva examiner profile for: ${examinerName}, ${institution}.\n` +
          `Include: research interests, likely question angle for a DBA on AI-enabled FM cost forecasting in GCC, ` +
          `and 3 typical challenge questions they would ask. Be specific and academically grounded.`
        }],
        'You are a viva examiner profile generator. Output a concise, specific profile.',
        600,
        'sonnet'
      )
      return NextResponse.json({ ok: true, profile, source: 'generated' })
    }

    // ── Mode: summary — chapter summary from text ─────────────────────────
    if (mode === 'summary') {
      const chapterText = body.chapterText ?? ''
      const chapterNum  = body.chapterNum  ?? 1
      if (!chapterText) return NextResponse.json({ error: 'chapterText required' }, { status: 400 })
      const summary = await callClaude(
        [{ role: 'user', content:
          `${PORTSMOUTH_DBA_CONTEXT}\n\nGenerate a one-page viva preparation summary for Chapter ${chapterNum} of this DBA thesis.\n\n` +
          `Include: (1) Core argument in 1 sentence, (2) Key contributions (3 bullets), ` +
          `(3) Likely examiner questions for this chapter (3 questions), (4) Weaknesses to acknowledge proactively.\n\n` +
          `Chapter text:\n${chapterText.slice(0, 4000)}`
        }],
        'You are a viva summary generator. Output a structured, concise summary.',
        500,
        'sonnet'
      )
      return NextResponse.json({ ok: true, summary, chapterNum })
    }

    // ── Mode: feedback — evaluate a submitted answer ──────────────────────
    if (mode === 'feedback') {
      if (!question || !answer) return NextResponse.json({ error: 'question and answer required' }, { status: 400 })
      const examinerProfile = examiner ? (EXAMINER_PROFILES[examiner] ?? '') : ''
      const feedback = await callClaude(
        [{ role: 'user', content:
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
        'You are a viva answer feedback generator. Output a structured, honest critique.',
        700,
        'sonnet'
      )
      return NextResponse.json({ ok: true, feedback, question })
    }

    // ── Mode: standard / examiner / stress — generate question ───────────
    const { question: pickedQ, category: pickedCat } = pickQuestion(category)
    const currentQuestion = question ?? pickedQ
    const examinerProfile = examiner ? (EXAMINER_PROFILES[examiner as string] ?? '') : ''

    // Select context based on institution type (generic fallback if no institution specified)
    const GENERIC_DOCTORAL_CONTEXT = `You are operating within a standard UK doctoral examination context.\nViva format: oral examination before a panel of examiners.\nOutcome categories: Pass, Minor corrections, Major corrections, Resubmission.\nThe candidate is a doctoral student defending their thesis.`
    const institutionCtx = body.institutionKey
      ? (SA_EXAMINER_PROFILES[body.institutionKey] ? SA_DOCTORAL_CONTEXT : PORTSMOUTH_DBA_CONTEXT)
      : (examiner && EXAMINER_PROFILES[examiner as string] ? PORTSMOUTH_DBA_CONTEXT : GENERIC_DOCTORAL_CONTEXT)
    const saExaminerProfile = body.institutionKey ? (SA_EXAMINER_PROFILES[body.institutionKey] ?? '') : ''
    const activeExaminerProfile = examinerProfile || saExaminerProfile

    const modeInstructions: Record<string, string> = {
      standard: `You are a fair but rigorous doctoral examiner. Ask the viva question below in a professional, non-confrontational tone. After the candidate answers, you will probe with one follow-up.`,
      examiner: `${activeExaminerProfile || 'You are a doctoral examiner.'}\n\nYou are role-playing as this specific examiner. Ask the viva question below in their characteristic style. Stay in character throughout.`,
      stress: `You are a demanding external examiner who is sceptical of practitioner-research. You will ask the question below and regardless of the answer, probe for weaknesses, demand specific evidence, and challenge generalisability. Do not accept vague answers. Push hard but remain professional.`,
    }

    const systemPrompt = `${institutionCtx}\n\n${modeInstructions[mode] ?? modeInstructions.standard}\n\nThesis context: ${thesisContext ?? 'Doctoral research thesis (candidate has not specified topic — ask general examination questions)'}`

    const response = await callClaude(
      [{ role: 'user', content:
        answer
          ? `The candidate answered: "${answer}"\n\nNow provide ONE probing follow-up question. Stay in character. Do not provide the answer. Just ask the follow-up.`
          : `Ask this viva question to the candidate: "${currentQuestion}"\n\nFrame it naturally as an examiner would in a real viva. Do not add preamble. Just ask the question.`
      }],
      systemPrompt,
      400,
      'sonnet'
    )

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
    return apiError(err)
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
      sa_institutions_available: Object.keys(SA_EXAMINER_PROFILES),
      sa_context_available: true,
      modes: ['standard', 'examiner', 'stress', 'feedback', 'profile', 'summary'],
    })
  } catch (err: any) {
    console.error('[PIOS viva GET]', err)
    return apiError(err)
  }
}
