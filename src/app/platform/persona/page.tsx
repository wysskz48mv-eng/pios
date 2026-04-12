'use client'

import { useEffect, useState } from 'react'

type PersonaProfile = {
  full_name: string | null
  job_title: string | null
  organisation: string | null
  persona_type: string | null
}

type PersonaConfig = {
  persona_context: string | null
  company_context: string | null
  goals_context: string | null
  tone_preference: string | null
  response_style: string | null
  custom_instructions: string | null
}

type FormState = {
  persona_type: string
  job_title: string
  organisation: string
  persona_context: string
  company_context: string
  goals_context: string
  tone_preference: string
  response_style: string
  custom_instructions: string
}

const PERSONAS = [
  { value: 'executive', label: 'Executive' },
  { value: 'founder', label: 'Founder' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'professional', label: 'Professional' },
  { value: 'student', label: 'Student' },
]

const TONES = ['professional', 'direct', 'coaching', 'friendly']
const STYLES = ['structured', 'concise', 'detailed']

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(10, 18, 32, 0.65)',
  border: '1px solid rgba(148, 163, 184, 0.3)',
  borderRadius: 12,
  padding: '10px 12px',
  color: 'var(--pios-text)',
  fontSize: 13,
}

function toForm(profile: PersonaProfile | null, config: PersonaConfig | null): FormState {
  return {
    persona_type: profile?.persona_type ?? 'executive',
    job_title: profile?.job_title ?? '',
    organisation: profile?.organisation ?? '',
    persona_context: config?.persona_context ?? '',
    company_context: config?.company_context ?? '',
    goals_context: config?.goals_context ?? '',
    tone_preference: config?.tone_preference ?? 'professional',
    response_style: config?.response_style ?? 'structured',
    custom_instructions: config?.custom_instructions ?? '',
  }
}

