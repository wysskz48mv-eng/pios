'use client'
import { useState, useEffect, useCallback } from 'react'
import { Brain, Sparkles, TestTube2, Save, RefreshCw, Loader2,
         Upload, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// NemoClaw™ Training — Executive Intelligence Configuration
// Configure AI persona context, goals, tone, and CV calibration
// PIOS v3.0.3 · Sprint 84 · VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', desc: 'Polished, measured, boardroom-ready' },
  { value: 'direct',       label: 'Direct',       desc: 'No padding, lead with the point' },
  { value: 'academic',     label: 'Academic',     desc: 'Structured, evidenced, rigorous' },
  { value: 'coaching',     label: 'Coaching',     desc: 'Reflective questions, challenge assumptions' },
  { value: 'casual',       label: 'Casual',       desc: 'Conversational, relaxed, exploratory' },
]
const STYLE_OPTIONS = [
  { value: 'structured',     label: 'Structured',     desc: 'Headers, bullet points, clear hierarchy' },
  { value: 'narrative',      label: 'Narrative',      desc: 'Flowing prose with clear argument' },
  { value: 'bullet',         label: 'Bullets only',   desc: 'Maximum density, minimal prose' },
  { value: 'conversational', label: 'Conversational', desc: 'Dialogue-style, back and forth' },
]

type Config = {
  persona_context?: string
  company_context?: string
  goals_context?: string
  custom_instructions?: string
  tone_preference?: string
  response_style?: string
}
type Calibration = {
  calibration_summary?: string
  seniority_level?: string
  primary_industry?: string
  career_years?: number
  recommended_frameworks?: string[]
  communication_register?: string
  coaching_intensity?: string
  decision_style?: string
  strengths?: string[]
  growth_areas?: string[]
  cv_processed_at?: string
}

