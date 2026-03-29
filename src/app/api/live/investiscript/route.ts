import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'
import { createClient } from '@/lib/supabase/server'

// GET /api/live/investiscript
// Pulls live metrics from the InvestiScript Supabase project via direct pg connection.
// Uses SUPABASE_IS_SERVICE_KEY for auth — falls back gracefully if not configured.
// PIOS v3.0 | VeritasIQ Technologies Ltd

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const IS_DB_URL = process.env.SUPABASE_IS_DB_URL ?? ''
const IS_KEY    = process.env.SUPABASE_IS_SERVICE_KEY ?? ''
const IS_URL    = 'https://dexsdwqkunnmhxcwayda.supabase.co'

export async function GET(_req: NextRequest) {
  // Auth guard — must be a signed-in PIOS user
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!IS_KEY && !IS_DB_URL) {
    return NextResponse.json({
      connected: false,
      error: 'SUPABASE_IS_SERVICE_KEY not configured',
      snapshot: null,
    })
  }

  try {
    const now           = new Date()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString()
    const sevenDaysAgo  = new Date(Date.now() -  7 * 86400_000).toISOString()

    // Use direct pg connection if IS_DB_URL is set, otherwise use REST API
    if (IS_DB_URL) {
      return await queryViaPg(IS_DB_URL, now, thirtyDaysAgo, sevenDaysAgo)
    }

    // Fallback: Supabase REST API with service key
    return await queryViaRest(IS_KEY, IS_URL, now, thirtyDaysAgo, sevenDaysAgo)

  } catch (err: unknown) {
    return NextResponse.json({
      connected: false,
      error: (err as Error).message ?? 'Unknown error',
      snapshot: null,
    })
  }
}

async function queryViaPg(dbUrl: string, now: Date, thirtyDaysAgo: string, sevenDaysAgo: string) {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()

    const [userR, orgR, topicR, scriptR, usageR] = await Promise.all([
      client.query(`SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE "createdAt" > $1) as recent
        FROM "User"`, [thirtyDaysAgo]),
      client.query(`SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE "planStatus" = 'trialing') as trialing,
        COUNT(*) FILTER (WHERE "planStatus" = 'active') as active_orgs,
        COUNT(*) FILTER (WHERE "createdAt" > $1) as recent
        FROM "Organisation"`, [thirtyDaysAgo]),
      client.query(`SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE "createdAt" > $1) as recent_week
        FROM "Topic"`, [sevenDaysAgo]),
      client.query(`SELECT COUNT(*) as total FROM "Script"`),
      client.query(`SELECT
        COALESCE(SUM("inputTokens"), 0) as input_tokens,
        COALESCE(SUM("outputTokens"), 0) as output_tokens,
        COALESCE(SUM("costUsd"), 0) as cost_usd
        FROM "UsageRecord" WHERE "createdAt" > $1`, [thirtyDaysAgo]),
    ])

    return buildResponse(now, thirtyDaysAgo,
      { total: Number(userR.rows[0].total), recent: Number(userR.rows[0].recent) },
      { total: Number(orgR.rows[0].total), trialing: Number(orgR.rows[0].trialing), active: Number(orgR.rows[0].active_orgs), recent: Number(orgR.rows[0].recent) },
      { total: Number(topicR.rows[0].total), recentWeek: Number(topicR.rows[0].recent_week) },
      { total: Number(scriptR.rows[0].total) },
      { input: Number(usageR.rows[0].input_tokens), output: Number(usageR.rows[0].output_tokens), cost: Number(usageR.rows[0].cost_usd) }
    )
  } finally {
    await client.end()
  }
}

async function queryViaRest(key: string, url: string, now: Date, thirtyDaysAgo: string, sevenDaysAgo: string) {
  // Use fetch directly against PostgREST — handles PascalCase table names
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'count=exact',
  }

  const base = `${url}/rest/v1`

  const [userR, orgR, topicR, scriptR, usageR] = await Promise.all([
    fetch(`${base}/User?select=id,createdAt&order=createdAt.desc`, { headers }).then(r => r.json()),
    fetch(`${base}/Organisation?select=id,name,plan,planStatus,trialEndsAt,createdAt`, { headers }).then(r => r.json()),
    fetch(`${base}/Topic?select=id,createdAt&order=createdAt.desc`, { headers }).then(r => r.json()),
    fetch(`${base}/Script?select=id`, { headers }).then(r => r.json()),
    fetch(`${base}/UsageRecord?select=inputTokens,outputTokens,costUsd,createdAt&createdAt=gte.${thirtyDaysAgo}`, { headers }).then(r => r.json()),
  ])

  // Check for PostgREST errors
  if (userR?.code || orgR?.code) {
    throw new Error(userR?.message ?? orgR?.message ?? `PostgREST error: ${JSON.stringify(userR)}`)
  }

  const users  = Array.isArray(userR)  ? userR  : []
  const orgs   = Array.isArray(orgR)   ? orgR   : []
  const topics = Array.isArray(topicR) ? topicR : []
  const scripts = Array.isArray(scriptR) ? scriptR : []
  const usage  = Array.isArray(usageR) ? usageR : []

  const trialing = orgs.filter((o: any) => o.planStatus === 'trialing').length
  const active   = orgs.filter((o: any) => o.planStatus === 'active').length

  return buildResponse(now, thirtyDaysAgo,
    { total: users.length, recent: users.filter((u: any) => u.createdAt > thirtyDaysAgo).length },
    { total: orgs.length, trialing, active, recent: orgs.filter((o: any) => o.createdAt > thirtyDaysAgo).length },
    { total: topics.length, recentWeek: topics.filter((t: any) => t.createdAt > sevenDaysAgo).length },
    { total: scripts.length },
    {
      input:  usage.reduce((s: number, r: any) => s + Number(r.inputTokens  || 0), 0),
      output: usage.reduce((s: number, r: any) => s + Number(r.outputTokens || 0), 0),
      cost:   usage.reduce((s: number, r: any) => s + Number(r.costUsd      || 0), 0),
    }
  )
}

function buildResponse(now: Date, thirtyDaysAgo: string,
  users: { total: number; recent: number },
  orgs: { total: number; trialing: number; active: number; recent: number },
  topics: { total: number; recentWeek: number },
  scripts: { total: number },
  usage: { input: number; output: number; cost: number }
) {
  return NextResponse.json({
    connected: true,
    snapshot: {
      users: {
        total:         users.total,
        recentSignups: users.recent,
      },
      organisations: {
        total:     orgs.total,
        trialing:  orgs.trialing,
        active:    orgs.active,
        recentNew: orgs.recent,
      },
      investigations: {
        total:      topics.total,
        recentWeek: topics.recentWeek,
      },
      scripts: {
        total: scripts.total,
      },
      apiUsage: {
        inputTokens:  usage.input,
        outputTokens: usage.output,
        totalTokens:  usage.input + usage.output,
        costUsd:      Math.round(usage.cost * 100) / 100,
        period:       'last 30 days',
      },
      pulledAt: now.toISOString(),
    },
  })
}


