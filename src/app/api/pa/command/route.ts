import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/pa/command
 * NemoClaw™ Personal Assistant — Natural Language Command Handler
 *
 * Receives: { message, history }
 * Returns:  { response, actions? }
 *
 * The PA reads ALL PIOS tables for context, then either:
 *   A. Answers directly (status queries)
 *   B. Proposes actions for user confirmation (write/mutate operations)
 *   C. Executes directly (read-only + low-risk like marking something read)
 *
 * NEVER executes destructive or outbound actions without explicit confirmation.
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K+1
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { message, history = [] } = await req.json()
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Load comprehensive PIOS context for NemoClaw™
  const ctx = await loadPAContext(user.id, admin)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Build conversation history
  const claudeHistory = history
    .filter((m: {role:string}) => m.role !== 'system')
    .map((m: {role:string;content:string}) => ({
      role:    m.role === 'pa' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }))
  claudeHistory.push({ role: 'user', content: message })

  const msg = await client.messages.create({
    model:      'claude-sonnet-4-5-20251001',
    max_tokens: 600,
    system:     buildPASystemPrompt(ctx),
    messages:   claudeHistory,
  })

  const rawResponse = msg.content[0].type === 'text' ? msg.content[0].text : ''

  // Parse actions from response if any
  const { response, actions } = parseResponse(rawResponse)

  // Execute any auto-executable actions (read-only, safe)
  await executeAutoActions(actions, user.id, admin)

  return NextResponse.json({ response, actions: actions.filter(a => a.requires_confirmation) })
}

/* ── Load all PIOS context ──────────────────────────────────── */
async function loadPAContext(userId: string, admin: any) {
  const today = new Date().toISOString().split('T')[0]
  const week  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const [calibRes, profileRes, taskRes, okrRes, decRes, stakeRes, emailRes, vaultRes, alertRes] =
    await Promise.allSettled([
      admin.from('nemoclaw_calibration').select('calibration_summary,seniority_level,primary_industry,communication_register').eq('user_id', userId).single(),
      admin.from('user_profiles').select('full_name').eq('user_id', userId).single(),
      admin.from('tasks').select('id,title,priority,status,due_date,domain').eq('user_id', userId).neq('status','done').order('priority',{ascending:false}).limit(10),
      admin.from('executive_okrs').select('id,objective,progress,status').eq('user_id', userId).eq('status','active').limit(5),
      admin.from('executive_decisions').select('id,title,context,created_at').eq('user_id', userId).eq('status','open').limit(5),
      admin.from('stakeholders').select('id,name,organisation,last_contact_date,contact_cadence_days').eq('user_id', userId).limit(10),
      admin.from('email_items').select('id,from_name,from_address,subject,triage_class,received_at').eq('user_id', userId).is('triage_class',null).order('received_at',{ascending:false}).limit(5),
      admin.from('vault_documents').select('id,title,doc_type,organisation_name,expiry_date').eq('user_id', userId).lte('expiry_date', week).gte('expiry_date', today).limit(5),
      admin.from('staleness_alerts').select('id,entity_type,message,alert_type').eq('user_id', userId).eq('dismissed', false).limit(5),
    ])

  const calib    = calibRes.status    === 'fulfilled' ? calibRes.value.data    : null
  const profile  = profileRes.status  === 'fulfilled' ? profileRes.value.data  : null
  const tasks    = taskRes.status     === 'fulfilled' ? taskRes.value.data     : []
  const okrs     = okrRes.status      === 'fulfilled' ? okrRes.value.data      : []
  const decisions= decRes.status      === 'fulfilled' ? decRes.value.data      : []
  const stakes   = stakeRes.status    === 'fulfilled' ? stakeRes.value.data    : []
  const emails   = emailRes.status    === 'fulfilled' ? emailRes.value.data    : []
  const expiring = vaultRes.status    === 'fulfilled' ? vaultRes.value.data    : []
  const alerts   = alertRes.status    === 'fulfilled' ? alertRes.value.data    : []

  // Overdue tasks
  const overdue  = (tasks as {due_date?:string;status:string}[]).filter(t =>
    t.due_date && new Date(t.due_date) < new Date()
  )

  // Stale decisions
  const staleDecisions = ((decisions ?? []) as {created_at:string;title:string}[]).filter(d =>
    (Date.now() - new Date(d.created_at).getTime()) > 14 * 86400000
  )

  // Overdue stakeholder contact
  const overdueContact = ((stakes ?? []) as {name:string;last_contact_date?:string;contact_cadence_days?:number;organisation:string}[]).filter(s =>
    s.contact_cadence_days && s.last_contact_date &&
    (Date.now() - new Date(s.last_contact_date).getTime()) > (s.contact_cadence_days * 86400000)
  )

  return {
    userName:    (profile as any)?.full_name ?? 'there',
    calib, tasks, okrs, decisions, stakes, emails,
    expiring, alerts, overdue, staleDecisions, overdueContact,
  }
}

