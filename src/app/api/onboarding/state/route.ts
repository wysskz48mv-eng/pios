import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPersonaCalibrationConfig } from '@/lib/onboarding/persona-calibration'

export const dynamic = 'force-dynamic'

type SupabaseErrorLike = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

type DbClient = ReturnType<typeof createClient>

const SCHEMA_DRIFT_CODES = new Set(['42P01', '42703'])
const RLS_OR_PERMISSION_CODES = new Set(['42501'])
const ONBOARDING_FEATURE_LAUNCH_DATE = '2026-04-22T14:00:00.000Z'

function clampStep(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(6, Math.max(1, Math.round(n)))
}

function asSupabaseError(error: unknown): SupabaseErrorLike {
  if (!error || typeof error !== 'object') return {}
  const e = error as Record<string, unknown>
  return {
    code: typeof e.code === 'string' ? e.code : undefined,
    message: typeof e.message === 'string' ? e.message : undefined,
    details: typeof e.details === 'string' ? e.details : undefined,
    hint: typeof e.hint === 'string' ? e.hint : undefined,
  }
}

function isSchemaDriftError(error: unknown) {
  const e = asSupabaseError(error)
  return Boolean(e.code && SCHEMA_DRIFT_CODES.has(e.code))
}

function isPermissionError(error: unknown) {
  const e = asSupabaseError(error)
  return Boolean(e.code && RLS_OR_PERMISSION_CODES.has(e.code))
}

function isCreatedBeforeLaunch(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const ts = Date.parse(createdAt)
  if (Number.isNaN(ts)) return false
  return ts < Date.parse(ONBOARDING_FEATURE_LAUNCH_DATE)
}

function logDbError(scope: string, error: unknown, context?: Record<string, unknown>) {
  const e = asSupabaseError(error)
  console.error(scope, {
    code: e.code,
    message: e.message,
    details: e.details,
    hint: e.hint,
    ...(context ?? {}),
  })
}

function readBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

function readStep(value: unknown): number | null {
  if (typeof value === 'number') return clampStep(value)
  const n = Number(value)
  return Number.isFinite(n) ? clampStep(n) : null
}

function maybeServiceClient(): DbClient {
  try {
    return createServiceClient()
  } catch (error) {
    logDbError('[onboarding/state] service client unavailable, falling back to session client', error)
    return createClient()
  }
}

async function queryProfile(admin: DbClient, userId: string) {
  const profileQuery = await admin
    .from('user_profiles')
    .select('id,full_name,job_title,organisation,persona_type,onboarding_complete,onboarding_current_step,onboarded,created_at')
    .eq('id', userId)
    .maybeSingle()

  if (!profileQuery.error) return profileQuery.data as Record<string, unknown> | null

  if (profileQuery.error.code === '42703') {
    const legacyProfileQuery = await admin
      .from('user_profiles')
      .select('id,full_name,job_title,organisation,persona_type,onboarded,created_at')
      .eq('id', userId)
      .maybeSingle()

    if (legacyProfileQuery.error) {
      logDbError('[onboarding/state] GET profile legacy', legacyProfileQuery.error, { userId })
      return null
    }

    return legacyProfileQuery.data as Record<string, unknown> | null
  }

  logDbError('[onboarding/state] GET profile', profileQuery.error, { userId })
  return null
}

async function queryOnboardingState(admin: DbClient, userId: string) {
  const stateQuery = await admin
    .from('onboarding_state')
    .select('user_id,current_step,step_history,persona_selected,calibration_answers,cv_uploaded,cv_analyzed,cv_skipped,onboarding_complete,started_at,completed_at,last_seen_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!stateQuery.error) {
    return {
      data: stateQuery.data as Record<string, unknown> | null,
      readBlocked: false,
      missingTableOrColumn: false,
    }
  }

  if (isSchemaDriftError(stateQuery.error)) {
    console.warn('[onboarding/state] GET onboarding_state unavailable; continuing with profile-only fallback', {
      userId,
      ...asSupabaseError(stateQuery.error),
    })
    return {
      data: null,
      readBlocked: false,
      missingTableOrColumn: true,
    }
  }

  if (isPermissionError(stateQuery.error)) {
    console.error('[onboarding/state] GET onboarding_state blocked by permission/RLS policy', {
      userId,
      ...asSupabaseError(stateQuery.error),
    })
    return {
      data: null,
      readBlocked: true,
      missingTableOrColumn: false,
    }
  }

  logDbError('[onboarding/state] GET state', stateQuery.error, { userId })
  return {
    data: null,
    readBlocked: true,
    missingTableOrColumn: false,
  }
}

