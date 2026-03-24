'use client'
import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// /platform/setup — Environment setup guide for PIOS Phase 2
// Covers: CRON_SECRET, Google OAuth, Resend, Live Data vars
// Owner: info@veritasiq.tech
// PIOS v2.2 | VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

interface Step {
  id:    string
  title: string
  tag:   string
  tagColour: string
  items: {
    label:    string
    key?:     string
    value?:   string
    note?:    string
    url?:     string
    urlLabel?:string
    code?:    string
  }[]
  done?: boolean
}

const STEPS: Step[] = [
  {
    id:        'cron',
    title:     'Morning Brief Cron',
    tag:       'Critical',
    tagColour: '#ef4444',
    items: [
      {
        label:    'Generate CRON_SECRET',
        note:     'Any secure random string. Run this in your terminal:',
        code:     'openssl rand -hex 32',
      },
      {
        label:    'Add to Vercel',
        key:      'CRON_SECRET',
        value:    '<your generated secret>',
        note:     'Vercel → veritasedge → Settings → Environment Variables → Add',
        url:      'https://vercel.com/wysskz48mv-eng/pios/settings/environment-variables',
        urlLabel: 'Open Vercel Env Vars →',
      },
      {
        label:    'Redeploy',
        note:     'After adding the env var, trigger a redeploy: Vercel → Deployments → Redeploy latest.',
      },
    ],
  },
  {
    id:        'google',
    title:     'Google OAuth (Gmail + Calendar)',
    tag:       'High',
    tagColour: '#f59e0b',
    items: [
      {
        label:    'Step 1 — Create OAuth credentials',
        note:     'Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web application',
        url:      'https://console.cloud.google.com/apis/credentials',
        urlLabel: 'Open Google Cloud Console →',
      },
      {
        label:    'Authorised redirect URI',
        code:     'https://vfvfulbcaurqkygjrrhh.supabase.co/auth/v1/callback',
        note:     'Add this exact URI to "Authorised redirect URIs" in the OAuth client.',
      },
      {
        label:    'Step 2 — Add Client ID to Supabase Auth',
        note:     'Supabase → Authentication → Providers → Google → Enable → Paste Client ID + Client Secret',
        url:      'https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/auth/providers',
        urlLabel: 'Open Supabase Auth Providers →',
      },
      {
        label:    'Step 3 — Add env vars to Vercel',
        key:      'GOOGLE_CLIENT_ID',
        value:    '<from Google Cloud Console>',
      },
      {
        label:    '',
        key:      'GOOGLE_CLIENT_SECRET',
        value:    '<from Google Cloud Console>',
        url:      'https://vercel.com/wysskz48mv-eng/pios/settings/environment-variables',
        urlLabel: 'Open Vercel Env Vars →',
      },
      {
        label:    'Required OAuth scopes',
        code:     'openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly',
        note:     'Ensure these are added under "Scopes" in your OAuth consent screen.',
      },
    ],
  },
  {
    id:        'resend',
    title:     'Morning Brief Email (Resend)',
    tag:       'High',
    tagColour: '#f59e0b',
    items: [
      {
        label:    'Create Resend account & API key',
        url:      'https://resend.com',
        urlLabel: 'Open Resend.com →',
        note:     'Sign up → API Keys → Create API Key (full access). Verify your sending domain.',
      },
      {
        label:    'Add env vars to Vercel',
        key:      'RESEND_API_KEY',
        value:    're_xxxxxxxxxxxx',
      },
      {
        label:    '',
        key:      'RESEND_FROM_EMAIL',
        value:    'PIOS <info@veritasiq.tech>',
        note:     'Must match a verified domain in Resend. Use veritasiq.tech or any domain you own.',
        url:      'https://vercel.com/wysskz48mv-eng/pios/settings/environment-variables',
        urlLabel: 'Open Vercel Env Vars →',
      },
    ],
  },
  {
    id:        'livedata',
    title:     'Live Command Centre Data',
    tag:       'Medium',
    tagColour: '#4d9fff',
    items: [
      {
        label:    'VeritasEdge™ service key',
        key:      'SUPABASE_SE_SERVICE_KEY',
        value:    '<SE service_role key from Supabase>',
        url:      'https://supabase.com/dashboard/project/oxqqzxvuksgzeeyhufhp/settings/api',
        urlLabel: 'Open SE Supabase API Settings →',
      },
      {
        label:    'InvestiScript service key',
        key:      'SUPABASE_IS_SERVICE_KEY',
        value:    '<IS service_role key from Supabase>',
        url:      'https://supabase.com/dashboard/project/dexsdwqkunnmhxcwayda/settings/api',
        urlLabel: 'Open IS Supabase API Settings →',
      },
      {
        label:    'GitHub PAT',
        key:      'GITHUB_PAT',
        value:    '<GitHub PAT with repo:read scope>',
        note:     'GitHub → Settings → Developer Settings → Personal access tokens → Fine-grained. Read-only access to wysskz48mv-eng org.',
        url:      'https://github.com/settings/personal-access-tokens/new',
        urlLabel: 'Create GitHub PAT →',
      },
    ],
  },
  {
    id:        'microsoft',
    title:     'Microsoft 365 / Outlook (Multi-Email)',
    tag:       'Required for M365',
    tagColour: '#0078D4',
    items: [
      {
        label:    'Register app in Azure Portal',
        note:     'Go to portal.azure.com → Microsoft Entra ID → App registrations → New registration. Name: PIOS. Supported account types: Accounts in any organizational directory and personal Microsoft accounts. Redirect URI (Web): https://pios-wysskz48mv-engs-projects.vercel.app/api/auth/callback/microsoft',
        url:      'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
        urlLabel: 'Open Azure App Registrations →',
      },
      {
        label:    'Grant API permissions',
        note:     'In your app registration → API permissions → Add permission → Microsoft Graph → Delegated: Mail.Read, Mail.Send, Calendars.Read, User.Read, offline_access. Then click "Grant admin consent".',
      },
      {
        label:    'Add AZURE_CLIENT_ID',
        key:      'AZURE_CLIENT_ID',
        value:    '<Application (client) ID from Azure Portal overview>',
        note:     'Found in your app registration overview page.',
        url:      'https://vercel.com/wysskz48mv-eng/pios/settings/environment-variables',
        urlLabel: 'Open Vercel Env Vars →',
      },
      {
        label:    'Add AZURE_CLIENT_SECRET',
        key:      'AZURE_CLIENT_SECRET',
        value:    '<Client secret value — Certificates & secrets tab>',
        note:     'Create in Azure Portal → App registration → Certificates & secrets → New client secret. Copy the Value (not the ID). Set expiry to 24 months.',
      },
      {
        label:    'Redeploy after adding vars',
        note:     'Vercel → PIOS → Deployments → Redeploy latest to activate Microsoft OAuth.',
      },
    ],
  },
  {
    id:        'domain',
    title:     'Custom Domain (Optional)',
    tag:       'Optional',
    tagColour: '#454d63',
    items: [
      {
        label:    'Add domain in Vercel',
        note:     'Vercel → PIOS project → Settings → Domains → Add domain. Suggested: pios.veritasiq.tech',
        url:      'https://vercel.com/wysskz48mv-eng/pios/settings/domains',
        urlLabel: 'Open Vercel Domains →',
      },
      {
        label:    'Update NEXT_PUBLIC_APP_URL',
        key:      'NEXT_PUBLIC_APP_URL',
        value:    'https://pios.veritasiq.tech',
        note:     'Update this env var to your custom domain after it is live.',
      },
    ],
  },
]

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000) }}
      style={{
        background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4,
        color: copied ? '#22c55e' : '#7a8299', cursor: 'pointer', fontSize: 11,
        padding: '2px 8px', marginLeft: 8, fontFamily: 'monospace', transition: '.15s',
      }}
    >{copied ? '✓ Copied' : 'Copy'}</button>
  )
}

