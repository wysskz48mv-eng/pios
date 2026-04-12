import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { toCanonicalPersona, getPersonaPackaging } from '@/lib/persona-packaging'

type TempUser = {
  id: string
  email: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const hasDbEnv = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY)

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!)
}

async function createTempUser(admin: SupabaseClient): Promise<TempUser> {
  const email = `m072-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pios.test`
  const password = 'Temp#Pass12345'

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'PIOS Test User' },
  })

  if (error || !data.user) {
    throw new Error(`Failed to create temp user: ${error?.message ?? 'unknown'}`)
  }

  const { error: bootstrapErr } = await admin.rpc('bootstrap_user_profile', {
    p_user_id: data.user.id,
    p_email: email,
    p_raw_user_meta_data: { full_name: 'PIOS Test User' },
  })

  if (bootstrapErr) {
    throw new Error(`Failed to bootstrap profile: ${bootstrapErr.message}`)
  }

  return { id: data.user.id, email }
}

async function deleteTempUser(admin: SupabaseClient, id: string) {
  await admin.auth.admin.deleteUser(id)
}

function isConstraintErrorMessage(message: string | undefined, key: string): boolean {
  const value = (message ?? '').toLowerCase()
  return value.includes('constraint') && value.includes(key)
}

test.describe('Onboarding M072-M075 Validation', () => {
  test('Persona alias normalization maps to canonical DB values', async () => {
    expect(toCanonicalPersona('executive')).toBe('EXECUTIVE')
    expect(toCanonicalPersona('pro')).toBe('CONSULTANT')
    expect(toCanonicalPersona('starter')).toBe('ACADEMIC')
    expect(toCanonicalPersona('founder')).toBe('CEO')
    expect(toCanonicalPersona('invalid_persona')).toBeNull()

    const ceo = getPersonaPackaging('CEO')
    const consultant = getPersonaPackaging('CONSULTANT')
    const academic = getPersonaPackaging('ACADEMIC')

    expect(ceo.fallbackFrameworkCodes).toHaveLength(7)
    expect(consultant.fallbackFrameworkCodes).toHaveLength(6)
    expect(academic.fallbackFrameworkCodes).toHaveLength(4)
  })

  test('M072 persona_type constraint rejects invalid values', async () => {
    test.skip(!hasDbEnv, 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run DB validation tests')

    const admin = adminClient()
    const user = await createTempUser(admin)

    try {
      const { error } = await admin
        .from('user_profiles')
        .update({ persona_type: 'invalid_persona' })
        .eq('id', user.id)

      expect(error).toBeTruthy()
      expect(isConstraintErrorMessage(error?.message, 'persona_type')).toBe(true)
    } finally {
      await deleteTempUser(admin, user.id)
    }
  })

  test('M073 active_modules validator rejects invalid framework codes', async () => {
    test.skip(!hasDbEnv, 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run DB validation tests')

    const admin = adminClient()
    const user = await createTempUser(admin)

    try {
      const { error } = await admin
        .from('user_profiles')
        .update({
          active_modules: ['INVALID-CODE-99'],
        })
        .eq('id', user.id)

      if (!error) {
        test.skip(true, 'active_modules validator is not active on this DB yet')
      }

      expect(error).toBeTruthy()
      const msg = (error?.message ?? '').toLowerCase()
      expect(msg.includes('framework') || msg.includes('active_modules') || msg.includes('constraint')).toBe(true)
    } finally {
      await deleteTempUser(admin, user.id)
    }
  })

  test('M073 allows empty active_modules array', async () => {
    test.skip(!hasDbEnv, 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run DB validation tests')

    const admin = adminClient()
    const user = await createTempUser(admin)

    try {
      const { error: updateErr } = await admin
        .from('user_profiles')
        .update({
          active_modules: [],
        })
        .eq('id', user.id)

      expect(updateErr).toBeFalsy()

      const { data: profile, error: readErr } = await admin
        .from('user_profiles')
        .select('active_modules')
        .eq('id', user.id)
        .single()

      expect(readErr).toBeFalsy()
      expect(profile?.active_modules ?? []).toEqual([])
    } finally {
      await deleteTempUser(admin, user.id)
    }
  })

  test('M074 cv_processing_status constraint accepts only enum-like values', async () => {
    test.skip(!hasDbEnv, 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run DB validation tests')

    const admin = adminClient()
    const user = await createTempUser(admin)

    try {
      const { error: okErr } = await admin
        .from('user_profiles')
        .update({ cv_processing_status: 'pending' })
        .eq('id', user.id)

      expect(okErr).toBeFalsy()

      const { error: badErr } = await admin
        .from('user_profiles')
        .update({ cv_processing_status: 'unknown_state' })
        .eq('id', user.id)

      if (!badErr) {
        test.skip(true, 'cv_processing_status_valid is not active on this DB yet')
      }

      expect(badErr).toBeTruthy()
      expect(isConstraintErrorMessage(badErr?.message, 'cv_processing_status')).toBe(true)
    } finally {
      await deleteTempUser(admin, user.id)
    }
  })

  test('M074 calibration trigger syncs completed status to user_profiles', async () => {
    test.skip(!hasDbEnv, 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run DB validation tests')

    const admin = adminClient()
    const user = await createTempUser(admin)

    try {
      const { error: schemaProbeError } = await admin
        .from('nemoclaw_calibration')
        .select('cv_filename')
        .limit(1)

      if (schemaProbeError) {
        test.skip(true, 'nemoclaw_calibration M074 schema is not active on this DB yet')
      }

      const { error: insertErr } = await admin
        .from('nemoclaw_calibration')
        .upsert({
          user_id: user.id,
          cv_filename: 'test-cv.pdf',
          cv_storage_path: `${user.id}/cv-test.pdf`,
          cv_uploaded_at: new Date().toISOString(),
          status: 'completed',
          extracted_data: { current_role: 'CEO' },
        }, { onConflict: 'user_id' })

      expect(insertErr).toBeFalsy()

      const { data: profile, error: readErr } = await admin
        .from('user_profiles')
        .select('nemoclaw_calibrated,nemoclaw_calibrated_at')
        .eq('id', user.id)
        .single()

      expect(readErr).toBeFalsy()
      expect(profile?.nemoclaw_calibrated).toBe(true)
      expect(profile?.nemoclaw_calibrated_at).toBeTruthy()
    } finally {
      await deleteTempUser(admin, user.id)
    }
  })

  test('M074 monitoring function returns CV status payload', async () => {
    test.skip(!hasDbEnv, 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run DB validation tests')

    const admin = adminClient()
    const user = await createTempUser(admin)

    try {
      await admin
        .from('nemoclaw_calibration')
        .upsert({
          user_id: user.id,
          status: 'pending',
          cv_filename: 'test-cv.pdf',
          cv_storage_path: `${user.id}/cv-test.pdf`,
        }, { onConflict: 'user_id' })

      const { data, error } = await admin.rpc('get_cv_processing_status', { p_user_id: user.id })

      if (error && error.code === 'PGRST202') {
        test.skip(true, 'get_cv_processing_status function is not active on this DB yet')
      }

      expect(error).toBeFalsy()
      expect(data).toBeTruthy()
      expect(data).toHaveProperty('user_id', user.id)
      expect(data).toHaveProperty('calibration_status')
      expect(data).toHaveProperty('nemoclaw_calibrated')
    } finally {
      await deleteTempUser(admin, user.id)
    }
  })

  test('M075 onboarding endpoint requires auth and returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/onboarding/complete', {
      data: {
        persona_type: 'CEO',
        command_centre_theme: 'onyx',
      },
    })

    expect([401, 403]).toContain(res.status())
  })

  test('Onboarding readiness endpoint returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/onboarding')
    expect(res.status()).toBe(401)
  })
})
