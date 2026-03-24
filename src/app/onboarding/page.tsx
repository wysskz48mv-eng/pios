'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/**
 * /onboarding — First-run wizard
 * Step 0: Persona selection (student | professional/executive)
 * Step 1: Profile setup (context-aware per persona)
 * Step 2: Plan selection
 * Step 3: Optional Gmail connect
 * PIOS Sprint 22 | VeritasIQ Technologies Ltd
 */

const PERSONAS = [
  {
    key: 'executive',
    icon: '⚡',
    title: 'Founder / CEO',
    subtitle: 'Running one or more companies, consulting practice, or executive role',
    features: ['Command Centre + Daily AI Brief', 'Payroll & expense engine', '15 proprietary consulting frameworks', 'Executive OS + Decision Architecture', 'IP Vault + Group P&L'],
    colour: '#0d9488',
    badge: '★ Primary Mode',
  },
  {
    key: 'professional',
    icon: '💼',
    title: 'Consultant / Advisor',
    subtitle: 'Client-facing advisory, interim, or specialist consulting work',
    features: ['Consulting Framework Engine (15 tools)', 'Client engagement tracker', 'SE-MIL Knowledge Base', 'Stakeholder Power Atlas', 'Proposal drafting AI'],
    colour: '#7c3aed',
  },
  {
    key: 'student',
    icon: '🎓',
    title: 'Student / Researcher',
    subtitle: 'DBA, MBA, MSc, PhD, CPD or professional qualification',
    features: ['Thesis & chapter tracker', 'CPD deadline management', 'Academic calendar', 'Literature organiser', 'Supervisor comms'],
    colour: '#6c8eff',
  },
  {
    key: 'professional',
    icon: '💼',
    title: 'Professional / Consultant',
    subtitle: 'Consultant, project manager, analyst, or specialist',
    features: ['Client project tracker', 'Consulting framework engine', 'Proposal drafting AI', 'Stakeholder management', 'Time & expense tracking'],
    colour: '#a78bfa',
  },
  {
    key: 'executive',
    icon: '⚡',
    title: 'Executive / Founder',
    subtitle: 'CEO, MD, founder, or C-suite leader',
    features: ['Executive Operating System™', 'Decision Architecture™', 'OKR & performance pulse', 'Board & investor comms', 'Strategic intelligence feed'],
    colour: '#22d3ee',
    badge: 'Most powerful',
  },
]

