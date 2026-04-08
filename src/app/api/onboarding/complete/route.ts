import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

    const body = await req.json()
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

    const requestedPersona = typeof persona_type === 'string' ? persona_type : persona
    if (!requestedPersona) return NextResponse.json({ error: 'Persona required' }, { status: 400 })

    const admin = createServiceClient()

    const personaMap: Record<string, string> = {
      starter: 'academic', pro: 'consultant', enterprise: 'executive',
      founder: 'executive', consultant: 'consultant', executive: 'executive',
      academic: 'academic', professional: 'consultant', other: 'executive',
    }
    const normalizedPersona = personaMap[requestedPersona] ?? 'executive'
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
      persona_type:    normalizedPersona,
      onboarded:       true,
      onboarding_step: 9,
      onboarding_completed_at: now,
      deployment_mode: deploy_mode ?? 'full',
      active_modules:  Array.isArray(active_modules) ? active_modules : [],
      it_policy_acknowledged: deploy_mode === 'standalone',
      command_centre_theme:   normalizedTheme,
      email_triage_consent:   triageConsent,
      ...(typeof job_title === 'string'       && job_title.trim()       ? { job_title:       job_title.trim()       } : {}),
      ...(typeof organisation === 'string'    && organisation.trim()    ? { organisation:    organisation.trim()    } : {}),
      ...(typeof cv_filename === 'string'     && cv_filename.trim()     ? { cv_filename:     cv_filename.trim(),
                                                                            cv_processing_status: 'pending',
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

    const { data: existingProfile } = await admin
      .from('user_profiles').select('id').eq('id', user.id).maybeSingle()

    const profileWrite = existingProfile
      ? await admin.from('user_profiles').update(profilePayload).eq('id', user.id).select('id,onboarded').single()
      : await admin.from('user_profiles').insert(profilePayload).select('id,onboarded').single()

    const { data: profileRow, error: profileErr } = profileWrite
    if (profileErr || !profileRow?.onboarded) {
      console.error('[onboarding] profile update error:', {
        code: profileErr?.code, message: profileErr?.message,
        details: profileErr?.details, hint: profileErr?.hint,
      })
      return NextResponse.json({ error: 'Could not save onboarding state. Please try again.' }, { status: 500 })
    }

    // ── All operations below are NON-FATAL ──────────────────────────

    // exec_intelligence_config
    try {
      await admin.from('exec_intelligence_config').upsert(
        { user_id: user.id, persona: normalizedPersona, updated_at: now },
        { onConflict: 'user_id' }
      )
    } catch (e) { console.error('[onboarding] exec_intelligence_config (non-fatal):', e) }

    // Consent records
    try {
      const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null
      const ua = req.headers.get('user-agent') ?? null
      for (const consent_type of ['terms_of_service','privacy_policy','ai_processing']) {
        await admin.from('consent_records').insert({
          user_id: user.id, consent_type, version: '1.0',
          granted: true, granted_at: now, ip_address: ip, user_agent: ua,
        }).then(() => {}).catch(() => {})
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

    // Welcome email
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const personaLabels: Record<string,string> = {
          founder:'Founder / CEO', consultant:'Consultant', executive:'Executive',
          academic:'Academic', professional:'Professional', other:'Professional',
        }
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
              <p style="color:#666;line-height:1.6;margin:0 0 20px">NemoClaw™ has been calibrated for your ${personaLabels[requestedPersona] ?? 'Professional'} profile.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios-coral.vercel.app'}/platform/dashboard"
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
      ok: true, persona: normalizedPersona,
      modules: Array.isArray(active_modules) ? active_modules.length : 0,
      deploy: deploy_mode, theme: normalizedTheme,
    })

  } catch (err) {
    console.error('[onboarding/complete]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