export default function NemoClawTrainPage() {
  const [config,     setConfig]     = useState<Config>({})
  const [saved,      setSaved]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [testing,    setTesting]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [testOutput, setTestOutput] = useState('')
  const [calibration,setCalibration]= useState<Calibration | null>(null)
  const [calLoading, setCalLoading] = useState(true)
  const [cvUploading,setCvUploading]= useState(false)
  const [cvDone,     setCvDone]     = useState(false)
  const [cvError,    setCvError]    = useState('')
  const [showCvPanel,setShowCvPanel]= useState(false)
  const [genInputs,  setGenInputs]  = useState({ company_desc: '', goals: '', working_style: '' })

  // Load existing config + calibration
  const loadAll = useCallback(async () => {
    setCalLoading(true)
    try {
      const [trainRes, calRes] = await Promise.allSettled([
        fetch('/api/ai/train').then(r => r.json()),
        fetch('/api/cv').then(r => r.json()),
      ])
      if (trainRes.status === 'fulfilled') {
        const d = trainRes.value
        setConfig({
          persona_context:      d.config?.persona_context      ?? '',
          company_context:      d.config?.company_context      ?? '',
          goals_context:        d.config?.goals_context        ?? '',
          custom_instructions:  d.config?.custom_instructions  ?? '',
          tone_preference:      d.config?.tone_preference      ?? 'professional',
          response_style:       d.config?.response_style       ?? 'structured',
        })
      }
      if (calRes.status === 'fulfilled') {
        setCalibration(calRes.value?.calibration ?? null)
      }
    } catch (err) { console.error('[PIOS]', err) }
    setCalLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      const r = await fetch('/api/ai/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_config', ...config }),
      })
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    } catch (err) { console.error('[PIOS]', err) }
    setSaving(false)
  }

  async function generate() {
    setGenerating(true)
    try {
      const r = await fetch('/api/ai/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_context', ...genInputs }),
      })
      const d = await r.json()
      if (d.generated) {
        const raw: string = d.generated
        const ctxMatch   = raw.match(/CONTEXT:\s*([\s\S]*?)(?:CUSTOM INSTRUCTIONS:|$)/i)
        const instrMatch = raw.match(/CUSTOM INSTRUCTIONS:\s*([\s\S]*)/i)
        if (ctxMatch?.[1])   setConfig(p => ({ ...p, persona_context: ctxMatch[1].trim() }))
        if (instrMatch?.[1]) setConfig(p => ({ ...p, custom_instructions: instrMatch[1].trim() }))
      }
    } catch (err) { console.error('[PIOS]', err) }
    setGenerating(false)
  }

  async function test() {
    setTesting(true)
    setTestOutput('')
    try {
      const r = await fetch('/api/ai/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_persona', config }),
      })
      const d = await r.json()
      setTestOutput(d.response ?? d.error ?? 'No response')
    } catch (e: unknown) { setTestOutput((e as Error).message) }
    setTesting(false)
  }

  async function uploadCV(file: File) {
    setCvUploading(true)
    setCvError('')
    setCvDone(false)
    try {
      const fd = new FormData()
      fd.append('cv', file)
      const r = await fetch('/api/cv', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Upload failed')
      setCalibration(d.calibration ?? null)
      setCvDone(true)
      // Auto-populate persona context if empty
      if (!config.persona_context && d.calibration?.calibration_summary) {
        setConfig(p => ({ ...p, persona_context: d.calibration.calibration_summary }))
      }
    } catch (e: unknown) { setCvError((e as Error).message) }
    setCvUploading(false)
  }

  const ta = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    rows = 4
  ) => (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: 9,
        background: 'var(--pios-surface)',
        border: '1px solid var(--pios-border2)',
        color: 'var(--pios-text)', fontSize: 13,
        fontFamily: 'var(--font-sans)', resize: 'vertical',
        lineHeight: 1.6, boxSizing: 'border-box',
        outline: 'none',
      }}
    />
  )

  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Brain size={20} color="var(--ai)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400,
              fontStyle: 'italic', color: 'var(--pios-text)', margin: 0 }}>
              NemoClaw™ Training
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)', margin: 0, maxWidth: 540 }}>
            Configure your AI context so NemoClaw knows who you are, what you're working on,
            and how to communicate with you. Every conversation uses this profile.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/platform/ai" style={{
            padding: '8px 14px', borderRadius: 9, fontSize: 12,
            border: '1px solid var(--pios-border2)',
            color: 'var(--pios-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center',
          }}>
            ← Back to NemoClaw
          </Link>
          <button onClick={save} disabled={saving} style={{
            padding: '8px 18px', borderRadius: 9, fontSize: 12, fontWeight: 600,
            background: saved ? 'rgba(34,197,94,0.15)' : 'var(--ai)',
            border: `1px solid ${saved ? 'rgba(34,197,94,0.3)' : 'transparent'}`,
            color: saved ? '#22c55e' : '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
              : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save config'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* ── Left: config form ────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI Generate helper */}
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
            borderRadius: 12, padding: '16px 18px' }}>
            <button onClick={() => setShowCvPanel(!showCvPanel)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--pios-text)', padding: 0, marginBottom: showCvPanel ? 12 : 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} color="var(--ai)" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Auto-generate from description</span>
              </div>
              {showCvPanel ? <ChevronDown size={14} color="var(--pios-muted)" />
                : <ChevronRight size={14} color="var(--pios-muted)" />}
            </button>
            {showCvPanel && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: 'var(--pios-muted)', margin: 0 }}>
                  Describe yourself briefly and NemoClaw will generate the persona context and custom instructions for you.
                </p>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginBottom: 4 }}>Company / what you do</div>
                  {ta(genInputs.company_desc, v => setGenInputs(p => ({ ...p, company_desc: v })),
                    'e.g. VeritasEdge™ FM SaaS, InvestiScript AI journalism, DBA candidate at Portsmouth…', 2)}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginBottom: 4 }}>Current goals (top 3)</div>
                  {ta(genInputs.goals, v => setGenInputs(p => ({ ...p, goals: v })),
                    'e.g. Submit Qiddiya RFP by Apr 14, complete DBA Chapter 3, launch VeritasEdge to first client…', 2)}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginBottom: 4 }}>Working style preference</div>
                  {ta(genInputs.working_style, v => setGenInputs(p => ({ ...p, working_style: v })),
                    'e.g. Sprint-based, high-tempo, direct feedback preferred, data-driven…', 2)}
                </div>
                <button onClick={generate} disabled={generating} style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(139,124,248,0.12)', border: '1px solid rgba(139,124,248,0.25)',
                  color: 'var(--ai)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  alignSelf: 'flex-start',
                }}>
                  {generating ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                    : <Sparkles size={12} />}
                  {generating ? 'Generating…' : 'Generate for me'}
                </button>
              </div>
            )}
          </div>

          {/* Persona context */}
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
            borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-text)', marginBottom: 4 }}>
              About me <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--pios-muted)' }}>persona_context</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 8 }}>
              Who you are, your roles, background, and expertise. NemoClaw reads this at the start of every session.
            </div>
            {ta(
              config.persona_context ?? '',
              v => setConfig(p => ({ ...p, persona_context: v })),
              'e.g. I am Dimitry Masuku — Founder and CEO of VeritasIQ Technologies Ltd, DBA candidate at University of Portsmouth researching AI-enabled FM cost forecasting, FM consultant specialising in GCC master communities…',
              5
            )}
          </div>

          {/* Company context */}
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
            borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-text)', marginBottom: 4 }}>
              My company / organisation <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--pios-muted)' }}>company_context</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 8 }}>
              What your company does, key platforms, active clients, and current position.
            </div>
            {ta(
              config.company_context ?? '',
              v => setConfig(p => ({ ...p, company_context: v })),
              'e.g. VeritasIQ Technologies Ltd — three SaaS platforms: VeritasEdge™ (FM service charge intelligence), InvestiScript (AI investigative journalism), PIOS (personal intelligence OS). Key client: Qiddiya Investment Company…',
              4
            )}
          </div>

          {/* Goals context */}
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
            borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-text)', marginBottom: 4 }}>
              Current goals & priorities <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--pios-muted)' }}>goals_context</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 8 }}>
              What you're working toward right now. NemoClaw uses this to frame advice in terms of your actual priorities.
            </div>
            {ta(
              config.goals_context ?? '',
              v => setConfig(p => ({ ...p, goals_context: v })),
              'e.g. 1. Submit Qiddiya QPMO-410-CT-07922 RFP by 14 April 2026. 2. Complete DBA Chapter 3 literature synthesis by end of April. 3. Register VeritasIQ Technologies Ltd at Companies House and file VeritasEdge + VeritasIQ trademarks…',
              4
            )}
          </div>

          {/* Custom instructions */}
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
            borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-text)', marginBottom: 4 }}>
              Custom instructions <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--pios-muted)' }}>custom_instructions</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 8 }}>
              Specific rules for how NemoClaw should behave — always-on, session-independent directives.
            </div>
            {ta(
              config.custom_instructions ?? '',
              v => setConfig(p => ({ ...p, custom_instructions: v })),
              'e.g. Always lead with the highest-value action. When I ask about my platforms, reference actual sprint status not generic advice. Use SAR for Saudi costs, GBP for UK. Flag Qiddiya RFP deadlines proactively…',
              4
            )}
          </div>

          {/* Tone + style */}
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
            borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-text)', marginBottom: 12 }}>
              Response style
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 8 }}>Tone preference</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {TONE_OPTIONS.map(t => (
                    <label key={t.value} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 10px',
                      borderRadius: 8, cursor: 'pointer',
                      background: config.tone_preference === t.value ? 'rgba(139,124,248,0.1)' : 'transparent',
                      border: `1px solid ${config.tone_preference === t.value ? 'rgba(139,124,248,0.3)' : 'var(--pios-border)'}`,
                    }}>
                      <input type="radio" value={t.value}
                        checked={config.tone_preference === t.value}
                        onChange={() => setConfig(p => ({ ...p, tone_preference: t.value }))}
                        style={{ marginTop: 2, accentColor: 'var(--ai)' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--pios-text)' }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{t.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 8 }}>Response structure</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {STYLE_OPTIONS.map(s => (
                    <label key={s.value} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 10px',
                      borderRadius: 8, cursor: 'pointer',
                      background: config.response_style === s.value ? 'rgba(139,124,248,0.1)' : 'transparent',
                      border: `1px solid ${config.response_style === s.value ? 'rgba(139,124,248,0.3)' : 'var(--pios-border)'}`,
                    }}>
                      <input type="radio" value={s.value}
                        checked={config.response_style === s.value}
                        onChange={() => setConfig(p => ({ ...p, response_style: s.value }))}
                        style={{ marginTop: 2, accentColor: 'var(--ai)' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--pios-text)' }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{s.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Test persona */}
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
            borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <TestTube2 size={13} color="var(--fm)" />
                Test your configuration
              </div>
              <button onClick={test} disabled={testing} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.25)',
                color: 'var(--fm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {testing ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <TestTube2 size={12} />}
                {testing ? 'Running test…' : 'Run test'}
              </button>
            </div>
            {testOutput ? (
              <div style={{ fontSize: 12, color: 'var(--pios-sub)', lineHeight: 1.6,
                background: 'var(--pios-bg)', borderRadius: 8, padding: '12px 14px',
                border: '1px solid var(--pios-border)', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                {testOutput}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--pios-dim)' }}>
                Click "Run test" to see how NemoClaw introduces itself using your current configuration.
              </div>
            )}
          </div>
        </div>

        {/* ── Right: CV calibration panel ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* CV calibration card */}
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
            borderRadius: 12, padding: '16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Upload size={13} color="var(--ai)" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-text)' }}>
                CV Calibration
              </div>
            </div>

            {calLoading ? (
              <div style={{ fontSize: 12, color: 'var(--pios-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading…
              </div>
            ) : calibration ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <CheckCircle2 size={13} color="#22c55e" />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#22c55e' }}>Calibrated</span>
                </div>
                {calibration.calibration_summary && (
                  <p style={{ fontSize: 11, color: 'var(--pios-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
                    {calibration.calibration_summary}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Seniority',  calibration.seniority_level],
                    ['Industry',   calibration.primary_industry],
                    ['Experience', calibration.career_years ? `${calibration.career_years} years` : null],
                    ['Register',   calibration.communication_register],
                    ['Coaching',   calibration.coaching_intensity ? `${calibration.coaching_intensity} intensity` : null],
                    ['Decisions',  calibration.decision_style],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: 'var(--pios-dim)' }}>{l}</span>
                      <span style={{ color: 'var(--pios-sub)', textTransform: 'capitalize', textAlign: 'right', maxWidth: 130 }}>{v}</span>
                    </div>
                  ))}
                </div>
                {(calibration.recommended_frameworks ?? []).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginBottom: 4 }}>Recommended frameworks</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(calibration.recommended_frameworks ?? []).map(fw => (
                        <span key={fw} style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 20,
                          background: 'rgba(139,124,248,0.1)', color: 'var(--ai)',
                          border: '1px solid rgba(139,124,248,0.2)',
                        }}>{fw}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--pios-border)', marginTop: 10, paddingTop: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginBottom: 8 }}>
                    Recalibrate by uploading an updated CV
                  </div>
                  <CVUpload onFile={uploadCV} uploading={cvUploading} done={cvDone} error={cvError} />
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: 'var(--pios-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  Upload your CV so NemoClaw can calibrate its coaching register, framework recommendations,
                  and decision-support style to your exact background.
                </p>
                <CVUpload onFile={uploadCV} uploading={cvUploading} done={cvDone} error={cvError} />
              </div>
            )}
          </div>

          {/* Tips card */}
          <div style={{ background: 'rgba(139,124,248,0.06)', border: '1px solid rgba(139,124,248,0.15)',
            borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai)', marginBottom: 8, letterSpacing: '0.05em' }}>
              TRAINING TIPS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Be specific about roles — "DBA candidate + FM consultant + SaaS founder" beats "entrepreneur"',
                'List actual project names and deadlines in Goals — NemoClaw flags these proactively',
                'Custom instructions override general behaviour — use them for hard rules',
                'Re-run Test after each change to verify your config works as expected',
                'Recalibrate via CV whenever your seniority or industry changes significantly',
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 7 }}>
                  <span style={{ color: 'var(--ai)', fontSize: 10, marginTop: 2, flexShrink: 0 }}>◈</span>
                  <span style={{ fontSize: 11, color: 'var(--pios-muted)', lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick link */}
          <Link href="/platform/ai" style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '12px 14px',
            background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
            borderRadius: 10, textDecoration: 'none', color: 'var(--pios-text)',
          }}>
            <Brain size={13} color="var(--ai)" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Open NemoClaw™</div>
              <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>Start a calibrated conversation</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

function CVUpload({
  onFile, uploading, done, error
}: { onFile: (f: File) => void; uploading: boolean; done: boolean; error: string }) {
  return (
    <div>
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: '10px', borderRadius: 8,
        background: uploading ? 'rgba(139,124,248,0.08)' : done ? 'rgba(34,197,94,0.08)' : 'transparent',
        border: `1px dashed ${uploading ? 'rgba(139,124,248,0.4)' : done ? 'rgba(34,197,94,0.4)' : 'var(--pios-border2)'}`,
        cursor: uploading ? 'not-allowed' : 'pointer',
        color: done ? '#22c55e' : 'var(--pios-muted)', fontSize: 11,
      }}>
        {uploading
          ? <><Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Processing CV…</>
          : done
            ? <><CheckCircle2 size={12} /> Calibration updated</>
            : <><Upload size={12} /> Upload CV (PDF / DOCX)</>}
        <input type="file" accept=".pdf,.doc,.docx"
          disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
          style={{ display: 'none' }} />
      </label>
      {error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 5 }}>{error}</div>}
    </div>
  )
}
