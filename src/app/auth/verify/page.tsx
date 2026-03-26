'use client'
import React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Verify v3.0 — Investment-Grade UIX
// Email confirmation holding screen
// ─────────────────────────────────────────────────────────────────────────────

function VerifyContent() {
  const params = useSearchParams()
  const email  = params.get('email') ?? 'your email'

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--pios-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }} className="fade-up">

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
          background: 'rgba(16,217,160,0.1)', border: '1px solid rgba(16,217,160,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, position: 'relative',
        }}>
          ✉
          {/* Animated ring */}
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: '1px solid rgba(16,217,160,0.15)',
            animation: 'ping 2s ease-in-out infinite',
          }} />
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
          color: 'var(--pios-text)', letterSpacing: '-0.03em', marginBottom: 10,
        }}>Check your email</h1>

        <p style={{ fontSize: 14, color: 'var(--pios-muted)', lineHeight: 1.7, marginBottom: 28 }}>
          We sent a verification link to<br />
          <strong style={{
            fontFamily: 'var(--font-display)', color: 'var(--pios-text)',
            fontSize: 15, letterSpacing: '-0.01em',
          }}>{email}</strong>
        </p>

        {/* Info card */}
        <div style={{
          background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
          borderRadius: 14, padding: '18px 20px', marginBottom: 28, textAlign: 'left',
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase' as const, color: 'var(--pios-dim)', marginBottom: 10,
          }}>What happens next</div>
          {[
            { icon: '✉', text: 'Click the link in the email to verify your account' },
            { icon: '⚡', text: 'You\'ll be redirected to your PIOS workspace' },
            { icon: '◉', text: 'NemoClaw™ AI will be ready to brief you immediately' },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--pios-border)' : 'none',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, color: 'var(--fm)' }}>{s.icon}</span>
              <span style={{ fontSize: 12.5, color: 'var(--pios-sub)', lineHeight: 1.5 }}>{s.text}</span>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div style={{
          background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 24,
          fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.65,
        }}>
          Didn't receive it? Check your spam folder. The link expires in 24 hours.
        </div>

        <Link href="/auth/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--ai)', textDecoration: 'none', fontWeight: 600,
        }}>← Back to sign in</Link>

        <div style={{ marginTop: 24, fontSize: 10.5, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)' }}>
          PIOS v3.0 · VeritasIQ Technologies Ltd
        </div>
      </div>

      <style>{`
        @keyframes ping {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.18); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default function VerifyPage() {
  return <Suspense fallback={null}><VerifyContent /></Suspense>
}
