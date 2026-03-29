'use client'
/**
 * /platform/vault — VIQ-VAULT™ Intelligent Document Filing
 *
 * Three-panel layout:
 *   LEFT:   Folder tree (by org, by doc type, smart folders)
 *   CENTRE: Document list with filters + search
 *   RIGHT:  Document detail panel
 *
 * Filing hierarchy:
 *   By Organisation → By stakeholder → By doc type
 *   Smart folders: Expiring soon, Needs review, Recent
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K — VIQ-VAULT™
 */

import { useState, useEffect, useCallback } from 'react'

/* ── Types ──────────────────────────────────────────────────── */
interface VaultDoc {
  id: string
  filename: string
  file_type: string
  doc_type: string
  doc_subtype?: string
  title?: string
  description?: string
  organisation_name?: string
  key_parties?: string[]
  key_dates?: { document_date?: string; expiry_date?: string; effective_date?: string }
  financial_value?: number
  currency?: string
  ai_tags?: string[]
  requires_review?: boolean
  confidence_score?: number
  expiry_date?: string
  document_date?: string
  created_at: string
  stakeholder?: { name: string; organisation: string }
  decision?: { title: string }
  proposal?: { title: string }
}

interface VaultFolder {
  id: string
  name: string
  folder_type: string
  parent_id?: string
  doc_count?: number
}

interface VaultStats {
  total: number
  expiring_soon: number
  needs_review: number
  by_type: Record<string, number>
}

/* ── Doc type config ────────────────────────────────────────── */
const DOC_TYPE_ICONS: Record<string, string> = {
  contract:      '⟐',
  invoice:       '◈',
  proposal:      '◎',
  report:        '▤',
  meeting_notes: '◇',
  strategy:      '◉',
  financial:     '◆',
  legal:         '⊡',
  hr:            '○',
  technical:     '⊞',
  correspondence:'▢',
  certificate:   '⊛',
  insurance:     '⊠',
  compliance:    '⊟',
  research:      '◬',
  other:         '□',
}

const DOC_TYPE_COLOURS: Record<string, string> = {
  contract:      'var(--dng)',
  invoice:       'var(--fm)',
  proposal:      'var(--academic)',
  report:        'var(--pios-muted)',
  meeting_notes: 'var(--ai)',
  strategy:      'var(--ai)',
  financial:     'var(--fm)',
  legal:         'var(--dng)',
  certificate:   'var(--warn)',
  insurance:     'var(--warn)',
  compliance:    'var(--warn)',
  other:         'var(--pios-dim)',
}

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: '📄', docx: '📝', xlsx: '📊', pptx: '📑',
  image: '🖼', csv: '📋', txt: '📃', archive: '📦', other: '📎',
}

/* ── Smart folder definitions ───────────────────────────────── */
const SMART_FOLDERS = [
  { id: 'all',           label: 'All documents',   icon: '◈' },
  { id: 'expiring',      label: 'Expiring soon',   icon: '⏳' },
  { id: 'needs_review',  label: 'Needs review',    icon: '⚑' },
  { id: 'recent',        label: 'Recent (7 days)', icon: '◎' },
  { id: 'contracts',     label: 'Contracts',       icon: '⟐' },
  { id: 'invoices',      label: 'Invoices',        icon: '◆' },
  { id: 'meeting_notes', label: 'Meeting notes',   icon: '◇' },
  { id: 'strategy',      label: 'Strategy',        icon: '◉' },
]

