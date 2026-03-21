'use client'
import { useEffect, useState, useCallback } from 'react'

const CARD: React.CSSProperties = {
  background: 'var(--pios-surface)',
  border: '1px solid var(--pios-border)',
  borderRadius: 12,
  padding: '20px 24px',
}

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--pios-dim)',
  marginBottom: 4,
}

const BIG: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1,
  color: 'var(--pios-text)',
}

const SUB: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--pios-muted)',
  marginTop: 4,
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: ok ? '#22c55e' : '#ef4444',
      marginRight: 6, flexShrink: 0,
      boxShadow: ok ? '0 0 6px rgba(34,197,94,0.5)' : '0 0 6px rgba(239,68,68,0.5)',
    }} />
  )
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: `${color}20`, color,
    }}>{children}</span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--pios-muted)', fontSize: 13 }}>
      <div style={{
        width: 14, height: 14, border: '2px solid rgba(167,139,250,0.2)',
        borderTop: '2px solid #a78bfa', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      Loading live data…
    </div>
  )
}

function formatSAR(n: number) {
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `SAR ${(n / 1_000).toFixed(0)}K`
  return `SAR ${n}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function CommandPage() {
  const [se, setSe]       = useState<any>(null)
  const [is_, setIs]      = useState<any>(null)
  const [gh, setGh]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [seR, isR, ghR] = await Promise.all([
      fetch('/api/live/sustainedge').then(r => r.json()).catch(() => ({ connected: false })),
      fetch('/api/live/investiscript').then(r => r.json()).catch(() => ({ connected: false })),
      fetch('/api/live/github').then(r => r.json()).catch(() => ({ connected: false })),
    ])
    setSe(seR)
    setIs(isR)
    setGh(ghR)
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const seData = se?.snapshot
  const isData = is_?.snapshot
  const ghRepos = gh?.repos ?? {}

  return (
    <div className="fade-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Live Command Centre</h1>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
            Real-time data across SustainEdge · InvestiScript · GitHub
            {lastRefresh && (
              <span style={{ marginLeft: 12, color: 'var(--pios-dim)' }}>
                Updated {timeAgo(lastRefresh.toISOString())}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="pios-btn pios-btn-ghost"
          style={{ fontSize: 12, gap: 6, opacity: loading ? 0.5 : 1 }}
        >
          {loading ? '⟳ Refreshing…' : '⟳ Refresh'}
        </button>
      </div>

      {/* Connection status bar */}
      <div style={{ ...CARD, marginBottom: 20, padding: '12px 20px', display: 'flex', gap: 24, flexWrap: 'wrap' as const }}>
        {[
          { label: 'SustainEdge DB', ok: se?.connected },
          { label: 'InvestiScript DB', ok: is_?.connected },
          { label: 'GitHub', ok: gh?.connected },
        ].map(({ label, ok }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
            <StatusDot ok={!!ok} />
            <span style={{ color: ok ? 'var(--pios-text)' : 'var(--pios-dim)' }}>{label}</span>
            {!ok && <span style={{ marginLeft: 6, fontSize: 11, color: '#ef4444' }}>· Not configured</span>}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--pios-dim)' }}>
          Phase 11 · Live Data Sync
        </div>
      </div>

      {/* === SUSTAINEDGE === */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...LABEL, fontSize: 12, marginBottom: 12 }}>
          ⚡ SustainEdge · Service Charge Platform
        </div>
      </div>

      {!se?.connected ? (
        <div style={{ ...CARD, marginBottom: 20, color: 'var(--pios-muted)', fontSize: 13 }}>
          {loading ? <Spinner /> : <>Configure <code>SUPABASE_SE_SERVICE_KEY</code> in Vercel to connect.</>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
          <div style={CARD}>
            <div style={LABEL}>Tenants</div>
            <div style={BIG}>{seData?.tenants?.total ?? '—'}</div>
            <div style={SUB}>{seData?.tenants?.list?.map((t: any) => t.name).join(', ') || 'No tenants yet'}</div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>Projects</div>
            <div style={BIG}>{seData?.projects?.total ?? '—'}</div>
            <div style={SUB}>{seData?.projects?.active ?? 0} active</div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>Asset Portfolio</div>
            <div style={{ ...BIG, fontSize: 18 }}>{seData?.assets?.totalValueSAR ? formatSAR(seData.assets.totalValueSAR) : '—'}</div>
            <div style={SUB}>{seData?.assets?.total ?? 0} assets registered</div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>OBE Engine</div>
            <div style={{ ...BIG, fontSize: 18 }}>
              {seData?.obe ? <Pill color={seData.obe.engine === 'python' ? '#22c55e' : '#a78bfa'}>{seData.obe.engine === 'python' ? 'Python' : 'Claude'}</Pill> : '—'}
            </div>
            <div style={SUB}>{seData?.obe?.lastRun ? `Last run ${timeAgo(seData.obe.lastRun)}` : 'No OBE runs yet'}</div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>Agent Activity</div>
            <div style={BIG}>{seData?.agents?.recentRuns ?? '—'}</div>
            <div style={SUB}>
              {seData?.agents?.byType
                ? Object.entries(seData.agents.byType).map(([k, v]) => `${k}: ${v}`).join(' · ')
                : 'No agent runs yet'}
            </div>
          </div>
        </div>
      )}

      {/* === INVESTISCRIPT === */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...LABEL, fontSize: 12, marginBottom: 12 }}>
          🔍 InvestiScript · AI Investigative Journalism
        </div>
      </div>

      {!is_?.connected ? (
        <div style={{ ...CARD, marginBottom: 20, color: 'var(--pios-muted)', fontSize: 13 }}>
          {loading ? <Spinner /> : <>Configure <code>SUPABASE_IS_SERVICE_KEY</code> in Vercel to connect.</>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
          <div style={CARD}>
            <div style={LABEL}>Total Users</div>
            <div style={BIG}>{isData?.users?.total ?? '—'}</div>
            <div style={SUB}>{isData?.users?.recentSignups ?? 0} last 30 days</div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>Active Trials</div>
            <div style={BIG}>{isData?.users?.activeTrial ?? '—'}</div>
            <div style={SUB}>{isData?.users?.expiredTrial ?? 0} expired</div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>Paid Subscribers</div>
            <div style={BIG}>{isData?.subscriptions?.total ?? '—'}</div>
            <div style={SUB}>
              {isData?.subscriptions?.byPlan
                ? Object.entries(isData.subscriptions.byPlan).map(([k, v]) => `${k}: ${v}`).join(' · ')
                : 'No paid plans yet'}
            </div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>Investigations</div>
            <div style={BIG}>{isData?.investigations?.total ?? '—'}</div>
            <div style={SUB}>{isData?.articles?.total ?? 0} articles generated</div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>API Tokens (50 calls)</div>
            <div style={{ ...BIG, fontSize: 20 }}>
              {isData?.apiUsage?.recentTokens
                ? `${(isData.apiUsage.recentTokens / 1000).toFixed(0)}K`
                : '—'}
            </div>
            <div style={SUB}>tokens used</div>
          </div>
        </div>
      )}

      {/* === GITHUB === */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...LABEL, fontSize: 12, marginBottom: 12 }}>
          ⬡ GitHub · Recent Commits
        </div>
      </div>

      {!gh?.connected ? (
        <div style={{ ...CARD, marginBottom: 20, color: 'var(--pios-muted)', fontSize: 13 }}>
          {loading ? <Spinner /> : <>Configure <code>GITHUB_PAT</code> in Vercel to connect.</>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12, marginBottom: 20 }}>
          {Object.entries(ghRepos).map(([key, repo]: [string, any]) => (
            <div key={key} style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{repo.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {repo.head && <code style={{ fontSize: 11, color: 'var(--pios-muted)', background: 'var(--pios-surface2,rgba(255,255,255,0.05))', padding: '2px 6px', borderRadius: 4 }}>{repo.head}</code>}
                  {repo.openIssues > 0 && <Pill color="#f59e0b">{repo.openIssues} issues</Pill>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {(repo.commits ?? []).map((c: any) => (
                  <div key={c.sha} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <code style={{ fontSize: 10, color: '#a78bfa', flexShrink: 0, marginTop: 2 }}>{c.sha}</code>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--pios-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--pios-dim)' }}>{c.author} · {timeAgo(c.date)}</div>
                    </div>
                  </div>
                ))}
                {(!repo.commits || repo.commits.length === 0) && (
                  <div style={{ fontSize: 12, color: 'var(--pios-dim)' }}>No commits found</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Setup guide — shown when any connection is missing */}
      {(!se?.connected || !is_?.connected || !gh?.connected) && !loading && (
        <div style={{ ...CARD, marginTop: 8, borderColor: 'rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.05)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: '#a78bfa' }}>
            ⚙ Vercel Environment Variables Needed
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, fontSize: 12 }}>
            {!se?.connected && (
              <div>
                <code style={{ color: '#f59e0b' }}>SUPABASE_SE_SERVICE_KEY</code>
                <span style={{ color: 'var(--pios-muted)', marginLeft: 8 }}>
                  → SustainEdge service role key (Supabase dashboard → Project oxqqzxvuksgzeeyhufhp → Settings → API)
                </span>
              </div>
            )}
            {!is_?.connected && (
              <div>
                <code style={{ color: '#f59e0b' }}>SUPABASE_IS_SERVICE_KEY</code>
                <span style={{ color: 'var(--pios-muted)', marginLeft: 8 }}>
                  → InvestiScript service role key (Supabase dashboard → Project dexsdwqkunnmhxcwayda → Settings → API)
                </span>
              </div>
            )}
            {!gh?.connected && (
              <div>
                <code style={{ color: '#f59e0b' }}>GITHUB_PAT</code>
                <span style={{ color: 'var(--pios-muted)', marginLeft: 8 }}>
                  → Your GitHub Personal Access Token with repo scope
                </span>
              </div>
            )}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--pios-dim)' }}>
            Add these in Vercel → PIOS project → Settings → Environment Variables → Redeploy
          </div>
        </div>
      )}
    </div>
  )
}
