import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type WorkbenchAuthSuccess = {
  user: User
  admin: SupabaseClient
}

type WorkbenchAuthFailure = {
  error: NextResponse
}

export type WorkbenchAuthResult = WorkbenchAuthSuccess | WorkbenchAuthFailure

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function extractBearerToken(req: NextRequest) {
  const header = req.headers.get('authorization') ?? ''
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice(7).trim()
}

export async function requireWorkbenchUser(req: NextRequest): Promise<WorkbenchAuthResult> {
  const admin = getAdmin()

  const supabase = createClient()
  const { data: { user: cookieUser } } = await supabase.auth.getUser()
  if (cookieUser) return { user: cookieUser, admin }

  const bearer = extractBearerToken(req)
  if (bearer) {
    const { data, error } = await admin.auth.getUser(bearer)
    if (!error && data.user) {
      return { user: data.user, admin }
    }
  }

  return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
}
