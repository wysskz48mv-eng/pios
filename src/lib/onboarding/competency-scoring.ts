export const COMPETENCY_DIMENSIONS = [
  'Strategic Thinking',
  'Execution Discipline',
  'Leadership Influence',
  'Decision Velocity',
  'Systems Thinking',
  'Financial Acumen',
  'Commercial Orientation',
  'Stakeholder Management',
  'Communication Clarity',
  'Problem Structuring',
  'Analytical Rigor',
  'Research Depth',
  'Innovation Orientation',
  'Adaptability',
  'Operational Excellence',
  'Risk Governance',
  'Project Delivery',
  'Client Orientation',
  'Negotiation Capability',
  'Learning Agility',
  'Ethical Judgment',
  'Collaboration Quality',
  'Resilience Under Pressure',
] as const

export type CompetencyDimension = (typeof COMPETENCY_DIMENSIONS)[number]

export type CompetencyScore = {
  score: number
  confidence: number
  rationale: string
}

type Input = {
  text: string
  extracted: Record<string, unknown>
  personaHint?: string | null
}

const KEYWORDS: Record<CompetencyDimension, string[]> = {
  'Strategic Thinking': ['strategy', 'strategic', 'roadmap', 'long-term', 'vision'],
  'Execution Discipline': ['execution', 'delivery', 'milestone', 'deadline', 'implementation'],
  'Leadership Influence': ['led', 'leadership', 'managed', 'director', 'head of'],
  'Decision Velocity': ['decision', 'rapid', 'priorit', 'turnaround', 'fast-paced'],
  'Systems Thinking': ['system', 'cross-functional', 'ecosystem', 'integration', 'end-to-end'],
  'Financial Acumen': ['budget', 'p&l', 'forecast', 'financial', 'revenue'],
  'Commercial Orientation': ['sales', 'growth', 'commercial', 'pipeline', 'market'],
  'Stakeholder Management': ['stakeholder', 'board', 'investor', 'partner', 'committee'],
  'Communication Clarity': ['presented', 'communication', 'report', 'brief', 'workshop'],
  'Problem Structuring': ['framework', 'diagnosis', 'root cause', 'structured', 'hypothesis'],
  'Analytical Rigor': ['analysis', 'model', 'quantitative', 'data', 'evidence'],
  'Research Depth': ['research', 'literature', 'methodology', 'thesis', 'publication'],
  'Innovation Orientation': ['innovation', 'new product', 'prototype', 'experiment', 'design'],
  Adaptability: ['adapt', 'change', 'transformation', 'pivot', 'dynamic'],
  'Operational Excellence': ['operations', 'process', 'efficiency', 'service quality', 'sop'],
  'Risk Governance': ['risk', 'compliance', 'governance', 'control', 'audit'],
  'Project Delivery': ['project', 'programme', 'pm', 'timeline', 'deliverable'],
  'Client Orientation': ['client', 'customer', 'engagement', 'advisory', 'relationship'],
  'Negotiation Capability': ['negotiation', 'contract', 'procurement', 'agreement', 'vendor'],
  'Learning Agility': ['learn', 'training', 'certification', 'upskill', 'continuous improvement'],
  'Ethical Judgment': ['ethics', 'integrity', 'responsible', 'policy', 'safeguard'],
  'Collaboration Quality': ['collaboration', 'team', 'cross-team', 'co-created', 'facilitated'],
  'Resilience Under Pressure': ['pressure', 'crisis', 'incident', 'high-stakes', 'deadline-driven'],
}

function clamp(value: number, min = 40, max = 95) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function scoreByKeywords(text: string, words: string[]) {
  const lower = text.toLowerCase()
  const hits = words.reduce((count, word) => (lower.includes(word) ? count + 1 : count), 0)
  const densityBoost = Math.min(22, hits * 4)
  return { hits, densityBoost }
}

function personaBias(personaHint: string | null | undefined, dim: CompetencyDimension): number {
  const p = (personaHint ?? '').toUpperCase()
  if (p === 'ACADEMIC') {
    if (dim === 'Research Depth' || dim === 'Analytical Rigor' || dim === 'Learning Agility') return 6
  }
  if (p === 'CONSULTANT') {
    if (dim === 'Problem Structuring' || dim === 'Client Orientation' || dim === 'Communication Clarity') return 5
  }
  if (p === 'CEO' || p === 'EXECUTIVE') {
    if (dim === 'Strategic Thinking' || dim === 'Leadership Influence' || dim === 'Decision Velocity') return 6
  }
  return 0
}

export function buildCompetencyScores(input: Input): Record<CompetencyDimension, CompetencyScore> {
  const text = input.text.slice(0, 12000)
  const extracted = input.extracted ?? {}
  const years = Number(extracted.career_years ?? 0)
  const hasAchievements = Array.isArray(extracted.key_achievements) && extracted.key_achievements.length > 0

  const result = {} as Record<CompetencyDimension, CompetencyScore>

  for (const dimension of COMPETENCY_DIMENSIONS) {
    const base = 48 + Math.min(16, Math.floor(years / 2)) + (hasAchievements ? 4 : 0)
    const { hits, densityBoost } = scoreByKeywords(text, KEYWORDS[dimension])
    const bias = personaBias(input.personaHint, dimension)
    const score = clamp(base + densityBoost + bias)
    const confidence = clamp(52 + hits * 8 + (text.length > 1800 ? 6 : 0), 45, 96)

    result[dimension] = {
      score,
      confidence,
      rationale: hits > 0
        ? `Evidence found in CV for ${hits} relevant signal${hits > 1 ? 's' : ''}.`
        : 'Limited explicit evidence; inferred from overall role and tenure context.',
    }
  }

  return result
}

export function topCompetencies(scores: Record<CompetencyDimension, CompetencyScore>, take = 5) {
  return Object.entries(scores)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, take)
    .map(([dimension, value]) => ({ dimension, score: value.score, confidence: value.confidence }))
}
