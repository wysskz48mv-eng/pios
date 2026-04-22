import { NextRequest, NextResponse } from 'next/server'
import { requireWorkbenchUser } from '@/app/api/workbench/_auth'
import { getProfilePersonaModuleState } from '@/lib/profile-persona-service'

const MODULE_FALLBACK = new Set([
  'CITATION_GRAPH',
  'ACADEMIC',
  'CONSULTING_HUB',
  'CONSULTING_WORKBENCH',
])

export async function requireCitationGraphAccess(req: NextRequest) {
  const auth = await requireWorkbenchUser(req)
  if ('error' in auth) return { error: auth.error }

  const { user, admin } = auth
  const state = await getProfilePersonaModuleState(user.id)
  const hasModuleAccess = state.activeModules.some((moduleCode) => MODULE_FALLBACK.has(moduleCode))

  if (!hasModuleAccess) {
    return {
      error: NextResponse.json(
        { error: 'Citation Graph module is not active for this profile' },
        { status: 403 },
      ),
    }
  }

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile?.tenant_id) {
    return {
      error: NextResponse.json(
        { error: 'Missing tenant context for user profile' },
        { status: 400 },
      ),
    }
  }

  return {
    user,
    admin,
    tenantId: String(profile.tenant_id),
  }
}

export function parseBoolean(value: string | null, fallback = false) {
  if (value === null) return fallback
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}
