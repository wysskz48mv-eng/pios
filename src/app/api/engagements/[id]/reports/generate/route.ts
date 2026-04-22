import { NextRequest } from 'next/server'
import { POST as generateReport } from '@/app/api/engagements/[id]/report/generate/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  return generateReport(req, context)
}
