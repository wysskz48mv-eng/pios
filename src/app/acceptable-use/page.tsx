import Link from 'next/link'

export const metadata = { title: 'Acceptable Use Policy — PIOS' }

const EFFECTIVE = '8 April 2026'

const COMPANY = [
  'VeritasIQ Technologies Limited',
  'Company number 17120203',
  'Registered office: 2a Connaught Avenue, London, United Kingdom, E4 7AA',
].join('\n')

export default function AcceptableUsePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0d', color: '#e2e8f0', fontFamily: 'system-ui', padding: '40px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/terms" style={{ fontSize: 13, color: '#c8a96e', textDecoration: 'none' }}>← Back</Link>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>Acceptable Use Policy</h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>Effective: {EFFECTIVE} · PIOS v3.0</p>
        </div>

        {[
          {
            title: '1. Purpose',
            body: `This Acceptable Use Policy explains how you may and may not use PIOS. It forms part of the Terms of Service and applies to every user, workspace, invitee, and administrator.`
          },
          {
            title: '2. Permitted use',
            body: `You may use PIOS for legitimate professional, operational, academic, research, and business productivity purposes in accordance with applicable law and our Terms of Service.`
          },
          {
            title: '3. Prohibited use',
            body: `You must not use PIOS to:

• break the law or assist unlawful conduct
• upload malware, malicious scripts, or harmful code
• interfere with platform security, availability, or integrity
• scrape, reverse engineer, copy, or extract models, prompts, training methods, or proprietary frameworks
• submit personal data you do not have the right to process or disclose
• generate content that is fraudulent, abusive, defamatory, discriminatory, or infringing
• impersonate another person or misrepresent your authority
• probe, scan, or test the platform for vulnerabilities without written permission
• use the service as a high-risk control system where failure could cause death, injury, or material physical harm`
          },
          {
            title: '4. AI-specific restrictions',
            body: `You must not present AI-generated outputs from PIOS as legal, financial, investment, regulatory, or other professional advice without independent human review by a suitably qualified professional.`
          },
          {
            title: '5. Enforcement',
            body: `We may suspend, restrict, or terminate access where we reasonably believe this policy or our Terms have been breached. We may also remove content, block requests, or report misuse to relevant authorities where required.`
          },
          {
            title: '6. Contact',
            body: `${COMPANY}\nEmail: info@veritasiq.io`
          },
        ].map((section) => (
          <div key={section.title} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 10 }}>{section.title}</h2>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{section.body}</div>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, marginTop: 32, display: 'flex', gap: 16 }}>
          <Link href="/terms" style={{ fontSize: 12, color: '#c8a96e', textDecoration: 'none' }}>Terms of Service →</Link>
          <Link href="/cookies" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>Cookie Policy</Link>
        </div>
      </div>
    </div>
  )
}