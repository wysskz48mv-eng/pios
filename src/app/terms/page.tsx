import Link from 'next/link'

export const metadata = { title: 'Terms of Service — PIOS' }

const EFFECTIVE = 'March 2026'

export default function TermsPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0b0d', color:'#e2e8f0', fontFamily:'system-ui', padding:'40px 20px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ marginBottom:32 }}>
          <Link href="/auth/login" style={{ fontSize:13, color:'#a78bfa', textDecoration:'none' }}>← Back</Link>
        </div>
        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontSize:28, fontWeight:700, marginBottom:8, color:'#f1f5f9' }}>Terms of Service</h1>
          <p style={{ fontSize:13, color:'#64748b' }}>Effective: {EFFECTIVE} · PIOS v1.0</p>
        </div>

        {[
          {
            title: '1. Acceptance',
            body: `By creating a PIOS account, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use PIOS.

PIOS is operated by VeritasIQ Technologies Ltd ("we", "us", "our"), registered in the UAE Free Zone.`
          },
          {
            title: '2. Service description',
            body: `PIOS ("Personal Intelligent Operating System") is a personal productivity platform that combines task management, academic lifecycle tracking, business intelligence feeds, calendar synchronisation, email triage, financial workflow management, and an AI companion powered by Anthropic's Claude API.

The service is provided "as is" and may be updated, changed, or discontinued at any time with reasonable notice.`
          },
          {
            title: '3. Accounts',
            body: `You are responsible for:
• Keeping your login credentials secure
• All activity that occurs under your account
• Ensuring the information you provide is accurate

You must be 18 or older to create an account. One person may not maintain multiple accounts.`
          },
          {
            title: '4. Acceptable use',
            body: `You agree not to:
• Use PIOS for any unlawful purpose
• Attempt to reverse-engineer, scrape, or extract the platform's AI models or training data
• Share your account credentials with others
• Upload malicious files, viruses, or code
• Use PIOS to harass, defame, or harm others
• Circumvent any security or access controls

We reserve the right to suspend accounts that violate these terms without refund.`
          },
          {
            title: '5. AI-generated content',
            body: `The PIOS AI Companion uses Anthropic's Claude API. AI outputs are generated automatically and may contain errors, omissions, or inaccuracies. All AI-generated content is:

• Provided for personal productivity and informational purposes only
• Not professional advice (legal, financial, medical, or otherwise)
• Subject to your own review and verification before acting on it

You are responsible for verifying any AI-generated output before relying on it for important decisions.`
          },
          {
            title: '6. Google integrations',
            body: `If you connect your Google account, you authorise PIOS to access your Gmail, Google Calendar, and Google Drive in accordance with the scopes you approve. You may revoke this access at any time via Settings → Integrations or directly through your Google Account settings at myaccount.google.com.

PIOS does not send emails, create calendar events, or modify Drive files without your explicit action.`
          },
          {
            title: '7. Payments and subscriptions',
            body: `Paid plans are billed monthly via Stripe. Prices are shown in USD. You may cancel at any time via Settings → Billing — cancellation takes effect at the end of the current billing period. We do not offer refunds for partial months.

Stripe handles all payment processing. Your card details are never stored on our servers.`
          },
          {
            title: '8. Intellectual property',
            body: `PIOS, the NemoClaw methodology references, and all platform content are the intellectual property of VeritasIQ Technologies Ltd and its subsidiaries. You retain ownership of content you create within PIOS (your tasks, notes, files, etc.).

You grant us a limited licence to store, process, and display your content solely for the purpose of providing the service.`
          },
          {
            title: '9. Limitation of liability',
            body: `To the maximum extent permitted by law, VeritasIQ Technologies Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of PIOS.

Our total liability to you for any claim shall not exceed the amount you paid us in the 12 months prior to the claim.`
          },
          {
            title: '10. Governing law',
            body: `These terms are governed by the laws of the United Arab Emirates. Any disputes shall be subject to the exclusive jurisdiction of the courts of the UAE, unless otherwise required by applicable law in your jurisdiction.`
          },
          {
            title: '11. Changes',
            body: `We may update these terms. Material changes will be notified via email and in-app notification at least 14 days before taking effect. Continued use after that date constitutes acceptance.`
          },
          {
            title: '12. Contact',
            body: `VeritasIQ Technologies Ltd
Fujairah Creative City Free Zone, UAE
Email: d.masuku@veritasiq.co.uk`
          },
        ].map(section => (
          <div key={section.title} style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:16, fontWeight:600, color:'#f1f5f9', marginBottom:10 }}>{section.title}</h2>
            <div style={{ fontSize:13, color:'#94a3b8', lineHeight:1.8, whiteSpace:'pre-line' }}>{section.body}</div>
          </div>
        ))}

        <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:24, marginTop:32, display:'flex', gap:16 }}>
          <Link href="/privacy" style={{ fontSize:12, color:'#a78bfa', textDecoration:'none' }}>Privacy Policy →</Link>
          <Link href="/auth/login" style={{ fontSize:12, color:'#64748b', textDecoration:'none' }}>Back to PIOS</Link>
        </div>
      </div>
    </div>
  )
}
