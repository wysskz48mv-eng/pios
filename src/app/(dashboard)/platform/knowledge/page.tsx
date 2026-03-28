'use client'
/**
 * /platform/knowledge — Knowledge Base
 * Capture insights, learnings, frameworks, and reference material.
 * AI-powered tagging and search. Linked to NemoClaw™ context.
 * VeritasIQ Technologies Ltd · Sprint J
 */
import { useState, useEffect } from 'react'

interface KnowledgeEntry {
  id:         string
  title:      string
  content:    string
  category:   string
  tags?:      string[]
  source?:    string
  created_at: string
}

const CATEGORIES = ['insight', 'framework', 'reference', 'lesson', 'market', 'technical', 'other']
const CAT_COLORS: Record<string, string> = {
  insight:   'var(--ai)',
  framework: 'var(--pro)',
  reference: 'var(--acad)',
  lesson:    '#f0a030',
  market:    '#10d9a0',
  technical: '#f4845f',
  other:     'var(--pios-muted)',
}

export default function KnowledgePage() {
  const [entries, setEntries]   = useState<KnowledgeEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showAdd, setShowAdd]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm]         = useState({ title: '', content: '', category: 'insight', source: '' })

  useEffect(() => {
    fetch('/api/knowledge')
      .then(r => r.ok ? r.json() : null)
      .then(d => setEntries(d?.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!form.title || !form.content) return
    setSaving(true)
    try {
      const r = await fetch('/api/knowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (r.ok && d.entry) {
        setEntries(prev => [d.entry, ...prev])
        setShowAdd(false)
        setForm({ title: '', content: '', category: 'insight', source: '' })
      }
    } finally { setSaving(false) }
  }

  const filtered = entries.filter(e => {
    const matchCat    = catFilter === 'all' || e.category === catFilter
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) ||
                        e.content.toLowerCase().includes(search.toLowerCase()) ||
                        (e.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    return matchCat && matchSearch
  })

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="pios-page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="pios-page-title">Knowledge Base</h1>
            <p className="pios-page-sub">Capture insights, frameworks, lessons and reference material. Feeds into NemoClaw™ context.</p>
          </div>
          <button onClick={() => setShowAdd(s => !s)} className="pios-btn pios-btn-primary pios-btn-sm">
            + Add entry
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="pios-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search entries..."
          style={{ flex: 1, minWidth: 200 }}
        />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['all', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: '7px 11px', borderRadius: 6, fontSize: 12,
              border: `1px solid ${catFilter === c ? (CAT_COLORS[c] ?? 'var(--ai)') : 'var(--pios-border2)'}`,
              background: catFilter === c ? `${CAT_COLORS[c] ?? 'var(--ai)'}15` : 'transparent',
              color: catFilter === c ? (CAT_COLORS[c] ?? 'var(--ai)') : 'var(--pios-muted)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="pios-card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 14 }}>New knowledge entry</h3>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Title *</label>
            <input className="pios-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Clear, descriptive title" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Category</label>
              <select className="pios-input pios-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Source</label>
              <input className="pios-input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Book, article, conversation..." />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Content *</label>
            <textarea className="pios-input pios-textarea" value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="The insight, framework, lesson, or reference..." rows={4} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving || !form.title || !form.content} className="pios-btn pios-btn-primary pios-btn-sm">
              {saving ? 'Saving...' : 'Save entry'}
            </button>
            <button onClick={() => setShowAdd(false)} className="pios-btn pios-btn-ghost pios-btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="pios-skeleton" style={{ height: 80, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="pios-empty">
          <div className="pios-empty-icon">◇</div>
          <div className="pios-empty-title">{entries.length === 0 ? 'Knowledge base is empty' : 'No matches'}</div>
          <div className="pios-empty-desc">
            {entries.length === 0
              ? 'Capture your first insight — frameworks, lessons, market intelligence, reference material.'
              : 'Try a different search or category.'}
          </div>
          {entries.length === 0 && (
            <button onClick={() => setShowAdd(true)} className="pios-btn pios-btn-ghost pios-btn-sm" style={{ marginTop: 16 }}>
              + Add first entry
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(entry => {
            const isOpen = expanded === entry.id
            const color  = CAT_COLORS[entry.category] ?? 'var(--pios-muted)'
            return (
              <div key={entry.id}
                className="pios-card-sm"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : entry.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 3, height: '100%', minHeight: 40, borderRadius: 2,
                    background: color, flexShrink: 0, alignSelf: 'stretch',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)' }}>{entry.title}</span>
                      <span className="pios-badge" style={{
                        background: `${color}15`, color, border: `1px solid ${color}35`,
                        fontSize: 9, textTransform: 'capitalize',
                      }}>{entry.category}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.5, margin: 0 }}>
                      {isOpen ? entry.content : entry.content.slice(0, 160) + (entry.content.length > 160 ? '…' : '')}
                    </p>
                    {isOpen && entry.source && (
                      <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 8 }}>Source: {entry.source}</p>
                    )}
                    {(entry.tags ?? []).length > 0 && (
                      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                        {(entry.tags ?? []).map(t => (
                          <span key={t} className="pios-badge pios-badge-muted" style={{ fontSize: 9 }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--pios-dim)', flexShrink: 0 }}>
                    {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
