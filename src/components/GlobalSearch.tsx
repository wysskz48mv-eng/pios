/**
 * GlobalSearch — ⌘K cross-domain search overlay
 * Searches tasks, projects, files, meetings, knowledge, contracts, IP assets
 * PIOS Sprint 63 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string
  type: 'task' | 'project' | 'file' | 'meeting' | 'knowledge' | 'expense' | 'contract' | 'ip_asset'
  title: string
  subtitle?: string
  domain?: string
  href: string
  matched_field?: string
}

const TYPE_ICON: Record<string, string> = {
  task:     '✓',
  project:  '◈',
  file:     '📄',
  meeting:  '🗒',
  knowledge:'🧠',
  expense:  '💳',
  contract: '📑',
  ip_asset: '🔐',
}
const TYPE_COLOUR: Record<string, string> = {
  task:     '#a78bfa',
  project:  '#6c8eff',
  file:     '#f59e0b',
  meeting:  '#22d3ee',
  knowledge:'#0d9488',
  expense:  '#e05a7a',
  contract: '#3b82f6',
  ip_asset: '#8b5cf6',
}

export function GlobalSearch() {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor,  setCursor]  = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setCursor(0)
    }
  }, [open])

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const d = await res.json()
        setResults(d.results ?? [])
        setCursor(0)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 200)
  }

  // Keyboard navigation
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) {
      router.push(results[cursor].href)
      setOpen(false)
    }
  }

  if (!open) return null

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '80px',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 580,
        background: 'var(--pios-surface)',
        border: '1px solid var(--pios-border2)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        margin: '0 16px',
      }}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--pios-border)' }}>
          <span style={{ fontSize: 18, color: 'var(--pios-dim)', flexShrink: 0 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder="Search tasks, projects, files, meetings, knowledge…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--pios-text)',
            }}
          />
          {loading && (
            <div style={{ width: 14, height: 14, border: '2px solid rgba(167,139,250,0.2)', borderTop: '2px solid #a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          )}
          <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', color: 'var(--pios-dim)', flexShrink: 0 }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {results.map((r, i) => (
              <Link
                key={r.id}
                href={r.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 18px', textDecoration: 'none',
                  background: i === cursor ? 'rgba(167,139,250,0.08)' : 'transparent',
                  borderBottom: '1px solid var(--pios-border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={() => setCursor(i)}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: (TYPE_COLOUR[r.type] ?? '#a78bfa') + '20',
                  color: TYPE_COLOUR[r.type] ?? '#a78bfa',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13,
                }}>
                  {TYPE_ICON[r.type] ?? '·'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.title}
                  </div>
                  {r.subtitle && (
                    <div style={{ fontSize: 11, color: 'var(--pios-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.subtitle}
                    </div>
                  )}
                </div>
                {r.domain && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--pios-surface2)', color: 'var(--pios-dim)', flexShrink: 0 }}>
                    {r.domain}
                  </span>
                )}
                <span style={{ fontSize: 10, color: 'var(--pios-dim)', flexShrink: 0, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                  {r.type.replace('_', ' ')}
                </span>
              </Link>
            ))}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div style={{ padding: '24px 18px', textAlign: 'center' as const, color: 'var(--pios-muted)', fontSize: 13 }}>
            No results for &ldquo;{query}&rdquo;
          </div>
        ) : query.length === 0 ? (
          <div style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
              Quick jump
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { label: 'Tasks', href: '/platform/tasks', icon: '✓' },
                { label: 'Executive OS', href: '/platform/executive', icon: '⚡' },
                { label: 'AI Companion', href: '/platform/ai', icon: '✨' },
                { label: 'Knowledge Base', href: '/platform/knowledge', icon: '🧠' },
                { label: 'IP Vault', href: '/platform/ip-vault', icon: '🔐' },
                { label: 'Research Hub', href: '/platform/research', icon: '🔬' },
              ].map(item => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
                    background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
                    fontSize: 12, color: 'var(--pios-muted)',
                    transition: 'all 0.1s',
                  }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ padding: '8px 18px', borderTop: '1px solid var(--pios-border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--pios-dim)' }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>⌘K toggle</span>
          <span style={{ marginLeft: 'auto' }}>{results.length > 0 ? `${results.length} results` : ''}</span>
        </div>
      </div>
    </div>
  )
}
