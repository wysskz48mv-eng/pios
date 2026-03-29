'use client'
/**
 * /platform/settings/intelligence — Market Intelligence Settings
 * User controls for the overnight intelligence agent.
 *
 * All features opt-IN — disabled by default.
 * User can toggle categories, depth, custom topics.
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */

import { useState, useEffect, useCallback } from 'react'

interface IntelConfig {
  intel_enabled:    boolean
  intel_categories: string[]
  intel_depth:      'standard' | 'deep'
  intel_time:       string
}

interface TopicSub {
  id: string; topic: string; description?: string; active: boolean
}

const CATEGORIES = [
  { key: 'sector_news',      label: 'Sector news',            desc: 'Latest developments in your industry — 24-48 hours' },
  { key: 'opportunity',      label: 'Opportunities + tenders', desc: 'New contracts, RFPs, and funding announcements' },
  { key: 'regulatory',       label: 'Regulatory + policy',     desc: 'Regulatory changes and consultation papers' },
  { key: 'client_intel',     label: 'Client intelligence',     desc: 'News about your named stakeholder organisations' },
  { key: 'competitor_intel', label: 'Competitor activity',     desc: 'Market moves, M&A, new entrants in your sector' },
  { key: 'research',         label: 'Research + reports',      desc: 'Industry surveys, academic research, thought leadership' },
]

