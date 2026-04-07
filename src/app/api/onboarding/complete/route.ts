import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * POST /api/onboarding/complete
 * Saves persona selection, active modules, and deployment mode.
 * Marks user as onboarded. Triggers welcome email.
 *
 * Body:
 *   persona:        'founder' | 'consultant' | 'executive' | 'academic' | 'other'
 *   deploy_mode:    'full' | 'hybrid' | 'standalone'
 *   active_modules: string[]
 *   integrations:   Record<string, boolean>
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K
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
    } = body

    const requestedPersona = typeof persona_type === 'string' ? persona_type : persona

    if (!requestedPersona) return NextResponse.json({ error: 'Persona required' }, { status: 400 })

    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Map persona to persona_type for user_profiles
    const personaMap: Record<string, string> = {
      starter:    'academic',
      pro:        'consultant',
      enterprise: 'executive',
      founder:    'executive',   // Founder uses executive persona in NemoClaw
      consultant: 'consultant',
      executive:  'executive',
      academic:   'academic',
      professional: 'consultant',
      other:      'executive',
    }

    const normalizedPersona = personaMap[requestedPersona] ?? 'executive'
    const triageConsent = typeof email_triage_consent === 'boolean'
      ? email_triage_consent
      : typeof integrations?.email_triage === 'boolean'
      ? integrations.email_triage
      : true
    const now = new Date().toISOString()
    const fallbackFullName = user.user_metadata?.full_name
      ?? user.user_metadata?.name
      ?? user.email?.split('@')[0]
      ?? 'PIOS User'
    const normalizedGoals = typeof goals === 'string' ? goals.trim() : ''
    const normalizedTheme = command_centre_theme === 'onyx' || command_centre_theme === 'meridian' || command_centre_theme === 'signal'
      ? command_centre_theme
      : 'onyx'

    // Persist the onboarding milestone atomically so users do not get trapped in redirect loops.
    const { data: profileRow, error: profileErr } = await admin
      .from('user_profiles')
      .upsert({
        id:              user.id,
        full_name:       typeof full_name === 'string' && full_name.trim() ? full_name.trim() : fallbackFullName,
        plan:            'free',
        persona_type:    normalizedPersona,
        onboarded:       true,
        deployment_mode: deploy_mode ?? 'full',
        active_modules:  Array.isArray(active_modules) ? active_modules : [],
        it_policy_acknowledged: deploy_mode === 'standalone',
        command_centre_theme: normalizedTheme,
        ...(typeof job_title === 'string' && job_title.trim() ? { job_title: job_title.trim() } : {}),
        ...(typeof organisation === 'string' && organisation.trim() ? { organisation: organisation.trim() } : {}),
        ...(typeof cv_filename === 'string' && cv_filename.trim() ? { cv_filename: cv_filename.trim() } : {}),
        updated_at:      now,
        created_at:      now,
      })
      .select('id, onboarded')
      .single()

    if (profileErr || !profileRow?.onboarded) {
      console.error('[onboarding] profile update error:', profileErr)
      return NextResponse.json({ error: 'Could not save onboarding state. Please try again.' }, { status: 500 })
    }

    // Update exec_intelligence_config with persona context
    await admin
      .from('exec_intelligence_config')
      .upsert({
        user_id:    user.id,
        persona:    normalizedPersona,
        updated_at: now,
      }, { onConflict: 'user_id' })

    if (normalizedGoals) {
      await admin
        .from('knowledge_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('category', 'goals')
        .eq('source', 'onboarding')

      await admin
        .from('knowledge_entries')
        .insert({
          user_id:    user.id,
          title:      '90-day onboarding goals',
          content:    normalizedGoals,
          category:   'goals',
          source:     'onboarding',
          tags:       ['onboarding', 'goals'],
          created_at: now,
          updated_at: now,
        })
    }

    await admin
      .from('connected_email_accounts')
      .update({
        ai_triage_enabled: triageConsent,
        updated_at: now,
      })
      .eq('user_id', user.id)
      .eq('is_active', true)

    await admin
      .from('onboarding_drafts')
      .delete()
      .eq('user_id', user.id)

    // Send welcome email via RESEND if configured
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const personaLabels: Record<string, string> = {
          starter:    'Student',
          pro:        'Professional',
          enterprise: 'Enterprise Leader',
          founder:    'Founder / CEO',
          consultant: 'Consultant',
          executive:  'Executive',
          academic:   'Academic',
          professional: 'Professional',
          other:      'Professional',
        }
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:    process.env.RESEND_FROM_EMAIL ?? 'PIOS <noreply@veritasiq.io>',
            to:      user.email,
            subject: 'Your NemoClaw™ Command Centre is live',
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
                <div style="font-size:20px;font-weight:400;margin-bottom:24px">PIOS</div>
                <h1 style="font-size:22px;font-weight:500;margin:0 0 12px">Your Command Centre is ready.</h1>
                <p style="color:#666;line-height:1.6;margin:0 0 20px">
                  NemoClaw™ has been calibrated for your ${personaLabels[requestedPersona] ?? personaLabels[normalizedPersona] ?? 'Professional'} profile.
                  Your first morning brief will arrive tomorrow at 07:00.
                </p>
                <div style="background:#f5f4fe;border-radius:10px;padding:16px 20px;margin-bottom:24px">
                  <div style="font-size:13px;font-weight:500;color:#7F77DD;margin-bottom:10px">Active today</div>
                  <div style="font-size:13px;color:#666;line-height:1.8">
                    ✓ ${active_modules?.length ?? 0} modules activated<br>
                    ✓ NemoClaw™ intelligence layer active<br>
                    ✓ Morning brief scheduled — 07:00 daily
                  </div>
                </div>
                <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios-wysskz48mv-engs-projects.vercel.app'}/platform/dashboard"
                   style="display:inline-block;padding:12px 24px;background:#7F77DD;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">
                  Open Command Centre →
                </a>
                <p style="margin-top:32px;font-size:12px;color:#999">
                  VeritasIQ Technologies Ltd · info@veritasiq.io
                </p>
              </div>
            `,
          }),
        })
      } catch (emailErr) {
        console.error('[onboarding] welcome email failed:', emailErr)
        // Non-fatal
      }
    }

    return NextResponse.json({
      ok:      true,
      persona: normalizedPersona,
      modules: Array.isArray(active_modules) ? active_modules.length : 0,
      deploy:  deploy_mode,
      theme:   normalizedTheme,
    })

  } catch (err) {
    console.error('[onboarding/complete]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
