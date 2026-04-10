/**
 * NemoClaw Capability Detection & Adaptive Response Engine
 * Detects what tools the user has, builds context-aware prompts,
 * and learns from user choices over time.
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */

export interface UserCapabilities {
  has_email: boolean
  email_provider: string | null
  has_calendar: boolean
  calendar_provider: string | null
  has_tasks: boolean
  task_provider: string | null
  has_files: boolean
  file_provider: string | null
  has_crm: boolean
  has_slack: boolean
  has_teams: boolean
  has_drive: boolean
  preferred_task_system: string
  preferred_reminder: string
  preferred_comm_style: string
  total_interactions: number
  learning_score: number
}

/**
 * Detect user capabilities from their connected services
 */
export async function detectCapabilities(supabase: any, userId: string): Promise<UserCapabilities> {
  // Check connected email accounts
  const { data: emailAccounts } = await supabase
    .from('connected_email_accounts')
    .select('provider, is_active, calendar_source')
    .eq('user_id', userId)
    .eq('is_active', true)

  const hasGmail = emailAccounts?.some((a: any) => a.provider === 'google' && a.is_active)
  const hasMicrosoft = emailAccounts?.some((a: any) => a.provider === 'microsoft' && a.is_active)
  const hasCalendar = hasGmail || hasMicrosoft

  // Check if user has files/documents
  const { count: fileCount } = await supabase
    .from('file_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Check if user has stakeholders (CRM proxy)
  const { count: stakeholderCount } = await supabase
    .from('exec_stakeholders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Get existing capability profile
  const { data: existing } = await supabase
    .from('nemoclaw_user_capabilities')
    .select('*')
    .eq('user_id', userId)
    .single()

  const caps: UserCapabilities = {
    has_email: hasGmail || hasMicrosoft,
    email_provider: hasGmail ? 'gmail' : hasMicrosoft ? 'microsoft' : null,
    has_calendar: hasCalendar,
    calendar_provider: hasGmail ? 'google' : hasMicrosoft ? 'outlook' : null,
    has_tasks: true, // PIOS always has tasks
    task_provider: 'pios',
    has_files: true, // PIOS always has files
    file_provider: 'pios',
    has_crm: (stakeholderCount ?? 0) > 0,
    has_slack: !!process.env.SLACK_WEBHOOK_URL,
    has_teams: hasMicrosoft,
    has_drive: hasGmail,
    preferred_task_system: existing?.preferred_task_system ?? 'pios',
    preferred_reminder: existing?.preferred_reminder ?? (hasCalendar ? 'calendar' : 'task'),
    preferred_comm_style: existing?.preferred_comm_style ?? 'direct',
    total_interactions: existing?.total_interactions ?? 0,
    learning_score: existing?.learning_score ?? 0.5,
  }

  // Upsert capability profile
  await supabase.from('nemoclaw_user_capabilities').upsert({
    user_id: userId,
    ...caps,
    last_validated: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return caps
}

/**
 * Build the capability-aware system prompt section
 */
export function buildCapabilityPrompt(caps: UserCapabilities): string {
  const tools: string[] = []
  const unavailable: string[] = []

  if (caps.has_email) tools.push(`Email (${caps.email_provider}) — can read, triage, draft, send`)
  else unavailable.push('Email — not connected')

  if (caps.has_calendar) tools.push(`Calendar (${caps.calendar_provider}) — can read events`)
  else unavailable.push('Calendar — not connected')

  tools.push(`Tasks (PIOS) — can create, update, list, set deadlines`)
  tools.push(`Files (PIOS) — can upload, classify, file, extract intelligence`)

  if (caps.has_crm) tools.push('Stakeholders (PIOS CRM) — can view and update')
  if (caps.has_drive) tools.push('Google Drive — can scan and classify files')
  if (caps.has_slack) tools.push('Slack — can send notifications')

  return `
AVAILABLE TOOLS (use ONLY these):
${tools.map(t => `  ✓ ${t}`).join('\n')}

NOT AVAILABLE (do NOT suggest these):
${unavailable.length > 0 ? unavailable.map(t => `  ✗ ${t}`).join('\n') : '  (all core tools available)'}

USER PREFERENCES:
  Preferred task system: ${caps.preferred_task_system}
  Preferred reminder method: ${caps.preferred_reminder}
  Communication style: ${caps.preferred_comm_style}
  Interactions to date: ${caps.total_interactions}

CRITICAL RULES:
1. NEVER suggest tools the user doesn't have access to
2. When primary tool unavailable, offer the BEST available alternative
3. If no tool available, provide clear manual instructions
4. Always explain what you're doing and why
5. For reminders: prefer ${caps.preferred_reminder}, fallback to tasks
6. Match the user's ${caps.preferred_comm_style} communication style
`.trim()
}

/**
 * Log an interaction for learning
 */
export async function logInteraction(
  supabase: any,
  userId: string,
  sessionId: string | null,
  intent: string,
  suggestedTool: string | null,
  chosenTool: string | null,
  fallbackUsed: boolean,
) {
  await supabase.from('nemoclaw_interactions').insert({
    user_id: userId,
    session_id: sessionId,
    intent,
    suggested_tool: suggestedTool,
    chosen_tool: chosenTool,
    fallback_used: fallbackUsed,
  })

  // Increment interaction count
  await supabase.from('nemoclaw_user_capabilities').update({
    total_interactions: (await supabase.from('nemoclaw_user_capabilities').select('total_interactions').eq('user_id', userId).single()).data?.total_interactions + 1 || 1,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)
}
