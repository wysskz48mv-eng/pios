/**
 * /platform/board-pack — Board Pack Generator
 * Auto-compiles board-ready report from live PIOS data
 * Obsidian Command v3.0.2 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useCallback } from 'react'
import { FileText, RefreshCw, AlertTriangle, TrendingUp,
         CheckCircle2, Shield, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

type Risk = { type: string; label: string; severity: 'high' | 'medium' | 'low' }
type OKR  = { title: string; progress: number; keyResults: { title: string; current: number; target: number }[] }

interface Pack {
  meta: { generatedAt: string; period: string; preparedBy: string; organisation: string }
  narrative: Record<string, string>
  financials: { snapshot: any; ytdExpenses: number; activeContracts: number; contractsValue: number }
  okrs: OKR[]
  decisions: any[]
  ip: { assets: any[]; expiringSoon: any[] }
  contracts: { active: any[]; expiringSoon: any[] }
  tasks: { open: number; critical: number; overdue: number }
  projects: { active: any[] }
  stakeholders: any[]
  risks: Risk[]
}

// ── Shared styles ─────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
  borderRadius: 12, padding: '18px 20px', marginBottom: 14,
}
const sectionTitle = (color = 'var(--pios-dim)'): React.CSSProperties => ({
  fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 500,
  letterSpacing: '0.1em', textTransform: 'uppercase' as const,
  color, marginBottom: 12,
})
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10 }

function fmt(n: number | null | undefined, prefix = '') {
  if (n == null) return '—'
  return prefix + new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

// ── Collapsible section ───────────────────────────────────────────────────
function Section({ title, color, children, defaultOpen = true }:
  { title: string; color?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={card}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: open ? 14 : 0,
      }}>
        <span style={sectionTitle(color ?? 'var(--pios-dim)')}>{title}</span>
        {open ? <ChevronDown size={14} color="var(--pios-dim)" /> : <ChevronRight size={14} color="var(--pios-dim)" />}
      </button>
      {open && children}
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--pios-surface2)', flex: 1, minWidth: 100 }}>
      <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: color ?? 'var(--pios-text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

// ── Risk pill ─────────────────────────────────────────────────────────────
function RiskPill({ risk }: { risk: Risk }) {
  const colors = {
    high:   { bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.25)',  text: 'var(--dng)' },
    medium: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: 'var(--saas)' },
    low:    { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: 'var(--fm)' },
  }
  const c = colors[risk.severity]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px', borderRadius: 8,
      background: c.bg, border: `1px solid ${c.border}`,
    }}>
      <AlertTriangle size={12} color={c.text} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...mono, color: c.text, marginRight: 8 }}>{risk.type}</span>
        <span style={{ fontSize: 12, color: 'var(--pios-text)' }}>{risk.label}</span>
      </div>
    </div>
  )
}

// ── OKR progress bar ──────────────────────────────────────────────────────
function OKRCard({ okr }: { okr: OKR }) {
  const [open, setOpen] = useState(false)
  const pct = Math.min(100, Math.max(0, okr.progress))
  const color = pct >= 70 ? 'var(--fm)' : pct >= 40 ? 'var(--saas)' : 'var(--dng)'
  return (
    <div style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 9, background: 'var(--pios-surface2)', cursor: 'pointer' }}
      onClick={() => setOpen(v => !v)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{okr.title}</span>
        <span style={{ ...mono, color }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: 'var(--pios-surface3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s' }} />
      </div>
      {open && okr.keyResults.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {okr.keyResults.map((kr, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--pios-muted)' }}>
              <span>{kr.title}</span>
              <span style={mono}>{kr.current ?? '—'} / {kr.target ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function BoardPackPage() {
  const [pack,     setPack]     = useState<Pack | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/board-pack')
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed')
      setPack(await r.json())
    } catch (e: unknown) { setError((e as Error).message) }
    setLoading(false)
  }, [])

  const narrativeLabels: Record<string, string> = {
    chairOpening:       'Chair opening',
    financialNarrative: 'Financial position',
    strategicProgress:  'Strategic progress',
    keyDecisions:       'Key decisions',
    riskAlert:          'Risk & governance',
    outlook:            'Outlook',
  }

  return (
    <div className="fade-up" style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' as const }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, letterSpacing: '-0.03em', marginBottom: 5 }}>
            Board Pack
          </h1>
          <p style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
            Auto-compiled from live financials, OKRs, IP vault, contracts, tasks and projects
          </p>
        </div>
        <button onClick={generate} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 18px', borderRadius: 9, border: 'none',
          background: loading ? 'rgba(99,73,255,0.4)' : 'var(--ai)',
          color: '#fff', fontSize: 13, fontWeight: 500,
          fontFamily: 'var(--font-sans)', cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}>
          {loading
            ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating…</>
            : <><RefreshCw size={15} /> {pack ? 'Regenerate' : 'Generate Pack'}</>}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 9, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: 'var(--dng)', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {!pack && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
          <FileText size={36} color="var(--pios-dim)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, marginBottom: 8 }}>
            No board pack generated yet
          </p>
          <p style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            Click Generate to pull live data from your financials, OKRs, IP vault, contracts, and tasks — NemoClaw™ writes the board narrative.
          </p>
          <button onClick={generate} style={{
            padding: '9px 20px', borderRadius: 9, border: 'none',
            background: 'var(--ai)', color: '#fff', fontSize: 13,
            fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}>Generate Pack</button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 0', color: 'var(--pios-muted)', fontSize: 13 }}>
          <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
          NemoClaw™ is compiling your board pack…
        </div>
      )}

      {pack && !loading && (
        <>
          {/* Meta strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' as const,
            padding: '10px 16px', borderRadius: 9,
            background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
            marginBottom: 18,
          }}>
            <span style={{ ...mono, color: 'var(--pios-text)', fontWeight: 600 }}>{pack.meta.organisation}</span>
            <span style={{ ...mono, color: 'var(--pios-dim)' }}>·</span>
            <span style={{ ...mono, color: 'var(--pios-muted)' }}>{pack.meta.period}</span>
            <span style={{ ...mono, color: 'var(--pios-dim)' }}>·</span>
            <span style={{ ...mono, color: 'var(--pios-muted)' }}>
              Generated {new Date(pack.meta.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Risks — always first if any */}
          {pack.risks.length > 0 && (
            <Section title={`Risk & governance — ${pack.risks.length} item${pack.risks.length > 1 ? 's' : ''} need attention`} color="var(--dng)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {pack.risks.map((r, i) => <RiskPill key={i} risk={r} />)}
              </div>
            </Section>
          )}

          {/* Financial snapshot */}
          <Section title="Financial position" color="var(--fm)">
            {pack.narrative.financialNarrative && (
              <p style={{ fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.7, marginBottom: 14 }}>
                {pack.narrative.financialNarrative}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
              <Stat label="Revenue" value={fmt(pack.financials.snapshot?.revenue, 'SAR ')} color="var(--fm)" />
              <Stat label="Expenses" value={fmt(pack.financials.snapshot?.expenses, 'SAR ')} />
              <Stat label="Cash position" value={fmt(pack.financials.snapshot?.cash_position, 'SAR ')} />
              <Stat label="YTD expenses" value={fmt(pack.financials.ytdExpenses, 'SAR ')} />
              <Stat label="Active contracts" value={pack.financials.activeContracts} />
              <Stat label="Contract value" value={fmt(pack.financials.contractsValue, 'SAR ')} color="var(--academic)" />
            </div>
          </Section>

          {/* OKRs */}
          <Section title={`Strategic OKRs — ${pack.okrs.length} active`} color="var(--ai3)">
            {pack.narrative.strategicProgress && (
              <p style={{ fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.7, marginBottom: 14 }}>
                {pack.narrative.strategicProgress}
              </p>
            )}
            {pack.okrs.length === 0
              ? <p style={{ fontSize: 12, color: 'var(--pios-dim)' }}>No active OKRs. Add them in Executive OS.</p>
              : pack.okrs.map((okr, i) => <OKRCard key={i} okr={okr} />)
            }
          </Section>

          {/* Key decisions */}
          {pack.decisions.length > 0 && (
            <Section title="Key decisions" color="var(--pro)">
              {pack.narrative.keyDecisions && (
                <p style={{ fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.7, marginBottom: 14 }}>
                  {pack.narrative.keyDecisions}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pack.decisions.map((d, i) => (
                  <div key={i} style={{ padding: '11px 14px', borderRadius: 9, background: 'var(--pios-surface2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: d.rationale ? 5 : 0 }}>
                      <CheckCircle2 size={13} color="var(--fm)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{d.title}</span>
                      {d.status && (
                        <span style={{ ...mono, fontSize: 9, padding: '1px 6px', borderRadius: 4,
                          background: 'var(--ai-subtle)', color: 'var(--ai3)' }}>{d.status}</span>
                      )}
                    </div>
                    {d.rationale && <p style={{ fontSize: 11.5, color: 'var(--pios-muted)', lineHeight: 1.6, paddingLeft: 21 }}>{d.rationale}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* IP portfolio */}
          <Section title={`IP portfolio — ${pack.ip.assets.length} asset${pack.ip.assets.length !== 1 ? 's' : ''}`} color="var(--saas)" defaultOpen={pack.ip.expiringSoon.length > 0}>
            <div style={{ display: 'flex', gap: 10, marginBottom: pack.ip.assets.length > 0 ? 14 : 0, flexWrap: 'wrap' as const }}>
              <Stat label="Total IP assets" value={pack.ip.assets.length} />
              <Stat label="Expiring in 90d" value={pack.ip.expiringSoon.length} color={pack.ip.expiringSoon.length > 0 ? 'var(--dng)' : undefined} />
            </div>
            {pack.ip.assets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {pack.ip.assets.slice(0, 6).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--pios-border)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Shield size={12} color="var(--saas)" />
                      <span>{a.name}</span>
                      <span style={{ ...mono, fontSize: 9, color: 'var(--pios-dim)' }}>{a.type}</span>
                    </span>
                    <span style={{ ...mono, color: a.expiry_date <= new Date(Date.now() + 90*86400000).toISOString().slice(0,10) ? 'var(--dng)' : 'var(--pios-muted)' }}>
                      {a.expiry_date ?? a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Operations */}
          <Section title="Operations snapshot" defaultOpen={false}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 14 }}>
              <Stat label="Open tasks" value={pack.tasks.open} />
              <Stat label="Critical" value={pack.tasks.critical} color={pack.tasks.critical > 0 ? 'var(--dng)' : undefined} />
              <Stat label="Overdue" value={pack.tasks.overdue} color={pack.tasks.overdue > 0 ? 'var(--saas)' : undefined} />
              <Stat label="Active projects" value={pack.projects.active.length} />
            </div>
            {pack.projects.active.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pack.projects.active.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, flex: 1 }}>{p.title}</span>
                    <div style={{ width: 80, height: 3, background: 'var(--pios-surface3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${p.progress ?? 0}%`, height: '100%', background: 'var(--ai)', borderRadius: 2 }} />
                    </div>
                    <span style={{ ...mono, color: 'var(--pios-dim)', minWidth: 30, textAlign: 'right' as const }}>{p.progress ?? 0}%</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* AI narrative — outlook */}
          {pack.narrative.outlook && (
            <div style={{ ...card, borderLeft: '3px solid var(--ai)', borderRadius: '0 12px 12px 0' }}>
              <div style={sectionTitle('var(--ai3)')}>Outlook — NemoClaw™</div>
              <p style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.75 }}>{pack.narrative.outlook}</p>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '20px 0 8px', ...mono, color: 'var(--pios-dim)' }}>
            {pack.meta.organisation} · Board Pack · {pack.meta.period} · Prepared by {pack.meta.preparedBy} via PIOS™
          </div>
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
