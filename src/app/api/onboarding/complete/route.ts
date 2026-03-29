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
    const { persona, deploy_mode, active_modules, integrations } = body

    if (!persona) return NextResponse.json({ error: 'Persona required' }, { status: 400 })

    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Map persona to persona_type for user_profiles
    const personaMap: Record<string, string> = {
      founder:    'executive',   // Founder uses executive persona in NemoClaw
      consultant: 'consultant',
      executive:  'executive',
      academic:   'academic',
      other:      'executive',
    }

    // Update user_profiles
    const { error: profileErr } = await admin
      .from('user_profiles')
      .update({
        persona_type:    personaMap[persona] ?? 'executive',
        onboarded:       true,
        deployment_mode: deploy_mode ?? 'full',
        active_modules:  active_modules ?? [],
        it_policy_acknowledged: deploy_mode === 'standalone',
        updated_at:      new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (profileErr) {
      console.error('[onboarding] profile update error:', profileErr)
      // Non-fatal — continue
    }

    // Update exec_intelligence_config with persona context
    await admin
      .from('exec_intelligence_config')
      .upsert({
        user_id:    user.id,
        persona:    personaMap[persona] ?? 'executive',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    // Send welcome email via RESEND if configured
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const personaLabels: Record<string, string> = {
          founder:    'Founder / CEO',
          consultant: 'Consultant',
          executive:  'Executive',
          academic:   'Academic',
          other:      'Professional',
        }
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:    'PIOS <noreply@veritasiq.io>',
            to:      user.email,
            subject: 'Your NemoClaw™ Command Centre is live',
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
                <div style="font-size:20px;font-weight:400;margin-bottom:24px">PIOS</div>
                <h1 style="font-size:22px;font-weight:500;margin:0 0 12px">Your Command Centre is ready.</h1>
                <p style="color:#666;line-height:1.6;margin:0 0 20px">
                  NemoClaw™ has been calibrated for your ${personaLabels[persona] ?? 'Professional'} profile.
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
      persona,
      modules: active_modules?.length ?? 0,
      deploy:  deploy_mode,
    })

  } catch (err) {
    console.error('[onboarding/complete]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
