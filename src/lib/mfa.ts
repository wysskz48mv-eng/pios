/**
 * PIOS MFA enforcement — Supabase AAL2 session check
 * ISO 27001 A.9.4 — Access control; MFA for privileged routes
 * PIOS v2.4.2 | Sprint 56 | VeritasIQ Technologies Ltd
 *
 * Usage:
 *   const mfaError = await requireMFA(supabase)
 *   if (mfaError) return mfaError
 */
import { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Checks that the current session has AAL2 assurance (MFA verified).
 * Returns a 403 NextResponse if not, null if ok.
 *
 * Supabase native TOTP: users enrol at /platform/settings?tab=security
 * Once enrolled, all sessions start at AAL1. On /api/auth/mfa/verify
 * the session is elevated to AAL2.
 *
 * IMPORTANT: On PIOS, MFA is not yet enforced at session creation
 * (users may not have enrolled). This guard applies only to admin
 * routes. Regular user routes rely on Supabase RLS row-level isolation.
 *
 * Enforcement tiers:
 *   - Admin routes (/api/admin/*):    require AAL2 if MFA enrolled
 *   - Migration routes:               require AAL2 if MFA enrolled
 *   - Standard routes:                AAL1 sufficient (RLS handles data isolation)
 */
export async function requireMFA(
  supabase: SupabaseClient,
  strict = false   // strict=true: fail if MFA not enrolled at all
): Promise<NextResponse | null> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: levelData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!levelData) return null // MFA check unavailable — allow through

    const { currentLevel, nextLevel } = levelData

    // If MFA is enrolled (nextLevel is aal2) but session is only aal1:
    // require the user to verify their MFA code before accessing admin routes
    if (currentLevel === 'aal1' && nextLevel === 'aal2') {
      return NextResponse.json(
        { error: 'MFA verification required', code: 'MFA_REQUIRED', redirectTo: '/platform/settings?tab=security&mfa=verify' },
        { status: 403 }
      )
    }

    // strict mode: reject if MFA not enrolled at all (nextLevel still aal1)
    if (strict && currentLevel === 'aal1' && nextLevel === 'aal1') {
      return NextResponse.json(
        { error: 'MFA not enrolled. Admin access requires MFA.', code: 'MFA_NOT_ENROLLED', redirectTo: '/platform/settings?tab=security&mfa=enrol' },
        { status: 403 }
      )
    }

    return null // AAL2 confirmed, or MFA not enrolled (non-strict mode allows)
  } catch {
    return null // MFA check failed gracefully — do not block
  }
}

/**
 * MFA enrolment check for settings page.
 * Returns whether user has TOTP enrolled.
 */
export async function getMFAStatus(supabase: SupabaseClient): Promise<{
  enrolled: boolean
  currentLevel: string
  nextLevel: string
}> {
  try {
    const { data } = await supabase.auth.mfa.listFactors()
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    return {
      enrolled:     (data?.totp?.length ?? 0) > 0,
      currentLevel: level?.currentLevel ?? 'aal1',
      nextLevel:    level?.nextLevel    ?? 'aal1',
    }
  } catch {
    return { enrolled: false, currentLevel: 'aal1', nextLevel: 'aal1' }
  }
}
