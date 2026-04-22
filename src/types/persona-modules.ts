export const PERSONA_CODES = [
  'CEO',
  'ACADEMIC',
  'CONSULTANT',
  'EXECUTIVE',
  'CHIEF_OF_STAFF',
  'WHOLE_LIFE',
] as const

export type PersonaCode = (typeof PERSONA_CODES)[number]

export const MODULE_CODES = [
  'COMMAND_CENTRE',
  'NEMOCLAW',
  'VIQ_VAULT',
  'CONSULTING_HUB',
  'CHIEF_OF_STAFF_DASHBOARD',
  'OVERNIGHT_INTEL',
  'ACADEMIC',
  'CPD',
  'FM_CONSULTANT',
  'RIBA',
  'CITATION_GRAPH',
] as const

export type ModuleCode = (typeof MODULE_CODES)[number]

export interface UserPersonaRecord {
  id: string
  user_id: string
  persona_type: PersonaCode
  is_primary: boolean
  activated_at: string | null
  metadata: Record<string, unknown>
}

export interface UserModuleRecord {
  id: string
  user_id: string
  module_code: ModuleCode
  is_active: boolean
  activated_at: string | null
  config: Record<string, unknown>
}

export interface PersonaActivationOptions {
  fmConsultant?: boolean
  ribaEnabled?: boolean
}
