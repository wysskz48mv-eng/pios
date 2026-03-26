/**
 * POST /api/research/verify
 * Batch-verify citations from the literature library, research search,
 * or academic module AI outputs.
 *
 * Body: { citations: CitationInput[] }
 * Returns: GuardReport
 *
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyCitations, type CitationInput } from '@/lib/citation-guard'

export const runtime   = 'nodejs'
export const maxDuration = 45

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { citations } = body as { citations: CitationInput[] }

    if (!Array.isArray(citations) || citations.length === 0) {
      return NextResponse.json({ error: 'citations array required' }, { status: 400 })
    }
    if (citations.length > 30) {
      return NextResponse.json({ error: 'Maximum 30 citations per request' }, { status: 400 })
    }

    const report = await verifyCitations(citations)
    return NextResponse.json(report)
  } catch (err: unknown) {
    console.error('/api/research/verify:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Verification failed' }, { status: 500 })
  }
}