/* ── Main component ─────────────────────────────────────────── */
export default function VaultPage() {
  const [docs, setDocs]             = useState<VaultDoc[]>([])
  const [folders, setFolders]       = useState<VaultFolder[]>([])
  const [stats, setStats]           = useState<VaultStats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<VaultDoc | null>(null)
  const [activeFolder, setActiveFolder] = useState('all')
  const [search, setSearch]         = useState('')
  const [processing, setProcessing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [docsRes, foldersRes] = await Promise.allSettled([
        fetch('/api/vault/documents').then(r => r.ok ? r.json() : {documents:[],stats:null}),
        fetch('/api/vault/folders').then(r => r.ok ? r.json() : {folders:[]}),
      ])
      if (docsRes.status === 'fulfilled') {
        setDocs(docsRes.value.documents ?? [])
        setStats(docsRes.value.stats ?? null)
      }
      if (foldersRes.status === 'fulfilled') {
        setFolders(foldersRes.value.folders ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const processQueue = async () => {
    setProcessing(true)
    await fetch('/api/email/process-attachments', { method: 'POST' })
    await load()
    setProcessing(false)
  }

  /* ── Filtered docs ── */
  const filtered = docs.filter(d => {
    const matchSearch = !search || [d.title, d.filename, d.organisation_name, ...(d.ai_tags ?? [])]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))

    const matchFolder = (() => {
      if (activeFolder === 'all')          return true
      if (activeFolder === 'expiring')     return !!d.expiry_date && daysUntil(d.expiry_date) <= 90
      if (activeFolder === 'needs_review') return !!d.requires_review
      if (activeFolder === 'recent')       return daysUntil(d.created_at) >= -7
      if (activeFolder === 'contracts')    return d.doc_type === 'contract'
      if (activeFolder === 'invoices')     return d.doc_type === 'invoice'
      if (activeFolder === 'meeting_notes')return d.doc_type === 'meeting_notes'
      if (activeFolder === 'strategy')     return d.doc_type === 'strategy'
      // Organisation folder
      const orgFolder = folders.find(f => f.id === activeFolder)
      if (orgFolder?.folder_type === 'organisation') return d.organisation_name === orgFolder.name
      return true
    })()

    return matchSearch && matchFolder
  })

  /* ── Group orgs from folders ── */
  const orgFolders = folders.filter(f => f.folder_type === 'organisation')

  const daysUntil = (dateStr: string) =>
    Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* ── LEFT: Folder tree ─────────────────────────────────── */}
      <div style={{ width: 220, borderRight: '1px solid var(--pios-border)', overflowY: 'auto', padding: '20px 0', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '0 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', letterSpacing: '-0.01em' }}>VIQ-VAULT™</span>
          {stats && <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>{stats.total} docs</span>}
        </div>

        {/* Smart folders */}
        <div style={{ padding: '0 8px', marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--pios-dim)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Smart folders</div>
          {SMART_FOLDERS.map(sf => {
            const count = sf.id === 'expiring' ? stats?.expiring_soon
              : sf.id === 'needs_review' ? stats?.needs_review
              : sf.id === 'all' ? stats?.total
              : docs.filter(d => {
                if (sf.id === 'recent')        return daysUntil(d.created_at) >= -7
                if (sf.id === 'contracts')     return d.doc_type === 'contract'
                if (sf.id === 'invoices')      return d.doc_type === 'invoice'
                if (sf.id === 'meeting_notes') return d.doc_type === 'meeting_notes'
                if (sf.id === 'strategy')      return d.doc_type === 'strategy'
                return false
              }).length

            return (
              <button key={sf.id} onClick={() => setActiveFolder(sf.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 6, border: 'none', background: activeFolder === sf.id ? 'rgba(139,124,248,0.1)' : 'transparent', color: activeFolder === sf.id ? 'var(--ai)' : 'var(--pios-muted)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                <span>{sf.icon}</span>
                <span style={{ flex: 1 }}>{sf.label}</span>
                {count != null && count > 0 && (
                  <span style={{ fontSize: 10, color: sf.id === 'expiring' ? 'var(--dng)' : 'var(--pios-dim)', background: sf.id === 'expiring' ? 'rgba(220,60,60,0.1)' : 'var(--pios-bg)', padding: '1px 5px', borderRadius: 10 }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Organisation folders */}
        {orgFolders.length > 0 && (
          <div style={{ padding: '8px 8px 0', borderTop: '1px solid var(--pios-border)', marginTop: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--pios-dim)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>By organisation</div>
            {orgFolders.map(f => (
              <button key={f.id} onClick={() => setActiveFolder(f.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 6, border: 'none', background: activeFolder === f.id ? 'rgba(139,124,248,0.1)' : 'transparent', color: activeFolder === f.id ? 'var(--ai)' : 'var(--pios-muted)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pios-border)', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                {f.doc_count != null && f.doc_count > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>{f.doc_count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── CENTRE: Document list ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--pios-border)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <input
            style={{ flex: 1, padding: '7px 12px', border: '1px solid var(--pios-border)', borderRadius: 7, background: 'var(--pios-bg)', color: 'var(--pios-text)', fontSize: 13 }}
            placeholder="Search documents, organisations, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={processQueue} disabled={processing}
            style={{ padding: '7px 14px', background: processing ? 'var(--pios-border)' : 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, cursor: processing ? 'wait' : 'pointer', flexShrink: 0 }}>
            {processing ? 'Processing...' : '⚡ Process queue'}
          </button>
        </div>

        {/* Stats strip */}
        {stats && (
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--pios-border)', display: 'flex', gap: 20, flexShrink: 0 }}>
            {[
              { label: 'Total',          value: stats.total,         colour: 'var(--pios-text)' },
              { label: 'Expiring ≤90d',  value: stats.expiring_soon, colour: 'var(--dng)' },
              { label: 'Needs review',   value: stats.needs_review,  colour: 'var(--warn)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: s.colour }}>{s.value}</span>
                <span style={{ fontSize: 11, color: 'var(--pios-dim)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Document rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px 20px', color: 'var(--pios-muted)', fontSize: 14, textAlign: 'center' }}>Loading vault...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px 20px', color: 'var(--pios-dim)', fontSize: 14, textAlign: 'center' }}>
              {search ? 'No documents match your search' : 'No documents in this folder'}
            </div>
          ) : filtered.map(doc => {
            const isSelected = selected?.id === doc.id
            const daysLeft   = doc.expiry_date ? daysUntil(doc.expiry_date) : null
            const expiring   = daysLeft !== null && daysLeft <= 90
            const expired    = daysLeft !== null && daysLeft <= 0
            const typeColour = DOC_TYPE_COLOURS[doc.doc_type] ?? 'var(--pios-muted)'

            return (
              <div key={doc.id} onClick={() => setSelected(isSelected ? null : doc)}
                style={{ padding: '12px 20px', borderBottom: '1px solid var(--pios-border)', cursor: 'pointer', background: isSelected ? 'rgba(139,124,248,0.05)' : 'transparent', display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 12, alignItems: 'start', transition: 'background 0.1s' }}>

                {/* File type icon */}
                <div style={{ fontSize: 18, lineHeight: 1.3 }}>
                  {FILE_TYPE_ICONS[doc.file_type] ?? '📎'}
                </div>

                {/* Doc info */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: `${typeColour}22`, color: typeColour, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                      {DOC_TYPE_ICONS[doc.doc_type]} {doc.doc_type.replace('_', ' ')}
                    </span>
                    {doc.requires_review && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(240,160,48,0.12)', color: 'var(--warn)', flexShrink: 0 }}>Review</span>
                    )}
                    {expired && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(220,60,60,0.12)', color: 'var(--dng)', flexShrink: 0 }}>Expired</span>
                    )}
                    {expiring && !expired && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(220,60,60,0.08)', color: 'var(--dng)', flexShrink: 0 }}>{daysLeft}d</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.title ?? doc.filename}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                    {doc.organisation_name && <span>{doc.organisation_name}</span>}
                    {doc.financial_value && doc.financial_value > 0 && (
                      <span style={{ color: 'var(--fm)' }}>{doc.currency ?? 'GBP'} {doc.financial_value.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div style={{ fontSize: 11, color: 'var(--pios-dim)', flexShrink: 0, textAlign: 'right' }}>
                  {doc.document_date
                    ? new Date(doc.document_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                    : new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Document detail ──────────────────────────────── */}
      {selected && (
        <div style={{ width: 320, borderLeft: '1px solid var(--pios-border)', overflowY: 'auto', padding: '20px', flexShrink: 0 }}>

          {/* Close */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)' }}>Document detail</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--pios-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>

          {/* Type badge */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: `${DOC_TYPE_COLOURS[selected.doc_type] ?? 'var(--pios-muted)'}22`, color: DOC_TYPE_COLOURS[selected.doc_type] ?? 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {DOC_TYPE_ICONS[selected.doc_type]} {selected.doc_type.replace('_', ' ')}
            </span>
            {selected.doc_subtype && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'var(--pios-bg)', color: 'var(--pios-dim)', border: '1px solid var(--pios-border)' }}>
                {selected.doc_subtype}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 8px', lineHeight: 1.4 }}>
            {selected.title ?? selected.filename}
          </h3>

          {/* AI summary */}
          {selected.description && (
            <p style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.7, margin: '0 0 16px', padding: '10px 12px', background: 'rgba(139,124,248,0.04)', borderRadius: 7, borderLeft: '2px solid var(--ai)' }}>
              {selected.description}
            </p>
          )}

          {/* Metadata grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Organisation',   value: selected.organisation_name },
              { label: 'Parties',        value: selected.key_parties?.join(', ') },
              { label: 'Value',          value: selected.financial_value ? `${selected.currency ?? 'GBP'} ${selected.financial_value.toLocaleString()}` : null },
              { label: 'Document date',  value: selected.key_dates?.document_date ? new Date(selected.key_dates.document_date).toLocaleDateString('en-GB') : null },
              { label: 'Effective',      value: selected.key_dates?.effective_date ? new Date(selected.key_dates.effective_date).toLocaleDateString('en-GB') : null },
              { label: 'Expires',        value: selected.expiry_date ? new Date(selected.expiry_date).toLocaleDateString('en-GB') : null, alert: true },
              { label: 'Linked decision', value: selected.decision?.title },
              { label: 'Linked proposal', value: selected.proposal?.title },
            ].filter(r => r.value).map(row => (
              <div key={row.label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{row.label}</div>
                <div style={{ fontSize: 12, color: row.alert ? 'var(--dng)' : 'var(--pios-text)', fontWeight: row.alert ? 500 : 400 }}>{row.value}</div>
              </div>
            ))}
          </div>

          {/* Tags */}
          {selected.ai_tags && selected.ai_tags.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {selected.ai_tags.map(tag => (
                  <span key={tag} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--pios-bg)', color: 'var(--pios-muted)', border: '1px solid var(--pios-border)' }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Review flag */}
          {selected.requires_review && (
            <div style={{ padding: '10px 12px', background: 'rgba(240,160,48,0.06)', border: '1px solid rgba(240,160,48,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--pios-muted)', marginBottom: 16 }}>
              <strong style={{ color: 'var(--warn)' }}>⚑ Review needed</strong> — NemoClaw™ confidence {Math.round((selected.confidence_score ?? 0) * 100)}%. Please verify classification.
            </div>
          )}

          {/* Confidence */}
          {selected.confidence_score != null && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>AI confidence</div>
              <div style={{ height: 4, background: 'var(--pios-border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((selected.confidence_score ?? 0) * 100)}%`, background: selected.confidence_score > 0.7 ? 'var(--fm)' : 'var(--warn)', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginTop: 3 }}>{Math.round((selected.confidence_score ?? 0) * 100)}%</div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button style={{ padding: '9px 14px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Download
            </button>
            <button style={{ padding: '9px 14px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 7, color: 'var(--pios-muted)', fontSize: 12, cursor: 'pointer' }}>
              Re-classify with NemoClaw™
            </button>
            {selected.requires_review && (
              <button style={{ padding: '9px 14px', background: 'transparent', border: '1px solid var(--fm)', borderRadius: 7, color: 'var(--fm)', fontSize: 12, cursor: 'pointer' }}>
                Mark as reviewed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