export default function PersonaPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [applyingDefaults, setApplyingDefaults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testReply, setTestReply] = useState<string>('')
  const [generatedPreview, setGeneratedPreview] = useState<string>('')
  const [genCompanyDesc, setGenCompanyDesc] = useState('')
  const [genGoals, setGenGoals] = useState('')
  const [genWorkingStyle, setGenWorkingStyle] = useState('')
  const [name, setName] = useState('')
  const [form, setForm] = useState<FormState>(() => toForm(null, null))

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const res = await fetch('/api/persona', { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? 'Failed to load persona settings')
        if (!active) return

        const profile = (data.profile ?? null) as PersonaProfile | null
        const config = (data.config ?? null) as PersonaConfig | null
        setForm(toForm(profile, config))
        setGenCompanyDesc(config?.company_context ?? profile?.organisation ?? '')
        setGenGoals(config?.goals_context ?? '')
        setGenWorkingStyle(config?.custom_instructions ?? '')
        setName(profile?.full_name ?? '')
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load persona settings')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSuccess(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/persona', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save persona settings')
      setSuccess('Persona settings updated successfully.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save persona settings')
    } finally {
      setSaving(false)
    }
  }

  function parseGeneratedContext(text: string) {
    const lines = text.split(/\r?\n/)
    const contextLines: string[] = []
    const instructionLines: string[] = []
    let section: 'none' | 'context' | 'instructions' = 'none'

    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      if (/^context\s*:/i.test(line)) {
        section = 'context'
        continue
      }
      if (/^custom\s+instructions\s*:/i.test(line)) {
        section = 'instructions'
        continue
      }

      if (section === 'context') {
        contextLines.push(line)
      } else if (section === 'instructions') {
        instructionLines.push(line.replace(/^\d+\.\s*/, ''))
      }
    }

    const contextBlock = contextLines.join(' ')
    const instructionsBlock = instructionLines.join('\n')
    return { contextBlock, instructionsBlock }
  }

  async function generateContext() {
    setGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/ai/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_context',
          company_desc: genCompanyDesc,
          goals: genGoals,
          working_style: genWorkingStyle,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to generate context')

      const generated = String(data?.generated ?? '')
      setGeneratedPreview(generated)

      const parsed = parseGeneratedContext(generated)
      setForm((prev) => ({
        ...prev,
        persona_context: parsed.contextBlock || prev.persona_context,
        company_context: genCompanyDesc || prev.company_context,
        goals_context: genGoals || prev.goals_context,
        custom_instructions: parsed.instructionsBlock || prev.custom_instructions,
      }))

      setSuccess('AI draft generated. Review and save your persona settings.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate context')
    } finally {
      setGenerating(false)
    }
  }

  async function applyPersonaDefaults() {
    setApplyingDefaults(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_defaults',
          persona_type: form.persona_type,
          company_context: form.company_context,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to apply defaults')

      const defaults = (data?.defaults ?? {}) as Record<string, string>
      setForm((prev) => ({
        ...prev,
        tone_preference: defaults.tone_preference ?? prev.tone_preference,
        response_style: defaults.response_style ?? prev.response_style,
        persona_context: defaults.persona_context ?? prev.persona_context,
        goals_context: defaults.goals_context ?? prev.goals_context,
        custom_instructions: defaults.custom_instructions ?? prev.custom_instructions,
      }))

      setSuccess('Persona defaults applied and saved for your selected profile.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to apply defaults')
    } finally {
      setApplyingDefaults(false)
    }
  }

  async function testPersona() {
    setTesting(true)
    setError(null)
    setSuccess(null)
    setTestReply('')

    try {
      const res = await fetch('/api/ai/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_persona',
          config: {
            persona_context: form.persona_context,
            company_context: form.company_context,
            goals_context: form.goals_context,
            custom_instructions: form.custom_instructions,
            tone_preference: form.tone_preference,
            response_style: form.response_style,
          },
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Persona test failed')

      setTestReply(String(data?.response ?? 'No response generated.'))
      setSuccess('Persona test response generated.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Persona test failed')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--pios-muted)' }}>Loading Persona Studio...</div>
  }

  return (
    <div className="fade-in" style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(14, 116, 144, 0.22), rgba(15, 23, 42, 0.8))',
        border: '1px solid rgba(125, 211, 252, 0.28)',
        borderRadius: 16,
        padding: 20,
      }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#67e8f9', marginBottom: 8 }}>
          Persona Studio
        </div>
        <h1 style={{ margin: 0, fontSize: 24, color: 'var(--pios-text)' }}>Develop Your Operational Persona</h1>
        <p style={{ margin: '8px 0 0', color: 'var(--pios-muted)', fontSize: 13 }}>
          Tune how PIOS reasons, writes, and prioritises for {name || 'your'} day-to-day execution.
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#fca5a5',
          borderRadius: 12,
          padding: '10px 12px',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          color: '#86efac',
          borderRadius: 12,
          padding: '10px 12px',
          fontSize: 13,
        }}>
          {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 14, padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Profile Identity</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
              Persona Type
              <select value={form.persona_type} onChange={(e) => updateField('persona_type', e.target.value)} style={inputStyle}>
                {PERSONAS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
              Job Title
              <input value={form.job_title} onChange={(e) => updateField('job_title', e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
              Organisation
              <input value={form.organisation} onChange={(e) => updateField('organisation', e.target.value)} style={inputStyle} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={applyPersonaDefaults}
                disabled={applyingDefaults || saving || testing || generating}
                className="pios-btn"
                style={{ minWidth: 220 }}
              >
                {applyingDefaults ? 'Applying Defaults...' : 'Apply Persona Defaults'}
              </button>
            </div>
          </div>
        </section>

        <section style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 14, padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Response Operating Mode</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
              Tone
              <select value={form.tone_preference} onChange={(e) => updateField('tone_preference', e.target.value)} style={inputStyle}>
                {TONES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
              Response Style
              <select value={form.response_style} onChange={(e) => updateField('response_style', e.target.value)} style={inputStyle}>
                {STYLES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>
        </section>
      </div>

      <section style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 14, padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Context Memory</h2>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
            Persona Context
            <textarea rows={4} value={form.persona_context} onChange={(e) => updateField('persona_context', e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
            Company Context
            <textarea rows={4} value={form.company_context} onChange={(e) => updateField('company_context', e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
            Current Goals
            <textarea rows={4} value={form.goals_context} onChange={(e) => updateField('goals_context', e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
            Custom Instructions
            <textarea rows={4} value={form.custom_instructions} onChange={(e) => updateField('custom_instructions', e.target.value)} style={inputStyle} />
          </label>
        </div>
      </section>

      <section style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 14, padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>AI Draft Builder</h2>
        <p style={{ margin: '8px 0 0', color: 'var(--pios-muted)', fontSize: 12 }}>
          Generate a first draft for persona context and custom instructions, then refine before saving.
        </p>

        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
            Company / Business Description
            <textarea rows={3} value={genCompanyDesc} onChange={(e) => setGenCompanyDesc(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
            Current Goals
            <textarea rows={3} value={genGoals} onChange={(e) => setGenGoals(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
            Working Style
            <textarea rows={3} value={genWorkingStyle} onChange={(e) => setGenWorkingStyle(e.target.value)} style={inputStyle} />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            onClick={generateContext}
            disabled={generating || saving || testing || applyingDefaults}
            className="pios-btn"
            style={{ minWidth: 200 }}
          >
            {generating ? 'Generating...' : 'Generate Context Draft'}
          </button>
        </div>

        {generatedPreview && (
          <div style={{ marginTop: 12, border: '1px solid var(--pios-border)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.45)' }}>
            <div style={{ fontSize: 11, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Draft Preview
            </div>
            <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--pios-text)', lineHeight: 1.6 }}>
              {generatedPreview}
            </div>
          </div>
        )}
      </section>

      {testReply && (
        <section style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 14, padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Persona Test Output</h2>
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: 'var(--pios-text)', whiteSpace: 'pre-wrap' }}>
            {testReply}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          onClick={testPersona}
          disabled={testing || saving || generating || applyingDefaults}
          className="pios-btn"
          style={{ minWidth: 180 }}
        >
          {testing ? 'Testing...' : 'Test Persona'}
        </button>
        <button
          onClick={save}
          disabled={saving || testing || generating || applyingDefaults}
          className="pios-btn pios-btn-primary"
          style={{ minWidth: 180 }}
        >
          {saving ? 'Saving...' : 'Save Persona'}
        </button>
      </div>
    </div>
  )
}
