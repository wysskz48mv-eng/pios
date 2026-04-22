import { PERSONA_PACKAGING, type CanonicalPersona, toCanonicalPersona } from '@/lib/persona-packaging'

export type CalibrationQuestion = {
  id: string
  prompt: string
  options: string[]
}

export type PersonaCalibrationConfig = {
  persona: CanonicalPersona
  display: string
  communicationStyle: string
  defaultModules: string[]
  questions: CalibrationQuestion[]
}

const questionSets: Record<CanonicalPersona, CalibrationQuestion[]> = {
  CEO: [
    {
      id: 'decision_style',
      prompt: 'When facing a high-stakes decision, what is your default operating style?',
      options: ['Fast and directional', 'Data-first and deliberate', 'Consensus with core team', 'Scenario planning before action'],
    },
    {
      id: 'strategic_horizon',
      prompt: 'Which horizon currently needs the most attention?',
      options: ['0-30 day execution', 'Quarterly growth', '12-24 month strategy', 'Fundraising / governance readiness'],
    },
    {
      id: 'leadership_focus',
      prompt: 'Where do you most want NemoClaw™ support this month?',
      options: ['Priority clarity', 'Delegation discipline', 'Board-level communication', 'Commercial momentum'],
    },
  ],
  EXECUTIVE: [
    {
      id: 'operating_mode',
      prompt: 'How do you prefer to run your operating cadence?',
      options: ['Structured weekly cadence', 'Rolling priorities daily', 'Milestone-driven', 'Portfolio view across teams'],
    },
    {
      id: 'team_management',
      prompt: 'Which management challenge is most present today?',
      options: ['Cross-team coordination', 'Upward stakeholder reporting', 'Delivery consistency', 'Decision bottlenecks'],
    },
    {
      id: 'communication_style',
      prompt: 'How should NemoClaw™ communicate with you?',
      options: ['Executive brief style', 'Detailed operating notes', 'Action list with owners', 'Balanced concise + evidence'],
    },
  ],
  CONSULTANT: [
    {
      id: 'engagement_pattern',
      prompt: 'How are your current client engagements structured?',
      options: ['Single major engagement', '2-3 parallel engagements', 'Advisory retainer mix', 'Project + internal practice build'],
    },
    {
      id: 'analysis_preference',
      prompt: 'What output style creates the most client value for you?',
      options: ['MECE frameworks', 'Visual executive summaries', 'Financial/operational models', 'Narrative recommendations'],
    },
    {
      id: 'delivery_constraint',
      prompt: 'What is your biggest delivery constraint right now?',
      options: ['Time bandwidth', 'Context switching', 'Client alignment', 'Data quality / evidence'],
    },
  ],
  ACADEMIC: [
    {
      id: 'research_stage',
      prompt: 'Where are you currently in your research journey?',
      options: ['Proposal / framing', 'Data collection', 'Analysis and writing', 'Viva preparation'],
    },
    {
      id: 'study_cadence',
      prompt: 'What cadence is realistic for sustained progress?',
      options: ['Daily short bursts', 'Focused deep-work blocks', 'Weekend-heavy cadence', 'Milestone-based sprints'],
    },
    {
      id: 'support_need',
      prompt: 'Where do you need the most support this term?',
      options: ['Literature synthesis', 'Chapter structuring', 'Supervisor preparation', 'Critical argument clarity'],
    },
  ],
}

function communicationStyle(persona: CanonicalPersona): string {
  switch (persona) {
    case 'CEO':
      return 'Strategic, concise, high-accountability, with explicit trade-offs.'
    case 'EXECUTIVE':
      return 'Operationally crisp, outcomes-focused, and structured by priority.'
    case 'CONSULTANT':
      return 'Hypothesis-driven, client-ready, and evidence-backed.'
    case 'ACADEMIC':
      return 'Clear, intellectually rigorous, and coaching-oriented.'
    default:
      return 'Professional, concise, and context-aware.'
  }
}

export function getPersonaCalibrationConfig(input: unknown): PersonaCalibrationConfig {
  const persona = toCanonicalPersona(input) ?? 'EXECUTIVE'
  const packaging = PERSONA_PACKAGING.find((item) => item.id === persona) ?? PERSONA_PACKAGING[0]

  return {
    persona,
    display: packaging.label,
    communicationStyle: communicationStyle(persona),
    defaultModules: packaging.fallbackFrameworkCodes,
    questions: questionSets[persona] ?? questionSets.EXECUTIVE,
  }
}
