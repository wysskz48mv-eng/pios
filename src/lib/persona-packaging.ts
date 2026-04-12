export type CanonicalPersona = 'CEO' | 'CONSULTANT' | 'ACADEMIC' | 'EXECUTIVE'

export interface PersonaPackaging {
  id: CanonicalPersona
  label: string
  tagline: string
  description: string
  modules: string[]
  priceLabel: string
  routePersona: 'executive' | 'consultant' | 'academic'
  configCode: 'CEO' | 'CONSULTANT' | 'ACADEMIC'
  fallbackFrameworkCodes: string[]
}

export const PERSONA_PACKAGING: PersonaPackaging[] = [
  {
    id: 'CEO',
    label: 'CEO / Founder',
    tagline: 'Build · Lead · Scale',
    description: 'You run a business, lead a team, and need a sovereign intelligence layer for decisions, stakeholders, and strategy.',
    modules: ['EOSA', 'Decisions', 'Stakeholders', 'Board Pack', 'Chief of Staff', 'Email Intelligence'],
    priceLabel: 'GBP 36/mo · Executive',
    routePersona: 'executive',
    configCode: 'CEO',
    fallbackFrameworkCodes: ['VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-SC-01', 'VIQ-SC-02', 'VIQ-OD-01', 'VIQ-RK-01'],
  },
  {
    id: 'CONSULTANT',
    label: 'Consultant / Advisor',
    tagline: 'Advise · Deliver · Influence',
    description: 'You manage engagements, produce strategic deliverables, and need a system that tracks multiple workstreams without losing context.',
    modules: ['Email Intelligence', 'Consulting Frameworks', 'Financials', 'CPD', 'Academic Suite'],
    priceLabel: 'GBP 28/mo · Pro',
    routePersona: 'consultant',
    configCode: 'CONSULTANT',
    fallbackFrameworkCodes: ['VIQ-PS-01', 'VIQ-PS-02', 'VIQ-ST-01', 'VIQ-SC-01', 'VIQ-FA-01', 'VIQ-EV-01'],
  },
  {
    id: 'ACADEMIC',
    label: 'Academic / Researcher',
    tagline: 'Research · Publish · Supervise',
    description: 'You are completing a doctorate alongside professional commitments. PIOS tracks your thesis, supervision, literature, and viva preparation.',
    modules: ['Thesis Tracker', 'Literature Agent', 'Supervision Prep', 'Viva Prep', 'Academic Brief'],
    priceLabel: 'GBP 12/mo · Starter',
    routePersona: 'academic',
    configCode: 'ACADEMIC',
    fallbackFrameworkCodes: ['VIQ-PS-04', 'VIQ-EV-01', 'VIQ-EV-02', 'VIQ-ST-07'],
  },
  {
    id: 'EXECUTIVE',
    label: 'Executive / Director',
    tagline: 'Operate · Delegate · Deliver',
    description: 'You lead a function or division and need operational clarity across priorities, people, and reporting lines.',
    modules: ['Chief of Staff', 'Decision Queue', 'Stakeholder Notes', 'Briefing Hub', 'Delivery Tracking'],
    priceLabel: 'GBP 36/mo · Executive',
    routePersona: 'executive',
    configCode: 'CEO',
    fallbackFrameworkCodes: ['VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-SC-01', 'VIQ-SC-02', 'VIQ-OD-01', 'VIQ-RK-01'],
  },
]

export const PERSONA_INPUT_ALIASES: Record<string, CanonicalPersona> = {
  ceo: 'CEO',
  founder: 'CEO',
  executive: 'EXECUTIVE',
  chief_of_staff: 'EXECUTIVE',
  whole_life: 'EXECUTIVE',
  consultant: 'CONSULTANT',
  professional: 'CONSULTANT',
  pro: 'CONSULTANT',
  academic: 'ACADEMIC',
  starter: 'ACADEMIC',
}

export function toCanonicalPersona(input: unknown): CanonicalPersona | null {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw) return null
  const upper = raw.toUpperCase() as CanonicalPersona
  if (PERSONA_PACKAGING.some((p) => p.id === upper)) return upper
  return PERSONA_INPUT_ALIASES[raw.toLowerCase()] ?? null
}

export function getPersonaPackaging(id: CanonicalPersona): PersonaPackaging {
  return PERSONA_PACKAGING.find((p) => p.id === id) ?? PERSONA_PACKAGING[0]
}