const PLANS = [
  {
    key: 'student',
    name: 'Student',
    price: '$9/mo',
    colour: '#0891b2',
    description: 'Academic lifecycle + CPD tracking',
    features: ['Academic Hub — thesis, chapters, milestones', 'CPD Tracker (12 bodies)', 'Supervisor session log + AI summaries', 'Research Hub + literature AI', '2,000 AI credits/mo'],
  },
  {
    key: 'professional',
    name: 'Professional',
    price: '$24/mo',
    colour: '#7c3aed',
    description: 'Full CEO/Founder OS — all 41 modules',
    popular: true,
    features: ['Daily AI Brief (7am)', 'Payroll detect engine', '15 NemoClaw™ consulting frameworks', 'Executive OS + Decision Architecture', 'IP Vault + Contracts + Group P&L', 'SE-MIL Knowledge Base', '10,000 AI credits/mo'],
  },
  {
    key: 'team',
    name: 'Team / Institution',
    price: 'Custom',
    colour: '#0d9488',
    description: 'Shared workspaces, SSO, dept admin',
    features: ['Everything in Professional', 'Shared research workspaces', 'Department-level admin', 'SSO / institutional login', 'Cohort dashboard for supervisors', 'Unlimited AI credits', 'Dedicated support'],
  },
]

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 40 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i + 1 === step ? 24 : 8, height: 8, borderRadius: 4,
          background: i + 1 === step ? '#a78bfa' : i + 1 < step ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.1)',
          transition: 'all .3s ease',
        }} />
      ))}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, color: '#454d63', marginBottom: 6 }}>{children}</div>
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type} value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 8,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
        marginBottom: 16,
      }}
    />
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep]             = useState(1)
  const [persona, setPersona]       = useState('')
  const [fullName, setFullName]     = useState('')
  const [jobTitle, setJobTitle]     = useState('')
  const [organisation, setOrg]      = useState('')
  const [programme, setProgramme]   = useState('')
  const [university, setUniversity] = useState('')
  const [timezone, setTimezone]     = useState('Europe/London')
  const [plan, setPlan]             = useState('professional')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  async function saveProfile() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          job_title: jobTitle || undefined,
          organisation: organisation || undefined,
          programme_name: programme || undefined,
          university: university || undefined,
          timezone,
          persona_type: persona || 'individual',
          onboarded: true,
        }),
      })
      if (!res.ok) throw new Error('Profile save failed')
      setStep(3)
    } catch {
      setError('Could not save profile. Please try again.')
    }
    setSaving(false)
  }

  async function completePlan() {
    setSaving(true)
    // Plan upgrade is handled via Stripe — for now just mark onboarded
    const { error: e } = await supabase.auth.updateUser({})
    if (!e) router.push('/platform/dashboard')
    setSaving(false)
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, padding: 32,
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0b1a 0%, #0d0f24 100%)',
      padding: 24, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: step === 1 ? 720 : 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
            PIOS<span style={{ color: '#a78bfa' }}>™</span>
          </div>
          <div style={{ fontSize: 13, color: '#454d63', marginTop: 4 }}>Personal Intelligence Operating System</div>
        </div>

        <ProgressDots step={step} total={4} />

        {/* ── STEP 1: Persona selection ─────────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
              How will you use PIOS?
            </h2>
            <p style={{ fontSize: 14, color: '#454d63', textAlign: 'center', marginBottom: 28 }}>
              Choose your primary context. You can change this later.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {PERSONAS.map(p => (
                <button key={p.key} onClick={() => { setPersona(p.key); setStep(2) }}
                  style={{
                    background: persona === p.key ? `rgba(${p.colour === '#22d3ee' ? '34,211,238' : p.colour === '#a78bfa' ? '167,139,250' : '108,142,255'},0.1)` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${persona === p.key ? p.colour : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, padding: 20, cursor: 'pointer', textAlign: 'left' as const,
                    transition: 'all .2s', position: 'relative' as const,
                  }}>
                  {p.badge && (
                    <div style={{ position: 'absolute', top: -10, right: 12, background: '#22d3ee', color: '#000', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{p.badge}</div>
                  )}
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{p.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: '#454d63', marginBottom: 14, lineHeight: 1.5 }}>{p.subtitle}</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {p.features.map(f => (
                      <li key={f} style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, paddingLeft: 14, position: 'relative' as const }}>
                        <span style={{ position: 'absolute', left: 0, color: p.colour }}>·</span>{f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Profile ───────────────────────────────── */}
        {step === 2 && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 24 }}>Set up your profile</h2>
            <Label>Full name</Label>
            <Input value={fullName} onChange={setFullName} placeholder="Your full name" />

            {(persona === 'professional' || persona === 'executive') && <>
              <Label>Job title</Label>
              <Input value={jobTitle} onChange={setJobTitle} placeholder="CEO, Managing Director, Consultant…" />
              <Label>Organisation</Label>
              <Input value={organisation} onChange={setOrg} placeholder="Your company or firm" />
            </>}

            {persona === 'student' && <>
              <Label>Programme</Label>
              <Input value={programme} onChange={setProgramme} placeholder="e.g. DBA — University of Portsmouth" />
              <Label>University</Label>
              <Input value={university} onChange={setUniversity} placeholder="University name" />
            </>}

            <Label>Timezone</Label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff', fontSize: 14, marginBottom: 16,
            }}>
              {['Europe/London','Europe/Dublin','Europe/Paris','Asia/Riyadh','Asia/Dubai','Asia/Karachi','Africa/Johannesburg','America/New_York','America/Chicago','America/Los_Angeles','UTC'].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>

            {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button onClick={saveProfile} disabled={!fullName || saving}
              style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#a78bfa', border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: !fullName || saving ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        )}

        {/* ── STEP 3: Plan ──────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 8, textAlign: 'center' }}>Choose your plan</h2>
            <p style={{ fontSize: 14, color: '#454d63', textAlign: 'center', marginBottom: 28 }}>14-day free trial on all plans. Cancel anytime.</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {PLANS.map(p => (
                <button key={p.key} onClick={() => setPlan(p.key)}
                  style={{
                    background: plan === p.key ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${plan === p.key ? '#a78bfa' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                  <div style={{ textAlign: 'left' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{p.name}</span>
                      {p.popular && <span style={{ fontSize: 10, fontWeight: 600, background: '#a78bfa', color: '#fff', padding: '1px 7px', borderRadius: 20 }}>Popular</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#454d63' }}>{p.description}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' as const }}>{p.price}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(4)} style={{ width: '100%', marginTop: 20, padding: '12px', borderRadius: 8, background: '#a78bfa', border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 4: Gmail connect ─────────────────────────── */}
        {step === 4 && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Connect Gmail</h2>
            <p style={{ fontSize: 14, color: '#454d63', lineHeight: 1.7, marginBottom: 28 }}>
              PIOS automatically triages your inbox, captures action items, and extracts receipts.
              Connecting Gmail unlocks the full autonomous intelligence layer.
            </p>
            <button
              onClick={async () => { await supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly', redirectTo: `${window.location.origin}/auth/callback?next=/platform/dashboard` } }) }}
              style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#fff', border: 'none', color: '#000', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.9l6-6C34.4 3.1 29.5 1 24 1 14.8 1 7 6.7 3.7 14.6l7 5.5C12.4 13.8 17.7 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.1-4.5 6.7l7 5.5C43.1 37 46.1 31.3 46.1 24.5z"/><path fill="#FBBC05" d="M10.7 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7-5.5C2.3 17.1 1 20.4 1 24s1.3 6.9 3.7 9.6l7-5.4z"/><path fill="#4285F4" d="M24 47c5.5 0 10.1-1.8 13.5-4.9l-7-5.5c-1.9 1.3-4.3 2-6.5 2-6.3 0-11.6-4.3-13.5-10.1l-7 5.5C7 40.3 14.8 47 24 47z"/></svg>
              Connect Gmail & Calendar
            </button>
            <button onClick={completePlan} disabled={saving}
              style={{ width: '100%', padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>
              Skip for now → Enter PIOS
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
