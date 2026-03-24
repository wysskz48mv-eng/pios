import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const VALID_DOMAINS   = ['academic','fm_consulting','saas','business','personal']
const VALID_STATUSES  = ['active','on_hold','completed','cancelled']

function domainColour(domain: string): string {
  const colours: Record<string, string> = {
    academic: '#6c8eff', fm_consulting: '#0ECFB0', saas: '#a78bfa',
    business: '#f59e0b', personal: '#e05a7a',
  }
  return colours[domain] ?? '#6c8eff'
}

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp      = req.nextUrl.searchParams
    const domain  = sp.get('domain')
    const include = sp.get('include') // e.g. 'tasks'

    const [projR, tasksR] = await Promise.all([
      supabase.from('projects').select('*')
        .eq('user_id', user.id).neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
      include === 'tasks'
        ? supabase.from('tasks').select('id,title,status,priority,due_date,project_id,domain')
            .eq('user_id', user.id).neq('status', 'cancelled')
        : Promise.resolve({ data: null }),
    ])

    let projects = projR.data ?? []
    if (domain && domain !== 'all') {
      projects = projects.filter((p: Record<string, unknown>) => p.domain === domain)
    }

    return NextResponse.json({ projects, tasks: tasksR.data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? (err as Error).message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, domain = 'personal', status = 'active', description, deadline, progress } = body

    if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
    if (!VALID_DOMAINS.includes(domain))  return NextResponse.json({ error: 'invalid domain' }, { status: 400 })

    const { data: profile } = await supabase.from('user_profiles').select('tenant_id').eq('id', user.id).single()

    const { data, error } = await supabase.from('projects').insert({
      user_id:     user.id,
      tenant_id:   profile?.tenant_id,
      title:       title.trim(),
      domain,
      status,
      description: description ?? null,
      deadline:    deadline    ?? null,
      progress:    progress    ?? 0,
      colour:      domainColour(domain),
      updated_at:  new Date().toISOString(),
    }).select().single()

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    return NextResponse.json({ project: data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? (err as Error).message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const allowed = ['title','domain','status','description','deadline','progress','notes']
    const safe: Record<string,unknown> = { updated_at: new Date().toISOString() }
    for (const k of (allowed as any[])) { if (k in updates) safe[k] = updates[k] }
    if ((safe as any).domain)  { (safe as any).colour = domainColour((safe as any).domain) }
    if ((safe as any).status && !VALID_STATUSES.includes((safe as any).status))
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    if ((safe as any).domain && !VALID_DOMAINS.includes((safe as any).domain))
      return NextResponse.json({ error: 'invalid domain' }, { status: 400 })
    if ((safe as any).progress !== undefined) (safe as any).progress = Math.min(100, Math.max(0, parseInt((safe as any).progress) || 0))

    const { data, error } = await supabase.from('projects')
      .update(safe).eq('id', id).eq('user_id', user.id).select().single()
    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    return NextResponse.json({ project: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? (err as Error).message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── DELETE ──────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Soft-delete: set status to cancelled
    const { error } = await supabase.from('projects')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id)

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    return NextResponse.json({ cancelled: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? (err as Error).message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
