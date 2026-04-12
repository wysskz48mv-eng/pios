import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  }

  return { user, admin: getAdmin() }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser()
    if ('error' in auth) return auth.error

    const { user, admin } = auth
    const status = req.nextUrl.searchParams.get('status')

    let query = admin
      .from('consulting_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ projects: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser()
    if ('error' in auth) return auth.error

    const { user, admin } = auth
    const body = await req.json() as {
      project_name?: string
      client_name?: string
      status?: 'in_progress' | 'completed' | 'archived'
      current_step?: number
    }

    const projectName = String(body.project_name ?? '').trim()
    const clientName = body.client_name ? String(body.client_name).trim() : null

    if (!projectName) {
      return NextResponse.json({ error: 'project_name is required' }, { status: 400 })
    }

    const step = body.current_step == null ? 1 : Number(body.current_step)
    if (!Number.isInteger(step) || step < 1 || step > 7) {
      return NextResponse.json({ error: 'current_step must be an integer between 1 and 7' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('consulting_projects')
      .insert({
        user_id: user.id,
        project_name: projectName,
        client_name: clientName,
        status: body.status ?? 'in_progress',
        current_step: step,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ project: data }, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}
