import type { SupabaseClient } from '@supabase/supabase-js'

type Json = Record<string, unknown>

export interface NemoclawTool {
  name: string
  description: string
  input_schema: Json
}

export const NEMOCLAW_TOOLS: NemoclawTool[] = [
  {
    name: 'tasks_list',
    description: 'Get active user tasks with optional status and priority filters',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'todo | in_progress | blocked | done' },
        priority: { type: 'string', description: 'critical | high | medium | low' },
        limit: { type: 'number', description: 'max records to return', default: 10 },
      },
    },
  },
  {
    name: 'email_inbox',
    description: 'Get latest inbox emails and urgent triage state',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 },
        urgent_only: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'stakeholders_list',
    description: 'Get key stakeholders and next touch points',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'projects_list',
    description: 'Get active projects and progress summary',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', default: 'active' },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'documents_search',
    description: 'Search both uploaded file records and project source documents',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', default: 8 },
      },
      required: ['query'],
    },
  },
]

function n(value: unknown, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(1, Math.min(50, Math.floor(value)))
}

export async function runNemoclawTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  input: Json
): Promise<Json> {
  if (name === 'tasks_list') {
    let q = supabase
      .from('tasks')
      .select('id,title,status,priority,due_date,domain,project_id,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(n(input.limit, 10))

    if (typeof input.status === 'string' && input.status !== 'all') {
      q = q.eq('status', input.status)
    } else {
      q = q.not('status', 'in', '(done,cancelled)')
    }
    if (typeof input.priority === 'string' && input.priority !== 'all') {
      q = q.eq('priority', input.priority)
    }

    const { data } = await q
    return { count: data?.length ?? 0, tasks: data ?? [] }
  }

  if (name === 'email_inbox') {
    let q = supabase
      .from('email_items')
      .select('id,subject,sender_name,sender_email,triage_class,is_read,received_at,inbox_address')
      .eq('user_id', userId)
      .order('received_at', { ascending: false })
      .limit(n(input.limit, 10))

    if (input.urgent_only === true) {
      q = q.eq('triage_class', 'urgent')
    }

    const { data } = await q
    return {
      count: data?.length ?? 0,
      urgent: (data ?? []).filter((e) => e.triage_class === 'urgent').length,
      emails: data ?? [],
    }
  }

  if (name === 'stakeholders_list') {
    const { data } = await supabase
      .from('stakeholders')
      .select('id,name,role,organisation,influence,alignment,engagement,next_touchpoint,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(n(input.limit, 10))

    return { count: data?.length ?? 0, stakeholders: data ?? [] }
  }

  if (name === 'projects_list') {
    let q = supabase
      .from('projects')
      .select('id,title,domain,status,progress,deadline,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(n(input.limit, 10))

    if (typeof input.status === 'string' && input.status !== 'all') {
      q = q.eq('status', input.status)
    }

    const { data } = await q
    return { count: data?.length ?? 0, projects: data ?? [] }
  }

  if (name === 'documents_search') {
    const term = String(input.query ?? '').trim()
    if (!term) return { count: 0, results: [] }
    const limit = n(input.limit, 8)

    const [files, documents] = await Promise.all([
      supabase
        .from('file_items')
        .select('id,name,file_type,ai_summary,created_at,drive_web_url')
        .eq('user_id', userId)
        .or(`name.ilike.%${term}%,ai_summary.ilike.%${term}%`)
        .limit(limit),
      supabase
        .from('project_source_documents')
        .select('id,filename,file_type,source_content,uploaded_at')
        .eq('user_id', userId)
        .or(`filename.ilike.%${term}%,source_content.ilike.%${term}%`)
        .limit(limit),
    ])

    const results = [
      ...(files.data ?? []).map((f) => ({
        source: 'file_items',
        id: f.id,
        name: f.name,
        file_type: f.file_type,
        summary: f.ai_summary,
        created_at: f.created_at,
        url: f.drive_web_url,
      })),
      ...(documents.data ?? []).map((d) => ({
        source: 'project_source_documents',
        id: d.id,
        name: d.filename,
        file_type: d.file_type,
        summary: d.source_content,
        created_at: d.uploaded_at,
      })),
    ].slice(0, limit)

    return { count: results.length, results }
  }

  return { error: `Unknown tool: ${name}` }
}