export default function SetupGuidePage() {
  const [done, setDone] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<unknown>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  useEffect(() => {
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(d => { setStatus(d); setStatusLoading(false) })
      .catch(() => setStatusLoading(false))
  }, [])

  const toggle = (id: string) => setDone(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const completedCount = done.size

  return (
    <div style={{ padding: '32px 40px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#454d63', fontWeight: 600, marginBottom: 8 }}>PIOS · Phase 2</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Environment Setup Guide</h1>
        <p style={{ fontSize: 14, color: '#7a8299', margin: 0 }}>Complete these steps in Vercel to activate all PIOS Phase 2 features. Each step requires adding environment variables and redeploying.</p>
      </div>

      {/* Live status panel */}
      <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: statusLoading ? 0 : 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#7a8299', letterSpacing: 0.5 }}>LIVE ENVIRONMENT STATUS</span>
          {statusLoading
            ? <span style={{ fontSize: 11, color: '#454d63' }}>Checking…</span>
            : <span style={{ fontSize: 11, fontFamily: 'monospace', color: status?.ready ? '#22c55e' : '#f59e0b' }}>
                {status?.score} configured · {status?.ready ? '✓ Required complete' : '⚠ Incomplete'}
              </span>
          }
        </div>
        {!statusLoading && status?.checks && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Required checks */}
            <div style={{ fontSize: 10, color: '#7a8299', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Required</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {Object.entries(status.checks).filter(([,c]: [string,any]) => c.required).map(([key, check]: [string, any]) => (
                <span key={key} title={check.ok ? '' : (check.hint ?? '')} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 4, fontFamily: 'monospace', cursor: check.ok ? 'default' : 'help',
                  background: check.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.12)',
                  color: check.ok ? '#22c55e' : '#ef4444',
                  border: `1px solid ${check.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  {check.ok ? '✓' : '✗'} {check.label}{!check.ok && check.hint ? ' ?' : ''}
                </span>
              ))}
            </div>
            {/* Optional checks */}
            <div style={{ fontSize: 10, color: '#7a8299', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optional</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {Object.entries(status.checks).filter(([,c]: [string,any]) => !c.required).map(([key, check]: [string, any]) => (
                <span key={key} title={check.ok ? '' : (check.hint ?? '')} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 4, fontFamily: 'monospace', cursor: check.ok ? 'default' : 'help',
                  background: check.ok ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.08)',
                  color: check.ok ? '#22c55e' : '#f59e0b',
                  border: `1px solid ${check.ok ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.2)'}`,
                }}>
                  {check.ok ? '✓' : '○'} {check.label}
                </span>
              ))}
            </div>
            {/* Stripe setup action */}
            {status.checks.stripe_keys?.ok && !status.checks.stripe_price_ids?.ok && (
              <div style={{ marginTop: 4, padding: '10px 14px', borderRadius: 8, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>Stripe keys set — run price setup: </span>
                <button onClick={async () => {
                  const r = await fetch('/api/stripe/setup', { method: 'POST' })
                  const d = await r.json()
                  if (d.success) {
                    alert('Price IDs generated!\n\nAdd these to Vercel env vars then redeploy:\n\n' +
                      d.env_vars.map((e: Record<string, unknown>) => `${e.key}=${e.value}`).join('\n'))
                  } else {
                    alert('Error: ' + (d.error ?? 'Unknown'))
                  }
                }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: '#a78bfa', color: '#fff', border: 'none', cursor: 'pointer', marginLeft: 8 }}>
                  POST /api/stripe/setup
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress */}
      <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: 6, background: '#1c2030', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#a78bfa', borderRadius: 3, width: `${(completedCount / STEPS.length) * 100}%`, transition: 'width .4s ease' }} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#7a8299', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {completedCount} / {STEPS.length} complete
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {STEPS.map((step) => {
          const isDone = done.has(step.id)
          return (
            <div key={step.id} style={{
              background: isDone ? 'rgba(34,197,94,0.03)' : '#111318',
              border: `1px solid ${isDone ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 10, padding: '20px 24px',
              transition: 'all .2s',
            }}>
              {/* Step header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isDone ? 0 : 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    background: `${step.tagColour}18`, color: step.tagColour,
                    border: `1px solid ${step.tagColour}30`, borderRadius: 4,
                    fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                    padding: '2px 8px',
                  }}>{step.tag}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: isDone ? '#7a8299' : '#fff', textDecoration: isDone ? 'line-through' : 'none' }}>{step.title}</span>
                </div>
                <button
                  onClick={() => toggle(step.id)}
                  style={{
                    background: isDone ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isDone ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 6, color: isDone ? '#22c55e' : '#7a8299',
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    padding: '5px 12px', transition: '.15s',
                  }}
                >{isDone ? '✓ Done' : 'Mark done'}</button>
              </div>

              {/* Step items — hidden when done */}
              {!isDone && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {step.items.map((item, i) => (
                    <div key={i} style={{ borderLeft: '2px solid rgba(255,255,255,0.06)', paddingLeft: 16 }}>
                      {item.label && <div style={{ fontSize: 12, fontWeight: 600, color: '#c8cedd', marginBottom: 6 }}>{item.label}</div>}
                      {item.key && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 6 }}>
                          <code style={{ background: '#0e1015', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '4px 10px', fontSize: 12, fontFamily: 'monospace', color: '#a78bfa' }}>{item.key}</code>
                          <span style={{ fontSize: 12, color: '#454d63', margin: '0 6px' }}>=</span>
                          <code style={{ background: '#0e1015', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '4px 10px', fontSize: 12, fontFamily: 'monospace', color: '#7a8299', flex: 1 }}>{item.value}</code>
                          <CopyBtn text={`${item.key}=${item.value}`} />
                        </div>
                      )}
                      {item.code && (
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                          <code style={{ background: '#060709', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 5, padding: '6px 12px', fontSize: 12, fontFamily: 'monospace', color: '#22d3ee', flex: 1, wordBreak: 'break-all' }}>{item.code}</code>
                          <CopyBtn text={item.code} />
                        </div>
                      )}
                      {item.note && <div style={{ fontSize: 12, color: '#7a8299', lineHeight: 1.6, marginBottom: item.url ? 6 : 0 }}>{item.note}</div>}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 12, color: '#a78bfa', textDecoration: 'none',
                          borderBottom: '1px solid rgba(167,139,250,0.3)',
                          paddingBottom: 1,
                        }}>{item.urlLabel ?? item.url}</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* All done state */}
      {completedCount === STEPS.length && (
        <div style={{ marginTop: 32, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '20px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>Phase 2 Setup Complete</div>
          <div style={{ fontSize: 13, color: '#7a8299' }}>Morning briefs will land in your inbox at 08:00 UAE time. Gmail and Calendar are connected. Live Data is active.</div>
        </div>
      )}
    </div>
  )
}
