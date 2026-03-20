'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function getSupabase() {
    return createClient()
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = await getSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    const supabase = await getSupabase()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar',
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    })
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--pios-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #a78bfa, #6c8eff)',
            fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '16px'
          }}>P</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--pios-text)', marginBottom: '4px' }}>
            Welcome to PIOS
          </h1>
          <p style={{ color: 'var(--pios-muted)', fontSize: '14px' }}>
            Your personal intelligent operating system
          </p>
        </div>

        <div className="pios-card" style={{ padding: '28px' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✉</div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Check your email</h2>
              <p style={{ color: 'var(--pios-muted)', fontSize: '13px' }}>
                Magic link sent to <strong style={{ color: 'var(--pios-text)' }}>{email}</strong>
              </p>
            </div>
          ) : (
            <>
              <button onClick={handleGoogle} disabled={loading}
                className="pios-btn pios-btn-ghost"
                style={{ width: '100%', justifyContent: 'center', marginBottom: '16px', padding: '12px' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--pios-border)' }} />
                <span style={{ color: 'var(--pios-dim)', fontSize: '12px' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--pios-border)' }} />
              </div>

              <form onSubmit={handleMagicLink}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required className="pios-input"
                  style={{ marginBottom: '12px' }} />
                {error && <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px' }}>{error}</p>}
                <button type="submit" disabled={loading || !email}
                  className="pios-btn pios-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                  {loading ? 'Sending…' : 'Send magic link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--pios-dim)' }}>
          PIOS · Sustain International FZE Ltd · v1.0
        </p>
      </div>
    </div>
  )
}
