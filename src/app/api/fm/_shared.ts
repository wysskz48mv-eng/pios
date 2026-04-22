import { NextRequest, NextResponse } from 'next/server'
import { requireWorkbenchUser } from '@/app/api/workbench/_auth'
import { getProfilePersonaModuleState } from '@/lib/profile-persona-service'

const FM_MODULE = 'FM_CONSULTANT'
const FALLBACK_MODULES = new Set(['FM_CONSULTANT', 'CONSULTING_HUB'])

export async function requireFmAccess(req: NextRequest) {
  const auth = await requireWorkbenchUser(req)
  if ('error' in auth) return { error: auth.error }

  const { user } = auth
  const state = await getProfilePersonaModuleState(user.id)
  const hasAccess = state.activeModules.some((moduleCode) => FALLBACK_MODULES.has(moduleCode))

  if (!hasAccess) {
    return {
      error: NextResponse.json(
        { error: `${FM_MODULE} module is not active for this profile` },
        { status: 403 }
      ),
    }
  }

  return auth
}

export async function requireOwnedEngagement(req: NextRequest, engagementId: string) {
  const auth = await requireFmAccess(req)
  if ('error' in auth) return { error: auth.error }

  const { user, admin } = auth
  const { data: engagement, error } = await admin
    .from('consulting_engagements')
    .select('*')
    .eq('id', engagementId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!engagement) {
    return { error: NextResponse.json({ error: 'Engagement not found' }, { status: 404 }) }
  }

  return { user, admin, engagement }
}

export function parseJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
}
