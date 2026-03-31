/**
 * POST /api/admin/send-uat-invites
 * One-time UAT invitation email sender
 * Requires CRON_SECRET for auth (admin-only operation)
 *
 * VeritasIQ Technologies Ltd | Pre-UAT March 2026
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UAT_RECIPIENTS = [
  { email: 'dmasuku2008@gmail.com', name: 'Douglas', role: 'CEO — Executive tier (all features)', journeys: 'Full platform walkthrough + Executive OS + Consulting Frameworks' },
  { email: 'siphathisiwe@veritasiq.io', name: 'Siphathisiwe', role: 'Compliance & Policy Owner', journeys: 'Onboarding + Policy Coach + Document Vault + GDPR export' },
  { email: 'richard@veritasiq.io', name: 'Richard', role: 'Technical Lead — Security controls', journeys: 'API keys + Security headers + Session timeout + Data retention' },
  { email: 'samantha@veritasiq.io', name: 'Samantha', role: 'QA Lead — UAT quality', journeys: 'Full test script (docs/UAT_TEST_SCRIPTS.md) + edge cases' },
]

const PLATFORM_URL = 'https://pios-wysskz48mv-engs-projects.vercel.app'

function buildEmailHtml(recipient: typeof UAT_RECIPIENTS[0]): string {
  return `
<div style="font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:40px 24px;color:#1a1610">
  <div style="font-size:22px;font-weight:600;margin-bottom:32px;font-family:'Cormorant Garamond',Georgia,serif">PIOS</div>

  <h1 style="font-size:24px;font-weight:600;margin:0 0 8px;line-height:1.3">You are invited to UAT</h1>
  <p style="color:#6b6050;font-size:15px;line-height:1.7;margin:0 0 28px">
    Hi ${recipient.name},
  </p>
  <p style="color:#3d3626;font-size:15px;line-height:1.7;margin:0 0 24px">
    You are invited to participate in the User Acceptance Testing (UAT) for PIOS — our Professional Intelligence Operating System, built by VeritasIQ Technologies Ltd.
  </p>

  <div style="background:#f7f5f0;border:1px solid #e2dfd8;border-radius:12px;padding:24px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b8860b;margin-bottom:12px">WHAT WE NEED FROM YOU</div>
    <p style="color:#3d3626;font-size:14px;line-height:1.7;margin:0">
      Please test PIOS over the next 5 working days and report any issues, bugs, or feedback.
    </p>
  </div>

  <div style="background:#f7f5f0;border:1px solid #e2dfd8;border-radius:12px;padding:24px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b8860b;margin-bottom:12px">YOUR TEST ACCESS</div>
    <p style="color:#3d3626;font-size:14px;line-height:1.7;margin:0 0 8px">
      <strong>Platform URL:</strong> <a href="${PLATFORM_URL}" style="color:#1a3d7a">${PLATFORM_URL}</a>
    </p>
    <p style="color:#3d3626;font-size:14px;line-height:1.7;margin:0">
      <strong>Your role to test:</strong> ${recipient.role}
    </p>
  </div>

  <div style="background:#f7f5f0;border:1px solid #e2dfd8;border-radius:12px;padding:24px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b8860b;margin-bottom:12px">WHAT TO TEST</div>
    <p style="color:#3d3626;font-size:14px;line-height:1.7;margin:0 0 12px">
      Please walk through these journeys in order:
    </p>
    <ol style="color:#3d3626;font-size:14px;line-height:2;margin:0;padding-left:20px">
      <li>Onboarding — complete the wizard as a new user</li>
      <li>Morning Brief — generate your first daily brief</li>
      <li>Email Triage — connect your inbox and triage 5 emails</li>
      <li>Coaching Session — complete one session in any mode</li>
      <li>NemoClaw — ask it 3 questions about your tasks and priorities</li>
      <li>Weekly Summary — check the dashboard for your value summary</li>
    </ol>
    <p style="color:#6b6050;font-size:13px;line-height:1.7;margin:12px 0 0;font-style:italic">
      Your specific focus: ${recipient.journeys}
    </p>
  </div>

  <div style="background:#f7f5f0;border:1px solid #e2dfd8;border-radius:12px;padding:24px;margin-bottom:32px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b8860b;margin-bottom:12px">HOW TO REPORT ISSUES</div>
    <p style="color:#3d3626;font-size:14px;line-height:1.7;margin:0">
      Reply to this email with: what you were doing, what you expected, what actually happened, and a screenshot if possible.
    </p>
  </div>

  <div style="text-align:center;margin-bottom:32px">
    <a href="${PLATFORM_URL}" style="display:inline-block;padding:14px 36px;background:#1a1610;color:#f7f5f0;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600">
      Open PIOS →
    </a>
  </div>

  <p style="color:#b8860b;font-size:13px;font-weight:600;text-align:center;margin-bottom:24px">
    UAT CLOSES: Friday 4 April 2026 at 17:00
  </p>

  <hr style="border:none;border-top:1px solid #e2dfd8;margin:24px 0" />

  <p style="color:#3d3626;font-size:14px;line-height:1.7;margin:0 0 4px">
    Thank you for helping us ship a product we are proud of.
  </p>
  <p style="color:#1a1610;font-size:14px;font-weight:600;margin:0 0 4px">Douglas Masuku</p>
  <p style="color:#6b6050;font-size:13px;margin:0">CEO, VeritasIQ Technologies Ltd</p>
</div>`
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const results: { email: string; status: string; id?: string; error?: string }[] = []

  for (const recipient of UAT_RECIPIENTS) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PIOS <noreply@veritasiq.io>',
          to: recipient.email,
          subject: 'PIOS UAT — You are invited to test the platform [Action Required]',
          html: buildEmailHtml(recipient),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        results.push({ email: recipient.email, status: 'sent', id: data.id })
      } else {
        results.push({ email: recipient.email, status: 'failed', error: data.message ?? JSON.stringify(data) })
      }
    } catch (err) {
      results.push({ email: recipient.email, status: 'error', error: (err as Error).message })
    }
  }

  return NextResponse.json({
    ok: true,
    sent_at: new Date().toISOString(),
    results,
    total: UAT_RECIPIENTS.length,
    succeeded: results.filter(r => r.status === 'sent').length,
  })
}
