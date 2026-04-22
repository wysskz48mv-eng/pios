import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DEFAULT_BATCH_SIZE = 20
const DEFAULT_DELAY_MS = 500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const batchSize = Math.max(1, Math.min(Number(body.batch_size ?? DEFAULT_BATCH_SIZE), 50))
    const delayMs = Math.max(0, Math.min(Number(body.delay_ms ?? DEFAULT_DELAY_MS), 10_000))
    const maxEmails = Math.max(1, Math.min(Number(body.max_emails ?? 1000), 5000))

    let processed = 0
    let succeeded = 0
    let failed = 0
    const failures: Array<{ email_id: string; error: string }> = []

    while (processed < maxEmails) {
      const remaining = maxEmails - processed
      const fetchCount = Math.min(batchSize, remaining)

      const { data: emails, error: fetchError } = await supabase
        .from('email_items')
        .select('id')
        .is('triage_class', null)
        .not('body_text', 'is', null)
        .order('received_at', { ascending: false })
        .limit(fetchCount)

      if (fetchError) {
        throw new Error(`Failed to fetch emails for backfill: ${fetchError.message}`)
      }

      if (!emails?.length) break

      for (const email of emails) {
        processed++

        try {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/nemoclaw-triage-classifier`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({ emailId: email.id }),
          })

          if (!response.ok) {
            const text = await response.text()
            failed++
            failures.push({ email_id: email.id, error: `HTTP ${response.status}: ${text.slice(0, 200)}` })
          } else {
            succeeded++
          }
        } catch (error) {
          failed++
          failures.push({ email_id: email.id, error: error instanceof Error ? error.message : 'Unknown error' })
        }

        if (delayMs > 0) await sleep(delayMs)
      }

      if (emails.length < fetchCount) break
    }

    return new Response(JSON.stringify({
      success: true,
      processed,
      succeeded,
      failed,
      failures: failures.slice(0, 50),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unexpected error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
