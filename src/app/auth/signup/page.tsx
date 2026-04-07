'use client'
import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildGoogleOAuthOptions } from '@/lib/auth/google-oauth'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function buildCallbackUrl(next: string | null): string {
  if (typeof window === 'undefined') return '/auth/callback'

  const callbackUrl = new URL('/auth/callback', window.location.origin)
  if (next?.startsWith('/')) {
    callbackUrl.searchParams.set('next', next)
  }

  return callbackUrl.toString()
}

// ─────────────────────────────────────────────────────────────────────────────
// Signup v3.0 — Investment-Grade UIX
// 2-step email flow · Google OAuth primary · v3.0 token set
// All auth logic preserved — only presentation upgraded
// ─────────────────────────────────────────────────────────────────────────────

const PERSONA_OPTIONS = [
  { value: 'founder',       label: 'Founder / CEO',           icon: '⚡', color: 'var(--pro)' },
  { value: 'consultant',    label: 'Management Consultant',   icon: '◎',  color: 'var(--ai)' },
  { value: 'academic',      label: 'Academic / DBA / PhD',    icon: '◈',  color: 'var(--academic)' },
  { value: 'professional',  label: 'Corporate Professional',  icon: '▦',  color: 'var(--fm)' },
]

export default function SignupPage() {
  const [mode,    setMode]    = useState<'google' | 'email'>('google')
  const [step,    setStep]    = useState<1 | 2>(1)
  const [persona, setPersona] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [form,    setForm]    = useState({
    email: '', password: '', full_name: '', job_title: '',
    organisation: '', programme_name: '', university: 'University of Portsmouth',
  })
  const supabase = createClient()
  const router   = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const provider = searchParams.get('provider')
  const autoStart = searchParams.get('autostart') === '1'
  const autoStartedRef = useRef(false)

  function f(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function signUpWithGoogle() {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: buildGoogleOAuthOptions(window.location.origin, next, 'auth'),
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  useEffect(() => {
    if (provider !== 'google' || !autoStart || autoStartedRef.current || loading) return

    autoStartedRef.current = true
    void signUpWithGoogle()
  }, [autoStart, loading, provider])

  async function signUpWithEmail() {
    if (step === 1) {
      if (!form.email || !form.password || !form.full_name) {
        setError('Please fill in all required fields.'); return
      }
      if (form.password.length < 8) {
        setError('Password must be at least 8 characters.'); return
      }
      setStep(2); setError(null); return
    }
    setLoading(true); setError(null)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: {
          data: {
            full_name: form.full_name, job_title: form.job_title,
            organisation: form.organisation, programme_name: form.programme_name,
            university: form.university, persona_type: persona,
          },
          emailRedirectTo: buildCallbackUrl(next),
        },
      })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      router.push('/auth/verify?email=' + encodeURIComponent(form.email))
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Sign up failed. Please try again.')
      setLoading(false)
    }
  }

  // ── Shared input style ──────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '10px 13px',
    background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
    borderRadius: 9, color: 'var(--pios-text)', fontSize: 13,
    fontFamily: 'var(--font-sans)', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10.5, fontWeight: 600,
    color: 'var(--pios-muted)', marginBottom: 6, letterSpacing: '0.05em',
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--pios-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ width: '100%', maxWidth: 460 }} className="fade-up">

        {/* ── Logo ── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, var(--ai), var(--academic))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#fff',
            boxShadow: '0 4px 28px rgba(139,124,248,0.3)',
          }}>P</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400,
            color: 'var(--pios-text)', letterSpacing: '-0.03em', marginBottom: 5,
          }}>Create your PIOS account</div>
          <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
            14-day free trial · No credit card required
          </div>
        </div>

        {/* ── Card ── */}
        <div style={{
          background: 'var(--pios-surface)', border: '1px solid var(--pios-border2)',
          borderRadius: 18, padding: '30px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Top gradient rule */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, var(--ai), var(--academic))', opacity: 0.5,
          }} />

          {/* Step bar */}
          {mode === 'email' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
              {[1, 2].map(s => (
                <div key={s} style={{
                  flex: 1, height: 3, borderRadius: 99,
                  background: step >= s ? 'var(--ai)' : 'var(--pios-surface3)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 9, marginBottom: 18,
              background: 'rgba(224,82,114,0.08)', border: '1px solid rgba(224,82,114,0.2)',
              color: 'var(--dng)', fontSize: 12,
            }}>⚠ {error}</div>
          )}

          {/* Mode tabs — step 1 only */}
          {step === 1 && (
            <div style={{
              display: 'flex', gap: 4, padding: 4, borderRadius: 11,
              background: 'var(--pios-surface2)', marginBottom: 22,
            }}>
              {([['google', 'Continue with Google'], ['email', 'Email & password']] as const).map(([m, l]) => (
                <button key={m} onClick={() => { setMode(m); setError(null) }} style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                  fontSize: 12.5, fontWeight: mode === m ? 600 : 400,
                  background: mode === m ? 'var(--ai-subtle)' : 'transparent',
                  color: mode === m ? 'var(--ai)' : 'var(--pios-muted)',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                }}>{l}</button>
              ))}
            </div>
          )}

          {/* ── Google OAuth ── */}
          {mode === 'google' && (
            <div>
              <button onClick={signUpWithGoogle} disabled={loading} style={{
                width: '100%', padding: '12px 16px', borderRadius: 11,
                border: '1px solid var(--pios-border2)',
                background: 'var(--pios-surface2)', color: 'var(--pios-text)',
                fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
              }}
                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--pios-border3)'; b.style.background = 'var(--pios-surface3)' }}
                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--pios-border2)'; b.style.background = 'var(--pios-surface2)' }}>
                {loading
                  ? <span className="spin" style={{ display: 'inline-block', fontSize: 16 }}>⟳</span>
                  : <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                }
                {loading ? 'Connecting…' : 'Continue with Google'}
              </button>
              <p style={{ fontSize: 11.5, color: 'var(--pios-dim)', textAlign: 'center', marginTop: 12, lineHeight: 1.65 }}>
                Recommended — starts with Google account access only. Workspace integrations can be added during setup.
              </p>
            </div>
          )}

          {/* ── Email step 1 ── */}
          {mode === 'email' && step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>FULL NAME *</label>
                <input style={inputStyle} placeholder="Your full name" value={form.full_name} onChange={e => f('full_name', e.target.value)}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--ai)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--ai-glow)' }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--pios-border2)'; (e.target as HTMLInputElement).style.boxShadow = 'none' }} />
              </div>
              <div>
                <label style={labelStyle}>EMAIL ADDRESS *</label>
                <input style={inputStyle} type="email" placeholder="you@example.com" value={form.email} onChange={e => f('email', e.target.value)}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--ai)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--ai-glow)' }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--pios-border2)'; (e.target as HTMLInputElement).style.boxShadow = 'none' }} />
              </div>
              <div>
                <label style={labelStyle}>PASSWORD * (min. 8 characters)</label>
                <input style={inputStyle} type="password" placeholder="••••••••" value={form.password} onChange={e => f('password', e.target.value)}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--ai)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--ai-glow)' }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--pios-border2)'; (e.target as HTMLInputElement).style.boxShadow = 'none' }} />
              </div>
              <button onClick={signUpWithEmail} style={{
                width: '100%', padding: '12px', borderRadius: 11, border: 'none',
                background: 'var(--ai)', color: 'var(--pios-bg)',
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 400,
                cursor: 'pointer', marginTop: 2, transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}>
                Continue →
              </button>
            </div>
          )}

          {/* ── Email step 2 — profile ── */}
          {mode === 'email' && step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 400,
                  color: 'var(--pios-text)', letterSpacing: '-0.01em', marginBottom: 4,
                }}>Tell us about yourself</div>
                <p style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.65 }}>
                  Optional — helps NemoClaw™ AI personalise your experience.
                </p>
              </div>

              {/* Persona selector */}
              <div>
                <label style={labelStyle}>YOUR PRIMARY ROLE</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {PERSONA_OPTIONS.map(p => (
                    <button key={p.value} onClick={() => setPersona(p.value)} style={{
                      padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${persona === p.value ? p.color : 'var(--pios-border)'}`,
                      background: persona === p.value ? `${p.color}10` : 'var(--pios-surface2)',
                      color: persona === p.value ? p.color : 'var(--pios-muted)',
                      fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: persona === p.value ? 600 : 400,
                      display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: 14 }}>{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {[
                { label: 'JOB TITLE', key: 'job_title', placeholder: 'Group CEO / Founder' },
                { label: 'ORGANISATION', key: 'organisation', placeholder: 'VeritasIQ Technologies Ltd' },
                { label: 'PROGRAMME / DEGREE', key: 'programme_name', placeholder: 'DBA — Facilities Management' },
                { label: 'UNIVERSITY', key: 'university', placeholder: 'University of Portsmouth' },
              ].map(field => (
                <div key={field.key}>
                  <label style={labelStyle}>{field.label}</label>
                  <input
                    style={inputStyle}
                    placeholder={field.placeholder}
                    value={String((form as Record<string, unknown>)[field.key] ?? '')}
                    onChange={e => f(field.key, e.target.value)}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--ai)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--ai-glow)' }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--pios-border2)'; (e.target as HTMLInputElement).style.boxShadow = 'none' }}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setStep(1)} style={{
                  flex: 1, padding: '11px', borderRadius: 11,
                  border: '1px solid var(--pios-border2)', background: 'transparent',
                  color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}>← Back</button>
                <button onClick={signUpWithEmail} disabled={loading} style={{
                  flex: 2, padding: '11px', borderRadius: 11, border: 'none',
                  background: loading ? 'rgba(139,124,248,0.4)' : 'var(--ai)',
                  color: 'var(--pios-bg)', fontFamily: 'var(--font-display)',
                  fontSize: 14, fontWeight: 400, cursor: loading ? 'not-allowed' : 'pointer',
                }}>
                  {loading ? '⟳ Creating account…' : 'Create PIOS account'}
                </button>
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12.5, color: 'var(--pios-muted)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: 'var(--ai)', textDecoration: 'none', fontWeight: 600 }}>
              Sign in →
            </Link>
          </div>
        </div>

        {/* Legal */}
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--pios-dim)', marginTop: 18, lineHeight: 1.65 }}>
          By creating an account you agree to the{' '}
          <Link href="/privacy" style={{ color: 'var(--ai)', textDecoration: 'none' }}>Privacy Policy</Link>
          {' '}and confirm your data is stored securely in EU West (Ireland).
        </p>
      </div>
    </div>
  )
}
