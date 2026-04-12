import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireWorkbenchUser } from '@/app/api/workbench/_auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkbenchUser(req)
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
    const auth = await requireWorkbenchUser(req)
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
