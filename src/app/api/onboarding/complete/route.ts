import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPersonaPackaging, toCanonicalPersona } from '@/lib/persona-packaging'

function maybeServiceClient() {
  try {
    return createServiceClient()
  } catch (error) {
    console.error('[onboarding/complete] service client unavailable, falling back to session client', error)
    return createClient()
  }
}

function logSupabaseError(operation: string, error: unknown, extra?: Record<string, unknown>) {
  const e = (error ?? {}) as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }

  console.error('[onboarding/complete] operation failed', {
    operation,
    code: e.code,
    message: e.message,
    details: e.details,
    hint: e.hint,
    ...(extra ?? {}),
  })
}

async function tryWriteProfile(
  client: any,
  userId: string,
  payload: Record<string, unknown>,
  whereColumn: 'id' | 'user_id',
  shouldInsertIfMissing: boolean,
) {
  const query = client.from('user_profiles')

  const existing = await query.select('id,onboarded').eq(whereColumn, userId).maybeSingle()

  if (existing.error) {
    return { data: null, error: existing.error, mode: 'read_existing' as const }
  }

  if (existing.data) {
    const updated = await query
      .update(payload)
      .eq(whereColumn, userId)
      .select('id,onboarded')
      .single()

    return { ...updated, mode: 'update' as const }
  }

  if (!shouldInsertIfMissing) {
    return {
      data: null,
      error: {
        code: 'NO_PROFILE_ROW',
        message: `No user_profiles row found via ${whereColumn}`,
      },
      mode: 'missing' as const,
    }
  }

  const insertPayload = whereColumn === 'id'
    ? { ...payload, id: userId }
    : { ...payload, user_id: userId }

  const inserted = await query
    .insert(insertPayload)
    .select('id,onboarded')
    .single()

  return { ...inserted, mode: 'insert' as const }
}

