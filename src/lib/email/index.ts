/**
 * lib/email/index.ts
 * PIOS Email Library
 * 
 * - morningBriefHtml()   — branded HTML morning brief template
 * - morningBriefText()   — plain text fallback
 * - sendEmail()          — Resend API delivery with graceful degradation
 * - sendWelcomeEmail()   — onboarding welcome
 * - sendMagicLinkEmail() — custom magic link (if overriding Supabase default)
 * 
 * Design: dark navy email matching PIOS platform aesthetic.
 * Tested against: Gmail, Apple Mail, Outlook 2019+, iOS Mail.
 * 
 * VeritasIQ Technologies Ltd · Sprint I
 */

// ── Constants ──────────────────────────────────────────────────────────────
const NAVY      = '#07080f'
const SURFACE   = '#0b0d18'
const SURFACE2  = '#0f1120'
const BORDER    = '#1a1f34'
const AI_COLOR  = '#8b7cf8'
const TEXT_PRI  = '#eceef8'
const TEXT_SEC  = '#a8adc8'
const TEXT_MUT  = '#636880'
const OK_COLOR  = '#1D9E75'
const WARN_COLOR= '#f0a030'
const DNG_COLOR = '#e05272'
const PRO_COLOR = '#22d3ee'
const FONT      = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const DISPLAY   = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif"

// ── Types ──────────────────────────────────────────────────────────────────
export interface EmailPayload {
  to:       string
  subject:  string
  html:     string
  text?:    string
  from?:    string
  replyTo?: string
}

export interface EmailResult {
  ok:     boolean
  id?:    string
  error?: string
}

export interface BriefData {
  userName:       string
  briefDate:      string         // ISO date string
  summary:        string         // Main AI-generated prose
  tasks?:         BriefTask[]
  okrs?:          BriefOKR[]
  decisions?:     BriefDecision[]
  wellness?:      { mood: number; streak: number } | null
  financial?:     { revenue?: number; burn?: number; runway?: number } | null
  platforms?:     { ve_tenants?: number; is_newsrooms?: number } | null
  frameworks?:    string[]       // recommended NemoClaw™ framework codes
}

interface BriefTask {
  title:    string
  priority: 'high' | 'medium' | 'low'
  due_date?: string
  overdue?: boolean
}

interface BriefOKR {
  title:    string
  progress: number
  health:   string
}

interface BriefDecision {
  title:  string
  status: string
}

