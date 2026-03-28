'use client'
/**
 * /platform/publications — Academic Publications
 * Track papers, conference submissions, working papers, and publications.
 * Secondary academic module — DBA/PhD research context.
 * VeritasIQ Technologies Ltd · Sprint J
 */
import { useState, useEffect } from 'react'

interface Publication {
  id:         string
  title:      string
  type:       'journal' | 'conference' | 'working_paper' | 'book_chapter' | 'thesis'
  status:     'draft' | 'submitted' | 'under_review' | 'accepted' | 'published' | 'rejected'
  venue?:     string
  authors?:   string
  year?:      number
  doi?:       string
  url?:       string
  notes?:     string
  created_at: string
}

const STATUS_CONFIG = {
  draft:        { color: 'var(--pios-muted)', label: 'Draft' },
  submitted:    { color: '#f0a030', label: 'Submitted' },
  under_review: { color: '#4f8ef7', label: 'Under review' },
  accepted:     { color: '#1D9E75', label: 'Accepted' },
  published:    { color: '#8b7cf8', label: 'Published' },
  rejected:     { color: '#e05272', label: 'Rejected' },
}

const TYPE_CONFIG = {
  journal:      { label: 'Journal article', badge: 'JNL' },
  conference:   { label: 'Conference paper', badge: 'CONF' },
  working_paper:{ label: 'Working paper', badge: 'WP' },
  book_chapter: { label: 'Book chapter', badge: 'CH' },
  thesis:       { label: 'Thesis / dissertation', badge: 'DBA' },
}

export default function PublicationsPage() {
  const [pubs, setPubs]       = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [filter, setFilter]   = useState('all')
  const [form, setForm]       = useState({
    title: '', type: 'journal' as Publication['type'],
    status: 'draft' as Publication['status'],
    venue: '', authors: '', year: new Date().getFullYear(), doi: '', url: '', notes: '',
  })

  useEffect(() => {
    fetch('/api/publications')
      .then(r => r.ok ? r.json() : null)
      .then(d => setPubs(d?.publications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!form.title) return
    setSaving(true)
    try {
      const r = await fetch('/api/publications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (r.ok && d.publication) {
        setPubs(prev => [d.publication, ...prev])
        setShowAdd(false)
        setForm({ title: '', type: 'journal', status: 'draft', venue: '', authors: '', year: new Date().getFullYear(), doi: '', url: '', notes: '' })
      }
    } finally { setSaving(false) }
  }

  const filtered = filter === 'all' ? pubs : pubs.filter(p => p.status === filter)
  const published = pubs.filter(p => p.status === 'published').length
  const inProgress = pubs.filter(p => ['submitted', 'under_review', 'accepted'].includes(p.status)).length

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="pios-page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 className="pios-page-title" style={{ margin: 0 }}>Publications</h1>
              <span className="pios-badge pios-badge-acad" style={{ fontSize: 9 }}>ACADEMIC</span>
            </div>
            <p className="pios-page-sub">Track papers, conference submissions, working papers, and publications from your DBA research</p>
          </div>
          <button onClick={() => setShowAdd(s => !s)} className="pios-btn pios-btn-primary pios-btn-sm">+ Add publication</button>
        </div>
      </div>

      {/* Stats */}
      {pubs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Published', value: published, color: '#8b7cf8' },
            { label: 'In pipeline', value: inProgress, color: '#4f8ef7' },
            { label: 'Total tracked', value: pubs.length, color: 'var(--pios-sub)' },
          ].map(s => (
            <div key={s.label} className="pios-stat">
              <div className="pios-stat-label">{s.label}</div>
              <div className="pios-stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="pios-card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 14 }}>Add publication</h3>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Title *</label>
            <input className="pios-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Full title of the work" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Type</label>
              <select className="pios-input pios-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Publication['type'] }))}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Status</label>
              <select className="pios-input pios-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Publication['status'] }))}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Year</label>
              <input className="pios-input" type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Journal / Conference / Venue</label>
              <input className="pios-input" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="e.g. Journal of Facilities Management" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Authors</label>
              <input className="pios-input" value={form.authors} onChange={e => setForm(f => ({ ...f, authors: e.target.value }))} placeholder="Masuku, D. et al." />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>DOI</label>
              <input className="pios-input" value={form.doi} onChange={e => setForm(f => ({ ...f, doi: e.target.value }))} placeholder="10.xxxx/..." />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>URL</label>
              <input className="pios-input" type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving || !form.title} className="pios-btn pios-btn-primary pios-btn-sm">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowAdd(false)} className="pios-btn pios-btn-ghost pios-btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Status filter */}
      {pubs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {['all', ...Object.keys(STATUS_CONFIG)].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 11,
              border: `1px solid ${filter === s ? (STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.color ?? 'var(--ai)') : 'var(--pios-border2)'}`,
              background: filter === s ? `${STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.color ?? 'var(--ai)'}15` : 'transparent',
              color: filter === s ? (STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.color ?? 'var(--ai)') : 'var(--pios-muted)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{s === 'all' ? `All (${pubs.length})` : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label}</button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2].map(i => <div key={i} className="pios-skeleton" style={{ height: 72, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="pios-empty">
          <div className="pios-empty-icon">◇</div>
          <div className="pios-empty-title">{pubs.length === 0 ? 'No publications tracked' : 'No matches'}</div>
          <div className="pios-empty-desc">
            {pubs.length === 0 ? 'Track your DBA papers, working papers, and conference submissions here.' : 'Adjust the filter.'}
          </div>
          {pubs.length === 0 && (
            <button onClick={() => setShowAdd(true)} className="pios-btn pios-btn-ghost pios-btn-sm" style={{ marginTop: 16 }}>
              + Add first publication
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => {
            const status = STATUS_CONFIG[p.status]
            const type   = TYPE_CONFIG[p.type]
            return (
              <div key={p.id} className="pios-card-sm">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    padding: '3px 7px', borderRadius: 4, flexShrink: 0,
                    background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)',
                    fontSize: 9, fontWeight: 800, color: 'var(--acad)', letterSpacing: '0.05em',
                    fontFamily: 'monospace', marginTop: 2,
                  }}>{type.badge}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      {p.doi || p.url ? (
                        <a href={p.url ?? `https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', textDecoration: 'none', flex: 1 }}>
                          {p.title}
                        </a>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', flex: 1 }}>{p.title}</span>
                      )}
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, flexShrink: 0,
                        background: `${status.color}18`, color: status.color,
                        border: `1px solid ${status.color}35`, letterSpacing: '0.05em',
                      }}>{status.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pios-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {p.authors && <span>{p.authors}</span>}
                      {p.venue   && <span>{p.venue}</span>}
                      {p.year    && <span>{p.year}</span>}
                    </div>
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
