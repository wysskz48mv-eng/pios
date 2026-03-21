'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// /onboarding — First-run wizard for new PIOS users
// Step 1: Complete profile (name, role, organisation, DBA/academic context)
// Step 2: Choose plan (Student / Individual / Professional)
// Step 3: Connect Gmail (optional but recommended)
// PIOS v2.0 | Sustain International FZE Ltd
// ─────────────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    key: 'student',
    name: 'Student',
    price: '$9/mo',
    colour: '#6c8eff',
    description: 'Academic lifecycle + calendar + personal tasks',
    features: ['Academic Lifecycle Manager', 'AI Calendar (basic)', 'Personal Tasks', '2,000 AI credits/mo', '50% off for .edu emails'],
  },
  {
    key: 'individual',
    name: 'Individual',
    price: '$19/mo',
    colour: '#a78bfa',
    description: 'Full PIOS — all three core modules',
    popular: true,
    features: ['Everything in Student', 'Gmail Autonomous Triage', 'Personal Projects', 'Expense Tracker', 'PIOS AI Companion', '5,000 AI credits/mo'],
  },
  {
    key: 'professional',
    name: 'Professional',
    price: '$39/mo',
    colour: '#22d3ee',
    description: 'Full platform + FM consulting engine',
    features: ['Everything in Individual', 'FM Consulting Engine', 'Business Ops Dashboard', '15,000 AI credits/mo', 'Priority support', 'Cross-domain clash detection'],
  },
]

function ProgressDots({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 40 }}>
      {[1, 2, 3].map(n => (
        <div key={n} style={{
          width: n === step ? 24 : 8, height: 8, borderRadius: 4,
          background: n === step ? '#a78bfa' : n < step ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.1)',
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
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13,
        background: '#0e1015', border: '1px solid rgba(255,255,255,0.08)',
        color: '#dde2f0', outline: 'none', fontFamily: 'inherit',
        boxSizing: 'border-box' as const,
      }}
    />
  )
}