async function queryCalibration(admin: DbClient, userId: string) {
  const calibrationQuery = await admin
    .from('nemoclaw_calibration')
    .select('communication_register,coaching_intensity,recommended_frameworks,competency_scores,top_competencies,cv_profile_summary,updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!calibrationQuery.error) return calibrationQuery.data as Record<string, unknown> | null

  if (calibrationQuery.error.code === '42703') {
    const calibrationLegacyQuery = await admin
      .from('nemoclaw_calibration')
      .select('communication_register,coaching_intensity,recommended_frameworks,calibration_summary,updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (calibrationLegacyQuery.error) {
      logDbError('[onboarding/state] GET calibration legacy', calibrationLegacyQuery.error, { userId })
      return null
    }

    return calibrationLegacyQuery.data as Record<string, unknown> | null
  }

  logDbError('[onboarding/state] GET calibration', calibrationQuery.error, { userId })
  return null
}

export async function GET() {
  try {
    const supabase = createClient()
    const admin = maybeServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [profile, stateRead, calibration] = await Promise.all([
      queryProfile(admin, user.id),
      queryOnboardingState(admin, user.id),
      queryCalibration(admin, user.id),
    ])

    const stateRow = stateRead.data
    const isLegacyUser = isCreatedBeforeLaunch(user.created_at)
      || isCreatedBeforeLaunch(typeof profile?.created_at === 'string' ? profile.created_at : null)

    const explicitComplete = Boolean(
      stateRow?.onboarding_complete
      ?? profile?.onboarding_complete
      ?? profile?.onboarded,
    )

    const bypassOnboarding = isLegacyUser || profile?.onboarding_complete == null || stateRead.readBlocked
    const mergedComplete = explicitComplete || bypassOnboarding

    const personaSelected = stateRow?.persona_selected ?? profile?.persona_type ?? null

    const ensuredStep = mergedComplete
      ? 6
      : Math.max(
        clampStep(stateRow?.current_step ?? profile?.onboarding_current_step ?? 1),
        personaSelected ? 2 : 1,
      )

    if (!stateRow && !stateRead.readBlocked && !stateRead.missingTableOrColumn) {
      const upsertResult = await admin.from('onboarding_state').upsert({
        user_id: user.id,
        current_step: ensuredStep,
        persona_selected: personaSelected,
        onboarding_complete: mergedComplete,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (upsertResult.error) {
        logDbError('[onboarding/state] GET auto-create onboarding_state (non-fatal)', upsertResult.error, { userId: user.id })
      }
    }

    const warnings: string[] = []
    if (stateRead.readBlocked) warnings.push('onboarding_state_read_blocked')
    if (stateRead.missingTableOrColumn) warnings.push('onboarding_state_schema_missing')
    if (isLegacyUser && !explicitComplete) warnings.push('legacy_user_bypass_applied')

    const calibrationConfig = getPersonaCalibrationConfig(typeof personaSelected === 'string' ? personaSelected : null)

    return NextResponse.json({
      ok: true,
      warning: warnings.length ? warnings.join(',') : undefined,
      profile: profile ?? null,
      state: {
        ...(stateRow ?? {}),
        current_step: ensuredStep,
        onboarding_complete: mergedComplete,
        persona_selected: personaSelected,
      },
      calibration: calibration ?? null,
      persona_config: calibrationConfig,
    })
  } catch (error) {
    console.error('[onboarding/state] GET', error)
    return NextResponse.json({
      ok: true,
      warning: 'state_read_failed_assumed_complete',
      profile: null,
      state: { current_step: 6, onboarding_complete: true, persona_selected: null },
      calibration: null,
      persona_config: getPersonaCalibrationConfig(null),
    })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = maybeServiceClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const nextStep = clampStep(body.current_step)
    const now = new Date().toISOString()

    const requestedComplete = readBool(body.onboarding_complete)
    const resolvedComplete = requestedComplete ?? false

    const payload: Record<string, unknown> = {
      user_id: user.id,
      current_step: resolvedComplete ? 6 : nextStep,
      last_seen_at: now,
      updated_at: now,
      created_at: now,
    }

    if (typeof body.persona_selected === 'string' && body.persona_selected.trim()) {
      payload.persona_selected = body.persona_selected.trim()
    }
    if (typeof body.cv_uploaded === 'boolean') payload.cv_uploaded = body.cv_uploaded
    if (typeof body.cv_analyzed === 'boolean') payload.cv_analyzed = body.cv_analyzed
    if (typeof body.cv_skipped === 'boolean') payload.cv_skipped = body.cv_skipped
    if (requestedComplete !== null) {
      payload.onboarding_complete = requestedComplete
      payload.completed_at = requestedComplete ? now : null
    }
    if (body.calibration_answers && typeof body.calibration_answers === 'object') {
      payload.calibration_answers = body.calibration_answers
    }

    let stateSaved = false
    const onboardingStateWrite = await admin
      .from('onboarding_state')
      .upsert(payload, { onConflict: 'user_id' })

    if (onboardingStateWrite.error) {
      logDbError('[onboarding/state] PATCH onboarding_state upsert failed', onboardingStateWrite.error, {
        userId: user.id,
        payload,
      })
    } else {
      stateSaved = true
    }

    const desiredStep = requestedComplete ? 6 : (readStep(body.current_step) ?? nextStep)

    const profilePayloadCandidates: Record<string, unknown>[] = [
      {
        updated_at: now,
        onboarded: resolvedComplete,
        onboarding_current_step: desiredStep,
        onboarding_complete: resolvedComplete,
        onboarding_completed_at: resolvedComplete ? now : null,
      },
      {
        updated_at: now,
        onboarded: resolvedComplete,
        onboarding_current_step: desiredStep,
      },
      {
        updated_at: now,
        onboarded: resolvedComplete,
      },
    ]

    let profileSaved = false
    let lastProfileError: unknown = null

    for (const candidate of profilePayloadCandidates) {
      const profileWrite = await admin
        .from('user_profiles')
        .update(candidate)
        .eq('id', user.id)

      if (!profileWrite.error) {
        profileSaved = true
        break
      }

      lastProfileError = profileWrite.error
      logDbError('[onboarding/state] PATCH user_profiles fallback failed', profileWrite.error, {
        userId: user.id,
        candidate,
      })

      if (!isSchemaDriftError(profileWrite.error)) {
        break
      }
    }

    if (!stateSaved && !profileSaved) {
      console.warn('[onboarding/state] PATCH persistence unavailable; returning non-blocking success', {
        userId: user.id,
        onboardingStateError: asSupabaseError(onboardingStateWrite.error),
        userProfileError: asSupabaseError(lastProfileError),
      })

      return NextResponse.json({
        ok: true,
        persisted: false,
        warning: 'state_persistence_degraded',
      })
    }

    return NextResponse.json({
      ok: true,
      persisted: stateSaved || profileSaved,
      saved_to: {
        onboarding_state: stateSaved,
        user_profiles: profileSaved,
      },
    })
  } catch (error) {
    console.error('[onboarding/state] PATCH unexpected error; returning non-blocking success', error)
    return NextResponse.json({
      ok: true,
      persisted: false,
      warning: 'state_persistence_failed_unexpectedly',
    })
  }
}
