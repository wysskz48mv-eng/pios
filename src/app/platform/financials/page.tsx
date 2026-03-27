/**
 * /platform/financials — Group Financial Overview
 * Aggregates expenses, payroll, contracts into a single group P&L view
 * PIOS Sprint 36 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Zap, Loader2, RefreshCw, Copy, Check, DollarSign, PiggyBank, FileText, BarChart2 } from 'lucide-react'

type Summary = {
  totalExpensesYTD: number
  payrollYTD: number
  activeContractValue: number
  expByDomain: Record<string, number>
  monthlyBreakdown: Record<string, { expenses: number; payroll: number }>
}
type Contract = { title: string; contract_type: string; counterparty: string; value?: number; currency?: string; end_date?: string }

const DOMAIN_COLOR: Record<string, string> = {
  academic:      'bg-[var(--ai)]/10 text-[var(--ai3)]',
  fm_consulting: 'bg-teal-500/10 text-teal-400',
  saas:          'bg-[var(--academic)]/10 text-[var(--academic)]',
  business:      'bg-[var(--saas)]/10 text-[var(--saas)]',
  personal:      'bg-[var(--pios-surface2)] text-[var(--pios-muted)]',
}

export default function FinancialsPage() {
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading]     = useState(true)
  const [commentary, setComm]     = useState<string | null>(null)
  const [generating, setGen]      = useState(false)
  const [copied, setCopied]       = useState(false)
  const [refreshing, setRefresh]  = useState(false)
  const [showSnap, setShowSnap]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [snapForm, setSnapForm]   = useState({
    period: `${new Date().toLocaleString('en-GB', { month: 'short' })} ${new Date().getFullYear()}`,
    period_type: 'month', revenue: '', expenses: '', payroll_cost: '',
    cash_position: '', receivables: '', payables: '', currency: 'GBP', notes: '',
  })

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefresh(true); else setLoading(true)
    try {
      const r = await fetch('/api/financials')
      const d = await r.json()
      setSummary(d.summary ?? null)
      setContracts(d.contracts ?? [])
    } catch { /**/ }
    setLoading(false); setRefresh(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function aiCommentary() {
    if (!summary) return
    setGen(true)
    try {
      const r = await fetch('/api/financials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_commentary', summary }) })
      const d = await r.json()
      setComm(d.commentary ?? null)
    } catch { /**/ }
    setGen(false)
  }

  async function saveSnapshot() {
    setSaving(true)
    try {
      const r = await fetch('/api/financials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_snapshot',
          period: snapForm.period, period_type: snapForm.period_type,
          revenue: Number(snapForm.revenue) || 0,
          expenses: Number(snapForm.expenses) || 0,
          payroll_cost: Number(snapForm.payroll_cost) || 0,
          cash_position: Number(snapForm.cash_position) || 0,
          receivables: Number(snapForm.receivables) || 0,
          payables: Number(snapForm.payables) || 0,
          currency: snapForm.currency, notes: snapForm.notes || null,
        }),
      })
      if (r.ok) { setShowSnap(false); load() }
    } catch { /* silent */ }
    setSaving(false)
  }

  const now = new Date()
  const ytdLabel = `YTD ${now.getFullYear()}`
  const totalBurn = (summary?.totalExpensesYTD ?? 0) + (summary?.payrollYTD ?? 0)
  const months = Object.entries(summary?.monthlyBreakdown ?? {}).sort((a, b) => a[0].localeCompare(b[0]))
  const maxMonthTotal = months.reduce((m, [, v]) => Math.max(m, v.expenses + v.payroll), 1)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-[var(--fm)]" />
          <div>
            <h1 className="text-xl font-semibold">Group Financial Overview</h1>
            <p className="text-sm text-[var(--pios-muted)]">Aggregated view — expenses · payroll · contracts · cash position</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--pios-border)] text-sm text-[var(--pios-muted)] hover:text-[var(--pios-text)]">
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowSnap(s => !s)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--pios-border)] text-sm text-[var(--pios-muted)] hover:text-[var(--pios-text)]">
            + Add snapshot
          </button>
          <button onClick={aiCommentary} disabled={generating || !summary} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--pios-border)] bg-[rgba(16,185,129,0.1)] text-[var(--fm)] text-sm font-medium hover:bg-green-500/15 disabled:opacity-50">
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            CFO Brief
          </button>
        </div>
      </div>

      {/* Snapshot entry form */}
      {showSnap && (
        <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Add Financial Snapshot</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label:'Period', key:'period', placeholder:'Mar 2026' },
              { label:'Currency', key:'currency', placeholder:'GBP' },
              { label:'Revenue', key:'revenue', placeholder:'0', type:'number' },
              { label:'Expenses', key:'expenses', placeholder:'0', type:'number' },
              { label:'Payroll cost', key:'payroll_cost', placeholder:'0', type:'number' },
              { label:'Cash position', key:'cash_position', placeholder:'0', type:'number' },
              { label:'Receivables', key:'receivables', placeholder:'0', type:'number' },
              { label:'Payables', key:'payables', placeholder:'0', type:'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  value={(snapForm as any)[f.key]}
                  onChange={e => setSnapForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40"
                />
              </div>
            ))}
          </div>
          <div className="mb-3">
            <label className="text-xs text-[var(--pios-muted)] block mb-1">Notes (optional)</label>
            <input
              value={snapForm.notes}
              onChange={e => setSnapForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any context for this period..."
              className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSnap(false)} className="px-4 py-2 rounded-lg text-sm text-[var(--pios-muted)] border border-[var(--pios-border)] hover:bg-[var(--pios-surface)]">
              Cancel
            </button>
            <button onClick={saveSnapshot} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgba(16,185,129,0.1)] text-[var(--fm)] border border-[rgba(16,185,129,0.2)] hover:bg-green-500/15 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save snapshot'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--pios-muted)]" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-[var(--dng)]" /><span className="text-xs text-[var(--pios-muted)] uppercase tracking-wide">Expenses {ytdLabel}</span></div>
              <div className="text-2xl font-semibold">£{(summary?.totalExpensesYTD ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><PiggyBank className="w-4 h-4 text-[var(--ai3)]" /><span className="text-xs text-[var(--pios-muted)] uppercase tracking-wide">Payroll {ytdLabel}</span></div>
              <div className="text-2xl font-semibold">£{(summary?.payrollYTD ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><BarChart2 className="w-4 h-4 text-[var(--saas)]" /><span className="text-xs text-[var(--pios-muted)] uppercase tracking-wide">Total burn {ytdLabel}</span></div>
              <div className="text-2xl font-semibold">£{totalBurn.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-[var(--academic)]" /><span className="text-xs text-[var(--pios-muted)] uppercase tracking-wide">Contract pipeline</span></div>
              <div className="text-2xl font-semibold">£{(summary?.activeContractValue ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Spend by domain */}
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Expense breakdown by domain</h3>
              {Object.entries(summary?.expByDomain ?? {}).length === 0 ? (
                <p className="text-xs text-[var(--pios-muted)]">No expenses recorded yet. Add expenses in the Expense Tracker.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(summary?.expByDomain ?? {}).sort((a, b) => b[1] - a[1]).map(([domain, amount]) => {
                    const pct = totalBurn > 0 ? (amount / totalBurn) * 100 : 0
                    return (
                      <div key={domain}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${DOMAIN_COLOR[domain] ?? 'bg-[var(--pios-surface2)] text-[var(--pios-muted)]'}`}>{domain.replace('_', ' ')}</span>
                          <span className="text-sm font-medium">£{amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-[rgba(16,185,129,0.5)] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Monthly trend */}
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Monthly burn trend</h3>
              {months.length === 0 ? (
                <p className="text-xs text-[var(--pios-muted)]">No monthly data yet. Expenses and payroll will appear here.</p>
              ) : (
                <div className="space-y-2">
                  {months.slice(-6).map(([month, v]) => {
                    const total = v.expenses + v.payroll
                    const pct = (total / maxMonthTotal) * 100
                    return (
                      <div key={month}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-[var(--pios-muted)]">{month}</span>
                          <span className="text-xs font-medium">£{total.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                          <div className="h-full bg-[rgba(244,63,94,0.5)] rounded-l-full" style={{ width: `${(v.expenses / maxMonthTotal) * 100}%` }} />
                          <div className="h-full bg-[var(--ai)]/50" style={{ width: `${(v.payroll / maxMonthTotal) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex gap-4 pt-1">
                    <span className="flex items-center gap-1 text-xs text-[var(--pios-muted)]"><span className="w-2 h-2 rounded-full bg-[rgba(244,63,94,0.5)] inline-block" />Expenses</span>
                    <span className="flex items-center gap-1 text-xs text-[var(--pios-muted)]"><span className="w-2 h-2 rounded-full bg-[var(--ai)]/50 inline-block" />Payroll</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active contracts */}
          {contracts.length > 0 && (
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">Active contracts</h3>
              <div className="space-y-2">
                {contracts.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--pios-border)] last:border-0">
                    <div>
                      <div className="text-sm font-medium">{c.title}</div>
                      <div className="text-xs text-[var(--pios-muted)]">{c.counterparty} · {c.contract_type}</div>
                    </div>
                    <div className="text-right">
                      {c.value ? <div className="text-sm font-medium">{c.currency ?? 'GBP'} {Number(c.value).toLocaleString()}</div> : <div className="text-xs text-[var(--pios-muted)]">No value</div>}
                      {c.end_date && <div className="text-xs text-[var(--pios-muted)]">Ends {c.end_date}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Commentary */}
          {commentary && (
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-[var(--fm)]" /><span className="text-sm font-semibold text-[var(--fm)]">CFO Commentary — AI Generated</span></div>
                <button onClick={() => { navigator.clipboard.writeText(commentary); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="flex items-center gap-1 text-xs text-[var(--pios-muted)] hover:text-[var(--pios-text)]">
                  {copied ? <Check className="w-3 h-3 text-[var(--fm)]" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs text-[var(--pios-text)]/80 leading-relaxed whitespace-pre-wrap font-sans">{commentary}</pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}
