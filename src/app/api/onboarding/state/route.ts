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
  return e.code === '42P01' || e.code === '42703'
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

export async function GET() {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let profile: Record<string, unknown> | null = null
    {
      const profileQuery = await admin
        .from('user_profiles')
        .select('id,full_name,job_title,organisation,persona_type,onboarding_complete,onboarding_current_step,onboarded')
        .eq('id', user.id)
        .maybeSingle()

      if (profileQuery.error?.code === '42703') {
        const legacyProfileQuery = await admin
          .from('user_profiles')
          .select('id,full_name,job_title,organisation,persona_type,onboarded')
          .eq('id', user.id)
          .maybeSingle()

        if (legacyProfileQuery.error) {
          logDbError('[onboarding/state] GET profile legacy', legacyProfileQuery.error, { userId: user.id })
          return NextResponse.json({ error: 'Could not load onboarding state' }, { status: 500 })
        }

        profile = legacyProfileQuery.data as Record<string, unknown> | null
      } else if (profileQuery.error) {
        logDbError('[onboarding/state] GET profile', profileQuery.error, { userId: user.id })
        return NextResponse.json({ error: 'Could not load onboarding state' }, { status: 500 })
      } else {
        profile = profileQuery.data as Record<string, unknown> | null
      }
    }

    let stateRow: Record<string, unknown> | null = null
    {
      const stateQuery = await admin
        .from('onboarding_state')
        .select('user_id,current_step,step_history,persona_selected,calibration_answers,cv_uploaded,cv_analyzed,cv_skipped,onboarding_complete,started_at,completed_at,last_seen_at,updated_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (stateQuery.error && stateQuery.error.code !== '42P01') {
        logDbError('[onboarding/state] GET state', stateQuery.error, { userId: user.id })
        return NextResponse.json({ error: 'Could not load onboarding state' }, { status: 500 })
      }

      if (stateQuery.error?.code === '42P01') {
        console.warn('[onboarding/state] GET onboarding_state table missing; using profile fallback', { userId: user.id })
      } else {
        stateRow = stateQuery.data as Record<string, unknown> | null
      }
    }

    let calibration: Record<string, unknown> | null = null
    {
      const calibrationQuery = await admin
        .from('nemoclaw_calibration')
        .select('communication_register,coaching_intensity,recommended_frameworks,competency_scores,top_competencies,cv_profile_summary,updated_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (calibrationQuery.error?.code === '42703') {
        const calibrationLegacyQuery = await admin
          .from('nemoclaw_calibration')
          .select('communication_register,coaching_intensity,recommended_frameworks,calibration_summary,updated_at')
          .eq('user_id', user.id)
          .maybeSingle()

        if (calibrationLegacyQuery.error) {
          logDbError('[onboarding/state] GET calibration legacy', calibrationLegacyQuery.error, { userId: user.id })
        } else {
          calibration = calibrationLegacyQuery.data as Record<string, unknown> | null
        }
      } else if (calibrationQuery.error) {
        logDbError('[onboarding/state] GET calibration', calibrationQuery.error, { userId: user.id })
      } else {
        calibration = calibrationQuery.data as Record<string, unknown> | null
      }
    }

    const mergedComplete = Boolean(
      stateRow?.onboarding_complete
      ?? profile?.onboarding_complete
      ?? profile?.onboarded
    )
    const personaSelected = stateRow?.persona_selected ?? profile?.persona_type ?? null

    const ensuredStep = mergedComplete
      ? 6
      : Math.max(clampStep(stateRow?.current_step ?? profile?.onboarding_current_step ?? 1), personaSelected ? 2 : 1)

    if (!stateRow) {
      const upsertResult = await admin.from('onboarding_state').upsert({
        user_id: user.id,
        current_step: ensuredStep,
        persona_selected: personaSelected,
        onboarding_complete: mergedComplete,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (upsertResult.error && upsertResult.error.code !== '42P01') {
        logDbError('[onboarding/state] GET auto-create onboarding_state', upsertResult.error, { userId: user.id })
      }
    } else {
      const updateResult = await admin.from('onboarding_state').update({
        current_step: ensuredStep,
        onboarding_complete: mergedComplete,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      if (updateResult.error) {
        logDbError('[onboarding/state] GET sync onboarding_state', updateResult.error, { userId: user.id })
      }
    }

    const calibrationConfig = getPersonaCalibrationConfig(
      typeof personaSelected === 'string' ? personaSelected : null,
    )

    return NextResponse.json({
      ok: true,
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
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const nextStep = clampStep(body.current_step)
    const now = new Date().toISOString()

    const payload: Record<string, unknown> = {
      user_id: user.id,
      current_step: nextStep,
      last_seen_at: now,
      updated_at: now,
      created_at: now,
    }

    if (typeof body.persona_selected === 'string' && body.persona_selected.trim()) payload.persona_selected = body.persona_selected.trim()
    if (typeof body.cv_uploaded === 'boolean') payload.cv_uploaded = body.cv_uploaded
    if (typeof body.cv_analyzed === 'boolean') payload.cv_analyzed = body.cv_analyzed
    if (typeof body.cv_skipped === 'boolean') payload.cv_skipped = body.cv_skipped
    if (typeof body.onboarding_complete === 'boolean') {
      payload.onboarding_complete = body.onboarding_complete
      payload.completed_at = body.onboarding_complete ? now : null
      payload.current_step = body.onboarding_complete ? 6 : nextStep
    }

    if (body.calibration_answers && typeof body.calibration_answers === 'object') {
      payload.calibration_answers = body.calibration_answers
    }

    const upsertResult = await admin
      .from('onboarding_state')
      .upsert(payload, { onConflict: 'user_id' })

    if (!upsertResult.error) {
      return NextResponse.json({ ok: true })
    }

    if (!isSchemaDriftError(upsertResult.error)) {
      logDbError('[onboarding/state] PATCH upsert', upsertResult.error, { userId: user.id, payload })
      return NextResponse.json({ error: 'Could not save onboarding state' }, { status: 500 })
    }

    console.warn('[onboarding/state] PATCH onboarding_state unavailable, falling back to user_profiles', {
      userId: user.id,
      code: upsertResult.error.code,
      message: upsertResult.error.message,
    })

    const fallbackPayload: Record<string, unknown> = {
      updated_at: now,
      onboarded: Boolean(body.onboarding_complete),
      onboarding_current_step: body.onboarding_complete ? 6 : nextStep,
      onboarding_complete: Boolean(body.onboarding_complete),
      onboarding_completed_at: body.onboarding_complete ? now : null,
    }

    let fallbackResult = await admin
      .from('user_profiles')
      .update(fallbackPayload)
      .eq('id', user.id)

    if (fallbackResult.error?.code === '42703') {
      fallbackResult = await admin
        .from('user_profiles')
        .update({
          updated_at: now,
          onboarded: Boolean(body.onboarding_complete),
        })
        .eq('id', user.id)
    }

    if (fallbackResult.error) {
      logDbError('[onboarding/state] PATCH fallback user_profiles', fallbackResult.error, { userId: user.id })
      return NextResponse.json({ error: 'Could not save onboarding state' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, warning: 'onboarding_state_table_unavailable' })
  } catch (error) {
    console.error('[onboarding/state] PATCH', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
