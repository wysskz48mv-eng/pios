import { MODULE_CODES, PERSONA_CODES, type ModuleCode, type PersonaActivationOptions, type PersonaCode } from '@/types/persona-modules'

export const PERSONA_LABELS: Record<PersonaCode, string> = {
  CEO: 'Founder / CEO',
  ACADEMIC: 'Academic / PhD',
  CONSULTANT: 'Management Consultant',
  EXECUTIVE: 'Executive',
  CHIEF_OF_STAFF: 'Chief of Staff',
  WHOLE_LIFE: 'Whole-Life',
}

export const PERSONA_DESCRIPTIONS: Record<PersonaCode, string> = {
  CEO: 'Strategic founder workflows with neutral consulting substrate.',
  ACADEMIC: 'Research, thesis progression, and citation-driven academic workflows.',
  CONSULTANT: 'Neutral consulting frameworks and delivery workflows.',
  EXECUTIVE: 'Executive operating cadence and strategic delivery oversight.',
  CHIEF_OF_STAFF: 'Principal support, cross-functional orchestration, and decision flow.',
  WHOLE_LIFE: 'Balanced performance across professional and personal operating systems.',
}

export function normalisePersonaCodes(input: unknown): PersonaCode[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set(PERSONA_CODES)
  return [...new Set(input.map((v) => String(v).toUpperCase()).filter((v): v is PersonaCode => allowed.has(v as PersonaCode)))]
}

export function normaliseModuleCodes(input: unknown): ModuleCode[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set(MODULE_CODES)
  return [...new Set(input.map((v) => String(v).toUpperCase()).filter((v): v is ModuleCode => allowed.has(v as ModuleCode)))]
}

export function resolveModulesForPersonas(
  personas: PersonaCode[],
  options: PersonaActivationOptions = {}
): ModuleCode[] {
  const modules = new Set<ModuleCode>()

  for (const persona of personas) {
    if (persona === 'ACADEMIC') {
      modules.add('ACADEMIC')
      modules.add('CITATION_GRAPH')
      modules.add('CPD')
    }

    if (persona === 'CONSULTANT') {
      modules.add('CONSULTING_HUB')
      modules.add('CPD')
      if (options.fmConsultant) modules.add('FM_CONSULTANT')
    }

    if (persona === 'CEO' || persona === 'EXECUTIVE') {
      modules.add('CONSULTING_HUB')
    }
  }

  if (options.ribaEnabled && personas.some((p) => p === 'CONSULTANT' || p === 'EXECUTIVE' || p === 'ACADEMIC')) {
    modules.add('RIBA')
  }

  return [...modules]
}

export function inferPersonaSuggestionsFromCvSummary(summary: string | null | undefined): PersonaCode[] {
  const text = (summary ?? '').toLowerCase()
  if (!text) return []

  const suggestions = new Set<PersonaCode>()

  if (/(thesis|doctoral|phd|research|supervisor|viva|publication)/.test(text)) suggestions.add('ACADEMIC')
  if (/(consult|advisory|engagement|client|strategy|benchmark|framework)/.test(text)) suggestions.add('CONSULTANT')
  if (/(founder|startup|ceo|entrepreneur|scale-up)/.test(text)) suggestions.add('CEO')
  if (/(director|executive|operations|leadership|board)/.test(text)) suggestions.add('EXECUTIVE')

  return [...suggestions]
}
