'use client'
/**
 * /platform/comms — Communications Suite
 * Draft messages, manage outreach templates, track communications.
 * AI-assisted drafting via NemoClaw™.
 * VeritasIQ Technologies Ltd · Sprint J
 */
import { useState } from 'react'

type CommType = 'email' | 'proposal' | 'update' | 'deck' | 'press' | 'internal'

const TEMPLATES: Array<{ id: CommType; label: string; icon: string; desc: string; prompt: string }> = [
  {
    id: 'email', label: 'Executive email', icon: '✉',
    desc: 'Direct, professional email to a senior stakeholder or client',
    prompt: 'Draft a concise executive email to [recipient] about [topic]. Formal but direct. 3 paragraphs max.',
  },
  {
    id: 'proposal', label: 'Proposal outline', icon: '◈',
    desc: 'Structured proposal for a new engagement or project',
    prompt: 'Draft a proposal outline for [project/engagement]. Include: executive summary, scope, methodology, team, timeline, and commercial terms sections.',
  },
  {
    id: 'update', label: 'Investor update', icon: '▦',
    desc: 'Monthly or quarterly investor / board update',
    prompt: 'Draft an investor update covering: highlights this period, key metrics, challenges, next quarter focus, and asks.',
  },
  {
    id: 'deck', label: 'Deck narrative', icon: '◻',
    desc: 'Slide-by-slide narrative script for a presentation',
    prompt: 'Write a speaker narrative for a [N]-slide presentation about [topic]. One paragraph per slide, clear story arc.',
  },
  {
    id: 'press', label: 'Press release', icon: '◎',
    desc: 'Formal press release or announcement',
    prompt: 'Draft a press release announcing [news]. Standard format: headline, dateline, lede, body, boilerplate, contact.',
  },
  {
    id: 'internal', label: 'Internal brief', icon: '△',
    desc: 'Team briefing note or memo',
    prompt: 'Write an internal briefing note about [topic] for the team. Include: context, key points, actions required, and deadline.',
  },
]

export default function CommsPage() {
  const [selected, setSelected]   = useState<CommType | null>(null)
  const [context, setContext]      = useState('')
  const [draft, setDraft]          = useState('')
  const [generating, setGenerating]= useState(false)
  const [copied, setCopied]        = useState(false)

  const template = TEMPLATES.find(t => t.id === selected)

  async function generate() {
    if (!template || !context.trim()) return
    setGenerating(true)
    setDraft('')
    try {
      const prompt = template.prompt.replace(/\[.*?\]/g, match => context || match)
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `${prompt}\n\nContext: ${context}` }],
          domainContext: 'Professional executive communications. Founder and CEO of VeritasIQ Technologies Ltd. Consulting background in FM and service charge governance.',
        }),
      })
      const d = await r.json()
      setDraft(d.reply ?? d.content ?? '')
    } catch {
      setDraft('Generation failed — please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function copy() {
    navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="pios-page-header">
        <h1 className="pios-page-title">Communications Suite</h1>
        <p className="pios-page-sub">AI-assisted drafting for executive emails, proposals, updates, and outreach</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '280px 1fr' : '1fr', gap: 20 }}>

        {/* Template picker */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Select template
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TEMPLATES.map(t => (
              <div
                key={t.id}
                onClick={() => { setSelected(t.id); setDraft(''); setContext('') }}
                style={{
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${selected === t.id ? 'var(--ai-border)' : 'var(--pios-border)'}`,
                  background: selected === t.id ? 'var(--ai-subtle)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.12s',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}
              >
                <span style={{ fontSize: 14, color: selected === t.id ? 'var(--ai)' : 'var(--pios-muted)', flexShrink: 0, marginTop: 1 }}>
                  {t.icon}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 2 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Draft panel */}
        {selected && template && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Context — what is this about?
              </label>
              <textarea
                className="pios-input pios-textarea"
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder={`e.g. "Email to QIC procurement lead about our Qiddiya RFP submission — confirm receipt and offer a 30-min call"`}
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={generate}
                disabled={!context.trim() || generating}
                className="pios-btn pios-btn-primary"
              >
                {generating ? '◎ Generating...' : '✦ Generate draft'}
              </button>
              {draft && (
                <>
                  <button onClick={generate} className="pios-btn pios-btn-ghost pios-btn-sm" disabled={generating}>↻ Regenerate</button>
                  <button onClick={copy} className="pios-btn pios-btn-ghost pios-btn-sm">{copied ? '✓ Copied' : 'Copy'}</button>
                </>
              )}
            </div>

            {draft && (
              <div style={{
                background: 'var(--pios-surface2)',
                border: '1px solid var(--pios-border)',
                borderRadius: 8, padding: 20,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
                  ✦ NemoClaw™ Draft
                </div>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  style={{
                    width: '100%', background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--pios-sub)', fontSize: 13, lineHeight: 1.75,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    resize: 'vertical', minHeight: 300,
                  }}
                />
              </div>
            )}

            {!draft && !generating && (
              <div className="pios-empty" style={{ padding: '40px 0' }}>
                <div className="pios-empty-icon">✉</div>
                <div className="pios-empty-title">Add context above and generate</div>
                <div className="pios-empty-desc">
                  The more specific your context, the better the draft.
                </div>
              </div>
            )}
          </div>
        )}

        {!selected && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="pios-empty" style={{ padding: '60px 0' }}>
              <div className="pios-empty-icon">◻</div>
              <div className="pios-empty-title">Select a template to get started</div>
              <div className="pios-empty-desc">NemoClaw™ will draft it in your voice with your context.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