/* ── System prompt ──────────────────────────────────────────── */
function buildPASystemPrompt(ctx: Awaited<ReturnType<typeof loadPAContext>>): string {
  const { userName, calib, tasks, okrs, decisions, overdue, staleDecisions, emails, expiring, overdueContact } = ctx

  const fmtTask = (t: {title:string;priority:string;due_date?:string}) =>
    `- ${t.title} [${t.priority}]${t.due_date ? ` due ${new Date(t.due_date).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}` : ''}`

  const fmtOKR = (o: {objective:string;progress:number}) =>
    `- ${o.objective} (${o.progress}%)`

  const fmtDec = (d: {title:string;created_at:string}) =>
    `- ${d.title} (open ${Math.floor((Date.now()-new Date(d.created_at).getTime())/86400000)}d)`

  return `You are NemoClaw™, the personal AI assistant for ${userName}.
Profile: ${(calib as any)?.calibration_summary ?? 'Senior professional'}
Industry: ${(calib as any)?.primary_industry ?? 'consulting'}
Communication register: ${(calib as any)?.communication_register ?? 'professional'}

LIVE PIOS CONTEXT:
${tasks.length > 0 ? `Open tasks (${tasks.length}):\n${(tasks as {title:string;priority:string;due_date?:string}[]).map(fmtTask).join('\n')}` : 'No open tasks.'}
${overdue.length > 0 ? `\nOVERDUE (${overdue.length}): ${(overdue as {title:string}[]).map(t=>t.title).join(', ')}` : ''}
${okrs.length > 0 ? `\nActive OKRs:\n${(okrs as {objective:string;progress:number}[]).map(fmtOKR).join('\n')}` : ''}
${decisions.length > 0 ? `\nOpen decisions (${decisions.length}):\n${(decisions as {title:string;created_at:string}[]).map(fmtDec).join('\n')}` : ''}
${staleDecisions.length > 0 ? `\nSTALE DECISIONS (>14 days): ${(staleDecisions as {title:string}[]).map(d=>d.title).join(', ')}` : ''}
${emails.length > 0 ? `\nUntriaged emails: ${emails.length}` : ''}
${expiring.length > 0 ? `\nDocuments expiring this week: ${(expiring as {title?:string;doc_type:string}[]).map(d=>d.title??d.doc_type).join(', ')}` : ''}
${overdueContact.length > 0 ? `\nOverdue stakeholder contact: ${(overdueContact as {name:string}[]).map(s=>s.name).join(', ')}` : ''}

PA RULES:
1. Be extremely concise. Under 80 words unless user asks for detail.
2. Prioritise ruthlessly — surface only what matters most.
3. For status queries: answer directly from context above.
4. For action requests: propose the action, ask for confirmation before executing.
   Format proposals as: "I'll [action]. Shall I proceed? [Yes / Cancel]"
5. NEVER auto-send emails, delete records, or push deadlines without confirmation.
6. Use UK English and British spellings.
7. If asked something not in context: say you don't have that data and suggest where to find it.
8. Tone: direct executive assistant — professional, not chatty.

For actions you'd like to take, append to your response on a new line:
ACTION: type=task_update|email_draft|decision_create|okr_update, label="Confirm action", requires_confirmation=true`
}

/* ── Parse response + actions ───────────────────────────────── */
function parseResponse(raw: string): { response: string; actions: {type:string;label:string;requires_confirmation:boolean;payload:Record<string,unknown>}[] } {
  const lines   = raw.split('\n')
  const actions: {type:string;label:string;requires_confirmation:boolean;payload:Record<string,unknown>}[] = []
  const textLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('ACTION:')) {
      try {
        const parts = line.replace('ACTION:', '').trim()
        const type  = parts.match(/type=(\w+)/)?.[1] ?? 'unknown'
        const label = parts.match(/label="([^"]+)"/)?.[1] ?? 'Confirm'
        const conf  = parts.includes('requires_confirmation=true')
        actions.push({ type, label, requires_confirmation: conf, payload: {} })
      } catch { /* skip malformed action */ }
    } else {
      textLines.push(line)
    }
  }

  return { response: textLines.join('\n').trim(), actions }
}

/* ── Execute auto-actions (safe, read-only) ─────────────────── */
async function executeAutoActions(
  actions: {type:string;requires_confirmation:boolean}[],
  _userId: string,
  _admin: any
): Promise<void> {
  // Only execute actions that don't require confirmation
  const autoActions = actions.filter(a => !a.requires_confirmation)
  // Currently no auto-actions implemented — all actions require confirmation
  // Future: mark alerts as read, etc.
  void autoActions
}
