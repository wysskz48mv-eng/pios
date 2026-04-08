import Link from 'next/link'

export const metadata = { title: 'Cookie Policy — PIOS' }

const EFFECTIVE = '8 April 2026'

const COMPANY = [
  'VeritasIQ Technologies Limited',
  'Company number 17120203',
  'Registered office: 2a Connaught Avenue, London, United Kingdom, E4 7AA',
].join('\n')

export default function CookiePolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0d', color: '#e2e8f0', fontFamily: 'system-ui', padding: '40px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/privacy" style={{ fontSize: 13, color: '#c8a96e', textDecoration: 'none' }}>← Back</Link>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>Cookie Policy</h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>Effective: {EFFECTIVE} · PIOS v3.0</p>
        </div>

        {[
          {
            title: '1. Scope',
            body: `This Cookie Policy explains how PIOS uses cookies and similar technologies on the public site and platform.`
          },
          {
            title: '2. Cookies we use',
            body: `PIOS currently uses strictly necessary cookies only:

• authentication cookies required to sign you in and maintain your session
• security cookies used for CSRF protection, request integrity, and session hardening
• operational cookies needed to deliver core platform functionality`
          },
          {
            title: '3. Cookies we do not use',
            body: `We do not currently use advertising cookies, behavioural profiling cookies, or third-party analytics cookies on the PIOS public site or authenticated platform.`
          },
          {
            title: '4. Managing cookies',
            body: `You can block or remove cookies in your browser settings. If you disable strictly necessary cookies, parts of PIOS may not function correctly, including sign-in and security controls.`
          },
          {
            title: '5. Contact',
            body: `${COMPANY}\nEmail: info@veritasiq.io`
          },
        ].map((section) => (
          <div key={section.title} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 10 }}>{section.title}</h2>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{section.body}</div>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, marginTop: 32, display: 'flex', gap: 16 }}>
          <Link href="/privacy" style={{ fontSize: 12, color: '#c8a96e', textDecoration: 'none' }}>Privacy Policy →</Link>
          <Link href="/terms" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>Terms of Service</Link>
        </div>
      </div>
    </div>
  )
}