/**
 * /platform/stakeholders — Stakeholder CRM
 * Investor · Client · Partner · Academic relationship intelligence
 * Obsidian Command v3.0.2 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Zap, Loader2, Trash2, Calendar,
         ChevronDown, ExternalLink, AlertTriangle } from 'lucide-react'

type Stakeholder = {
  id: string; name: string; organisation?: string; category: string
  importance: number; relationship_status: string; notes?: string
  next_touchpoint?: string; last_contact_date?: string; linkedin_url?: string
  overdue?: boolean
}
type Briefing = {
  opening?: string; key_objectives?: string[]; talking_points?: string[]
  risks?: string; ask?: string
}

const CATEGORIES = ['investor','client','partner','academic','government','media','advisor','supplier','internal']

const HEALTH_META: Record<string, { label: string; color: string; bg: string }> = {
  strong:  { label: 'Strong',  color: 'var(--fm)',       bg: 'rgba(16,185,129,0.08)'  },
  good:    { label: 'Good',    color: 'var(--academic)', bg: 'rgba(79,142,247,0.08)'  },
  neutral: { label: 'Neutral', color: 'var(--pios-muted)', bg: 'var(--pios-surface2)' },
  at_risk: { label: 'At risk', color: 'var(--saas)',     bg: 'rgba(245,158,11,0.08)'  },
  dormant: { label: 'Dormant', color: 'var(--pios-dim)', bg: 'rgba(63,63,70,0.3)'     },
}
const CAT_COLOR: Record<string, string> = {
  investor: 'var(--saas)', client: 'var(--fm)', partner: 'var(--ai3)',
  academic: 'var(--academic)', government: 'var(--pro)', media: 'var(--dng)',
  advisor: 'var(--ai)', supplier: 'var(--pios-muted)', internal: 'var(--pios-sub)',
}

const inp: React.CSSProperties = {
  display: 'block', width: '100%', padding: '8px 12px',
  background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
  borderRadius: 8, color: 'var(--pios-text)', fontSize: 13,
  fontFamily: 'var(--font-sans)', outline: 'none',
}
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10 }

function ImportanceDots({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%',
          background: i <= n ? 'var(--ai3)' : 'var(--pios-surface3)' }} />
      ))}
    </div>
  )
}

export default function StakeholdersPage() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([])
  const [loading, setLoading]           = useState(true)
  const [catFilter, setCatFilter]       = useState('all')
  const [healthFilter, setHealthFilter] = useState('all')
  const [selected, setSelected]         = useState<Stakeholder | null>(null)
  const [briefing, setBriefing]         = useState<Briefing | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', organisation: '', category: 'client', importance: 3,
    relationship_status: 'neutral', notes: '', next_touchpoint: '', linkedin_url: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (catFilter !== 'all')    params.set('category', catFilter)
      if (healthFilter !== 'all') params.set('health', healthFilter)
      const r = await fetch(`/api/stakeholders?${params}`)
      const d = await r.json()
      setStakeholders(d.stakeholders ?? [])
    } catch { setStakeholders([]) }
    setLoading(false)
  }, [catFilter, healthFilter])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    await fetch('/api/stakeholders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name:'', organisation:'', category:'client', importance:3,
              relationship_status:'neutral', notes:'', next_touchpoint:'', linkedin_url:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function del(id: string) {
    if (!window.confirm('Remove this stakeholder?')) return
    setDeleting(id)
    await fetch(`/api/stakeholders?id=${id}`, { method: 'DELETE' })
    setStakeholders(prev => prev.filter(s => s.id !== id))
    if (selected?.id === id) { setSelected(null); setBriefing(null) }
    setDeleting(null)
  }

  async function getBriefing(s: Stakeholder) {
    setSelected(s); setBriefing(null); setBriefLoading(true)
    try {
      const r = await fetch('/api/stakeholders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_briefing', stakeholder: s }),
      })
      const d = await r.json()
      setBriefing(d.briefing ?? null)
    } catch { setBriefing({ opening: 'Briefing failed — please retry.' }) }
    setBriefLoading(false)
  }

  async function logContact(id: string) {
    const today = new Date().toISOString().slice(0, 10)
    await fetch('/api/stakeholders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, last_contact_date: today }),
    })
    setStakeholders(prev => prev.map(s => s.id === id ? { ...s, last_contact_date: today, overdue: false } : s))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, last_contact_date: today, overdue: false } : prev)
  }

  const overdue = stakeholders.filter(s => s.overdue).length
  const atRisk  = stakeholders.filter(s => s.relationship_status === 'at_risk').length

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 0, height: 'calc(100vh - 120px)', minHeight: 500 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── LEFT: List ──────────────────────────────────────────────────── */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--pios-border)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--pios-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Users size={15} color="var(--academic)" />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, letterSpacing: '-0.02em', flex: 1 }}>
              Stakeholders
            </span>
            <button onClick={() => setShowForm(!showForm)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              borderRadius: 7, border: 'none', background: 'var(--ai)', color: '#fff',
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}>
              <Plus size={11} /> Add
            </button>
          </div>

          {/* Alerts */}
          {(overdue > 0 || atRisk > 0) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {overdue > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', fontSize: 10.5, color: 'var(--dng)' }}>
                  <AlertTriangle size={10} /> {overdue} follow-up overdue
                </div>
              )}
              {atRisk > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10.5, color: 'var(--saas)' }}>
                  {atRisk} at risk
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 6 }}>
            <select style={{ ...inp, fontSize: 11, flex: 1 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select style={{ ...inp, fontSize: 11, flex: 1 }} value={healthFilter} onChange={e => setHealthFilter(e.target.value)}>
              <option value="all">All health</option>
              {Object.entries(HEALTH_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {/* Add form */}
        {showForm && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--pios-border)', flexShrink: 0, background: 'var(--pios-surface)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input style={inp} placeholder="Name *" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} autoFocus />
              <input style={inp} placeholder="Organisation" value={form.organisation} onChange={e => setForm(p => ({...p, organisation: e.target.value}))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <select style={inp} value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <select style={inp} value={form.relationship_status} onChange={e => setForm(p => ({...p, relationship_status: e.target.value}))}>
                  {Object.entries(HEALTH_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 4 }}>Importance (1–5)</div>
                <input type="range" min={1} max={5} step={1} value={form.importance}
                  onChange={e => setForm(p => ({...p, importance: Number(e.target.value)}))}
                  style={{ width: '100%', accentColor: 'var(--ai)' }} />
              </div>
              <input type="date" style={inp} placeholder="Next touchpoint" value={form.next_touchpoint} onChange={e => setForm(p => ({...p, next_touchpoint: e.target.value}))} />
              <textarea style={{ ...inp, resize: 'vertical' as const, minHeight: 56, fontFamily: 'var(--font-sans)' }} placeholder="Notes…" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={save} disabled={!form.name || saving} style={{
                  flex: 1, padding: '7px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: form.name ? 'var(--ai)' : 'rgba(99,73,255,0.3)', color: '#fff', fontSize: 12, fontWeight: 500,
                }}>{saving ? 'Saving…' : 'Add stakeholder'}</button>
                <button onClick={() => setShowForm(false)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--pios-border2)', background: 'transparent', color: 'var(--pios-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Stakeholder list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--pios-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading…
            </div>
          ) : stakeholders.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--pios-dim)', fontSize: 12 }}>
              No stakeholders yet. Add your first.
            </div>
          ) : stakeholders.map(s => {
            const h = HEALTH_META[s.relationship_status] ?? HEALTH_META.neutral
            const isSelected = selected?.id === s.id
            return (
              <div key={s.id}
                onClick={() => { setSelected(s); setBriefing(null) }}
                style={{
                  padding: '10px 16px', cursor: 'pointer',
                  background: isSelected ? 'var(--ai-subtle)' : 'transparent',
                  borderLeft: isSelected ? '2px solid var(--ai)' : '2px solid transparent',
                  borderBottom: '1px solid var(--pios-border)',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--pios-surface2)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: `${CAT_COLOR[s.category] ?? 'var(--pios-dim)'}18`,
                    border: `1px solid ${CAT_COLOR[s.category] ?? 'var(--pios-dim)'}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: CAT_COLOR[s.category] ?? 'var(--pios-muted)',
                  }}>
                    {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {s.name}
                      </span>
                      {s.overdue && <AlertTriangle size={11} color="var(--dng)" />}
                    </div>
                    {s.organisation && (
                      <div style={{ ...mono, color: 'var(--pios-muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{s.organisation}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 4, background: h.bg, color: h.color }}>{h.label}</span>
                      <span style={{ fontSize: 9.5, color: CAT_COLOR[s.category] ?? 'var(--pios-dim)' }}>{s.category}</span>
                      <ImportanceDots n={s.importance} />
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); del(s.id) }} disabled={deleting === s.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pios-dim)', padding: 2, flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--dng)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--pios-dim)'}>
                    {deleting === s.id ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Trash2 size={12} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Detail + briefing ─────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--pios-muted)' }}>
            <Users size={36} style={{ opacity: 0.2 }} />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 400 }}>Select a stakeholder</p>
            <p style={{ fontSize: 12, color: 'var(--pios-dim)' }}>NemoClaw™ will brief you before any meeting</p>
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: `${CAT_COLOR[selected.category] ?? 'var(--pios-dim)'}18`,
                border: `2px solid ${CAT_COLOR[selected.category] ?? 'var(--pios-dim)'}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
                color: CAT_COLOR[selected.category] ?? 'var(--pios-muted)',
              }}>
                {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {selected.name}
                </h2>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  {selected.organisation && <span style={{ fontSize: 13, color: 'var(--pios-muted)' }}>{selected.organisation}</span>}
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: `${CAT_COLOR[selected.category] ?? 'var(--pios-dim)'}15`,
                    color: CAT_COLOR[selected.category] ?? 'var(--pios-dim)' }}>
                    {selected.category}
                  </span>
                  {(() => { const h = HEALTH_META[selected.relationship_status] ?? HEALTH_META.neutral; return (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: h.bg, color: h.color }}>{h.label}</span>
                  )})()}
                  <ImportanceDots n={selected.importance} />
                  {selected.linkedin_url && (
                    <a href={selected.linkedin_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--academic)', textDecoration: 'none' }}>
                      <ExternalLink size={11} /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => logContact(selected.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px',
                  borderRadius: 8, border: '1px solid var(--pios-border2)',
                  background: 'transparent', color: 'var(--pios-muted)', fontSize: 12, cursor: 'pointer',
                }}>
                  <Calendar size={12} /> Log contact
                </button>
                <button onClick={() => getBriefing(selected)} disabled={briefLoading} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                  borderRadius: 8, border: 'none', background: 'var(--ai-subtle)',
                  border2: '1px solid rgba(99,73,255,0.25)', color: 'var(--ai3)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                } as React.CSSProperties}>
                  {briefLoading ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={12} />}
                  {briefLoading ? 'Briefing…' : 'NemoClaw™ Brief'}
                </button>
              </div>
            </div>

            {/* Metadata row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Last contact', value: selected.last_contact_date ?? '—' },
                { label: 'Next touchpoint', value: selected.next_touchpoint ?? '—', alert: selected.overdue },
                { label: 'Importance', value: `${selected.importance} / 5` },
              ].map(item => (
                <div key={item.label} style={{ padding: '10px 13px', borderRadius: 9, background: 'var(--pios-surface2)',
                  border: `1px solid ${(item as any).alert ? 'rgba(244,63,94,0.3)' : 'var(--pios-border)'}` }}>
                  <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: (item as any).alert ? 'var(--dng)' : 'var(--pios-text)' }}>
                    {(item as any).alert && '⚠ '}{item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            {selected.notes && (
              <div style={{ padding: '13px 15px', borderRadius: 10, background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', marginBottom: 18 }}>
                <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 6 }}>Notes</div>
                <p style={{ fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.7 }}>{selected.notes}</p>
              </div>
            )}

            {/* AI Briefing */}
            {briefLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', color: 'var(--pios-muted)', fontSize: 13 }}>
                <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                NemoClaw™ is preparing your briefing…
              </div>
            )}
            {briefing && (
              <div style={{ background: 'var(--pios-surface)', border: '1px solid rgba(99,73,255,0.25)', borderRadius: 12, padding: '16px 18px', borderLeft: '3px solid var(--ai)' }}>
                <div style={{ ...mono, color: 'var(--ai3)', marginBottom: 14 }}>NemoClaw™ meeting briefing</div>

                {briefing.opening && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', letterSpacing: '0.07em', marginBottom: 5, textTransform: 'uppercase' as const }}>Opening</div>
                    <p style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.7 }}>{briefing.opening}</p>
                  </div>
                )}
                {briefing.key_objectives && briefing.key_objectives.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', letterSpacing: '0.07em', marginBottom: 5, textTransform: 'uppercase' as const }}>Objectives</div>
                    {briefing.key_objectives.map((o, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: 'var(--ai3)', fontSize: 11, marginTop: 2 }}>▸</span>
                        <span style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.6 }}>{o}</span>
                      </div>
                    ))}
                  </div>
                )}
                {briefing.talking_points && briefing.talking_points.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', letterSpacing: '0.07em', marginBottom: 5, textTransform: 'uppercase' as const }}>Talking points</div>
                    {briefing.talking_points.map((tp, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ ...mono, color: 'var(--pios-dim)', minWidth: 18 }}>{i + 1}.</span>
                        <span style={{ fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.6 }}>{tp}</span>
                      </div>
                    ))}
                  </div>
                )}
                {briefing.risks && (
                  <div style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--saas)', letterSpacing: '0.07em', marginBottom: 4, textTransform: 'uppercase' as const }}>Relationship risk</div>
                    <p style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{briefing.risks}</p>
                  </div>
                )}
                {briefing.ask && (
                  <div style={{ padding: '10px 13px', borderRadius: 8, background: 'rgba(99,73,255,0.07)', border: '1px solid rgba(99,73,255,0.2)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai3)', letterSpacing: '0.07em', marginBottom: 4, textTransform: 'uppercase' as const }}>The ask</div>
                    <p style={{ fontSize: 13, color: 'var(--pios-text)', fontWeight: 500 }}>{briefing.ask}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
