import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  // 1. Nullify email body text/preview older than 90 days (keep metadata: subject, from, date)
  const { data: nullifiedRows } = await supabase
    .from('email_items')
    .update({ body_text: null, body_preview: null })
    .lt('received_at', ninetyDaysAgo)
    .not('body_text', 'is', null)
    .select('id')
  const emailsBodiesNullified = nullifiedRows?.length ?? 0

  // Log to audit_log
  await supabase.from('audit_log').insert({
    entity_type: 'data_retention',
    action: 'nullify_email_bodies',
    details: { threshold: '90 days', affected_rows: emailsBodiesNullified ?? 0 },
    created_at: new Date().toISOString(),
  })

  // 2. Delete email drafts older than 30 days
  const { data: deletedRows } = await supabase
    .from('email_drafts')
    .delete()
    .lt('created_at', thirtyDaysAgo)
    .select('id')
  const draftsDeleted = deletedRows?.length ?? 0

  // Log to audit_log
  await supabase.from('audit_log').insert({
    entity_type: 'data_retention',
    action: 'delete_old_drafts',
    details: { threshold: '30 days', affected_rows: draftsDeleted ?? 0 },
    created_at: new Date().toISOString(),
  })

  return NextResponse.json({
    ok: true,
    email_bodies_nullified: emailsBodiesNullified,
    drafts_deleted: draftsDeleted,
  })
}
