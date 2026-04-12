import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireWorkbenchUser } from '@/app/api/workbench/_auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { projectId: string }

async function updateProjectWithSchemaFallback(
  admin: any,
  projectId: string,
  updates: Record<string, unknown>
) {
  const baseQuery = admin
    .from('consulting_projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single()

  const primary = await baseQuery
  if (!primary.error) return primary

  // Backward compatibility for environments that do not have archived_at yet.
  const errorCode = (primary.error as { code?: string } | null)?.code
  if (Object.prototype.hasOwnProperty.call(updates, 'archived_at') && errorCode === '42703') {
    const reducedUpdates = { ...updates }
    delete (reducedUpdates as { archived_at?: unknown }).archived_at

    return admin
      .from('consulting_projects')
      .update(reducedUpdates)
      .eq('id', projectId)
      .select()
      .single()
  }

  return primary
}

async function requireOwnedProject(req: NextRequest, projectId: string) {
  const auth = await requireWorkbenchUser(req)
  if ('error' in auth) {
    return { error: auth.error }
  }

  const { user, admin } = auth
  const { data: project, error } = await admin
    .from('consulting_projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!project) {
    return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }
  }

  return { user, admin, project }
}

export async function GET(_req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { projectId } = await context.params
    const auth = await requireOwnedProject(_req, projectId)
    if ('error' in auth) return auth.error

    const { admin, project } = auth

    const { data: steps, error: stepsError } = await admin
      .from('analysis_steps')
      .select('*')
      .eq('project_id', projectId)
      .order('step_number', { ascending: true })

    if (stepsError) throw stepsError

    return NextResponse.json({
      project,
      steps: steps ?? [],
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { projectId } = await context.params
    const auth = await requireOwnedProject(req, projectId)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const body = await req.json() as {
      project_name?: string
      client_name?: string | null
      status?: 'in_progress' | 'completed' | 'archived'
      current_step?: number
      archived_at?: string | null
    }

    const updates: Record<string, unknown> = {}

    if (body.project_name !== undefined) {
      const projectName = String(body.project_name).trim()
      if (!projectName) {
        return NextResponse.json({ error: 'project_name cannot be empty' }, { status: 400 })
      }
      updates.project_name = projectName
    }

    if (body.client_name !== undefined) {
      updates.client_name = body.client_name == null ? null : String(body.client_name).trim()
    }

    if (body.status !== undefined) {
      updates.status = body.status
      if (body.status === 'archived' && body.archived_at === undefined) {
        updates.archived_at = new Date().toISOString()
      }
      if (body.status !== 'archived' && body.archived_at === undefined) {
        updates.archived_at = null
      }
    }

    if (body.current_step !== undefined) {
      const step = Number(body.current_step)
      if (!Number.isInteger(step) || step < 1 || step > 7) {
        return NextResponse.json({ error: 'current_step must be an integer between 1 and 7' }, { status: 400 })
      }
      updates.current_step = step
    }

    if (body.archived_at !== undefined) {
      updates.archived_at = body.archived_at
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await updateProjectWithSchemaFallback(admin, projectId, updates)

    if (error) throw error

    return NextResponse.json({ project: data })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { projectId } = await context.params
    const auth = await requireOwnedProject(_req, projectId)
    if ('error' in auth) return auth.error

    const { admin } = auth

    const { data, error } = await updateProjectWithSchemaFallback(admin, projectId, {
      status: 'archived',
      archived_at: new Date().toISOString(),
    })

    if (error) {
      // Legacy compatibility: fall back to hard-delete when soft archive fails.
      // This keeps cleanup behavior reliable across partially migrated schemas.
      const hardDelete = await admin
        .from('consulting_projects')
        .delete()
        .eq('id', projectId)

      if (hardDelete.error) throw hardDelete.error
      return NextResponse.json({ deleted: true, id: projectId, archive_fallback: true })
    }

    return NextResponse.json({ project: data })
  } catch (err: unknown) {
    return apiError(err)
  }
}
