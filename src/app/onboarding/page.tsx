'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding v3.0 — 5-step investment-grade wizard
// Step 1: Persona  (CEO/Founder PRIMARY)
// Step 2: Profile  (name, role, org, timezone)
// Step 3: CV Upload + NemoClaw™ Intelligence Calibration  ← NEW
// Step 4: Plan
// Step 5: Connect Gmail
// PIOS v3.0 · VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    key: 'executive', icon: '⚡', color: 'var(--pro)', badge: 'PRIMARY',
    label: 'Founder / CEO',
    sub: 'Running companies, consulting practice, or C-suite executive',
    features: ['Command Centre + 7am AI Brief', '15 NemoClaw™ consulting frameworks', 'Executive OS + Decision Architecture™', 'IP Vault · Group P&L · Contracts', 'Payroll engine + OKR pulse'],
  },
  {
    key: 'consultant', icon: '◎', color: 'var(--ai)',
    label: 'Consultant / Advisor',
    sub: 'Client-facing advisory, interim management, specialist consulting',
    features: ['Consulting Framework Engine (15 tools)', 'Client engagement & proposal tracker', 'SE-MIL Knowledge Base', 'Stakeholder Power Atlas', 'Time sovereignty + billing tracker'],
  },
  {
    key: 'academic', icon: '◈', color: 'var(--academic)',
    label: 'Academic / Researcher',
    sub: 'DBA, MBA, MSc, PhD, CPD or professional qualification',
    features: ['Thesis & chapter word-count tracker', 'CPD deadline management (12 bodies)', 'Academic calendar + supervisor log', 'Literature organiser + AI search', 'Research Hub + citation manager'],
  },
]

const PLANS = [
  { key: 'student',       name: 'Student',       price: '$9',   period: '/mo', color: 'var(--pro)',      description: 'Academic lifecycle + CPD', features: ['Academic Hub', 'CPD Tracker', 'Research Hub', '2,000 AI credits/mo'] },
  { key: 'professional',  name: 'Professional',  price: '$24',  period: '/mo', color: 'var(--ai)',       description: 'Full CEO/Founder OS', popular: true, features: ['Daily AI Brief', '15 NemoClaw™ frameworks', 'Executive OS', 'IP Vault + Contracts', '10,000 AI credits/mo'] },
  { key: 'team',          name: 'Team',          price: 'Custom', period: '',  color: 'var(--fm)',       description: 'Shared workspaces + SSO', features: ['Everything in Professional', 'Dept-level admin + SSO', 'Cohort dashboard', 'Unlimited AI credits'] },
]

const TIMEZONES = ['Europe/London','Europe/Dublin','Europe/Paris','Asia/Riyadh','Asia/Dubai','Asia/Karachi','Africa/Johannesburg','Africa/Lusaka','America/New_York','America/Chicago','America/Los_Angeles','UTC']

const REGISTER_LABELS: Record<string, string> = {
  peer_executive: 'Peer Executive',
  professional:   'Professional',
  coached:        'Coached',
  mentored:       'Mentored',
}
const INTENSITY_LABELS: Record<string, string> = {
  light:     'Light touch',
  balanced:  'Balanced',
  intensive: 'Intensive coaching',
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginBottom: 44 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: i + 1 === step ? 2.5 : 1, height: 3, borderRadius: 99,
          background: i + 1 < step ? 'rgba(139,124,248,0.4)' : i + 1 === step ? 'var(--ai)' : 'var(--pios-surface3)',
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        }} />
      ))}
    </div>
  )
}

const labelSty: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
  textTransform: 'uppercase' as const, color: 'var(--pios-dim)', marginBottom: 7,
}
const inputSty: React.CSSProperties = {
  display: 'block', width: '100%', padding: '10px 13px',
  background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
  borderRadius: 9, color: 'var(--pios-text)', fontSize: 13,
  fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' as const,
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

function TextInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={labelSty}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputSty}
        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--ai)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--ai-glow)' }}
        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--pios-border2)'; (e.target as HTMLInputElement).style.boxShadow = 'none' }} />
    </div>
  )
}

