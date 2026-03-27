/**
 * /platform/academic/writer — DBA Chapter AI Writer
 * Section-by-section drafting · Citation guard · Word count tracking
 * Obsidian Command v3.0.2 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BookOpen, Loader2, Save, Copy, Check, RefreshCw,
  ChevronDown, ChevronRight, FileText, Zap, Target
} from 'lucide-react'

type Chapter = {
  id: string; chapter_num: number; title: string; status: string
  word_count: number; target_words: number; content?: string
  chapter_type?: string
}

const CHAPTER_TYPES = [
  'intro', 'lit_review', 'methodology', 'findings', 'discussion', 'conclusion', 'appendix', 'main'
]

const TYPE_SECTIONS: Record<string, string[]> = {
  intro:       ['Background and context', 'Research problem', 'Research aims and objectives', 'Significance of study', 'Research questions', 'Thesis structure overview'],
  lit_review:  ['Introduction to literature review', 'FM cost forecasting landscape', 'AI/ML in FM applications', 'GCC-specific FM challenges', 'Socio-technical systems theory', 'Sensemaking theory', 'Evidential typology framework', 'Synthesis and research gap'],
  methodology: ['Research philosophy', 'Research approach', 'Research design', 'Case study strategy', 'Data collection methods', 'Data analysis approach', 'Quality and rigour', 'Ethical considerations', 'Limitations'],
  findings:    ['Level 1: Technical feasibility', 'Level 2: Operational analytics', 'Level 3: Governance-integrated forecasting', 'Cross-case analysis', 'Emergent themes'],
  discussion:  ['Interpreting the findings', 'Theoretical contribution', 'Practical implications', 'Comparison with existing literature', 'Framework refinement'],
  conclusion:  ['Summary of findings', 'Answering the research questions', 'Contributions to knowledge', 'Recommendations for practice', 'Limitations and future research'],
  main:        ['Introduction', 'Background', 'Analysis', 'Discussion', 'Conclusion'],
  appendix:    ['Appendix contents'],
}

const STATUS_COLOR: Record<string, string> = {
  not_started: 'var(--pios-dim)', outline: 'var(--saas)', drafting: 'var(--academic)',
  draft_complete: 'var(--ai3)', submitted: 'var(--fm)', passed: 'var(--fm)',
}

const inp: React.CSSProperties = {
  display: 'block', width: '100%', padding: '9px 13px',
  background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
  borderRadius: 8, color: 'var(--pios-text)', fontSize: 13.5,
  fontFamily: 'var(--font-sans)', outline: 'none',
}
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10 }

export default function DBAWriterPage() {
  const [chapters, setChapters]     = useState<Chapter[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Chapter | null>(null)
  const [section, setSection]       = useState('')
  const [sectionNotes, setSectionNotes] = useState('')
  const [litContext, setLitContext] = useState('')
  const [wordTarget, setWordTarget] = useState(500)
  const [draft, setDraft]           = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [copied, setCopied]         = useState(false)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/academic')
      const d = await r.json()
      setChapters(d.chapters ?? [])
      if (d.chapters?.length && !selected) setSelected(d.chapters[0])
    } catch { /* silent */ }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const sections = selected
    ? (TYPE_SECTIONS[selected.chapter_type ?? 'main'] ?? TYPE_SECTIONS.main)
    : []

  async function generate() {
    if (!selected || !section) return
    setGenerating(true)
    setDraft('')
    try {
      const r = await fetch('/api/academic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_draft_section',
          chapter_id: selected.id,
          chapter_title: selected.title,
          chapter_type: selected.chapter_type ?? 'main',
          section_heading: section,
          section_notes: sectionNotes.trim() || undefined,
          existing_content: selected.content?.slice(-1500) || undefined,
          literature_context: litContext.trim() || undefined,
          word_target: wordTarget,
        }),
      })
      const d = await r.json()
      setDraft(d.draft ?? '')
      // Refresh chapter to get updated content + word count
      load()
    } catch { setDraft('Generation failed — please retry.') }
    setGenerating(false)
  }

  async function saveDraft() {
    if (!selected || !draft.trim()) return
    setSaving(true)
    const newContent = (selected.content ? selected.content + '\n\n' : '') + `## ${section}\n\n${draft}`
    const wc = newContent.split(/\s+/).filter(Boolean).length
    await fetch('/api/academic', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'chapter', id: selected.id, content: newContent, word_count: wc }),
    })
    setSelected(prev => prev ? { ...prev, content: newContent, word_count: wc } : prev)
    setChapters(prev => prev.map(c => c.id === selected.id ? { ...c, word_count: wc } : c))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function copyDraft() {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const totalWords  = chapters.reduce((s, c) => s + (c.word_count ?? 0), 0)
  const targetWords = chapters.reduce((s, c) => s + (c.target_words ?? 8000), 0)
  const thesisPct   = targetWords > 0 ? Math.round((totalWords / targetWords) * 100) : 0

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 0, height: 'calc(100vh - 120px)', minHeight: 500 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── LEFT: Chapter selector ─────────────────────────────────────── */}
      <div style={{
        width: 240, flexShrink: 0, borderRight: '1px solid var(--pios-border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--pios-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <BookOpen size={15} color="var(--academic)" />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 400, letterSpacing: '-0.02em' }}>
              DBA Writer
            </span>
          </div>
          <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 6 }}>University of Portsmouth</div>
          {/* Thesis progress */}
          <div style={{ height: 3, background: 'var(--pios-surface2)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: `${thesisPct}%`, height: '100%', background: 'var(--academic)', borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, color: 'var(--pios-muted)' }}>
            <span>{totalWords.toLocaleString()} words</span>
            <span>{thesisPct}%</span>
          </div>
        </div>

        {/* Chapter list */}
        {loading ? (
          <div style={{ padding: 20, color: 'var(--pios-muted)', fontSize: 12 }}>Loading…</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {chapters.map(ch => {
              const isSelected = selected?.id === ch.id
              const pct = ch.target_words > 0 ? Math.round((ch.word_count / ch.target_words) * 100) : 0
              const sc = STATUS_COLOR[ch.status] ?? 'var(--pios-dim)'
              return (
                <div key={ch.id}>
                  <button
                    onClick={() => { setSelected(ch); setSection(''); setDraft('') }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 16px',
                      background: isSelected ? 'var(--ai-subtle)' : 'transparent',
                      border: 'none', borderLeft: isSelected ? '2px solid var(--ai)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--pios-text)' : 'var(--pios-sub)' }}>
                        Ch{ch.chapter_num} — {ch.title}
                      </span>
                    </div>
                    <div style={{ height: 2, background: 'var(--pios-surface3)', borderRadius: 1, overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: sc }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 9, color: 'var(--pios-dim)' }}>
                      <span style={{ color: sc }}>{ch.status.replace(/_/g, ' ')}</span>
                      <span>{ch.word_count.toLocaleString()} / {(ch.target_words ?? 8000).toLocaleString()}</span>
                    </div>
                  </button>
                </div>
              )
            })}
            {chapters.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--pios-dim)' }}>
                No chapters yet. Add them in the Academic Hub.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CENTRE: Draft controls + output ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pios-muted)', flexDirection: 'column', gap: 12 }}>
            <BookOpen size={36} style={{ opacity: 0.2 }} />
            <p style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 400 }}>Select a chapter to start writing</p>
          </div>
        ) : (
          <>
            {/* Chapter header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--pios-border)', flexShrink: 0, background: 'var(--pios-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <FileText size={14} color="var(--academic)" />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, letterSpacing: '-0.02em' }}>
                  Chapter {selected.chapter_num}: {selected.title}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, ...mono, color: 'var(--pios-muted)' }}>
                <span>{selected.word_count.toLocaleString()} / {(selected.target_words ?? 8000).toLocaleString()} words</span>
                <span style={{ color: STATUS_COLOR[selected.status] ?? 'var(--pios-dim)' }}>{selected.status.replace(/_/g, ' ')}</span>
                {selected.chapter_type && <span>{selected.chapter_type.replace(/_/g, ' ')}</span>}
              </div>
            </div>

            {/* Controls */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--pios-border)', flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 10 }}>
                {/* Section picker */}
                <div>
                  <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 4 }}>Section</div>
                  <select style={inp} value={section} onChange={e => setSection(e.target.value)}>
                    <option value="">Choose a section…</option>
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="__custom">Custom section…</option>
                  </select>
                </div>
                {/* Word target */}
                <div>
                  <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 4 }}>Target words</div>
                  <select style={inp} value={wordTarget} onChange={e => setWordTarget(Number(e.target.value))}>
                    {[250, 400, 500, 750, 1000, 1500, 2000].map(n => (
                      <option key={n} value={n}>{n} words</option>
                    ))}
                  </select>
                </div>
                {/* Generate button */}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={generate} disabled={!section || generating} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
                    borderRadius: 8, border: 'none', cursor: section ? 'pointer' : 'not-allowed',
                    background: section && !generating ? 'var(--ai)' : 'rgba(99,73,255,0.3)',
                    color: '#fff', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap' as const,
                  }}>
                    {generating
                      ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Writing…</>
                      : <><Zap size={14} /> Generate</>}
                  </button>
                </div>
              </div>

              {/* Custom section input */}
              {section === '__custom' && (
                <input style={{ ...inp, marginBottom: 10 }}
                  placeholder="Enter section heading…"
                  onChange={e => setSection(e.target.value)} autoFocus />
              )}

              {/* Collapsible: section notes + lit context */}
              <button onClick={() => setExpanded(v => v === 'context' ? null : 'context')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pios-muted)', fontSize: 11, padding: 0 }}>
                {expanded === 'context' ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Section notes &amp; literature context (optional)
              </button>

              {expanded === 'context' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 4 }}>Section notes</div>
                    <textarea style={{ ...inp, resize: 'vertical' as const, minHeight: 72, fontFamily: 'var(--font-sans)' }}
                      placeholder="Key arguments, findings, or points to include…"
                      value={sectionNotes} onChange={e => setSectionNotes(e.target.value)} rows={3} />
                  </div>
                  <div>
                    <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 4 }}>Key literature to reference</div>
                    <textarea style={{ ...inp, resize: 'vertical' as const, minHeight: 72, fontFamily: 'var(--font-sans)' }}
                      placeholder="Author (Year) — key argument or finding…"
                      value={litContext} onChange={e => setLitContext(e.target.value)} rows={3} />
                  </div>
                </div>
              )}
            </div>

            {/* Draft output */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 20px' }}>
              {generating ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--pios-muted)', fontSize: 13 }}>
                  <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                  NemoClaw™ is writing your section…
                </div>
              ) : draft ? (
                <>
                  {/* Draft toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ ...mono, color: 'var(--pios-dim)', flex: 1 }}>
                      {draft.split(/\s+/).filter(Boolean).length} words · {section}
                    </span>
                    <button onClick={copyDraft} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                      borderRadius: 7, border: '1px solid var(--pios-border2)',
                      background: 'transparent', color: 'var(--pios-muted)', fontSize: 11, cursor: 'pointer',
                    }}>
                      {copied ? <Check size={11} color="var(--fm)" /> : <Copy size={11} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={generate} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                      borderRadius: 7, border: '1px solid var(--pios-border2)',
                      background: 'transparent', color: 'var(--pios-muted)', fontSize: 11, cursor: 'pointer',
                    }}>
                      <RefreshCw size={11} /> Regenerate
                    </button>
                    <button onClick={saveDraft} disabled={saving} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px',
                      borderRadius: 7, border: 'none',
                      background: saved ? 'rgba(16,185,129,0.15)' : 'var(--ai)',
                      color: saved ? 'var(--fm)' : '#fff', fontSize: 11, cursor: 'pointer',
                    }}>
                      {saving ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                             : saved ? <Check size={11} /> : <Save size={11} />}
                      {saving ? 'Saving…' : saved ? 'Saved' : 'Append to chapter'}
                    </button>
                  </div>
                  {/* Draft text — editable */}
                  <textarea
                    ref={textRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    style={{
                      flex: 1, width: '100%', padding: '16px',
                      background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
                      borderRadius: 10, color: 'var(--pios-text)', fontSize: 14,
                      fontFamily: 'Georgia, serif', lineHeight: 1.85, resize: 'none',
                      outline: 'none',
                    }}
                  />
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--pios-muted)' }}>
                  <Target size={32} style={{ opacity: 0.2 }} />
                  <p style={{ fontSize: 13 }}>Select a section and click Generate</p>
                  <p style={{ fontSize: 11, color: 'var(--pios-dim)', maxWidth: 300, textAlign: 'center' as const }}>
                    NemoClaw™ will write academic prose grounded in your DBA context, theoretical framework, and case study sites.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Chapter content preview ─────────────────────────────── */}
      {selected?.content && (
        <div style={{
          width: 280, flexShrink: 0, borderLeft: '1px solid var(--pios-border)',
          overflowY: 'auto', padding: '14px 16px',
        }}>
          <div style={{ ...mono, color: 'var(--pios-dim)', marginBottom: 12 }}>Chapter content</div>
          <div style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.75, whiteSpace: 'pre-wrap' as const }}>
            {selected.content}
          </div>
        </div>
      )}
    </div>
  )
}