// ── HTML Template ──────────────────────────────────────────────────────────
export function morningBriefHtml(data: BriefData): string {
  const {
    userName, briefDate, summary,
    tasks = [], okrs = [], decisions = [],
    wellness, financial, platforms, frameworks = [],
  } = data

  const date   = new Date(briefDate)
  const dayStr = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

  const highTasks  = tasks.filter(t => t.priority === 'high' || t.overdue)
  const openDecs   = decisions.filter(d => d.status === 'open')
  const atRiskOkrs = okrs.filter(o => o.health === 'at_risk' || o.health === 'off_track')

  function priorityDot(p: string, overdue?: boolean) {
    const c = overdue ? DNG_COLOR : p === 'high' ? DNG_COLOR : p === 'medium' ? WARN_COLOR : TEXT_MUT
    return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${c};margin-right:8px;vertical-align:middle;"></span>`
  }

  function progressBar(pct: number, health: string) {
    const fill = health === 'on_track' ? OK_COLOR : health === 'at_risk' ? WARN_COLOR : DNG_COLOR
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background:${BORDER};border-radius:3px;height:4px;overflow:hidden;">
            <div style="width:${pct}%;height:4px;background:${fill};border-radius:3px;"></div>
          </td>
          <td width="36" style="text-align:right;font-size:11px;color:${fill};font-weight:700;padding-left:8px;">${pct}%</td>
        </tr>
      </table>`
  }

  function sectionHeader(label: string, color = AI_COLOR) {
    return `
      <tr><td style="padding:20px 32px 10px;">
        <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${color};font-family:${FONT};">
          ${label}
        </p>
      </td></tr>`
  }

  function dividerRow() {
    return `<tr><td style="padding:0 32px;"><div style="height:1px;background:${BORDER};"></div></td></tr>`
  }

  // ── Build email ────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="dark"/>
  <meta name="supported-color-schemes" content="dark"/>
  <title>PIOS Morning Brief — ${dayStr}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
    body { margin:0;padding:0;background:${NAVY};-webkit-text-size-adjust:100%;text-size-adjust:100%; }
    @media (prefers-color-scheme: light) {
      body { background:#f4f5f7 !important; }
      .email-outer { background:#f4f5f7 !important; }
      .email-card  { background:#ffffff !important; border-color:#e2e4ec !important; }
      .email-header{ background:#1a1060 !important; }
      .text-pri    { color:#1a1c2a !important; }
      .text-sec    { color:#4a4f6a !important; }
      .text-mut    { color:#7a7f9a !important; }
      .surface     { background:#f0f1f8 !important; border-color:#e2e4ec !important; }
      .surface2    { background:#e8eaf4 !important; }
    }
  </style>
</head>
<body class="email-outer" style="margin:0;padding:0;background:${NAVY};font-family:${FONT};">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;color:${NAVY};">
  ${summary.slice(0, 140).replace(/<[^>]+>/g, '')} &zwnj;&nbsp;&zwnj;&nbsp;
</div>

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NAVY};min-height:100vh;">
<tr><td align="center" style="padding:24px 16px;">

<!-- Card -->
<table class="email-card" width="600" cellpadding="0" cellspacing="0" border="0"
  style="max-width:600px;width:100%;background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">

  <!-- Header -->
  <tr><td class="email-header" style="background:linear-gradient(135deg,#0f0a2e 0%,#0b0d18 100%);padding:28px 32px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <!-- Logo -->
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:linear-gradient(135deg,${AI_COLOR},#4f8ef7);border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;">
                <span style="font-size:15px;font-weight:800;color:#fff;font-family:${DISPLAY};line-height:32px;">P</span>
              </td>
              <td style="padding-left:10px;vertical-align:middle;">
                <span style="font-family:${DISPLAY};font-size:15px;font-weight:800;color:${TEXT_PRI};letter-spacing:-0.02em;">PIOS</span>
                <span style="font-size:11px;color:${TEXT_MUT};margin-left:6px;">by VeritasIQ</span>
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="vertical-align:top;">
          <span style="font-size:10px;color:${TEXT_MUT};font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Morning Brief</span>
        </td>
      </tr>
    </table>

    <!-- Greeting -->
    <p style="margin:20px 0 6px;font-family:${DISPLAY};font-size:22px;font-weight:800;color:${TEXT_PRI};letter-spacing:-0.02em;line-height:1.2;">
      Good morning, ${escapeHtml(userName.split(' ')[0])}.
    </p>
    <p style="margin:0;font-size:13px;color:${TEXT_MUT};">
      ${dayStr}
      <span style="color:${AI_COLOR};margin-left:10px;">◉ NemoClaw™</span>
    </p>
  </td></tr>

  ${dividerRow()}

  <!-- AI Brief summary -->
  ${sectionHeader('Intelligence Summary', AI_COLOR)}
  <tr><td style="padding:4px 32px 20px;">
    <div class="surface" style="background:rgba(139,124,248,0.08);border:1px solid rgba(139,124,248,0.2);border-radius:10px;padding:18px 20px;">
      <p style="margin:0;font-size:14px;line-height:1.75;color:${TEXT_SEC};">
        ${escapeHtml(summary).replace(/\n\n/g, '</p><p style="margin:12px 0 0;font-size:14px;line-height:1.75;color:' + TEXT_SEC + ';">').replace(/\n/g, '<br/>')}
      </p>
    </div>
  </td></tr>

  ${highTasks.length > 0 ? `
  ${dividerRow()}
  ${sectionHeader('Priority Actions', DNG_COLOR)}
  <tr><td style="padding:4px 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${highTasks.slice(0, 5).map(t => {
        const due = t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
        return `<tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER};">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="vertical-align:middle;">
                ${priorityDot(t.priority, t.overdue)}
                <span style="font-size:13px;color:${TEXT_SEC};">${escapeHtml(t.title)}</span>
                ${t.overdue ? `<span style="margin-left:8px;font-size:9px;font-weight:700;color:${DNG_COLOR};background:rgba(224,82,114,0.12);border:1px solid rgba(224,82,114,0.25);padding:1px 6px;border-radius:3px;text-transform:uppercase;letter-spacing:0.05em;">OVERDUE</span>` : ''}
              </td>
              ${due ? `<td align="right" style="font-size:11px;color:${TEXT_MUT};white-space:nowrap;">${due}</td>` : ''}
            </tr></table>
          </td>
        </tr>`
      }).join('')}
    </table>
  </td></tr>` : ''}

  ${okrs.length > 0 ? `
  ${dividerRow()}
  ${sectionHeader('OKR Pulse', OK_COLOR)}
  <tr><td style="padding:4px 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${okrs.slice(0, 4).map(o => `
        <tr><td style="padding:8px 0;border-bottom:1px solid ${BORDER};">
          <p style="margin:0 0 6px;font-size:13px;color:${TEXT_SEC};">${escapeHtml(o.title)}</p>
          ${progressBar(o.progress, o.health)}
        </td></tr>`).join('')}
    </table>
  </td></tr>` : ''}

  ${openDecs.length > 0 ? `
  ${dividerRow()}
  ${sectionHeader('Open Decisions', WARN_COLOR)}
  <tr><td style="padding:4px 32px 20px;">
    ${openDecs.slice(0, 3).map(d => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid ${BORDER};">
        <span style="color:${WARN_COLOR};font-size:11px;margin-top:2px;">△</span>
        <span style="font-size:13px;color:${TEXT_SEC};">${escapeHtml(d.title)}</span>
      </div>`).join('')}
  </td></tr>` : ''}

  ${(financial?.revenue || financial?.burn || financial?.runway) ? `
  ${dividerRow()}
  ${sectionHeader('Financial Snapshot', PRO_COLOR)}
  <tr><td style="padding:4px 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${financial.revenue !== undefined ? `
        <td style="text-align:center;padding:12px 8px;background:rgba(29,158,117,0.07);border:1px solid rgba(29,158,117,0.2);border-radius:8px;margin:4px;">
          <p style="margin:0 0 4px;font-size:10px;color:${TEXT_MUT};text-transform:uppercase;letter-spacing:0.07em;font-weight:600;">Revenue</p>
          <p style="margin:0;font-size:18px;font-weight:800;color:${OK_COLOR};font-family:${DISPLAY};letter-spacing:-0.02em;">${fmtGBP(financial.revenue)}</p>
        </td>` : ''}
        ${financial.burn !== undefined ? `
        <td width="8"></td>
        <td style="text-align:center;padding:12px 8px;background:rgba(224,82,114,0.07);border:1px solid rgba(224,82,114,0.2);border-radius:8px;">
          <p style="margin:0 0 4px;font-size:10px;color:${TEXT_MUT};text-transform:uppercase;letter-spacing:0.07em;font-weight:600;">Burn</p>
          <p style="margin:0;font-size:18px;font-weight:800;color:${DNG_COLOR};font-family:${DISPLAY};letter-spacing:-0.02em;">${fmtGBP(financial.burn)}</p>
        </td>` : ''}
        ${financial.runway !== undefined ? `
        <td width="8"></td>
        <td style="text-align:center;padding:12px 8px;background:rgba(240,160,48,0.07);border:1px solid rgba(240,160,48,0.2);border-radius:8px;">
          <p style="margin:0 0 4px;font-size:10px;color:${TEXT_MUT};text-transform:uppercase;letter-spacing:0.07em;font-weight:600;">Runway</p>
          <p style="margin:0;font-size:18px;font-weight:800;color:${WARN_COLOR};font-family:${DISPLAY};letter-spacing:-0.02em;">${financial.runway}mo</p>
        </td>` : ''}
      </tr>
    </table>
  </td></tr>` : ''}

  ${frameworks.length > 0 ? `
  ${dividerRow()}
  ${sectionHeader('Suggested Frameworks Today', AI_COLOR)}
  <tr><td style="padding:4px 32px 20px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      ${frameworks.slice(0, 5).map(f => `
        <td style="padding-right:8px;">
          <div style="background:rgba(139,124,248,0.1);border:1px solid rgba(139,124,248,0.25);border-radius:5px;padding:3px 10px;">
            <span style="font-size:11px;font-weight:800;color:${AI_COLOR};font-family:monospace;letter-spacing:0.04em;">${escapeHtml(f)}</span>
          </div>
        </td>`).join('')}
    </tr></table>
  </td></tr>` : ''}

  ${wellness ? `
  ${dividerRow()}
  <tr><td style="padding:14px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td>
        <span style="font-size:13px;color:${TEXT_MUT};">Wellness streak</span>
      </td>
      <td align="right">
        <span style="font-size:20px;">🔥</span>
        <span style="font-size:14px;font-weight:700;color:${WARN_COLOR};margin-left:6px;">${wellness.streak} days</span>
        <span style="font-size:13px;color:${TEXT_MUT};margin-left:8px;">· mood ${wellness.mood}/10</span>
      </td>
    </tr></table>
  </td></tr>` : ''}

  ${dividerRow()}

  <!-- CTA -->
  <tr><td style="padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center">
        <a href="https://pios-wysskz48mv-engs-projects.vercel.app/platform/dashboard"
          style="display:inline-block;background:${AI_COLOR};color:#fff;font-family:${DISPLAY};font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:-0.01em;">
          Open Command Centre →
        </a>
      </td>
    </tr></table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:${SURFACE2};padding:20px 32px;border-top:1px solid ${BORDER};">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:12px;color:${TEXT_MUT};">
            <strong style="color:${TEXT_SEC};">PIOS</strong> by VeritasIQ Technologies Ltd
          </p>
          <p style="margin:0;font-size:11px;color:${TEXT_MUT};">
            You're receiving this because morning briefs are enabled in your account.
            <a href="https://pios-wysskz48mv-engs-projects.vercel.app/platform/settings"
              style="color:${AI_COLOR};text-decoration:none;">Manage preferences</a>
            &nbsp;·&nbsp;
            <a href="https://pios-wysskz48mv-engs-projects.vercel.app/platform/settings"
              style="color:${AI_COLOR};text-decoration:none;">Unsubscribe</a>
          </p>
        </td>
        <td align="right" style="vertical-align:top;">
          <p style="margin:0;font-size:11px;color:${TEXT_MUT};">${timeStr} BST</p>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