export default function OnboardingPage() {
  const [step, setStep]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<string>('individual')

  const [form, setForm] = useState({
    full_name:       '',
    job_title:       '',
    organisation:    '',
    programme_name:  '',
    university:      '',
    timezone:        'Asia/Dubai',
  })
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const router   = useRouter()
  const supabase = createClient()

  // ── Step 1 save ──────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!form.full_name.trim()) { setError('Please enter your name.'); return }
    setSaving(true); setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error: e } = await supabase.from('user_profiles').update({
        full_name:      form.full_name,
        job_title:      form.job_title,
        organisation:   form.organisation,
        programme_name: form.programme_name,
        university:     form.university,
        timezone:       form.timezone,
        onboarded:      false, // mark not yet fully onboarded
      }).eq('id', user.id)
      if (e) throw e
      setStep(2)
    } catch (e: any) {
      setError(e.message ?? 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2 — plan select → Stripe checkout or skip ───────────────────────
  async function choosePlan(planKey: string) {
    setSaving(true)
    // If they want to try first, skip to step 3 (individual is default free trial)
    setSelectedPlan(planKey)
    setSaving(false)
    setStep(3)
  }

  // ── Step 3 — connect Gmail or skip to dashboard ───────────────────────────
  async function connectGmail() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) setError(error.message)
  }

  async function skipToCheckout() {
    // Mark onboarded, redirect to dashboard
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('user_profiles').update({ onboarded: true }).eq('id', user.id)
      }
    } catch { /* silent */ }
    // Route to Stripe checkout if non-free plan selected
    if (selectedPlan !== 'student_free') {
      window.location.href = `/api/stripe/checkout?plan=${selectedPlan}`
    } else {
      router.push('/platform/dashboard')
    }
  }

  async function goToDashboard() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('user_profiles').update({ onboarded: true }).eq('id', user.id)
    } catch { /* silent */ }
    router.push('/platform/dashboard')
  }

  // ── Layout shell ──────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: '#060709',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: step === 2 ? 860 : 480 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center' as const, marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 12, marginBottom: 12,
            background: 'linear-gradient(135deg, #a78bfa, #6c8eff)',
            fontSize: 20, fontWeight: 800, color: '#fff',
          }}>P</div>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#454d63', fontWeight: 600 }}>PIOS · Setup</div>
        </div>

        <ProgressDots step={step} />

        {/* ─── STEP 1: Profile ─────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '32px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Tell us about yourself</h2>
            <p style={{ fontSize: 13, color: '#7a8299', margin: '0 0 28px', lineHeight: 1.6 }}>This personalises your morning brief and AI companion.</p>

            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
              <div>
                <Label>Full name *</Label>
                <Input value={form.full_name} onChange={v => f('full_name', v)} placeholder="Your full name" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Label>Job title</Label>
                  <Input value={form.job_title} onChange={v => f('job_title', v)} placeholder="Your job title" />
                </div>
                <div>
                  <Label>Organisation</Label>
                  <Input value={form.organisation} onChange={v => f('organisation', v)} placeholder="Your organisation" />
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, color: '#a78bfa', marginBottom: 12 }}>Academic (optional)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Label>Programme</Label>
                    <Input value={form.programme_name} onChange={v => f('programme_name', v)} placeholder="e.g. DBA, MBA, MSc" />
                  </div>
                  <div>
                    <Label>University</Label>
                    <Input value={form.university} onChange={v => f('university', v)} placeholder="Your university" />
                  </div>
                </div>
              </div>
              <div>
                <Label>Timezone</Label>
                <select
                  value={form.timezone}
                  onChange={e => f('timezone', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, background: '#0e1015', border: '1px solid rgba(255,255,255,0.08)', color: '#dde2f0', outline: 'none', fontFamily: 'inherit' }}
                >
                  <option value="Asia/Dubai">Asia/Dubai (UAE, UTC+4)</option>
                  <option value="Europe/London">Europe/London (UK)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                </select>
              </div>
            </div>

            {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}

            <button
              onClick={saveProfile}
              disabled={saving}
              style={{
                width: '100%', marginTop: 24, padding: '12px', borderRadius: 8,
                background: 'linear-gradient(135deg, #a78bfa, #6c8eff)',
                border: 'none', color: '#fff', fontWeight: 600, fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >{saving ? 'Saving…' : 'Continue →'}</button>
          </div>
        )}

        {/* ─── STEP 2: Plan ───────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center' as const, marginBottom: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Choose your plan</h2>
              <p style={{ fontSize: 13, color: '#7a8299', margin: 0 }}>Start with Individual — you can upgrade any time.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              {PLANS.map(plan => (
                <div
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  style={{
                    background: selectedPlan === plan.key ? `${plan.colour}10` : '#111318',
                    border: `1px solid ${selectedPlan === plan.key ? plan.colour : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 12, padding: '24px 20px', cursor: 'pointer',
                    transition: 'all .2s', position: 'relative' as const,
                  }}
                >
                  {plan.popular && (
                    <div style={{
                      position: 'absolute' as const, top: -10, left: '50%', transform: 'translateX(-50%)',
                      background: plan.colour, color: '#fff', fontSize: 10, fontWeight: 700,
                      letterSpacing: 1, textTransform: 'uppercase' as const, padding: '3px 10px', borderRadius: 20,
                      whiteSpace: 'nowrap' as const,
                    }}>Most Popular</div>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 700, color: plan.colour, marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{plan.price}</div>
                  <div style={{ fontSize: 11, color: '#7a8299', marginBottom: 16, lineHeight: 1.5 }}>{plan.description}</div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ fontSize: 11, color: '#7a8299', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ color: plan.colour, flexShrink: 0 }}>✓</span>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => choosePlan(selectedPlan)}
              disabled={saving}
              style={{
                width: '100%', padding: '13px', borderRadius: 8,
                background: 'linear-gradient(135deg, #a78bfa, #6c8eff)',
                border: 'none', color: '#fff', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Continue with {PLANS.find(p => p.key === selectedPlan)?.name} →</button>
            <button onClick={() => setStep(1)} style={{ width: '100%', marginTop: 8, padding: '10px', background: 'none', border: 'none', color: '#454d63', fontSize: 12, cursor: 'pointer' }}>← Back</button>
          </div>
        )}

        {/* ─── STEP 3: Connect Gmail ──────────────────────────────────── */}
        {step === 3 && (
          <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '32px' }}>
            <div style={{ textAlign: 'center' as const, marginBottom: 28 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✉</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Connect your Gmail</h2>
              <p style={{ fontSize: 13, color: '#7a8299', margin: 0, lineHeight: 1.6 }}>
                PIOS reads your inbox to surface action items, draft replies, and include email context in your morning brief.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 24 }}>
              {[
                { icon: '⚡', title: 'Smart triage', desc: 'AI surfaces action items from your inbox automatically' },
                { icon: '📋', title: 'Morning brief context', desc: 'Outstanding emails included in your daily AI brief' },
                { icon: '🔒', title: 'Read-only by default', desc: 'gmail.modify scope — PIOS only labels, never deletes' },
              ].map(item => (
                <div key={item.title} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#dde2f0', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: '#7a8299' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>}

            <button
              onClick={connectGmail}
              style={{
                width: '100%', padding: '12px', borderRadius: 8, marginBottom: 10,
                background: '#fff', border: 'none', color: '#1a1a2e',
                fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Connect Google Account
            </button>

            <button
              onClick={skipToCheckout}
              disabled={saving}
              style={{ width: '100%', padding: '11px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#7a8299', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >{saving ? 'Redirecting…' : 'Skip — connect later'}</button>

            <button onClick={goToDashboard} style={{ width: '100%', marginTop: 6, padding: '10px', background: 'none', border: 'none', color: '#454d63', fontSize: 12, cursor: 'pointer' }}>
              Go straight to dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
