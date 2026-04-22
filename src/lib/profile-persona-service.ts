import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  normaliseModuleCodes,
  normalisePersonaCodes,
  resolveModulesForPersonas,
} from '@/lib/persona-modules'
import type { ModuleCode, PersonaCode } from '@/types/persona-modules'

function maybeServiceClient() {
  try {
    return createServiceClient()
  } catch {
    return createClient()
  }
}

export async function getProfilePersonaModuleState(userId: string) {
  const db = maybeServiceClient()

  const [{ data: personas }, { data: modules }, { data: profile }] = await Promise.all([
    db
      .from('user_personas')
      .select('id,user_id,persona_type,is_primary,activated_at,metadata,updated_at')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false }),
    db
      .from('user_modules')
      .select('id,user_id,module_code,is_active,activated_at,config,updated_at')
      .eq('user_id', userId)
      .order('module_code', { ascending: true }),
    db
      .from('user_profiles')
      .select('persona_type,active_personas,active_module_codes,workload_tracking_enabled')
      .eq('id', userId)
      .maybeSingle(),
  ])

  const activePersonas = normalisePersonaCodes(
    personas?.length
      ? personas.filter((p) => p.is_primary || p.persona_type).map((p) => p.persona_type)
      : profile?.active_personas ?? (profile?.persona_type ? [profile.persona_type] : [])
  )

  const activeModules = normaliseModuleCodes(
    modules?.length
      ? modules.filter((m) => m.is_active).map((m) => m.module_code)
      : profile?.active_module_codes
  )

  return {
    personas: personas ?? [],
    modules: modules ?? [],
    activePersonas,
    activeModules,
    workloadTrackingEnabled: Boolean(profile?.workload_tracking_enabled),
  }
}

export async function syncProfileCaches(userId: string, personas: PersonaCode[], modules: ModuleCode[]) {
  const db = maybeServiceClient()
  await db
    .from('user_profiles')
    .update({
      active_personas: personas,
      active_module_codes: modules,
      workload_tracking_enabled: personas.includes('ACADEMIC') || modules.includes('FM_CONSULTANT'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

export async function upsertUserModules(userId: string, desiredModules: ModuleCode[]) {
  const db = maybeServiceClient()
  const now = new Date().toISOString()

  await db.from('user_modules').update({ is_active: false, updated_at: now }).eq('user_id', userId)

  for (const moduleCode of desiredModules) {
    await db.from('user_modules').upsert(
      {
        user_id: userId,
        module_code: moduleCode,
        is_active: true,
        activated_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id,module_code' }
    )
  }
}

export async function setUserPersonasAndModules(input: {
  userId: string
  personas: unknown
  primaryPersona?: string | null
  fmConsultant?: boolean
  ribaEnabled?: boolean
}) {
  const db = maybeServiceClient()
  const now = new Date().toISOString()

  const personas = normalisePersonaCodes(input.personas)
  const primaryPersona = (input.primaryPersona?.toUpperCase() ?? personas[0]) as PersonaCode | undefined

  await db.from('user_personas').delete().eq('user_id', input.userId)

  for (const persona of personas) {
    await db.from('user_personas').insert({
      user_id: input.userId,
      persona_type: persona,
      is_primary: primaryPersona === persona,
      activated_at: now,
      metadata:
        persona === 'CONSULTANT'
          ? {
              consultant_variant: input.fmConsultant ? 'FM_CONSULTANT' : 'GENERAL',
              riba_enabled: Boolean(input.ribaEnabled),
            }
          : { riba_enabled: Boolean(input.ribaEnabled) },
      updated_at: now,
    })
  }

  const resolvedModules = resolveModulesForPersonas(personas, {
    fmConsultant: Boolean(input.fmConsultant),
    ribaEnabled: Boolean(input.ribaEnabled),
  })

  await upsertUserModules(input.userId, resolvedModules)
  await syncProfileCaches(input.userId, personas, resolvedModules)

  return {
    personas,
    modules: resolvedModules,
  }
}

export async function setUserModules(input: {
  userId: string
  modules: unknown
}) {
  const modules = normaliseModuleCodes(input.modules)
  await upsertUserModules(input.userId, modules)

  const state = await getProfilePersonaModuleState(input.userId)
  await syncProfileCaches(input.userId, state.activePersonas, modules)

  return {
    personas: state.activePersonas,
    modules,
    workloadTrackingEnabled: state.workloadTrackingEnabled,
  }
}