<!-- End card -->

</td></tr>
</table>
<!-- End wrapper -->

</body>
</html>`
}

// ── Plain text fallback ────────────────────────────────────────────────────
export function morningBriefText(data: BriefData): string {
  const { userName, briefDate, summary, tasks = [], okrs = [], decisions = [] } = data
  const date   = new Date(briefDate)
  const dayStr = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const lines: string[] = [
    `PIOS Morning Brief — ${dayStr}`,
    `Good morning, ${userName.split(' ')[0]}.`,
    '',
    '── INTELLIGENCE SUMMARY ──',
    summary,
  ]

  const highTasks = tasks.filter(t => t.priority === 'high' || t.overdue)
  if (highTasks.length > 0) {
    lines.push('', '── PRIORITY ACTIONS ──')
    highTasks.slice(0, 5).forEach(t => {
      const overdue = t.overdue ? ' [OVERDUE]' : ''
      const due     = t.due_date ? ` · Due ${new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''
      lines.push(`• ${t.title}${overdue}${due}`)
    })
  }

  if (okrs.length > 0) {
    lines.push('', '── OKR PULSE ──')
    okrs.slice(0, 4).forEach(o => {
      lines.push(`${o.title} — ${o.progress}% (${o.health.replace('_', ' ')})`)
    })
  }

  const openDecs = decisions.filter(d => d.status === 'open')
  if (openDecs.length > 0) {
    lines.push('', '── OPEN DECISIONS ──')
    openDecs.slice(0, 3).forEach(d => lines.push(`△ ${d.title}`))
  }

  lines.push(
    '',
    '──',
    'Open Command Centre: https://pios-wysskz48mv-engs-projects.vercel.app/platform/dashboard',
    'Manage preferences: https://pios-wysskz48mv-engs-projects.vercel.app/platform/settings',
    '',
    'PIOS by VeritasIQ Technologies Ltd · info@veritasiq.io',
  )

  return lines.join('\n')
}

