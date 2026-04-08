import Link from 'next/link'

export const metadata = { title: 'Terms of Service — PIOS' }

const EFFECTIVE = '8 April 2026'

const COMPANY = [
  'VeritasIQ Technologies Limited',
  'Company number 17120203',
  'Registered office: 2a Connaught Avenue, London, United Kingdom, E4 7AA',
].join('\n')

export default function TermsPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0b0d', color:'#e2e8f0', fontFamily:'system-ui', padding:'40px 20px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ marginBottom:32 }}>
          <Link href="/auth/login" style={{ fontSize:13, color:'#a78bfa', textDecoration:'none' }}>← Back</Link>
        </div>
        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontSize:28, fontWeight:700, marginBottom:8, color:'#f1f5f9' }}>Terms of Service</h1>
          <p style={{ fontSize:13, color:'#64748b' }}>Effective: {EFFECTIVE} · PIOS v3.0</p>
        </div>

        {[
          {
            title: '1. Acceptance',
            body: `By creating a PIOS account, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use PIOS.

PIOS is operated by VeritasIQ Technologies Limited ("we", "us", "our"), a private company limited by shares incorporated in England and Wales under company number 17120203.`
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

Use of PIOS is also subject to our Acceptable Use Policy at /acceptable-use.

We reserve the right to suspend accounts that violate these terms without refund.`
          },
          {
            title: '5. AI-generated content',
            body: `The PIOS AI Companion uses Anthropic's Claude API. AI outputs are generated automatically and may contain errors, omissions, or inaccuracies. All AI-generated content is:

• Provided for personal productivity and informational purposes only
• Not professional advice (legal, financial, medical, or otherwise)
• Subject to your own review and verification before acting on it

AI-generated outputs in PIOS are not a substitute for professional legal, financial, regulatory, investment, or business advice. VeritasIQ Technologies Limited accepts no liability for decisions made solely in reliance on AI-generated content. You are responsible for verifying any AI-generated output before relying on it for important decisions.`
          },
          {
            title: '6. Google integrations',
            body: `If you connect your Google account, you authorise PIOS to access your Gmail, Google Calendar, and Google Drive in accordance with the scopes you approve. You may revoke this access at any time via Settings → Integrations or directly through your Google Account settings at myaccount.google.com.

PIOS does not send emails, create calendar events, or modify Drive files without your explicit action.`
          },
          {
            title: '7. Payments and subscriptions',
            body: `Paid plans are billed monthly or annually via Stripe. Prices on the public pricing pages are shown in GBP. As at the effective date of these Terms, individual plans are advertised as Starter £12/month, Pro £28/month, and Executive £36/month, with separate annual billing options. Enterprise pricing is quoted separately and may be set out in a written proposal or order form.

You may cancel at any time via Settings → Billing. Cancellation takes effect at the end of the current billing period. We do not offer refunds for partial months unless required by applicable law.

Stripe handles all payment processing. Your card details are never stored on our servers.`
          },
          {
            title: '8. Intellectual property',
            body: `PIOS, the NemoClaw methodology references, and all platform content are the intellectual property of VeritasIQ Technologies Limited. VeritasIQ Technologies Limited is the sole owner of the PIOS intellectual property, codebase, product materials, proprietary frameworks, trade secrets, and related platform assets unless expressly stated otherwise in writing. You retain ownership of content you create within PIOS (your tasks, notes, files, and similar user content).

You grant us a limited licence to store, process, and display your content solely for the purpose of providing the service.`
          },
          {
            title: '9. Limitation of liability',
            body: `Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any other liability which cannot lawfully be excluded or limited under the laws of England and Wales.

Subject to that, and to the maximum extent permitted by law, VeritasIQ Technologies Limited shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of PIOS.

Our total liability to you for any claim arising out of or in connection with PIOS shall not exceed the amount you paid us in the 12 months prior to the claim.`
          },
          {
            title: '10. Governing law',
            body: `These Terms and any non-contractual obligations arising out of or in connection with them are governed by the laws of England and Wales.

If you are acting in the course of business, the courts of England and Wales shall have exclusive jurisdiction over any dispute arising out of or in connection with these Terms. If you are a consumer, you may also have mandatory rights to bring proceedings in your home jurisdiction where required by law.`
          },
          {
            title: '11. Changes',
            body: `We may update these terms. Material changes will be notified via email and in-app notification at least 14 days before taking effect. Continued use after that date constitutes acceptance.`
          },
          {
            title: '12. Contact',
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
          <Link href="/acceptable-use" style={{ fontSize:12, color:'#c8a96e', textDecoration:'none' }}>Acceptable Use →</Link>
          <Link href="/cookies" style={{ fontSize:12, color:'#a78bfa', textDecoration:'none' }}>Cookie Policy</Link>
          <Link href="/privacy" style={{ fontSize:12, color:'#a78bfa', textDecoration:'none' }}>Privacy Policy →</Link>
          <Link href="/auth/login" style={{ fontSize:12, color:'#64748b', textDecoration:'none' }}>Back to PIOS</Link>
        </div>
      </div>
    </div>
  )
}