function PrimaryBtn({ onClick, disabled, children, color = 'var(--ai)' }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; color?: string
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '12px', borderRadius: 11, border: 'none',
      background: disabled ? 'rgba(139,124,248,0.3)' : color,
      color: 'var(--pios-bg)', fontFamily: 'var(--font-display)',
      fontSize: 14, fontWeight: 400, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.15s',
    }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}>
      {children}
    </button>
  )
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '11px', borderRadius: 11,
      border: '1px solid var(--pios-border2)', background: 'transparent',
      color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
    }}>{children}</button>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  // ── State — must be declared before any useEffect that references them ──────
  const [step,         setStep]         = useState(1)
  const [persona,      setPersona]      = useState('')
  const [fullName,     setFullName]     = useState('')
  const [jobTitle,     setJobTitle]     = useState('')
  const [organisation, setOrg]         = useState('')
  const [programme,    setProgramme]    = useState('')
  const [university,   setUniversity]   = useState('')
  const [timezone,     setTimezone]     = useState('Europe/London')
  const [plan,         setPlan]         = useState('professional')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [cvFile,        setCvFile]       = useState<File | null>(null)
  const [cvProcessing,  setCvProcessing] = useState(false)
  const [cvDone,        setCvDone]       = useState(false)
  const [cvError,       setCvError]      = useState('')
  const [calibration,   setCalibration]  = useState<Record<string, unknown> | null>(null)
  const [isDragging,    setIsDragging]   = useState(false)

  const isExec = persona === 'executive' || persona === 'consultant'
  const isAcad = persona === 'academic'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      supabase.from('user_profiles')
        .select('persona_type, onboarded, full_name, job_title, organisation, programme_name, university, timezone')
        .eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.onboarded) { router.push('/platform/dashboard'); return }
          if (data?.full_name)       setFullName(data.full_name)
          if (data?.job_title)       setJobTitle(data.job_title)
          if (data?.organisation)    setOrg(data.organisation)
          if (data?.programme_name)  setProgramme(data.programme_name)
          if (data?.university)      setUniversity(data.university)
          if (data?.timezone)        setTimezone(data.timezone)
          if (data?.persona_type)    setPersona(data.persona_type)
        })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const savedStep    = sessionStorage.getItem('pios_ob_step')
    const savedPersona = sessionStorage.getItem('pios_ob_persona')
    if (savedStep)    setStep(Number(savedStep))
    if (savedPersona) setPersona(savedPersona)
  }, [])

  useEffect(() => { sessionStorage.setItem('pios_ob_step',    String(step))    }, [step])
  useEffect(() => { if (persona) sessionStorage.setItem('pios_ob_persona', persona) }, [persona])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function saveProfile() {
    if (!fullName.trim()) { setError('Please enter your full name.'); return }
    setSaving(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in — please refresh and try again.')

      // Upsert directly via client — works regardless of RLS if profile already exists
      // For new users the auth callback already created the profile row
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name:      fullName.trim(),
          job_title:      jobTitle.trim()      || null,
          organisation:   organisation.trim()  || null,
          programme_name: programme.trim()     || null,
          university:     university.trim()    || null,
          timezone,
          persona_type:   persona              || 'executive',
          updated_at:     new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        // If update failed (no row yet), try API which uses service role
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name:      fullName,
            job_title:      jobTitle      || undefined,
            organisation:   organisation  || undefined,
            programme_name: programme     || undefined,
            university:     university    || undefined,
            timezone,
            persona_type:   persona       || 'executive',
          }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.error ?? `Save failed (${res.status})`)
      }

      setStep(3)
    } catch (e: any) {
      setError(e.message ?? 'Could not save profile. Please try again.')
    }
    setSaving(false)
  }

  async function processCV(file: File) {
    setCvFile(file); setCvError(''); setCvProcessing(true); setCvDone(false)
    try {
      const fd = new FormData()
      fd.append('cv', file)
      const res  = await fetch('/api/cv', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) { setCvError(data.error ?? 'Processing failed.'); setCvProcessing(false); return }

      // Auto-fill profile fields if empty
      if (data.autofill?.full_name    && !fullName)     setFullName(data.autofill.full_name)
      if (data.autofill?.job_title    && !jobTitle)     setJobTitle(data.autofill.job_title)
      if (data.autofill?.organisation && !organisation) setOrg(data.autofill.organisation)

      setCalibration(data.calibration)
      setCvDone(true)
    } catch { setCvError('Network error. Please try again.') }
    setCvProcessing(false)
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processCV(file)
  }

  async function completePlan() {
    setSaving(true)
    // Mark as onboarded
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarded: true }),
    })
    // Clear wizard state from sessionStorage
    sessionStorage.removeItem('pios_ob_step')
    sessionStorage.removeItem('pios_ob_persona')
    router.push('/platform/dashboard')
    setSaving(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--pios-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ width: '100%', maxWidth: step === 1 ? 820 : 500 }} className="fade-up">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, var(--ai), var(--academic))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: '#fff',
            boxShadow: '0 4px 24px rgba(139,124,248,0.3)',
          }}>P</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--pios-text)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            PIOS
          </div>
          <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>Personal Intelligence Operating System</div>
        </div>

        <StepBar step={step} total={5} />

        {/* ── STEP 1: Persona ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--pios-text)', letterSpacing: '-0.03em', marginBottom: 6 }}>
                How will you use PIOS?
              </div>
              <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
                Choose your primary context — all modules are available from any persona.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {PERSONAS.map(p => (
                <button key={p.key} onClick={() => { setPersona(p.key); setStep(2) }} style={{
                  background: persona === p.key ? `${p.color}0e` : 'var(--pios-surface)',
                  border: `1px solid ${persona === p.key ? p.color : 'var(--pios-border)'}`,
                  borderRadius: 14, padding: 22, cursor: 'pointer',
                  textAlign: 'left' as const, transition: 'all 0.2s',
                  position: 'relative' as const, fontFamily: 'var(--font-sans)',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = p.color }}
                  onMouseLeave={e => { if (persona !== p.key) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pios-border)' }}>

                  {p.badge && (
                    <div style={{
                      position: 'absolute', top: -10, right: 12,
                      background: p.color, color: 'var(--pios-bg)',
                      fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                      letterSpacing: '0.05em', fontFamily: 'var(--font-display)',
                    }}>{p.badge}</div>
                  )}

                  <div style={{ fontSize: 26, marginBottom: 12, color: p.color }}>{p.icon}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 400, color: 'var(--pios-text)', marginBottom: 5, letterSpacing: '-0.01em' }}>{p.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--pios-muted)', marginBottom: 16, lineHeight: 1.55 }}>{p.sub}</div>

                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                    {p.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11.5, color: 'var(--pios-sub)' }}>
                        <span style={{ color: p.color, fontSize: 10, marginTop: 2, flexShrink: 0 }}>◆</span>
                        {f}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Profile ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border2)', borderRadius: 18, padding: 30, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, var(--ai), var(--academic))', opacity: 0.5 }} />

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400, color: 'var(--pios-text)', letterSpacing: '-0.02em', marginBottom: 6 }}>Your profile</div>
            <div style={{ fontSize: 12.5, color: 'var(--pios-muted)', marginBottom: 24 }}>NemoClaw™ uses this to personalise every interaction.</div>

            <TextInput label="Full name *" value={fullName} onChange={setFullName} placeholder="Douglas Masuku" />

            {isExec && <>
              <TextInput label="Job title" value={jobTitle} onChange={setJobTitle} placeholder="Group CEO / Founder / Managing Director" />
              <TextInput label="Organisation" value={organisation} onChange={setOrg} placeholder="VeritasIQ Technologies Ltd" />
            </>}

            {isAcad && <>
              <TextInput label="Programme" value={programme} onChange={setProgramme} placeholder="DBA — Facilities Management" />
              <TextInput label="University" value={university} onChange={setUniversity} placeholder="University of Portsmouth" />
            </>}

            <div style={{ marginBottom: 22 }}>
              <div style={labelSty}>TIMEZONE</div>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{ ...inputSty }}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            {error && <div style={{ color: 'var(--dng)', fontSize: 12, marginBottom: 14 }}>⚠ {error}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <GhostBtn onClick={() => setStep(1)}>← Back</GhostBtn>
              <div style={{ flex: 2 }}>
                <PrimaryBtn onClick={saveProfile} disabled={!fullName || saving}>
                  {saving ? '⟳ Saving…' : 'Continue →'}
                </PrimaryBtn>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: CV Upload + Calibration ─────────────────────────────── */}
        {step === 3 && (
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border2)', borderRadius: 18, padding: 30, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, var(--ai), var(--academic))', opacity: 0.5 }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ai-subtle)', border: '1px solid rgba(139,124,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>◉</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400, color: 'var(--pios-text)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  Intelligence Calibration
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--pios-muted)', lineHeight: 1.6 }}>
                  Upload your CV so NemoClaw™ can calibrate its coaching register, select the most relevant frameworks for your background, and identify your growth areas — making every conversation bespoke from day one.
                </div>
              </div>
            </div>

            {/* What NemoClaw reads */}
            <div style={{ background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--pios-dim)', letterSpacing: '0.07em', textTransform: 'uppercase' as const, marginBottom: 10 }}>What NemoClaw™ extracts</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { icon: '◈', label: 'Education & qualifications', sub: 'Calibrates depth of support' },
                  { icon: '⚡', label: 'Career trajectory', sub: 'Sets communication register' },
                  { icon: '◎', label: 'Industry expertise', sub: 'Selects relevant frameworks' },
                  { icon: '↗', label: 'Achievements & gaps', sub: 'Identifies growth areas' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: 'var(--ai)', fontSize: 12, marginTop: 1, flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--pios-text)' }}>{item.label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--pios-dim)' }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            {!cvDone && (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--ai)' : cvFile ? 'rgba(139,124,248,0.3)' : 'var(--pios-border2)'}`,
                  borderRadius: 12, padding: '32px 20px', textAlign: 'center' as const,
                  cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16,
                  background: isDragging ? 'var(--ai-subtle)' : 'transparent',
                }}>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) processCV(f) }} />

                {cvProcessing ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 12, animation: 'ai-pulse 1.5s ease-in-out infinite', color: 'var(--ai)' }}>◉</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 400, color: 'var(--pios-text)', marginBottom: 6 }}>
                      NemoClaw™ is reading your CV…
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>Extracting profile · Calibrating intelligence · Selecting frameworks</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>📄</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 400, color: 'var(--pios-text)', marginBottom: 4 }}>
                      {cvFile ? cvFile.name : 'Drop your CV here'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
                      {cvFile ? 'Click to change file' : 'or click to browse — PDF, DOCX, DOC, or TXT · Max 5MB'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CV error */}
            {cvError && (
              <div style={{ background: 'rgba(224,82,114,0.08)', border: '1px solid rgba(224,82,114,0.2)', borderRadius: 9, padding: '10px 14px', marginBottom: 14, color: 'var(--dng)', fontSize: 12 }}>
                ⚠ {cvError} <button onClick={() => setCvError('')} style={{ background: 'none', border: 'none', color: 'var(--dng)', cursor: 'pointer', marginLeft: 8, fontSize: 12 }}>Retry</button>
              </div>
            )}

            {/* Calibration result */}
            {cvDone && calibration && (
              <div style={{ marginBottom: 18 }}>
                {/* NemoClaw summary */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(139,124,248,0.07), rgba(79,142,247,0.04))',
                  border: '1px solid rgba(139,124,248,0.18)', borderRadius: 12, padding: '14px 16px', marginBottom: 12,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, var(--ai), var(--academic))' }} />
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ai)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 8 }}>◉ NemoClaw™ Calibration Complete</div>
                  <div style={{ fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.65 }}>
                    {String(calibration.calibration_summary ?? '')}
                  </div>
                </div>

                {/* Calibration metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <div style={{ background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 9, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9.5, color: 'var(--pios-dim)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 5 }}>Register</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ai)' }}>{REGISTER_LABELS[String(calibration.communication_register ?? '')] ?? String(calibration.communication_register ?? '')}</div>
                  </div>
                  <div style={{ background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 9, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9.5, color: 'var(--pios-dim)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 5 }}>Coaching</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ai)' }}>{INTENSITY_LABELS[String(calibration.coaching_intensity ?? '')] ?? String(calibration.coaching_intensity ?? '')}</div>
                  </div>
                  <div style={{ background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 9, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9.5, color: 'var(--pios-dim)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 5 }}>Style</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ai)', textTransform: 'capitalize' as const }}>{String(calibration.decision_style ?? '')}</div>
                  </div>
                </div>

                {/* Frameworks */}
                {Array.isArray(calibration.recommended_frameworks) && (calibration.recommended_frameworks as string[]).length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9.5, color: 'var(--pios-dim)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Priority Frameworks</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {(calibration.recommended_frameworks as string[]).map(fw => (
                        <span key={fw} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 5, background: 'var(--ai-subtle)', color: 'var(--ai)' }}>{fw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Growth areas */}
                {Array.isArray(calibration.growth_areas) && (calibration.growth_areas as string[]).length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9.5, color: 'var(--pios-dim)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Growth Areas NemoClaw™ Will Coach On</div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                      {(calibration.growth_areas as string[]).slice(0, 3).map((area: string) => (
                        <div key={area} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: 'var(--pios-sub)' }}>
                          <span style={{ color: 'var(--fm)', flexShrink: 0, marginTop: 2 }}>◆</span>
                          {area}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => { setCvDone(false); setCvFile(null); setCalibration(null) }} style={{
                  marginTop: 10, background: 'none', border: 'none',
                  color: 'var(--pios-dim)', fontSize: 11, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}>↺ Upload a different CV</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <GhostBtn onClick={() => setStep(2)}>← Back</GhostBtn>
              <div style={{ flex: 2 }}>
                <PrimaryBtn onClick={() => setStep(4)}>
                  {cvDone ? 'Continue →' : 'Skip for now →'}
                </PrimaryBtn>
              </div>
            </div>

            {!cvDone && (
              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--pios-dim)' }}>
                Your CV is processed securely and never shared. You can update it anytime in Settings.
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: Plan ─────────────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 26 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--pios-text)', letterSpacing: '-0.03em', marginBottom: 5 }}>Choose your plan</div>
              <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>14-day free trial on all plans · Cancel anytime</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 18 }}>
              {PLANS.map(p => (
                <button key={p.key} onClick={() => setPlan(p.key)} style={{
                  background: plan === p.key ? `${p.color}0e` : 'var(--pios-surface)',
                  border: `1px solid ${plan === p.key ? p.color : 'var(--pios-border)'}`,
                  borderRadius: 12, padding: '14px 18px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                  transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                  position: 'relative' as const,
                }}>
                  {p.popular && (
                    <div style={{ position: 'absolute', top: -9, right: 14, background: 'var(--ai)', color: 'var(--pios-bg)', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, fontFamily: 'var(--font-display)' }}>POPULAR</div>
                  )}
                  <div style={{ textAlign: 'left' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 400, color: 'var(--pios-text)' }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--pios-muted)', marginBottom: 8 }}>{p.description}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                      {p.features.slice(0, 3).map(f => (
                        <span key={f} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${p.color}12`, color: p.color, fontWeight: 600 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--pios-text)', letterSpacing: '-0.04em' }}>{p.price}</span>
                    <span style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{p.period}</span>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <GhostBtn onClick={() => setStep(3)}>← Back</GhostBtn>
              <div style={{ flex: 2 }}>
                <PrimaryBtn onClick={() => setStep(5)}>Continue →</PrimaryBtn>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: Connect Gmail ────────────────────────────────────────── */}
        {step === 5 && (
          <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border2)', borderRadius: 18, padding: 30, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, var(--ai), var(--fm))', opacity: 0.5 }} />

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✉</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400, color: 'var(--pios-text)', letterSpacing: '-0.02em', marginBottom: 6 }}>Connect Gmail</div>
              <div style={{ fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.65, maxWidth: 340, margin: '0 auto' }}>
                PIOS auto-triages your inbox, captures action items, and extracts receipts — unlocking the full autonomous intelligence layer.
              </div>
            </div>

            <div style={{ background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              {[
                { icon: '◉', text: 'Autonomous inbox triage — NemoClaw™ surfaces what needs action' },
                { icon: '📅', text: 'Calendar sync — briefings include today\'s meetings automatically' },
                { icon: '🧾', text: 'Receipt capture — expenses logged without manual entry' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: i < 2 ? '1px solid var(--pios-border)' : 'none' }}>
                  <span style={{ fontSize: 14, color: 'var(--fm)', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--pios-sub)', lineHeight: 1.5 }}>{item.text}</span>
                </div>
              ))}
            </div>

            <div style={{
              width: '100%', padding: '14px 16px', borderRadius: 11, marginBottom: 10,
              border: '1px solid var(--pios-border)', background: 'var(--pios-surface2)',
              color: 'var(--pios-muted)', fontSize: 13, textAlign: 'center' as const,
              fontFamily: 'var(--font-sans)',
            }}>
              ✉ Gmail & Calendar connect available once Google OAuth is configured
            </div>

            <button onClick={completePlan} disabled={saving} style={{
              width: '100%', padding: '11px', borderRadius: 11,
              border: '1px solid var(--pios-border)', background: 'transparent',
              color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}>
              {saving ? '⟳ Setting up…' : 'Skip — Enter PIOS →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 10.5, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)' }}>
              PIOS v3.0 · VeritasIQ Technologies Ltd · info@veritasiq.io
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
