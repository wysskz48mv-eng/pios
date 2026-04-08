import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — PIOS' }

const EFFECTIVE = '8 April 2026'

const COMPANY = [
  'VeritasIQ Technologies Limited',
  'Company number 17120203',
  'Registered office: 2a Connaught Avenue, London, United Kingdom, E4 7AA',
].join('\n')

export default function PrivacyPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0b0d', color:'#e2e8f0', fontFamily:'system-ui', padding:'40px 20px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ marginBottom:32 }}>
          <Link href="/auth/login" style={{ fontSize:13, color:'#a78bfa', textDecoration:'none' }}>← Back</Link>
        </div>

        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontSize:28, fontWeight:700, marginBottom:8, color:'#f1f5f9' }}>Privacy Policy</h1>
          <p style={{ fontSize:13, color:'#64748b' }}>Effective: {EFFECTIVE} · PIOS v3.0</p>
        </div>

        <div style={{ background:'rgba(167,139,250,0.05)', border:'1px solid rgba(167,139,250,0.15)', borderRadius:12, padding:'16px 20px', marginBottom:32 }}>
          <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.75, margin:0 }}>
            <strong style={{ color:'#a78bfa' }}>Summary:</strong> PIOS is a personal productivity platform operated by VeritasIQ Technologies Limited in England and Wales. Your data is never sold and is not used for advertising. You can export your data at any time and request erasure through our privacy contact channel or available in-app privacy controls.
          </p>
        </div>

        {[
          {
            title: '1. Who we are',
            body: `PIOS ("Personal Intelligent Operating System") is operated by VeritasIQ Technologies Limited, a private company limited by shares incorporated in England and Wales under company number 17120203.

${COMPANY}

ICO registration application filed on 8 April 2026: reference C1903482.

For data protection enquiries: info@veritasiq.io`
          },
          {
            title: '2. What data we collect',
            body: `We collect:

• Account data: your name, email address, and password (hashed — we never store plaintext passwords)
• Profile data: job title, organisation, academic programme — provided voluntarily to personalise your experience
• Usage data: tasks, projects, calendar events, notes, expenses, and other content you create within PIOS
• Google OAuth data: if you sign in with Google, we receive your email, name, and profile picture. With your explicit consent, we may receive Google Calendar, Gmail, and Google Drive access tokens to power the Calendar sync, Email Intelligence, and File Intelligence features
• AI interaction data: messages you send to the PIOS AI Companion and the responses generated
• Technical data: IP address (for rate limiting), browser type, and device type (for security purposes only)`
          },
          {
            title: '3. How we use your data',
            body: `We use your data solely to:

• Provide and personalise the PIOS platform services you have signed up for
• Generate your AI morning brief and AI companion responses
• Sync your Google Calendar, Gmail, and Drive if you have granted those permissions
• Send transactional emails (account verification, subscription receipts)
• Prevent abuse and maintain platform security

We do not use your data for advertising. We do not sell your data. We do not share your data with third parties except as described in Section 5.`
          },
          {
            title: '4. Data storage and security',
            body: `Your data is stored in Supabase (PostgreSQL) hosted in the EU West (Ireland) region. Data in transit is encrypted via TLS 1.3. Data at rest is encrypted by the hosting provider.

We apply Row-Level Security (RLS) policies ensuring that each user can only access their own data. Service-level keys are stored as environment variables and never committed to source code.`
          },
          {
            title: '5. Third-party services',
            body: `PIOS uses the following third-party services:

• Supabase (database and authentication) — EU West, Ireland
• Anthropic Claude API (AI responses) — data processed but not stored by Anthropic per their enterprise privacy terms
• Google APIs (Calendar, Gmail, Drive) — only if you explicitly grant OAuth permission
• Stripe (payment processing) — your card details are handled entirely by Stripe and never touch our servers
• Vercel (hosting and deployment)

Each provider operates under their own privacy policy and data processing agreements.`
          },
          {
            title: '6. Your rights',
            body: `You have the right to:

• Access: request a copy of all data we hold about you
• Correction: update inaccurate data via the Settings page
• Deletion: request erasure of your personal data by contacting info@veritasiq.io or by using available in-app privacy controls
• Export: export your data in JSON format through the platform privacy controls or on request
• Withdraw consent: disconnect Google integrations at any time via Settings → Integrations

To exercise any of these rights, contact us at info@veritasiq.io or use the in-app privacy controls where available.`
          },
          {
            title: '7. Data retention',
            body: `We retain your data for as long as your account is active. If you submit a valid erasure request, we will handle it in line with UK GDPR obligations and ordinarily within 30 days unless we are legally required to retain specific records. Anonymised aggregate usage statistics (with no personal identifiers) may be retained for up to 2 years for service improvement and security analysis.`
          },
          {
            title: '8. Cookies',
            body: `PIOS uses strictly necessary cookies only:

• Session cookies: maintain your authenticated session (Supabase auth tokens)
• Security cookies: CSRF protection

We do not currently use analytics cookies, advertising cookies, or third-party behavioural tracking. For more detail, see our Cookie Policy at /cookies.`
          },
          {
            title: '9. Children',
            body: `PIOS is intended for users aged 18 and over. We do not knowingly collect data from children. If you believe a child has created an account, please contact us immediately.`
          },
          {
            title: '10. Changes to this policy',
            body: `We will notify you of material changes to this policy via email and an in-app notification at least 14 days before they take effect. Your continued use of PIOS after that date constitutes acceptance.`
          },
          {
            title: '11. Contact',
            body: `${COMPANY}
Email: info@veritasiq.io`
          },
        ].map(section => (
          <div key={section.title} style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:16, fontWeight:600, color:'#f1f5f9', marginBottom:10 }}>{section.title}</h2>
            <div style={{ fontSize:13, color:'#94a3b8', lineHeight:1.8, whiteSpace:'pre-line' }}>{section.body}</div>
          </div>
        ))}

        <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:24, marginTop:32, display:'flex', gap:16 }}>
          <Link href="/cookies" style={{ fontSize:12, color:'#c8a96e', textDecoration:'none' }}>Cookie Policy →</Link>
          <Link href="/terms" style={{ fontSize:12, color:'#a78bfa', textDecoration:'none' }}>Terms of Service →</Link>
          <Link href="/auth/login" style={{ fontSize:12, color:'#64748b', textDecoration:'none' }}>Back to PIOS</Link>
        </div>
      </div>
    </div>
  )
}
