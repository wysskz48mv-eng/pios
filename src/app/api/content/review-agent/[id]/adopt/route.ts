import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/content/review-agent/[id]/adopt
 * Marks a specific finding in a review job as adopted.
 * Body: { finding_index: number }
 * VeritasIQ Technologies Ltd · PIOS Content Pipeline
 */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { finding_index } = await req.json()
    if (typeof finding_index !== 'number') {
      return NextResponse.json({ error: 'finding_index required' }, { status: 400 })
    }

    // Get current job
    const { data: job, error: jobErr } = await supabase
      .from('content_review_jobs')
      .select('findings, adopted_count')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Review job not found' }, { status: 404 })
    }

    const findings = (job.findings as Array<Record<string, unknown>>) ?? []
    if (finding_index < 0 || finding_index >= findings.length) {
      return NextResponse.json({ error: 'Invalid finding_index' }, { status: 400 })
    }

    // Mark finding as adopted
    findings[finding_index] = { ...findings[finding_index], adopted: true }
    const adoptedCount = findings.filter(f => f.adopted).length

    const { error: updateErr } = await supabase
      .from('content_review_jobs')
      .update({
        findings,
        adopted_count: adoptedCount,
      })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    return NextResponse.json({
      ok:            true,
      finding_index,
      adopted_count: adoptedCount,
      total_findings: findings.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
