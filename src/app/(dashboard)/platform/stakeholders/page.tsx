'use client'
/**
 * /platform/stakeholders — Stakeholder Power Analysis (SPA™)
 * NemoClaw™ framework: map influence, track relationships, set engagement strategy.
 * VeritasIQ Technologies Ltd · Sprint J
 */
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stakeholder {
  id:          string
  name:        string
  role:        string
  organisation?: string
  influence:   number   // 1–5
  alignment:   number   // 1–5 (1=hostile, 5=champion)
  engagement:  'high' | 'medium' | 'low' | 'none'
  notes?:      string
  last_contact?: string
  tags?:       string[]
}

const ENGAGEMENT_COLOR = {
  high:   '#1D9E75',
  medium: '#f0a030',
  low:    '#636880',
  none:   '#3a3e58',
}

function InfluenceDots({ n, max = 5, color = 'var(--ai)' }: { n: number; max?: number; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i < n ? color : 'rgba(255,255,255,0.1)',
        }} />
      ))}
    </div>
  )
}

export default function StakeholdersPage() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([])
  const [loading, setLoading]           = useState(true)
  const [showAdd, setShowAdd]           = useState(false)
  const [filter, setFilter]             = useState<string>('all')
  const [form, setForm]                 = useState({
    name: '', role: '', organisation: '',
    influence: 3, alignment: 3, engagement: 'medium' as const, notes: '',
  })
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    fetch('/api/stakeholders')
      .then(r => r.ok ? r.json() : null)
      .then(d => setStakeholders(d?.stakeholders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/stakeholders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const d = await r.json()
      if (r.ok && d.stakeholder) {
        setStakeholders(prev => [d.stakeholder, ...prev])
        setShowAdd(false)
        setForm({ name: '', role: '', organisation: '', influence: 3, alignment: 3, engagement: 'medium', notes: '' })
      }
    } finally {
      setSaving(false)
    }
  }

  const filtered = filter === 'all'
    ? stakeholders
    : stakeholders.filter(s => s.engagement === filter)

  const champions  = stakeholders.filter(s => s.alignment >= 4)
  const neutral    = stakeholders.filter(s => s.alignment === 3)
  const detractors = stakeholders.filter(s => s.alignment <= 2)

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="pios-page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 className="pios-page-title" style={{ margin: 0 }}>Stakeholders</h1>
              <span className="pios-badge pios-badge-ai" style={{ fontSize: 9 }}>SPA™</span>
            </div>
            <p className="pios-page-sub">Stakeholder Power Analysis — map influence, track alignment, set engagement strategy</p>
          </div>
          <button onClick={() => setShowAdd(s => !s)} className="pios-btn pios-btn-primary pios-btn-sm">
            + Add stakeholder
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {stakeholders.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Champions',  count: champions.length,  color: '#1D9E75', desc: 'Alignment 4–5' },
            { label: 'Neutral',    count: neutral.length,    color: '#f0a030', desc: 'Alignment 3' },
            { label: 'Detractors', count: detractors.length, color: '#e05272', desc: 'Alignment 1–2' },
          ].map(g => (
            <div key={g.label} className="pios-card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: g.color, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>
                {g.count}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)' }}>{g.label}</div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{g.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="pios-card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Add stakeholder</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Name *</label>
              <input className="pios-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Role *</label>
              <input className="pios-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. CFO, Board Member" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Organisation</label>
              <input className="pios-input" value={form.organisation} onChange={e => setForm(f => ({ ...f, organisation: e.target.value }))} placeholder="Company / institution" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Engagement</label>
              <select className="pios-input pios-select" value={form.engagement} onChange={e => setForm(f => ({ ...f, engagement: e.target.value as typeof form.engagement }))}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Influence {form.influence}/5
              </label>
              <input type="range" min={1} max={5} step={1} value={form.influence}
                onChange={e => setForm(f => ({ ...f, influence: +e.target.value }))}
                style={{ width: '100%', accentColor: 'var(--ai)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Alignment {form.alignment}/5
              </label>
              <input type="range" min={1} max={5} step={1} value={form.alignment}
                onChange={e => setForm(f => ({ ...f, alignment: +e.target.value }))}
                style={{ width: '100%', accentColor: form.alignment >= 4 ? '#1D9E75' : form.alignment <= 2 ? '#e05272' : '#f0a030' }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Notes</label>
            <textarea className="pios-input pios-textarea" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Context, history, preferred engagement approach..." rows={2} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving || !form.name || !form.role} className="pios-btn pios-btn-primary pios-btn-sm">
              {saving ? 'Saving...' : 'Add stakeholder'}
            </button>
            <button onClick={() => setShowAdd(false)} className="pios-btn pios-btn-ghost pios-btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      {stakeholders.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {['all', 'high', 'medium', 'low', 'none'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '4px 11px', borderRadius: 5, fontSize: 12,
              border: `1px solid ${filter === f ? 'var(--ai)' : 'var(--pios-border2)'}`,
              background: filter === f ? 'var(--ai-subtle)' : 'transparent',
              color: filter === f ? 'var(--ai)' : 'var(--pios-muted)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{f === 'all' ? `All (${stakeholders.length})` : f}</button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="pios-skeleton" style={{ height: 72, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="pios-empty">
          <div className="pios-empty-icon">○</div>
          <div className="pios-empty-title">{stakeholders.length === 0 ? 'No stakeholders yet' : 'No matches'}</div>
          <div className="pios-empty-desc">
            {stakeholders.length === 0
              ? 'Map your key relationships — investors, clients, partners, advisors.'
              : 'Adjust the filter above.'}
          </div>
          {stakeholders.length === 0 && (
            <button onClick={() => setShowAdd(true)} className="pios-btn pios-btn-ghost pios-btn-sm" style={{ marginTop: 16 }}>
              + Add first stakeholder
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(s => {
            const alignColor = s.alignment >= 4 ? '#1D9E75' : s.alignment <= 2 ? '#e05272' : '#f0a030'
            return (
              <div key={s.id} className="pios-card-sm" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: `${alignColor}20`, border: `1px solid ${alignColor}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: alignColor,
                }}>
                  {s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)' }}>{s.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{s.role}</span>
                    {s.organisation && <span style={{ fontSize: 11, color: 'var(--pios-dim)' }}>· {s.organisation}</span>}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                      background: `${ENGAGEMENT_COLOR[s.engagement]}18`,
                      color: ENGAGEMENT_COLOR[s.engagement],
                      border: `1px solid ${ENGAGEMENT_COLOR[s.engagement]}40`,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{s.engagement}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--pios-muted)' }}>Influence</span>
                      <InfluenceDots n={s.influence} color="var(--ai)" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--pios-muted)' }}>Alignment</span>
                      <InfluenceDots n={s.alignment} color={alignColor} />
                    </div>
                  </div>
                  {s.notes && (
                    <p style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 4, lineHeight: 1.5 }}>
                      {s.notes.slice(0, 120)}{s.notes.length > 120 ? '…' : ''}
                    </p>
                  )}
                </div>

                {s.last_contact && (
                  <div style={{ fontSize: 11, color: 'var(--pios-dim)', flexShrink: 0 }}>
                    {new Date(s.last_contact).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
