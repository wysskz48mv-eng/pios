'use client'
/**
 * /platform/consulting — Consulting Hub
 * Central page for all billable work management.
 * Proposals, quotes, timesheet, invoice tracking.
 *
 * Persona: Founder/CEO, Consultant
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

/* ── Types ──────────────────────────────────────────────────── */
interface Proposal {
  id: string; title: string; client_id?: string; client_name?: string
  status: string; fee_gbp?: number; sent_at?: string; created_at: string
}
interface TimesheetEntry {
  id: string; date: string; hours: number; description?: string
  billable: boolean; invoiced: boolean; client_name?: string
}
interface CPDEntry {
  id: string; title: string; provider?: string; hours: number
  date?: string; professional_body?: string; renewal_date?: string
}
interface Subscription {
  id: string; name: string; category?: string; amount?: number
  currency?: string; next_renewal?: string; status: string; auto_detected?: boolean
}

/* ── Stat card ───────────────────────────────────────────────── */
function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 400, color: accent ?? 'var(--pios-text)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ── Status badge ────────────────────────────────────────────── */
function Badge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    draft: 'var(--pios-muted)', sent: 'var(--academic)', accepted: 'var(--fm)',
    rejected: 'var(--dng)', negotiating: 'var(--warn)', paid: 'var(--fm)',
    overdue: 'var(--dng)', active: 'var(--fm)', cancelled: 'var(--pios-dim)',
  }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${colours[status] ?? 'var(--pios-muted)'}22`, color: colours[status] ?? 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {status}
    </span>
  )
}

/* ── Main page ───────────────────────────────────────────────── */
export default function ConsultingPage() {
  const [tab, setTab]               = useState<'overview' | 'proposals' | 'timesheet' | 'cpd' | 'renewals'>('overview')
  const [proposals, setProposals]   = useState<Proposal[]>([])
  const [timesheet, setTimesheet]   = useState<TimesheetEntry[]>([])
  const [cpd, setCpd]               = useState<CPDEntry[]>([])
  const [subs, setSubs]             = useState<Subscription[]>([])
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, tRes, cRes, sRes] = await Promise.allSettled([
        fetch('/api/consulting/proposals').then(r => r.ok ? r.json() : { proposals: [] }),
        fetch('/api/consulting/timesheet').then(r => r.ok ? r.json() : { entries: [] }),
        fetch('/api/consulting/cpd').then(r => r.ok ? r.json() : { entries: [] }),
        fetch('/api/consulting/subscriptions').then(r => r.ok ? r.json() : { subscriptions: [] }),
      ])
      if (pRes.status === 'fulfilled') setProposals(pRes.value.proposals ?? [])
      if (tRes.status === 'fulfilled') setTimesheet(tRes.value.entries ?? [])
      if (cRes.status === 'fulfilled') setCpd(cRes.value.entries ?? [])
      if (sRes.status === 'fulfilled') setSubs(sRes.value.subscriptions ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Computed stats ── */
  const unbilledHours = timesheet.filter(t => t.billable && !t.invoiced).reduce((s, t) => s + t.hours, 0)
  const activeProposals = proposals.filter(p => ['sent','negotiating'].includes(p.status)).length
  const pendingValue = proposals.filter(p => p.status === 'sent').reduce((s, p) => s + (p.fee_gbp ?? 0), 0)
  const totalCPD = cpd.reduce((s, c) => s + c.hours, 0)
  const renewalsDue = subs.filter(s => {
    if (!s.next_renewal) return false
    const days = Math.ceil((new Date(s.next_renewal).getTime() - Date.now()) / 86400000)
    return days <= 90 && days >= 0
  }).length

  const tabs = ['overview', 'proposals', 'timesheet', 'cpd', 'renewals'] as const

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: 0, letterSpacing: '-0.02em' }}>Consulting</h1>
          <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginTop: 4 }}>Proposals · Timesheet · CPD · Renewals</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/platform/consulting/proposals/new" style={{ padding: '8px 16px', background: 'var(--ai)', borderRadius: 7, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
            + New proposal
          </Link>
          <Link href="/platform/consulting/timesheet/log" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 7, color: 'var(--pios-muted)', textDecoration: 'none', fontSize: 13 }}>
            Log hours
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--pios-border)', marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: tab === t ? '2px solid var(--ai)' : '2px solid transparent', color: tab === t ? 'var(--ai)' : 'var(--pios-muted)', fontSize: 13, fontWeight: tab === t ? 500 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
            {t}
            {t === 'renewals' && renewalsDue > 0 && <span style={{ marginLeft: 6, background: 'var(--dng)', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>{renewalsDue}</span>}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            <Stat label="Unbilled hours"     value={`${unbilledHours.toFixed(1)}h`} sub="this month"       accent="var(--ai)" />
            <Stat label="Active proposals"   value={activeProposals}                sub={`£${pendingValue.toLocaleString()} pending`} accent="var(--academic)" />
            <Stat label="CPD hours (YTD)"    value={`${totalCPD.toFixed(1)}h`}      sub="logged this year"  />
            <Stat label="Renewals due (90d)" value={renewalsDue}                    sub="subscriptions"      accent={renewalsDue > 0 ? 'var(--warn)' : undefined} />
          </div>

          {/* Recent proposals */}
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>Recent proposals</div>
              <button onClick={() => setTab('proposals')} style={{ fontSize: 12, color: 'var(--ai)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {loading ? (
              <div style={{ fontSize: 13, color: 'var(--pios-dim)', padding: '20px 0', textAlign: 'center' }}>Loading...</div>
            ) : proposals.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--pios-dim)', padding: '20px 0', textAlign: 'center' }}>
                No proposals yet · <Link href="/platform/consulting/proposals/new" style={{ color: 'var(--ai)' }}>Create your first →</Link>
              </div>
            ) : proposals.slice(0, 5).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--pios-border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>{p.client_name ?? 'No client'} · {new Date(p.created_at).toLocaleDateString('en-GB')}</div>
                </div>
                {p.fee_gbp && <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', flexShrink: 0 }}>£{p.fee_gbp.toLocaleString()}</div>}
                <Badge status={p.status} />
              </div>
            ))}
          </div>

          {/* Recent timesheet */}
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>Recent timesheet</div>
              <button onClick={() => setTab('timesheet')} style={{ fontSize: 12, color: 'var(--ai)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {timesheet.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--pios-dim)', padding: '20px 0', textAlign: 'center' }}>
                No hours logged · <Link href="/platform/consulting/timesheet/log" style={{ color: 'var(--ai)' }}>Log hours →</Link>
              </div>
            ) : timesheet.slice(0, 5).map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--pios-border)' }}>
                <div style={{ fontSize: 13, color: 'var(--pios-muted)', flexShrink: 0, width: 80 }}>{new Date(t.date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</div>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--pios-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description ?? t.client_name ?? 'No description'}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ai)', flexShrink: 0 }}>{t.hours}h</div>
                {t.invoiced ? <Badge status="paid" /> : t.billable ? <Badge status="sent" /> : <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>non-billable</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── PROPOSALS TAB ── */}
      {tab === 'proposals' && (
        <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Link href="/platform/consulting/proposals/new" style={{ padding: '8px 16px', background: 'var(--ai)', borderRadius: 7, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              + New proposal
            </Link>
          </div>
          {proposals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--pios-dim)', fontSize: 14 }}>
              No proposals yet.<br />
              <Link href="/platform/consulting/proposals/new" style={{ color: 'var(--ai)', fontSize: 13 }}>Create your first proposal →</Link>
            </div>
          ) : proposals.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--pios-border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 3 }}>{p.client_name ?? 'No client'} · Created {new Date(p.created_at).toLocaleDateString('en-GB')}</div>
              </div>
              {p.fee_gbp && <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>£{p.fee_gbp.toLocaleString()}</div>}
              <Badge status={p.status} />
              <Link href={`/platform/consulting/proposals/${p.id}`} style={{ fontSize: 12, color: 'var(--ai)', textDecoration: 'none' }}>View →</Link>
            </div>
          ))}
        </div>
      )}

      {/* ── TIMESHEET TAB ── */}
      {tab === 'timesheet' && (
        <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>
              Unbilled: <span style={{ color: 'var(--ai)' }}>{unbilledHours.toFixed(1)}h</span>
            </div>
            <Link href="/platform/consulting/timesheet/log" style={{ padding: '7px 14px', background: 'var(--ai)', borderRadius: 7, color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>
              + Log hours
            </Link>
          </div>
          {timesheet.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--pios-dim)', fontSize: 14 }}>
              No hours logged yet.<br />
              <Link href="/platform/consulting/timesheet/log" style={{ color: 'var(--ai)', fontSize: 13 }}>Log your first hours →</Link>
            </div>
          ) : timesheet.map(t => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px 80px', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--pios-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{new Date(t.date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--pios-text)' }}>{t.description ?? 'No description'}</div>
                {t.client_name && <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>{t.client_name}</div>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ai)', textAlign: 'right' }}>{t.hours}h</div>
              <div style={{ textAlign: 'right' }}>
                {t.invoiced ? <Badge status="paid" /> : t.billable ? <Badge status="active" /> : <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>non-bill</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CPD TAB ── */}
      {tab === 'cpd' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <Stat label="Total CPD (YTD)"   value={`${totalCPD.toFixed(1)}h`} />
            <Stat label="Entries logged"    value={cpd.length} />
            <Stat label="Certificates"      value={cpd.filter(c => c.certificate_url).length} />
          </div>
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Link href="/platform/consulting/cpd/new" style={{ padding: '7px 14px', background: 'var(--ai)', borderRadius: 7, color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>
                + Log CPD
              </Link>
            </div>
            {cpd.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--pios-dim)', fontSize: 14 }}>
                No CPD entries yet.<br />
                <Link href="/platform/consulting/cpd/new" style={{ color: 'var(--ai)', fontSize: 13 }}>Log your first CPD →</Link>
              </div>
            ) : cpd.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--pios-border)' }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--ai)', width: 50, flexShrink: 0 }}>{c.hours}h</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>
                    {c.provider && `${c.provider} · `}
                    {c.date && new Date(c.date).toLocaleDateString('en-GB')}
                    {c.professional_body && ` · ${c.professional_body}`}
                  </div>
                  {c.renewal_date && (
                    <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 4 }}>
                      Renewal: {new Date(c.renewal_date).toLocaleDateString('en-GB')}
                    </div>
                  )}
                </div>
                {c.certificate_url && (
                  <a href={c.certificate_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--ai)', textDecoration: 'none', flexShrink: 0 }}>Certificate →</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RENEWALS TAB ── */}
      {tab === 'renewals' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <Stat label="Due in 30 days" value={subs.filter(s => { const d = s.next_renewal ? Math.ceil((new Date(s.next_renewal).getTime() - Date.now()) / 86400000) : 999; return d <= 30 && d >= 0 }).length} accent="var(--dng)" />
            <Stat label="Due in 90 days" value={renewalsDue} accent="var(--warn)" />
            <Stat label="Active subscriptions" value={subs.filter(s => s.status === 'active').length} />
          </div>
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Link href="/platform/consulting/renewals/new" style={{ padding: '7px 14px', background: 'var(--ai)', borderRadius: 7, color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>
                + Add subscription
              </Link>
            </div>
            {subs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--pios-dim)', fontSize: 14 }}>
                No subscriptions tracked yet.<br />
                <span style={{ fontSize: 13, color: 'var(--pios-muted)' }}>Connect email to auto-detect renewals, or add manually.</span>
              </div>
            ) : subs.sort((a, b) => (a.next_renewal ?? '9999') < (b.next_renewal ?? '9999') ? -1 : 1).map(s => {
              const daysLeft = s.next_renewal ? Math.ceil((new Date(s.next_renewal).getTime() - Date.now()) / 86400000) : null
              const urgent = daysLeft !== null && daysLeft <= 30
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--pios-border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>{s.name}</span>
                      {s.auto_detected && <span style={{ fontSize: 9, color: 'var(--ai)', border: '1px solid var(--ai)', padding: '1px 5px', borderRadius: 4 }}>AUTO</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>
                      {s.category} {s.amount ? `· ${s.currency ?? 'GBP'} ${s.amount}/month` : ''}
                    </div>
                  </div>
                  {daysLeft !== null && (
                    <div style={{ fontSize: 12, color: urgent ? 'var(--dng)' : 'var(--pios-muted)', fontWeight: urgent ? 600 : 400, flexShrink: 0 }}>
                      {daysLeft <= 0 ? 'Overdue' : `${daysLeft}d`}
                    </div>
                  )}
                  {s.next_renewal && (
                    <div style={{ fontSize: 11, color: 'var(--pios-dim)', flexShrink: 0 }}>
                      {new Date(s.next_renewal).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                    </div>
                  )}
                  <Badge status={s.status} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
