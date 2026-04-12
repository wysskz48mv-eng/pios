import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const base = `${req.nextUrl.origin}/api/workbench`

  return NextResponse.json({
    ok: true,
    module: 'consulting-workbench',
    routes: {
      projects: `${base}/projects`,
      step_execution: `${base}/{projectId}/{stepNumber}`,
    },
  })
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Use /api/workbench/projects to create projects and /api/workbench/{projectId}/{stepNumber} for step actions',
    },
    { status: 400 }
  )
}