/**
 * POST /api/onboarding/complete
 * VeritasIQ Technologies Ltd · PIOS
 */

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const {
      persona,
      persona_type,
      deploy_mode,
      active_modules,
      integrations,
      goals,
      email_triage_consent,
      command_centre_theme,
      full_name,
      job_title,
      organisation,
      cv_filename,
      cv_storage_path,
    } = body

    const admin = maybeServiceClient()

    const { data: existingPersonaProfile } = await admin
      .from('user_profiles')
      .select('persona_type')
      .eq('id', user.id)
      .maybeSingle()

    const requestedPersona =
      (typeof persona_type === 'string' ? persona_type : undefined)
      ?? (typeof persona === 'string' ? persona : undefined)
      ?? existingPersonaProfile?.persona_type

    const canonicalPersona = toCanonicalPersona(requestedPersona)
    if (!canonicalPersona) {
      return NextResponse.json({
        error: 'Persona required. Valid values: CEO, CONSULTANT, ACADEMIC, EXECUTIVE.',
      }, { status: 400 })
    }
    const personaPackaging = getPersonaPackaging(canonicalPersona)

    let personaDefaultModules = personaPackaging.fallbackFrameworkCodes
    try {
      const { data: personaConfig } = await admin
        .from('persona_configs')
        .select('framework_priority_ids')
        .eq('code', personaPackaging.configCode)
        .maybeSingle()

      if (Array.isArray(personaConfig?.framework_priority_ids) && personaConfig.framework_priority_ids.length > 0) {
        personaDefaultModules = personaConfig.framework_priority_ids.filter((item): item is string => typeof item === 'string')
      }
    } catch (e) {
      console.error('[onboarding] persona_configs fetch failed, using fallback modules:', e)
    }

    const incomingModules = Array.isArray(active_modules)
      ? active_modules.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 44)
      : []
    const resolvedModules = incomingModules.length > 0 ? incomingModules : personaDefaultModules
    const triageConsent = typeof email_triage_consent === 'boolean'
      ? email_triage_consent
      : typeof integrations?.email_triage === 'boolean'
      ? integrations.email_triage : true
    const now = new Date().toISOString()
    const fallbackFullName = user.user_metadata?.full_name
      ?? user.user_metadata?.name
      ?? user.email?.split('@')[0]
      ?? 'PIOS User'
    const normalizedGoals = typeof goals === 'string' ? goals.trim() : ''
    const normalizedTheme = ['onyx','meridian','signal'].includes(command_centre_theme)
      ? command_centre_theme : 'onyx'

    const profilePayload = {
      id:              user.id,
      full_name:       typeof full_name === 'string' && full_name.trim() ? full_name.trim() : fallbackFullName,
      plan:            'free',
      persona_type:    canonicalPersona,
      onboarded:       true,
      onboarding_complete: true,
      onboarding_current_step: 6,
      onboarding_completed_at: now,
      deployment_mode: deploy_mode ?? 'full',
      active_modules:  resolvedModules,
      it_policy_acknowledged: deploy_mode === 'standalone',
      command_centre_theme:   normalizedTheme,
      email_triage_consent:   triageConsent,
      ...(typeof job_title === 'string'       && job_title.trim()       ? { job_title:       job_title.trim()       } : {}),
      ...(typeof organisation === 'string'    && organisation.trim()    ? { organisation:    organisation.trim()    } : {}),
      ...(typeof cv_filename === 'string'     && cv_filename.trim()     ? { cv_filename:     cv_filename.trim(),
                                                                            cv_processing_status: 'processing',
                                                                            cv_uploaded_at:       now } : {}),
      ...(typeof cv_storage_path === 'string' && cv_storage_path.trim() ? { cv_storage_path: cv_storage_path.trim() } : {}),
      updated_at: now,
      created_at: now,
    }

    // Bootstrap profile row if missing
    try {
      await admin.rpc('bootstrap_user_profile', {
        p_user_id: user.id,
        p_email: user.email ?? null,
        p_raw_user_meta_data: user.user_metadata ?? {},
      })
    } catch (e) {
      console.error('[onboarding] bootstrap error (non-fatal):', e)
    }

    const legacyPayload: Record<string, unknown> = {
      ...profilePayload,
      onboarded: true,
    }
    delete legacyPayload.onboarding_complete
    delete legacyPayload.onboarding_current_step
    delete legacyPayload.onboarding_completed_at

    const minimalCompletionPayload: Record<string, unknown> = {
      onboarded: true,
      onboarding_complete: true,
      onboarding_current_step: 6,
      onboarding_completed_at: now,
      updated_at: now,
    }

    const profileWriteAttempts: Array<{
      name: string
      where: 'id' | 'user_id'
      payload: Record<string, unknown>
      shouldInsertIfMissing: boolean
    }> = [
      { name: 'primary_full_id', where: 'id', payload: profilePayload as Record<string, unknown>, shouldInsertIfMissing: true },
      { name: 'legacy_schema_id', where: 'id', payload: legacyPayload, shouldInsertIfMissing: true },
      { name: 'minimal_completion_id', where: 'id', payload: minimalCompletionPayload, shouldInsertIfMissing: false },
      { name: 'primary_full_user_id', where: 'user_id', payload: profilePayload as Record<string, unknown>, shouldInsertIfMissing: true },
      { name: 'legacy_schema_user_id', where: 'user_id', payload: legacyPayload, shouldInsertIfMissing: true },
      { name: 'minimal_completion_user_id', where: 'user_id', payload: minimalCompletionPayload, shouldInsertIfMissing: false },
    ]

    let profileRow: { id?: string; onboarded?: boolean } | null = null
    let profileErr: any = null

    for (const attempt of profileWriteAttempts) {
      const attemptResult = await tryWriteProfile(
        admin,
        user.id,
        attempt.payload,
        attempt.where,
        attempt.shouldInsertIfMissing,
      )

      if (!attemptResult.error && attemptResult.data?.onboarded) {
        profileRow = attemptResult.data
        profileErr = null
        console.info('[onboarding/complete] profile completion write succeeded', {
          attempt: attempt.name,
          mode: attemptResult.mode,
          userId: user.id,
        })
        break
      }

      profileErr = attemptResult.error
      logSupabaseError('profile_write_attempt_failed', attemptResult.error, {
        attempt: attempt.name,
        mode: attemptResult.mode,
        where: attempt.where,
        userId: user.id,
      })
    }

    const profilePersisted = Boolean(profileRow?.onboarded)
    if (!profilePersisted) {
      logSupabaseError('profile_write_exhausted_all_attempts', profileErr, { userId: user.id })
    }

    const secondaryPersona = canonicalPersona === 'CEO' ? 'CHIEF_OF_STAFF' : null

    try {
      await admin.from('user_personas').upsert({
        user_id: user.id,
        primary_persona: canonicalPersona,
        secondary_persona: secondaryPersona,
        tier: 'standard',
        updated_at: now,
        created_at: now,
      }, { onConflict: 'user_id' })
    } catch (e) {
      console.error('[onboarding] user_personas upsert (non-fatal):', e)
    }

    try {
      const completedSteps = {
        profile: Boolean(profilePayload.full_name && profilePayload.organisation),
        nemoclaw: Boolean(profilePayload.cv_storage_path) || profilePayload.cv_processing_status === 'complete' || profilePayload.cv_processing_status === 'completed',
        google_oauth: Boolean(user.email),
      }
      const completedCount = Object.values(completedSteps).filter(Boolean).length

      await admin.from('onboarding_progress').upsert({
        user_id: user.id,
        completed_steps: completedSteps,
        readiness_pct: Math.round((completedCount / 3) * 100),
        updated_at: now,
        created_at: now,
      }, { onConflict: 'user_id' })
    } catch (e) {
      console.error('[onboarding] onboarding_progress upsert (non-fatal):', e)
    }

    if (typeof profilePayload.cv_storage_path === 'string' && profilePayload.cv_storage_path.trim()) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY

      if (supabaseUrl && serviceKey) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/cv-ingestion-pipeline`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: user.id,
              cv_storage_path: profilePayload.cv_storage_path,
              cv_filename: profilePayload.cv_filename ?? null,
              persona_code: canonicalPersona,
            }),
          })

          if (!res.ok) {
            const detail = await res.text().catch(() => '')
            console.error('[onboarding] cv-ingestion-pipeline non-fatal:', detail || res.statusText)
          }
        } catch (e) {
          console.error('[onboarding] cv-ingestion-pipeline trigger failed (non-fatal):', e)
        }
      }
    }

    // ── All operations below are NON-FATAL ──────────────────────────

    // exec_intelligence_config
    try {
      await admin.from('exec_intelligence_config').upsert(
        { user_id: user.id, persona: canonicalPersona, updated_at: now },
        { onConflict: 'user_id' }
      )
    } catch (e) { console.error('[onboarding] exec_intelligence_config (non-fatal):', e) }

    // Consent records
    try {
      const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null
      const ua = req.headers.get('user-agent') ?? null
      for (const consent_type of ['terms_of_service','privacy_policy','ai_processing']) {
        const { error: ce } = await admin.from('consent_records').insert({
          user_id: user.id, consent_type, version: '1.0',
          granted: true, granted_at: now, ip_address: ip, user_agent: ua,
        })
        if (ce) console.error('[onboarding] consent insert:', ce.message)
      }
    } catch (e) { console.error('[onboarding] consent_records (non-fatal):', e) }

    // Goals → knowledge_entries
    try {
      if (normalizedGoals) {
        await admin.from('knowledge_entries').delete()
          .eq('user_id', user.id).eq('category', 'goals').eq('source', 'onboarding')
        await admin.from('knowledge_entries').insert({
          user_id: user.id, title: '90-day onboarding goals',
          content: normalizedGoals, category: 'goals', source: 'onboarding',
          tags: ['onboarding','goals'], created_at: now, updated_at: now,
        })
      }
    } catch (e) { console.error('[onboarding] knowledge_entries (non-fatal):', e) }

    // Seed intelligence defaults
    try {
      await admin.rpc('fn_seed_intelligence_defaults', { p_user_id: user.id })
    } catch (e) { console.error('[onboarding] fn_seed_intelligence_defaults (non-fatal):', e) }

    // Email triage
    try {
      await admin.from('connected_email_accounts')
        .update({ ai_triage_enabled: triageConsent, updated_at: now })
        .eq('user_id', user.id).eq('is_active', true)
    } catch (e) { console.error('[onboarding] connected_email_accounts (non-fatal):', e) }

    // Clean up draft
    try {
      await admin.from('onboarding_drafts').delete().eq('user_id', user.id)
    } catch (e) { console.error('[onboarding] onboarding_drafts delete (non-fatal):', e) }

    // Final onboarding state
    try {
      await admin.from('onboarding_state').upsert({
        user_id: user.id,
        persona_selected: canonicalPersona,
        current_step: 6,
        onboarding_complete: true,
        completed_at: now,
        last_seen_at: now,
        updated_at: now,
        created_at: now,
      }, { onConflict: 'user_id' })
    } catch (e) { console.error('[onboarding] onboarding_state upsert (non-fatal):', e) }

    // First-time NemoClaw welcome seed
    try {
      const welcomeText = `Welcome to PIOS. I am NemoClaw™, now calibrated for your ${canonicalPersona} operating context.\n\nI am ready to support strategic clarity, execution momentum, and intelligent decisions from your command centre.`

      const { data: existingSession } = await admin
        .from('ai_sessions')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const sessionId = existingSession?.id
        ? existingSession.id
        : (
          await admin
            .from('ai_sessions')
            .insert({
              user_id: user.id,
              title: 'Welcome to NemoClaw™',
              domain_mode: 'general',
              domain: 'general',
              message_count: 0,
              last_message_at: now,
              updated_at: now,
            })
            .select('id')
            .single()
        ).data?.id

      if (sessionId) {
        const { data: existingWelcome } = await admin
          .from('ai_messages')
          .select('id')
          .eq('session_id', sessionId)
          .eq('role', 'assistant')
          .ilike('content', 'Welcome to PIOS.%')
          .limit(1)
          .maybeSingle()

        if (!existingWelcome?.id) {
          await admin.from('ai_messages').insert({
            session_id: sessionId,
            user_id: user.id,
            role: 'assistant',
            content: welcomeText,
            metadata: { source: 'onboarding' },
          })

          await admin.from('ai_sessions').update({
            message_count: 1,
            last_message_at: now,
            updated_at: now,
          }).eq('id', sessionId)
        }
      }
    } catch (e) { console.error('[onboarding] ai welcome seed (non-fatal):', e) }

    // Welcome email
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const personaLabels: Record<string,string> = {
          founder:'Founder / CEO', consultant:'Consultant', executive:'Executive',
          academic:'Academic', professional:'Professional', other:'Professional',
          ceo:'CEO / Founder', pro:'Consultant / Advisor', starter:'Academic / Researcher',
        }
        const requestedPersonaKey = String(requestedPersona).trim().toLowerCase()
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL ?? 'PIOS <noreply@veritasiq.io>',
            to: user.email,
            subject: 'Your NemoClaw™ Command Centre is live',
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
              <div style="font-size:20px;font-weight:400;margin-bottom:24px">PIOS</div>
              <h1 style="font-size:22px;font-weight:500;margin:0 0 12px">Your Command Centre is ready.</h1>
              <p style="color:#666;line-height:1.6;margin:0 0 20px">NemoClaw™ has been calibrated for your ${personaLabels[requestedPersonaKey] ?? 'Professional'} profile.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios-wysskz48mv-engs-projects.vercel.app'}/platform/dashboard"
                 style="display:inline-block;padding:12px 24px;background:#7F77DD;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">
                Open Command Centre →
              </a>
              <p style="margin-top:32px;font-size:12px;color:#999">VeritasIQ Technologies Ltd · info@veritasiq.io</p>
            </div>`,
          }),
        })
      } catch (e) { console.error('[onboarding] welcome email (non-fatal):', e) }
    }

    return NextResponse.json({
      ok: true,
      persisted: profilePersisted,
      warning: profilePersisted ? null : 'profile_update_failed_degraded_success',
      persona: canonicalPersona,
      modules: resolvedModules.length,
      deploy: deploy_mode,
      theme: normalizedTheme,
    })

  } catch (err) {
    console.error('[onboarding/complete]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
