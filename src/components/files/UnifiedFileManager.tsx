'use client'

import { useEffect, useMemo, useState } from 'react'

type UnifiedItem = {
  source: 'file_items' | 'project_source_documents'
  id: string
  name: string
  file_type?: string | null
  summary?: string | null
  size_bytes?: number | null
  created_at?: string | null
  updated_at?: string | null
  url?: string | null
}

interface Props {
  initialSource?: 'all' | 'file_items' | 'project_source_documents'
}

function sourceLabel(source: UnifiedItem['source']) {
  return source === 'file_items' ? 'File Intel' : 'Project Document'
}

export function UnifiedFileManager({ initialSource = 'all' }: Props) {
  const [source, setSource] = useState<'all' | 'file_items' | 'project_source_documents'>(initialSource)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<UnifiedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const params = new URLSearchParams({ source, limit: '120' })
      if (query.trim()) params.set('q', query.trim())
      const data = await fetch(`/api/files/unified?${params.toString()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      setItems(data?.items ?? [])
      setLoading(false)
    }
    void load()
  }, [source, query])

  const grouped = useMemo(() => {
    const map: Record<string, UnifiedItem[]> = {}
    for (const item of items) {
      const key = item.source
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
    return map
  }, [items])

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Unified Document & File Library</h1>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
            One source of truth for uploads from File Intelligence and Project Documents.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { key: 'all', label: 'All Sources' },
          { key: 'file_items', label: 'File Intel' },
          { key: 'project_source_documents', label: 'Project Documents' },
        ].map((s) => (
          <button
            key={s.key}
            className="pios-btn pios-btn-sm"
            style={{
              background: source === s.key ? 'rgba(99,73,255,0.18)' : 'transparent',
              color: source === s.key ? 'var(--ai3)' : 'var(--pios-muted)',
              border: '1px solid var(--pios-border)',
            }}
            onClick={() => setSource(s.key as 'all' | 'file_items' | 'project_source_documents')}
          >
            {s.label}
          </button>
        ))}
      </div>

      <input className="pios-input" placeholder="Search by name or summary…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 16 }} />

      {loading ? (
        <div className="pios-card" style={{ textAlign: 'center', padding: 36, color: 'var(--pios-muted)' }}>Loading unified library…</div>
      ) : items.length === 0 ? (
        <div className="pios-card" style={{ textAlign: 'center', padding: 36, color: 'var(--pios-muted)' }}>No files matched your filter.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {Object.entries(grouped).map(([src, rows]) => (
            <section key={src} className="pios-card" style={{ padding: 14 }}>
              <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--pios-dim)', marginBottom: 8 }}>
                {sourceLabel(src as UnifiedItem['source'])} · {rows.length}
              </h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {rows.map((row) => (
                  <article key={`${row.source}-${row.id}`} style={{ border: '1px solid var(--pios-border)', borderRadius: 10, padding: 10, background: 'var(--pios-surface2)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 13 }}>{row.name}</strong>
                      <span className="pios-tag">{sourceLabel(row.source)}</span>
                      {row.file_type ? <span className="pios-tag">{row.file_type}</span> : null}
                    </div>
                    {row.summary ? (
                      <p style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.6, marginBottom: 4 }}>
                        {String(row.summary).slice(0, 220)}
                        {String(row.summary).length > 220 ? '…' : ''}
                      </p>
                    ) : null}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: 'var(--pios-dim)' }}>
                      <span>Created: {row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB') : '—'}</span>
                      {row.size_bytes ? <span>Size: {Math.round(row.size_bytes / 1024)} KB</span> : null}
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noreferrer" style={{ color: 'var(--ai3)', textDecoration: 'none' }}>
                          Open source →
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
