import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('CLAUDE_API_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

interface EmailClassification {
  triage_class: 'opportunity' | 'client_request' | 'compliance' | 'internal' | 'newsletter' | 'automated' | 'spam' | 'personal'
  priority_score: number
  action_required: 'reply' | 'review' | 'file' | 'task' | 'delete' | null
  is_newsletter: boolean
  is_automated: boolean
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent'
  suggested_action: string | null
}

const VALID_TRIAGE = new Set(['opportunity', 'client_request', 'compliance', 'internal', 'newsletter', 'automated', 'spam', 'personal'])
const VALID_ACTIONS = new Set(['reply', 'review', 'file', 'task', 'delete'])
const VALID_URGENCY = new Set(['low', 'medium', 'high', 'urgent'])
const VALID_SENTIMENT = new Set(['positive', 'neutral', 'negative', 'urgent'])

function extractJsonBlock(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const match = trimmed.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in model response')
  return match[0]
}

function normalizeClassification(input: Partial<EmailClassification>): EmailClassification {
  const triage = VALID_TRIAGE.has(String(input.triage_class)) ? String(input.triage_class) : 'internal'
  const action = VALID_ACTIONS.has(String(input.action_required)) ? String(input.action_required) : null
  const urgency = VALID_URGENCY.has(String(input.urgency)) ? String(input.urgency) : 'medium'
  const sentiment = VALID_SENTIMENT.has(String(input.sentiment)) ? String(input.sentiment) : 'neutral'

  const score = Number(input.priority_score)
  const priorityScore = Number.isFinite(score)
    ? Math.max(1, Math.min(10, Math.trunc(score)))
    : triage === 'compliance' || triage === 'client_request'
      ? 8
      : triage === 'opportunity'
        ? 7
        : 4

  return {
    triage_class: triage as EmailClassification['triage_class'],
    priority_score: priorityScore,
    action_required: action as EmailClassification['action_required'],
    is_newsletter: Boolean(input.is_newsletter) || triage === 'newsletter',
    is_automated: Boolean(input.is_automated) || triage === 'automated',
    urgency: urgency as EmailClassification['urgency'],
    sentiment: sentiment as EmailClassification['sentiment'],
    suggested_action: typeof input.suggested_action === 'string' && input.suggested_action.trim().length > 0
      ? input.suggested_action.trim().slice(0, 240)
      : null,
  }
}

function heuristicClassification(email: Record<string, any>): EmailClassification {
  const text = `${email.subject ?? ''}\n${email.body_text ?? ''}\n${email.snippet ?? ''}`.toLowerCase()
  const from = `${email.sender_email ?? ''}`.toLowerCase()
  const hasUnsubscribe = Boolean(email.has_unsubscribe_link)

  if (/(unsubscribe|newsletter|digest|weekly update)/.test(text) || hasUnsubscribe) {
    return normalizeClassification({
      triage_class: 'newsletter', priority_score: 2, action_required: 'file', is_newsletter: true,
      is_automated: true, urgency: 'low', sentiment: 'neutral', suggested_action: 'Archive or unsubscribe if irrelevant.',
    })
  }

  if (/(invoice|receipt|payment confirmation|no-reply|noreply|notification)/.test(text) || /(no-?reply)/.test(from)) {
    return normalizeClassification({
      triage_class: 'automated', priority_score: 3, action_required: 'file', is_newsletter: false,
      is_automated: true, urgency: 'low', sentiment: 'neutral', suggested_action: 'File for records and review only if needed.',
    })
  }

  if (/(urgent|asap|deadline|breach|audit|legal|compliance|regulator)/.test(text)) {
    return normalizeClassification({
      triage_class: 'compliance', priority_score: 9, action_required: 'review', is_newsletter: false,
      is_automated: false, urgency: 'urgent', sentiment: 'urgent', suggested_action: 'Escalate immediately and assign owner.',
    })
  }

  if (/(proposal|partnership|opportunity|rfp|tender|introduction)/.test(text)) {
    return normalizeClassification({
      triage_class: 'opportunity', priority_score: 7, action_required: 'reply', is_newsletter: false,
      is_automated: false, urgency: 'medium', sentiment: 'positive', suggested_action: 'Qualify and respond with next-step proposal.',
    })
  }

  if (/(please|can you|could you|need|request)/.test(text)) {
    return normalizeClassification({
      triage_class: 'client_request', priority_score: 8, action_required: 'reply', is_newsletter: false,
      is_automated: false, urgency: 'high', sentiment: 'neutral', suggested_action: 'Respond with timeline and required inputs.',
    })
  }

  return normalizeClassification({
    triage_class: 'internal', priority_score: 5, action_required: 'review', is_newsletter: false,
    is_automated: false, urgency: 'medium', sentiment: 'neutral', suggested_action: 'Review and decide whether follow-up is required.',
  })
}

async function classifyWithAnthropic(email: Record<string, any>): Promise<EmailClassification> {
  if (!ANTHROPIC_KEY) return heuristicClassification(email)

  const prompt = `Classify this email and respond with JSON only.\n\nEmail Details:\nFrom: ${email.sender_name ?? ''} <${email.sender_email ?? ''}>\nSubject: ${email.subject ?? ''}\nBody: ${(email.body_text ?? email.snippet ?? '').slice(0, 12000)}\n\nReturn JSON with keys:\n{\n  "triage_class": "opportunity|client_request|compliance|internal|newsletter|automated|spam|personal",\n  "priority_score": 1-10,\n  "action_required": "reply|review|file|task|delete|null",\n  "is_newsletter": true/false,\n  "is_automated": true/false,\n  "urgency": "low|medium|high|urgent",\n  "sentiment": "positive|neutral|negative|urgent",\n  "suggested_action": "short actionable note or null"\n}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error ${response.status}: ${err.slice(0, 400)}`)
  }

  const data = await response.json()
  const text = data?.content?.[0]?.text
  if (!text || typeof text !== 'string') {
    throw new Error('Anthropic response missing content text')
  }

  const parsed = JSON.parse(extractJsonBlock(text)) as Partial<EmailClassification>
  return normalizeClassification(parsed)
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json().catch(() => ({}))
    const emailId = typeof payload.emailId === 'string' ? payload.emailId : ''
    if (!emailId) {
      return new Response(JSON.stringify({ error: 'emailId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: email, error: emailError } = await supabase
      .from('email_items')
      .select('*')
      .eq('id', emailId)
      .single()

    if (emailError || !email) {
      throw new Error(`Email not found: ${emailError?.message ?? emailId}`)
    }

    const classification = await classifyWithAnthropic(email).catch((err) => {
      console.warn('[nemoclaw-triage-classifier] model fallback', err)
      return heuristicClassification(email)
    })

    const senderDomain = String(email.sender_email ?? '').split('@')[1]?.toLowerCase() ?? null

    const { error: updateError } = await supabase
      .from('email_items')
      .update({
        triage_class: classification.triage_class,
        priority_score: classification.priority_score,
        action_required: classification.action_required,
        is_newsletter: classification.is_newsletter,
        is_automated: classification.is_automated,
        sender_domain: senderDomain,
        urgency: classification.urgency,
        sentiment: classification.sentiment,
        status: 'unprocessed',
      })
      .eq('id', emailId)

    if (updateError) throw new Error(`Failed to update email classification: ${updateError.message}`)

    const queuePayload = {
      user_id: email.user_id,
      email_id: email.id,
      gmail_message_id: email.gmail_message_id,
      gmail_thread_id: email.gmail_thread_id,
      sender: email.sender_email ?? email.sender_name ?? null,
      subject: email.subject ?? null,
      received_at: email.received_at ?? new Date().toISOString(),
      status: 'unreviewed',
      triage_class: classification.triage_class,
      priority_score: classification.priority_score,
      action_required: classification.action_required,
      suggested_action: classification.suggested_action,
      urgency: classification.urgency,
      sentiment: classification.sentiment,
      sender_domain: senderDomain,
      is_newsletter: classification.is_newsletter,
      is_automated: classification.is_automated,
      summary: email.snippet ?? null,
      signal_type: classification.action_required ? 'action_required' : (classification.is_newsletter ? 'noise' : 'fyi'),
      relevance_score: classification.priority_score,
      surface_to_dashboard: classification.priority_score >= 7,
    }

    if (queuePayload.gmail_message_id) {
      const { error: queueError } = await supabase
        .from('email_triage_queue')
        .upsert(queuePayload, { onConflict: 'user_id,gmail_message_id' })
      if (queueError) throw new Error(`Failed to upsert triage queue row: ${queueError.message}`)
    } else {
      const { error: queueError } = await supabase
        .from('email_triage_queue')
        .insert(queuePayload)
      if (queueError) throw new Error(`Failed to insert triage queue row: ${queueError.message}`)
    }

    return new Response(JSON.stringify({ success: true, emailId, classification }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