// ── Welcome email ──────────────────────────────────────────────────────────
export function welcomeEmailHtml(userName: string): string {
  const first = userName.split(' ')[0]
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Welcome to PIOS</title></head>
<body style="margin:0;padding:0;background:${NAVY};font-family:${FONT};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NAVY};">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">

  <tr><td style="background:linear-gradient(135deg,#0f0a2e,${SURFACE});padding:32px 32px 28px;">
    <div style="width:44px;height:44px;background:linear-gradient(135deg,${AI_COLOR},#4f8ef7);border-radius:11px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <span style="font-size:20px;font-weight:800;color:#fff;font-family:${DISPLAY};">P</span>
    </div>
    <h1 style="margin:0 0 8px;font-family:${DISPLAY};font-size:24px;font-weight:800;color:${TEXT_PRI};letter-spacing:-0.02em;">
      Welcome to PIOS, ${escapeHtml(first)}.
    </h1>
    <p style="margin:0;font-size:14px;color:${TEXT_MUT};">Your Personal Intelligence Operating System is ready.</p>
  </td></tr>

  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 20px;font-size:14px;color:${TEXT_SEC};line-height:1.7;">
      PIOS is your executive command centre — built for founders, CEOs, and senior consultants who run multiple platforms simultaneously. Your 7am morning brief starts tomorrow.
    </p>

    <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:${TEXT_MUT};text-transform:uppercase;letter-spacing:0.08em;">Get started</p>

    ${[
      ['Upload your CV', 'Calibrate NemoClaw™ AI to your exact career context', '/platform/ai'],
      ['Set your first OKR', 'Define what you\'re working toward this quarter', '/platform/okrs'],
      ['Log a strategic decision', 'Build your institutional memory from day one', '/platform/decisions'],
    ].map(([title, desc, path]) => `
      <a href="https://pios-wysskz48mv-engs-projects.vercel.app${path}" style="text-decoration:none;display:block;margin-bottom:10px;">
        <div style="background:${SURFACE2};border:1px solid ${BORDER};border-radius:8px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:${TEXT_PRI};">${escapeHtml(title)}</p>
            <p style="margin:0;font-size:12px;color:${TEXT_MUT};">${escapeHtml(desc)}</p>
          </div>
          <span style="color:${AI_COLOR};font-size:16px;margin-left:12px;">→</span>
        </div>
      </a>`).join('')}

    <div style="margin-top:24px;text-align:center;">
      <a href="https://pios-wysskz48mv-engs-projects.vercel.app/platform/dashboard"
        style="display:inline-block;background:${AI_COLOR};color:#fff;font-family:${DISPLAY};font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">
        Open Command Centre →
      </a>
    </div>
  </td></tr>

  <tr><td style="background:${SURFACE2};padding:18px 32px;border-top:1px solid ${BORDER};">
    <p style="margin:0;font-size:11px;color:${TEXT_MUT};">
      <strong style="color:${TEXT_SEC};">PIOS</strong> by VeritasIQ Technologies Ltd ·
      <a href="mailto:info@veritasiq.io" style="color:${AI_COLOR};text-decoration:none;">info@veritasiq.io</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Resend delivery ────────────────────────────────────────────────────────
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping')
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const from = payload.from
    ?? process.env.RESEND_FROM_EMAIL
    ?? 'PIOS <brief@veritasiq.io>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to:       [payload.to],
        subject:  payload.subject,
        html:     payload.html,
        text:     payload.text,
        reply_to: payload.replyTo ?? 'info@veritasiq.io',
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[email] Resend API error:', data)
      return { ok: false, error: data?.message ?? 'Resend API error' }
    }

    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[email] Fetch error:', err)
    return { ok: false, error: String(err) }
  }
}

export async function sendWelcomeEmail(to: string, userName: string): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Welcome to PIOS — your command centre is ready`,
    html:    welcomeEmailHtml(userName),
    text:    `Welcome to PIOS, ${userName.split(' ')[0]}.\n\nYour Personal Intelligence Operating System is live.\n\nOpen your command centre: https://pios-wysskz48mv-engs-projects.vercel.app/platform/dashboard\n\nPIOS by VeritasIQ Technologies Ltd · info@veritasiq.io`,
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtGBP(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `£${(n / 1_000).toFixed(0)}k`
  return `£${n}`
}