export default function IntelligenceSettingsPage() {
  const [config, setConfig]     = useState<IntelConfig>({
    intel_enabled:    false,
    intel_categories: ['sector_news', 'opportunity', 'regulatory'],
    intel_depth:      'standard',
    intel_time:       '05:00',
  })
  const [topics, setTopics]     = useState<TopicSub[]>([])
  const [newTopic, setNewTopic] = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [loading, setLoading]   = useState(true)
  const [preview, setPreview]   = useState('')
  const [previewing, setPreviewing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.config) setConfig(data.config)
        if (data.topics) setTopics(data.topics)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/intelligence/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config, topics }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const toggleCategory = (key: string) => {
    setConfig(prev => ({
      ...prev,
      intel_categories: prev.intel_categories.includes(key)
        ? prev.intel_categories.filter(k => k !== key)
        : [...prev.intel_categories, key],
    }))
  }

  const addTopic = async () => {
    if (!newTopic.trim()) return
    const topic: TopicSub = { id: crypto.randomUUID(), topic: newTopic.trim(), active: true }
    setTopics(prev => [...prev, topic])
    setNewTopic('')
  }

  const removeTopic = (id: string) => setTopics(prev => prev.filter(t => t.id !== id))

  const runPreview = async () => {
    setPreviewing(true)
    setPreview('')
    try {
      const res = await fetch('/api/intelligence/preview', { method: 'POST' })
      const data = await res.json()
      setPreview(data.preview ?? 'No preview available')
    } finally {
      setPreviewing(false)
    }
  }

  const inp = { padding: '9px 12px', border: '1px solid var(--pios-border)', borderRadius: 8, background: 'var(--pios-bg)', color: 'var(--pios-text)', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }

  if (loading) return <div style={{ padding: 32, color: 'var(--pios-muted)', fontSize: 14 }}>Loading...</div>

  return (
    <div style={{ padding: '28px 32px', maxWidth: 700, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Market Intelligence
        </h1>
        <p style={{ fontSize: 14, color: 'var(--pios-muted)', margin: 0, lineHeight: 1.6 }}>
          NemoClaw™ can gather market intelligence overnight and include it in your morning brief.
          All features are <strong style={{ color: 'var(--pios-text)' }}>opt-in</strong> and can be switched off at any time.
        </p>
      </div>

      {/* Master toggle */}
      <div style={{ background: 'var(--pios-card)', border: `1px solid ${config.intel_enabled ? 'rgba(139,124,248,0.4)' : 'var(--pios-border)'}`, borderRadius: 12, padding: '20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>
              Overnight intelligence agent
            </div>
            <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
              Runs at 05:00 UTC · Results included in your 07:00 morning brief
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: 44, height: 24, background: config.intel_enabled ? 'var(--ai)' : 'var(--pios-border)', borderRadius: 12, transition: 'background 0.2s', cursor: 'pointer' }}
              onClick={() => setConfig(prev => ({ ...prev, intel_enabled: !prev.intel_enabled }))}>
              <div style={{ position: 'absolute', top: 2, left: config.intel_enabled ? 22 : 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 13, color: config.intel_enabled ? 'var(--ai)' : 'var(--pios-muted)', fontWeight: 500 }}>
              {config.intel_enabled ? 'On' : 'Off'}
            </span>
          </label>
        </div>

        {config.intel_enabled && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(139,124,248,0.06)', borderRadius: 8, fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.6 }}>
            ✓ NemoClaw™ will use your calibration profile to gather relevant intelligence nightly.
            Intelligence uses approximately 2 AI credits per run.
            Data is retained for 30 days then automatically deleted.
          </div>
        )}
      </div>

      {config.intel_enabled && (
        <>
          {/* Categories */}
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>Intelligence categories</div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 16 }}>
              Select which types of intelligence to gather. More categories = more AI credits used.
            </div>
            {CATEGORIES.map(cat => {
              const active = config.intel_categories.includes(cat.key)
              return (
                <div key={cat.key} onClick={() => toggleCategory(cat.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--pios-border)', cursor: 'pointer' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${active ? 'var(--ai)' : 'var(--pios-border)'}`, background: active ? 'var(--ai)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {active && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>{cat.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Depth */}
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>Research depth</div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 16 }}>Standard takes ~2 min and uses 2 credits. Deep takes ~5 min and uses 5 credits.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['standard', 'deep'] as const).map(d => (
                <div key={d} onClick={() => setConfig(prev => ({ ...prev, intel_depth: d }))}
                  style={{ padding: '12px 16px', border: `1px solid ${config.intel_depth === d ? 'var(--ai)' : 'var(--pios-border)'}`, borderRadius: 10, cursor: 'pointer', background: config.intel_depth === d ? 'rgba(139,124,248,0.06)' : 'transparent' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', textTransform: 'capitalize', marginBottom: 4 }}>{d}</div>
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>
                    {d === 'standard' ? '5 items per category · ~1,500 words · 2 credits' : '10 items per category · ~3,000 words · 5 credits'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom topics */}
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>Custom topics</div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 16 }}>
              Add specific topics to monitor beyond your calibration profile. Examples: "GCC real estate market", "NHS procurement", "RICS CPD requirements 2026".
            </div>

            {topics.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--pios-border)' }}>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--pios-text)' }}>{t.topic}</div>
                <button onClick={() => removeTopic(t.id)} style={{ fontSize: 11, color: 'var(--dng)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px' }}>Remove</button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: topics.length > 0 ? 12 : 0 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Add a topic to monitor..." value={newTopic} onChange={e => setNewTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTopic()} />
              <button onClick={addTopic} style={{ padding: '9px 16px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                Add
              </button>
            </div>
          </div>

          {/* Preview */}
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>Preview intelligence</div>
                <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>Run a test now to see what NemoClaw™ would gather for you</div>
              </div>
              <button onClick={runPreview} disabled={previewing}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-muted)', fontSize: 12, cursor: previewing ? 'wait' : 'pointer', opacity: previewing ? 0.6 : 1 }}>
                {previewing ? 'Gathering...' : 'Run preview'}
              </button>
            </div>
            {previewing && (
              <div style={{ fontSize: 13, color: 'var(--ai)', padding: '12px 0' }}>
                NemoClaw™ is searching the web... this takes 1-2 minutes.
              </div>
            )}
            {preview && !previewing && (
              <div style={{ marginTop: 12, padding: '14px', background: 'var(--pios-bg)', borderRadius: 8, fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto', fontFamily: 'var(--font-mono)' }}>
                {preview}
              </div>
            )}
          </div>

          {/* Data notice */}
          <div style={{ padding: '14px 16px', background: 'rgba(16,217,160,0.04)', border: '1px solid rgba(16,217,160,0.15)', borderRadius: 10, marginBottom: 20, fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--fm)' }}>Privacy:</strong> Intelligence is gathered using web search only.
            Your personal data is never sent externally. Results are stored in your private PIOS database and auto-deleted after 30 days.
            No data is used for training. You can export or delete your intelligence data at any time from Settings → Data.
          </div>
        </>
      )}

      {/* Save */}
      <button onClick={save} disabled={saving}
        style={{ width: '100%', padding: '12px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save settings'}
      </button>
    </div>
  )
}
