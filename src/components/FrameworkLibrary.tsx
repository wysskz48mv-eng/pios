'use client'
import { useEffect, useState } from 'react'
import type { Framework, FrameworkWithRelevance } from '@/lib/framework-library/FrameworkLoader'

interface Props { domainMode?: string | null }

const CATEGORIES: Record<string, string> = {
  all: 'All', problem_structuring: 'Problem Structuring', strategy: 'Strategy',
  org_design: 'Organization', stakeholder_change: 'Change', process_improvement: 'Process',
  financial_commercial: 'Financial', evidence_analytics: 'Analytics', innovation_design: 'Innovation',
}

export function FrameworkLibrary({ domainMode }: Props) {
  const [frameworks, setFrameworks] = useState<(Framework & { relevance_score?: number })[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const url = domainMode ? `/api/frameworks?domain=${encodeURIComponent(domainMode)}` : '/api/frameworks'
    fetch(url).then(r => r.json()).then(d => setFrameworks(d.frameworks ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [domainMode])

  const filtered = frameworks.filter(f => {
    if (filter !== 'all' && f.category !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.when_to_use.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 4px' }}>VIQ Framework Library</h1>
        <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>{frameworks.length} proprietary frameworks{domainMode ? ` · ${domainMode}` : ''}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="text" placeholder="Search frameworks..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '8px 14px', background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 13, outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(CATEGORIES).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: filter === key ? 'var(--ai)' : 'var(--pios-surface2)', color: filter === key ? '#fff' : 'var(--pios-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginBottom: 12 }}>{filtered.length} of {frameworks.length} frameworks</div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--pios-muted)', fontSize: 13 }}>Loading frameworks...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--pios-dim)', fontSize: 13 }}>No frameworks match your search.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          {filtered.map(f => (
            <div key={f.id} onClick={() => setExpanded(expanded === f.id ? null : f.id)}
              style={{ background: 'var(--pios-surface)', border: `1px solid ${expanded === f.id ? 'rgba(99,73,255,0.3)' : 'var(--pios-border)'}`, borderRadius: 10, padding: '14px 18px', cursor: 'pointer', transition: 'border 0.15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--ai)', fontFamily: 'monospace' }}>{f.viq_code}</div>
                </div>
                {(f as any).relevance_score && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    {(f as any).relevance_score}/10
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--pios-surface2)', color: 'var(--pios-muted)' }}>
                {f.category.replace(/_/g, ' ')}
              </span>
              <div style={{ fontSize: 12, color: 'var(--pios-sub)', marginTop: 8, lineHeight: 1.5 }}>
                {expanded === f.id ? f.description : f.description.slice(0, 100) + (f.description.length > 100 ? '...' : '')}
              </div>
              {expanded === f.id && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(99,73,255,0.04)', borderRadius: 6, border: '1px solid rgba(99,73,255,0.1)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ai)', marginBottom: 4 }}>When to use</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-sub)', lineHeight: 1.5 }}>{f.when_to_use}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FrameworkLibrary
