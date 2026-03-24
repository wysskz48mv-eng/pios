/**
 * /api/expenses — PIOS Expense Tracker
 * Full CRUD with server-side validation, AI auto-categorise, and CSV export.
 *
 * GET    ?domain=&category=&tax_year=&currency=&limit=   → list + summary stats
 * POST   { action: 'create' | 'ai_categorise' | 'export_csv', ...body }
 * PATCH  { id, ...updates }
 * DELETE ?id=
 *
 * All operations scoped to auth.uid() — server enforces ownership.
 * RLS on `expenses` table provides defence-in-depth.
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'

// ── Tax-year helper ───────────────────────────────────────────────────────────
function getTaxYear(dateStr: string): string {
  const d = new Date(dateStr)
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
  if (m < 4 || (m === 4 && day < 6)) return `${y - 1}-${String(y).slice(2)}`
  return `${y}-${String(y + 1).slice(2)}`
}

// ── Allowed values ────────────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  'travel', 'software', 'research', 'consulting', 'equipment',
  'meals', 'accommodation', 'professional_fees', 'other',
]
const VALID_DOMAINS    = ['academic', 'fm_consulting', 'saas', 'business', 'personal']
const VALID_CURRENCIES = ['GBP', 'USD', 'SAR', 'AED', 'EUR']

// ── GET /api/expenses ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp       = req.nextUrl.searchParams
    const domain   = sp.get('domain')
    const category = sp.get('category')
    const taxYear  = sp.get('tax_year')
    const currency = sp.get('currency')
    const limit    = Math.min(parseInt(sp.get('limit') ?? '200'), 500)

    let q = supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(limit)

    if (domain   && domain !== 'all')   q = q.eq('domain', domain)
    if (category && category !== 'all') q = q.eq('category', category)
    if (currency && currency !== 'all') q = q.eq('currency', currency)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })

    let expenses = data ?? []

    // Filter by tax year client-side (derived field)
    if (taxYear && taxYear !== 'all') {
      expenses = expenses.filter((e: Record<string, unknown>) => getTaxYear(String(e.date ?? "")) === taxYear)
    }

    // ── Summary stats ─────────────────────────────────────────────────────────
    const byCategory: Record<string, number> = {}
    const byDomain:   Record<string, number> = {}
    const byCurrency: Record<string, number> = {}
    const byTaxYear:  Record<string, number> = {}

    for (const e of (expenses as any[])) {
      const amt = parseFloat(e.amount) || 0
      if (e.category) byCategory[String(e.category ?? "")] = (byCategory[e.category] ?? 0) + amt
      if (e.domain)   byDomain[String(e.domain ?? "")]     = (byDomain[e.domain]   ?? 0) + amt
      if (e.currency) byCurrency[String(e.currency ?? "")] = (byCurrency[e.currency] ?? 0) + amt
      const ty = getTaxYear(String(e.date ?? ""))
      byTaxYear[ty] = (byTaxYear[ty] ?? 0) + amt
    }

    return NextResponse.json({
      expenses,
      count: expenses.length,
      summary: { byCategory, byDomain, byCurrency, byTaxYear },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/expenses ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    // ── AI auto-categorise ────────────────────────────────────────────────────
    if (body.action === 'ai_categorise') {
      const { description, amount, currency } = body
      if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

      const system = `You are PIOS AI helping classify business expenses. Return ONLY valid JSON with no preamble:
{
  "category": "one of: travel|software|research|consulting|equipment|meals|accommodation|professional_fees|other",
  "domain": "one of: academic|fm_consulting|saas|business|personal",
  "billable": true or false,
  "reasoning": "one sentence"
}`
      const raw = await callClaude(
        [{ role: 'user', content: `Classify this expense:\nDescription: ${description}\nAmount: ${currency ?? 'GBP'} ${amount ?? '?'}\n\nReturn JSON only.` }],
        system,
        300,
      )
      let parsed: any = {}
      try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { parsed = {} }
      return NextResponse.json({ suggestion: parsed })
    }

    // ── CSV export ────────────────────────────────────────────────────────────
    if (body.action === 'export_csv') {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(500)

      const rows = data ?? []
      const header = ['date', 'description', 'amount', 'currency', 'category', 'domain', 'billable', 'client', 'notes', 'tax_year'].join(',')
      const lines  = rows.map((e: Record<string, unknown>) => [
        e.date ?? '',
        `"${String(e.description ?? '').replace(/"/g, '""')}"`,
        e.amount ?? 0,
        e.currency ?? 'GBP',
        e.category ?? '',
        e.domain ?? '',
        e.billable ? 'yes' : 'no',
        `"${String(e.client ?? '').replace(/"/g, '""')}"`,
        `"${String(e.notes ?? '').replace(/"/g, '""')}"`,
        getTaxYear(String(e.date ?? new Date().toISOString())),
      ].join(','))

      const csv = [header, ...lines].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="pios-expenses-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    // ── Create expense ────────────────────────────────────────────────────────
    const { description, amount, currency, category, domain, date, billable, client, notes } = body

    if (!description?.trim())       return NextResponse.json({ error: 'description is required' }, { status: 400 })
    if (!amount || isNaN(parseFloat(amount))) return NextResponse.json({ error: 'valid amount is required' }, { status: 400 })
    if (!date)                       return NextResponse.json({ error: 'date is required' }, { status: 400 })
    if (category && !VALID_CATEGORIES.includes(category)) return NextResponse.json({ error: `invalid category` }, { status: 400 })
    if (domain   && !VALID_DOMAINS.includes(domain))       return NextResponse.json({ error: `invalid domain` }, { status: 400 })
    if (currency && !VALID_CURRENCIES.includes(currency))  return NextResponse.json({ error: `invalid currency` }, { status: 400 })

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id:     user.id,
        description: description.trim(),
        amount:      parseFloat(amount),
        currency:    currency ?? 'GBP',
        category:    category ?? null,
        domain:      domain   ?? 'personal',
        date,
        billable:    !!billable,
        client:      client ?? null,
        notes:       notes  ?? null,
        updated_at:  new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    return NextResponse.json({ expense: data }, { status: 201 })

  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH /api/expenses ───────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Validate any provided fields
    if (updates.amount !== undefined && isNaN(parseFloat(updates.amount)))
      return NextResponse.json({ error: 'valid amount required' }, { status: 400 })
    if (updates.category && !VALID_CATEGORIES.includes(updates.category))
      return NextResponse.json({ error: 'invalid category' }, { status: 400 })
    if (updates.domain && !VALID_DOMAINS.includes(updates.domain))
      return NextResponse.json({ error: 'invalid domain' }, { status: 400 })
    if (updates.currency && !VALID_CURRENCIES.includes(updates.currency))
      return NextResponse.json({ error: 'invalid currency' }, { status: 400 })

    if (updates.amount !== undefined) updates.amount = parseFloat(updates.amount)
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)   // ownership enforced server-side
      .select()
      .single()

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    return NextResponse.json({ expense: data })

  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE /api/expenses ──────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)   // ownership enforced — cannot delete other users' records

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    return NextResponse.json({ deleted: true })

  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}
