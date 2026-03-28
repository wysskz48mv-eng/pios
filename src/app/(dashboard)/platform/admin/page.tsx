'use client'
/**
 * /platform/admin — PIOS System Administration
 * Health check · Migration runner · Seed controls · Env var audit
 * VeritasIQ Technologies Ltd
 */
import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
interface HealthCheck {
  name: string; status: 'ok' | 'warn' | 'fail'; detail?: string; ms?: number
}
interface HealthResult {
  ok: boolean; status: string; timestamp: string; latency_ms: number
  summary: { total: number; ok: number; warnings: number; failures: number }
  critical_failures: string[]; checks: HealthCheck[]
}
interface MigrationResult {
  id: string; label: string; ok: boolean; method?: string; error?: string
}
interface RunResult {
  ok: boolean; passed: number; failed: number; total: number
  results: MigrationResult[]; method?: string; error?: string; fix?: string
}

const STATUS_ICON = { ok: '✓', warn: '△', fail: '✗' }
const STATUS_COLOR = { ok: '#1D9E75', warn: '#f0a030', fail: '#e05272' }

export default function AdminPage() {
  const [health, setHealth]           = useState<HealthResult | null>(null)
  const [healthLoading, setHL]        = useState(false)
  const [migResult, setMigResult]     = useState<RunResult | null>(null)
  const [migRunning, setMigRunning]   = useState(false)
  const [seedResult, setSeedResult]   = useState<string[]>([])
  const [seedRunning, setSeedRunning] = useState(false)
  const [adminSecret, setAdminSecret] = useState('')
  const [secretSaved, setSecretSaved] = useState(false)
  const [activeTab, setActiveTab]     = useState<'health' | 'migrations' | 'seeds' | 'env'>('health')
  const [expandFailed, setExpandFailed] = useState(true)

  // Load saved secret from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('pios_admin_secret') ?? ''
    setAdminSecret(saved)
    if (saved) setSecretSaved(true)
  }, [])

  function saveSecret(v: string) {
    setAdminSecret(v)
    sessionStorage.setItem('pios_admin_secret', v)
    setSecretSaved(!!v)
  }

  const runHealth = useCallback(async () => {
    setHL(true)
    try {
      const r = await fetch('/api/health')
      setHealth(await r.json())
    } finally { setHL(false) }
  }, [])

  useEffect(() => { runHealth() }, [runHealth])

  async function runMigrations(migrationId?: string) {
    if (!adminSecret) { alert('Enter your ADMIN_SECRET first.'); return }
    setMigRunning(true); setMigResult(null)
    try {
      const r = await fetch('/api/admin/migrate-pending', {
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify(migrationId ? { migration_id: migrationId } : {}),
      })
      setMigResult(await r.json())
    } finally { setMigRunning(false) }
  }

  async function runSeed(endpoint: string) {
    setSeedRunning(true); setSeedResult([])
    try {
      const r = await fetch(endpoint, { method: 'POST' })
      const d = await r.json()
      setSeedResult(d.results ?? [d.error ?? 'Unknown result'])
    } finally { setSeedRunning(false) }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const tableChecks = health?.checks.filter(c => c.name.startsWith('table:')) ?? []
  const envChecks   = health?.checks.filter(c => c.name.startsWith('env:')) ?? []
  const sysChecks   = health?.checks.filter(c => !c.name.startsWith('table:') && !c.name.startsWith('env:')) ?? []
  const failedTables = tableChecks.filter(c => c.status === 'fail')
  const pendingMigs  = failedTables.length

  return (
    <div style={{ maxWidth: 860, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="pios-page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="pios-page-title">System Administration</h1>
            <p className="pios-page-sub">Health check · Migration runner · Seed controls · Env var audit</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {health && (
              <div style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: health.ok ? 'rgba(29,158,117,0.1)' : 'rgba(224,82,114,0.1)',
                color: health.ok ? '#1D9E75' : '#e05272',
                border: `1px solid ${health.ok ? 'rgba(29,158,117,0.3)' : 'rgba(224,82,114,0.3)'}`,
              }}>
                {health.ok ? '● HEALTHY' : '● DEGRADED'} · {health.latency_ms}ms
              </div>
            )}
            <button onClick={runHealth} disabled={healthLoading} className="pios-btn pios-btn-ghost pios-btn-sm">
              {healthLoading ? '◎' : '↻'} Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--pios-border)' }}>
        {[
          { key: 'health',     label: `◉ Health ${health ? `(${health.summary.failures} fail)` : ''}` },
          { key: 'migrations', label: `▦ Migrations ${pendingMigs > 0 ? `(${pendingMigs} tables missing)` : ''}` },
          { key: 'seeds',      label: '◈ Seeds' },
          { key: 'env',        label: `△ Env vars ${envChecks.filter(c=>c.status==='fail').length > 0 ? `(${envChecks.filter(c=>c.status==='fail').length} missing)` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
            color: activeTab === t.key ? 'var(--pios-text)' : 'var(--pios-muted)',
            cursor: 'pointer', marginBottom: -1,
            borderBottom: activeTab === t.key ? '2px solid var(--ai)' : '2px solid transparent',
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══ HEALTH TAB ══ */}
      {activeTab === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* System checks */}
          <div className="pios-card">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>System</div>
            {sysChecks.map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--pios-border)' }}>
                <span style={{ color: STATUS_COLOR[c.status], fontSize: 12, width: 14 }}>{STATUS_ICON[c.status]}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--pios-sub)' }}>{c.name}</span>
                {c.ms !== undefined && <span style={{ fontSize: 11, color: 'var(--pios-dim)' }}>{c.ms}ms</span>}
                {c.detail && <span style={{ fontSize: 11, color: STATUS_COLOR[c.status], maxWidth: 300, textAlign: 'right' }}>{c.detail}</span>}
              </div>
            ))}
          </div>

          {/* Tables */}
          <div className="pios-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Database tables ({tableChecks.filter(c=>c.status==='ok').length}/{tableChecks.length} present)
              </div>
              {failedTables.length > 0 && (
                <button onClick={() => setActiveTab('migrations')} style={{
                  fontSize: 11, color: '#e05272', background: 'rgba(224,82,114,0.08)',
                  border: '1px solid rgba(224,82,114,0.2)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                }}>
                  {failedTables.length} missing → run migrations
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {tableChecks.map(c => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 5, background: c.status === 'ok' ? 'rgba(29,158,117,0.05)' : 'rgba(224,82,114,0.05)' }}>
                  <span style={{ color: STATUS_COLOR[c.status], fontSize: 10 }}>{STATUS_ICON[c.status]}</span>
                  <span style={{ fontSize: 11, color: 'var(--pios-muted)', fontFamily: 'monospace' }}>{c.name.replace('table:', '')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ MIGRATIONS TAB ══ */}
      {activeTab === 'migrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Admin secret input */}
          <div className="pios-card">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Admin secret (ADMIN_SECRET env var)
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="password"
                className="pios-input"
                value={adminSecret}
                onChange={e => saveSecret(e.target.value)}
                placeholder="Enter ADMIN_SECRET from Vercel env"
                style={{ flex: 1, fontFamily: 'monospace' }}
              />
              {secretSaved && <span style={{ color: '#1D9E75', fontSize: 12, alignSelf: 'center' }}>✓ saved</span>}
            </div>
          </div>

          {/* Prerequisites */}
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(139,124,248,0.06)', border: '1px solid rgba(139,124,248,0.2)', fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ai)' }}>Before running:</strong> The <code style={{ fontSize: 11 }}>exec_sql</code> RPC function must exist in Supabase. If migrations fail with "Could not find the function", run{' '}
            <a href="https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/sql/new" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ai)' }}>
              00_create_exec_sql_rpc.sql ↗
            </a>{' '}
            in Supabase SQL editor first.
          </div>

          {/* Run button */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => runMigrations()}
              disabled={migRunning || !adminSecret}
              className="pios-btn pios-btn-primary"
            >
              {migRunning ? '◎ Running migrations…' : '▶ Run all pending (M019–M027)'}
            </button>
            <a
              href="https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/editor"
              target="_blank"
              rel="noopener noreferrer"
              className="pios-btn pios-btn-ghost pios-btn-sm"
            >
              Open SQL Editor ↗
            </a>
          </div>

          {/* Results */}
          {migResult && (
            <div className="pios-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: migResult.ok ? '#1D9E75' : '#e05272' }}>
                  {migResult.passed}/{migResult.total}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: migResult.ok ? '#1D9E75' : '#e05272' }}>
                    {migResult.ok ? 'All migrations applied' : `${migResult.failed} failed`}
                  </div>
                  {migResult.method && <div style={{ fontSize: 11, color: 'var(--pios-dim)' }}>via {migResult.method}</div>}
                </div>
              </div>

              {migResult.fix && (
                <div style={{ padding: '10px 14px', borderRadius: 6, background: 'rgba(224,82,114,0.08)', border: '1px solid rgba(224,82,114,0.2)', fontSize: 12, color: '#e05272', marginBottom: 14 }}>
                  💡 {migResult.fix}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(migResult.results ?? []).map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--pios-border)' }}>
                    <span style={{ color: r.ok ? '#1D9E75' : '#e05272', fontSize: 12, flexShrink: 0, marginTop: 1 }}>
                      {r.ok ? '✓' : '✗'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--pios-sub)', fontWeight: 600 }}>{r.id}</span>
                      <span style={{ fontSize: 12, color: 'var(--pios-muted)', marginLeft: 8 }}>{r.label}</span>
                      {r.error && !r.error.includes('already exists') && (
                        <div style={{ fontSize: 11, color: '#e05272', marginTop: 3, fontFamily: 'monospace' }}>{r.error.slice(0, 200)}</div>
                      )}
                    </div>
                    {r.method && <span style={{ fontSize: 10, color: 'var(--pios-dim)', flexShrink: 0 }}>{r.method}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ SEEDS TAB ══ */}
      {activeTab === 'seeds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)', margin: 0 }}>
            Seeds are idempotent — safe to run multiple times. Run NemoClaw™ first, then demo data.
          </p>

          {[
            {
              label:    'Seed NemoClaw™ + user config',
              sub:      'Calibration profile, 500 AI credits, wellness streak, intelligence prefs, Blood Oath Chronicles series',
              endpoint: '/api/admin/seed-nemoclaw',
              color:    'var(--ai)',
              icon:     '◉',
            },
            {
              label:    'Seed demo data',
              sub:      'Sample OKRs, tasks, decisions, financial snapshot — for investor demo',
              endpoint: '/api/admin/seed-demo',
              color:    '#10d9a0',
              icon:     '◈',
            },
          ].map(seed => (
            <div key={seed.label} className="pios-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ width: 4, borderRadius: 2, background: seed.color, flexShrink: 0, alignSelf: 'stretch' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 4 }}>
                  {seed.icon} {seed.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 12 }}>{seed.sub}</div>
                <button
                  onClick={() => runSeed(seed.endpoint)}
                  disabled={seedRunning}
                  className="pios-btn pios-btn-ghost pios-btn-sm"
                  style={{ borderColor: seed.color + '50', color: seed.color }}
                >
                  {seedRunning ? '◎ Running…' : `▶ Run seed`}
                </button>
              </div>
            </div>
          ))}

          {seedResult.length > 0 && (
            <div className="pios-card">
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Seed results</div>
              {seedResult.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: r.startsWith('✓') ? '#1D9E75' : r.startsWith('⚠') ? '#f0a030' : '#e05272', padding: '3px 0', fontFamily: 'monospace' }}>
                  {r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ ENV VARS TAB ══ */}
      {activeTab === 'env' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)', margin: '0 0 12px' }}>
            Shows which env vars are set. Values are never exposed — only presence is checked.
          </p>
          {[
            { group: 'Critical — app will not function without these', items: envChecks.filter(c => c.detail?.includes('critical') || c.status === 'ok' && ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ANTHROPIC_API_KEY'].some(k => c.name.includes(k))) },
            { group: 'Required for billing', items: envChecks.filter(c => c.name.includes('STRIPE')) },
            { group: 'Required for email + cron', items: envChecks.filter(c => c.name.includes('RESEND') || c.name.includes('CRON')) },
            { group: 'Optional / admin', items: envChecks.filter(c => c.name.includes('ADMIN') || c.name.includes('POOLER') || c.name.includes('POCKET')) },
          ].map(group => group.items.length === 0 ? null : (
            <div key={group.group} className="pios-card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{group.group}</div>
              {group.items.map(c => {
                const varName = c.name.replace('env:', '')
                return (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--pios-border)' }}>
                    <span style={{ color: STATUS_COLOR[c.status], fontSize: 12, width: 14 }}>{STATUS_ICON[c.status]}</span>
                    <code style={{ flex: 1, fontSize: 11, color: 'var(--pios-sub)', fontFamily: 'monospace' }}>{varName}</code>
                    <span style={{ fontSize: 11, color: STATUS_COLOR[c.status] }}>
                      {c.status === 'ok' ? 'set' : c.detail ?? 'not set'}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}

          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--pios-border)', fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.6 }}>
            Add env vars at{' '}
            <a href="https://vercel.com/wysskz48mv-eng/pios/settings/environment-variables" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ai)' }}>
              Vercel → PIOS → Settings → Environment Variables ↗
            </a>
            {' '}· After adding, redeploy to apply.
          </div>
        </div>
      )}
    </div>
  )
}
