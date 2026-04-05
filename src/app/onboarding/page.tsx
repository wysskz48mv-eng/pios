'use client'
/**
 * /onboarding — PIOS Streamlined Onboarding (2 steps)
 * Step 1: Persona selection (4 personas matching landing page)
 * Step 2: Goals + optional CV upload
 *
 * VeritasIQ Technologies Ltd · PIOS
 */

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Persona = 'starter' | 'pro' | 'executive' | 'enterprise'

const PERSONAS: { key: Persona; label: string; icon: string; who: string }[] = [
  { key: 'starter',    label: 'Starter',    icon: '🎓', who: 'Undergraduate and postgraduate students' },
  { key: 'pro',        label: 'Pro',        icon: '💼', who: 'Professionals, consultants, solo founders' },
  { key: 'executive',  label: 'Executive',  icon: '⚡', who: 'CEOs, founders, directors, senior executives' },
  { key: 'enterprise', label: 'Enterprise', icon: '🏢', who: 'Corporations, universities, white-label partners' },
]

// Map new persona keys to existing DB persona_type values
const PERSONA_DB_MAP: Record<Persona, string> = {
  starter: 'academic',
  pro: 'consultant',
  executive: 'executive',
  enterprise: 'executive',
}

const S = {
  page:  { minHeight: '100vh', background: 'var(--pios-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' } as React.CSSProperties,
  card:  { width: '100%', maxWidth: 520, background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 16, padding: '40px 40px 36px' } as React.CSSProperties,
  logo:  { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--pios-text)', marginBottom: 32, letterSpacing: '-0.02em' } as React.CSSProperties,
  steps: { display: 'flex', gap: 6, marginBottom: 32 } as React.CSSProperties,
  dot:   (active: boolean, done: boolean) => ({ width: 6, height: 6, borderRadius: '50%', background: done ? 'var(--ai)' : active ? 'var(--pios-text)' : 'var(--pios-border)', transition: 'background 0.2s' }) as React.CSSProperties,
  h1:    { fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 8px', letterSpacing: '-0.02em' } as React.CSSProperties,
  sub:   { fontSize: 14, color: 'var(--pios-muted)', margin: '0 0 28px', lineHeight: 1.5 } as React.CSSProperties,
  btn:   { width: '100%', padding: '12px 20px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8, transition: 'opacity 0.15s' } as React.CSSProperties,
  btnSec:{ width: '100%', padding: '11px 20px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer', marginTop: 8 } as React.CSSProperties,
  pCard: (sel: boolean) => ({ padding: '14px 16px', border: `1px solid ${sel ? 'var(--ai)' : 'var(--pios-border)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, background: sel ? 'rgba(139,124,248,0.06)' : 'transparent', transition: 'all 0.15s' }) as React.CSSProperties,
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [goals, setGoals] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [cvUploaded, setCvUploaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleCV = useCallback(async (file: File) => {
    setUploading(true)
    setUploadErr('')
    try {
      const fd = new FormData()
      fd.append('cv', file)
      const res = await fetch('/api/cv', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }
      setCvUploaded(true)
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  async function complete() {
    if (!persona) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: PERSONA_DB_MAP[persona],
          deploy_mode: 'full',
          active_modules: ['command_centre', 'morning_brief', 'tasks', 'wellness', 'email_intel'],
          integrations: {},
          goals,
          email_triage_consent: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Setup failed — please try again.')
        setSaving(false)
        return
      }
      router.push('/platform/dashboard')
    } catch {
      setError('Network error — please check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>PIOS</div>

        {/* Progress dots */}
        <div style={S.steps}>
          {[0, 1].map(i => (
            <div key={i} style={S.dot(step === i, step > i)} />
          ))}
        </div>

        {/* Step 1 — Persona */}
        {step === 0 && (
          <>
            <h1 style={S.h1}>Who are you?</h1>
            <p style={S.sub}>This configures your intelligence stack. You can change it later.</p>

            {PERSONAS.map(p => (
              <div
                key={p.key}
                onClick={() => setPersona(p.key)}
                style={S.pCard(persona === p.key)}
              >
                <span style={{ fontSize: 22 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 2 }}>{p.who}</div>
                </div>
              </div>
            ))}

            <button
              onClick={() => persona && setStep(1)}
              disabled={!persona}
              style={{ ...S.btn, opacity: persona ? 1 : 0.4 }}
            >
              Continue →
            </button>
          </>
        )}

        {/* Step 2 — Goals + CV */}
        {step === 1 && (
          <>
            <h1 style={S.h1}>What do you want to achieve?</h1>
            <p style={S.sub}>In 90 days, what would have to be true for you to say PIOS made a real difference?</p>

            <textarea
              value={goals}
              onChange={e => setGoals(e.target.value)}
              placeholder="e.g. My thesis chapter is submitted, my client proposals are on time, and I'm not dropping balls across any domain..."
              rows={4}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14,
                background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
                color: 'var(--pios-text)', resize: 'vertical', fontFamily: 'inherit',
                outline: 'none', marginBottom: 16, lineHeight: 1.5,
              }}
            />

            {/* CV upload */}
            <div style={{
              padding: '14px 16px', border: '1px dashed var(--pios-border)',
              borderRadius: 10, textAlign: 'center', marginBottom: 16,
              cursor: 'pointer',
            }} onClick={() => fileRef.current?.click()}>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCV(f); e.target.value = '' }}
              />
              {cvUploaded ? (
                <p style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>✓ CV uploaded — NemoClaw is calibrating</p>
              ) : uploading ? (
                <p style={{ fontSize: 13, color: 'var(--ai)' }}>Uploading...</p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--pios-sub)' }}>Upload your CV (optional)</p>
                  <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 4 }}>PDF, DOC, DOCX, TXT — makes NemoClaw significantly more accurate</p>
                </>
              )}
            </div>
            {uploadErr && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>⚠ {uploadErr}</p>}

            {error && (
              <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8, padding: '8px 12px', background: 'rgba(248,113,113,0.06)', borderRadius: 8, border: '1px solid rgba(248,113,113,0.15)' }}>
                ⚠ {error}
              </p>
            )}

            <button
              onClick={complete}
              disabled={saving}
              style={{ ...S.btn, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Setting up your command centre...' : 'Take me to my command centre →'}
            </button>

            <button
              onClick={() => setStep(0)}
              style={S.btnSec}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
