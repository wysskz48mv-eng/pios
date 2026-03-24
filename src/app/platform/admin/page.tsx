'use client'
import { useEffect, useState, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// PIOS Admin — Migration runner, platform health, system config
// Owner-only: info@sustain-intl.com
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATION_DETAILS: Record<string, { file: string; tables: string[] }> = {
  '001': { file: '001_initial_schema.sql',        tables: ['user_profiles','tasks','projects','academic_modules','calendar_events','literature_items','expenses','ai_sessions','daily_briefs'] },
  '002': { file: '002_dedup_and_seed.sql',        tables: ['user_profiles'] },
  '003': { file: '003_google_token_refresh.sql',  tables: ['user_profiles'] },
  '004': { file: '004_research_infrastructure.sql', tables: ['journal_watchlist','paper_calls','fm_news_items','database_searches'] },
  '005': { file: '005_user_feed_config.sql',      tables: ['user_feed_topics','user_feed_settings'] },
  '006': { file: '006_filing_system.sql',         tables: ['file_spaces','file_items','invoices','filing_rules','drive_scans'] },
  '007': { file: '007_payroll_expenses.sql',      tables: ['staff_members','payroll_runs','payroll_lines','expense_claims','transfer_queue','payroll_chase_log'] },
  '008': { file: '008_thesis_weekly_snapshots.sql', tables: ['thesis_weekly_snapshots'] },
  '009': { file: '009_multi_email_meeting_notes.sql', tables: ['connected_email_accounts','meeting_notes','email_items(patched)'] },
  '010': { file: '010_dba_milestones.sql',        tables: ['dba_milestones'] },
  '011': { file: '011_learning_journeys.sql',     tables: ['learning_journeys','learning_journey_steps','cpd_logs','programme_milestones'] },
  '012': { file: '012_trial_and_plan_status.sql',  tables: ['tenants(plan_status+seats_limit)','sync_plan_status trigger'] },
  '013': { file: '013_learning_hub_v2.sql',        tables: ['cpd_bodies','learning_journal_entries','learning_journeys(patched)'] },
}

const SUPABASE_URL = 'https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/sql/new'

function StatusBadge({ applied }: { applied: boolean }) {
  return (
    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:600,
      background:applied?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',
      color:applied?'#22c55e':'#ef4444' }}>
      {applied ? '✓ Applied' : '✗ Not applied'}
    </span>
  )
}

function Spinner() {
  return <div style={{ width:14, height:14, border:'2px solid rgba(167,139,250,0.2)', borderTop:'2px solid #a78bfa', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block', marginRight:6 }} />
}

export default function AdminPage() {
  const [status, setStatus]       = useState<unknown>({})
  const [loading, setLoading]     = useState(true)
  const [running, setRunning]     = useState<string|null>(null)
  const [results, setResults]     = useState<Record<string,any>>({})
  const [expanded, setExpanded]   = useState<string|null>(null)
  const [copySuccess, setCopySuccess] = useState<string|null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/migrate')
    const d = await res.json()
    if (d.status) setStatus(d.status)
    setLoading(false)
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function runMigration(id: string) {
    setRunning(id)
    // 001-007: legacy migrate route (file-based runner)
    // 008-013: run-migration route (inline SQL via pg direct connection)
    const legacyIds = ['001','002','003','004','005','006','007']
    const endpoint  = legacyIds.includes(id) ? '/api/admin/migrate' : '/api/admin/run-migration'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ migration: id }),
    })
    const d = await res.json()
    setResults(prev => ({ ...prev, [id]: d }))
    setExpanded(id)
    setRunning(null)
    if (d.status === 'applied' || d.success) loadStatus()
  }

  async function runAll() {
    setRunning('all')
    // Run legacy (001-007) then extended (008-013) migrations in sequence
    const legacyRes = await fetch('/api/admin/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_all: true }),
    })
    const legacyData = await legacyRes.json()

    const extRes = await fetch('/api/admin/run-migration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ migration: 'all' }),
    })
    const extData = await extRes.json()

    setResults(prev => ({ ...prev, all: { legacy: legacyData, extended: extData } }))
    setRunning(null)
    loadStatus()
  }

  async function copySql(id: string) {
    const res = await fetch('/api/admin/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ migration: id }),
    })
    const d = await res.json()
    if (d.sql_preview) {
      // Fetch full SQL from migration file via a dedicated endpoint
      try {
        const sqlRes = await fetch(`/api/admin/migrate/sql?id=${id}`)
        const sqlData = await sqlRes.json()
        await navigator.clipboard.writeText(sqlData.sql ?? d.sql_preview)
      } catch {
        await navigator.clipboard.writeText(d.sql_preview)
      }
      setCopySuccess(id)
      setTimeout(() => setCopySuccess(null), 2000)
    }
  }

  const appliedCount = Object.values(status).filter((s: Record<string, unknown>) => s.applied).length
  const totalCount = Object.keys(MIGRATION_DETAILS).length

  return (
    <div className="fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>PIOS Admin</h1>
        <p style={{ fontSize:13, color:'var(--pios-muted)' }}>
          Database migrations · Platform health · System config
          <span style={{ marginLeft:12, fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(239,68,68,0.1)', color:'#ef4444', fontWeight:600 }}>Owner only</span>
        </p>
      </div>

      {/* Health summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Migrations applied', value:`${appliedCount}/${totalCount}`, colour:appliedCount===totalCount?'#22c55e':'#f59e0b' },
          { label:'Platform version',   value:'v1.0.0',      colour:'#a78bfa' },
          { label:'Database',           value:'Supabase',     colour:'#6c8eff' },
          { label:'Deployment',         value:'Vercel',       colour:'#2dd4a0' },
        ].map(s=>(
          <div key={s.label} className="pios-card-sm" style={{ padding:'12px 14px' }}>
            <div style={{ fontSize:18, fontWeight:800, color:s.colour, lineHeight:1, marginBottom:3 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--pios-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Migrations */}
      <div className="pios-card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Database Migrations</div>
            <p style={{ fontSize:12, color:'var(--pios-muted)' }}>
              Run these in order. Migrations 001–003 may already be applied. 004–009 add Research, Feeds, File Intelligence, Payroll, Weekly Snapshots, and Multi-Email + Meeting Notes tables.
            </p>
          </div>
          <button
            onClick={runAll}
            disabled={running==='all' || loading}
            className="pios-btn pios-btn-primary"
            style={{ fontSize:12, flexShrink:0 }}
          >
            {running==='all' ? <><Spinner/>Running all…</> : '▶ Run all pending'}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'32px', color:'var(--pios-muted)', fontSize:13 }}>
            <Spinner/> Checking migration status…
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {Object.entries(MIGRATION_DETAILS).map(([id, details]) => {
              const st = status[id]
              const result = results[id]
              const isExpanded = expanded === id
              return (
                <div key={id} style={{ border:'1px solid var(--pios-border)', borderRadius:8, overflow:'hidden' }}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    background:st?.applied?'rgba(34,197,94,0.04)':'var(--pios-surface)',
                    cursor:'pointer',
                  }} onClick={()=>setExpanded(isExpanded?null:id)}>
                    <div style={{ width:32, height:32, borderRadius:8, background:'rgba(167,139,250,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#a78bfa', flexShrink:0 }}>
                      {id}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{st?.name ?? `Migration ${id}`}</div>
                      <div style={{ fontSize:11, color:'var(--pios-muted)' }}>{st?.description}</div>
                    </div>
                    <StatusBadge applied={st?.applied ?? false} />
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      {!st?.applied && (
                        <button
                          onClick={e=>{e.stopPropagation();runMigration(id)}}
                          disabled={running===id}
                          style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid rgba(167,139,250,0.3)', background:'rgba(167,139,250,0.08)', cursor:'pointer', color:'#a78bfa', fontWeight:600 }}
                        >
                          {running===id ? <><Spinner/>Running…</> : '▶ Run'}
                        </button>
                      )}
                      <button
                        onClick={e=>{e.stopPropagation();copySql(id)}}
                        style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid var(--pios-border)', background:'none', cursor:'pointer', color:'var(--pios-muted)' }}
                      >
                        {copySuccess===id ? '✓ Copied' : '⎘ Copy SQL'}
                      </button>
                      <a
                        href={SUPABASE_URL}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e=>e.stopPropagation()}
                        style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid rgba(34,209,194,0.3)', background:'none', color:'#22d3ee', textDecoration:'none' }}
                      >
                        Open SQL Editor →
                      </a>
                    </div>
                  </div>

                  {/* Tables created */}
                  {isExpanded && (
                    <div style={{ padding:'12px 16px', borderTop:'1px solid var(--pios-border)', background:'var(--pios-surface2)' }}>
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--pios-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Tables created</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {details.tables.map(t => (
                            <span key={t} style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:'var(--pios-surface)', border:'1px solid var(--pios-border)', fontFamily:'monospace', color:'var(--pios-muted)' }}>{t}</span>
                          ))}
                        </div>
                      </div>

                      <div style={{ fontSize:11, color:'var(--pios-dim)', marginBottom:10 }}>
                        File: <code style={{ fontFamily:'monospace' }}>supabase/migrations/{details.file}</code>
                      </div>

                      {/* Result feedback */}
                      {result && (
                        <div style={{
                          padding:'10px 14px', borderRadius:8, marginTop:8,
                          background:result.status==='applied'?'rgba(34,197,94,0.08)':result.status==='manual_required'?'rgba(167,139,250,0.08)':'rgba(239,68,68,0.08)',
                          borderLeft:`3px solid ${result.status==='applied'?'#22c55e':result.status==='manual_required'?'#a78bfa':'#ef4444'}`,
                        }}>
                          <div style={{ fontSize:12, fontWeight:600, marginBottom:4, color:result.status==='applied'?'#22c55e':result.status==='manual_required'?'#a78bfa':'#ef4444' }}>
                            {result.status==='applied' ? '✓ Applied successfully' :
                             result.status==='manual_required' ? '⚠ Manual execution required' :
                             `✗ Error: ${result.exec_error ?? result.error}`}
                          </div>
                          {result.status==='manual_required' && (
                            <div>
                              <p style={{ fontSize:11, color:'var(--pios-muted)', lineHeight:1.65, marginBottom:8 }}>{result.message}</p>
                              <ol style={{ fontSize:11, color:'var(--pios-muted)', lineHeight:1.65, paddingLeft:20, marginBottom:10 }}>
                                {result.instructions?.map((s:string,i:number) => <li key={i}>{s}</li>)}
                              </ol>
                              <div style={{ display:'flex', gap:8 }}>
                                <button onClick={()=>copySql(id)} style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid rgba(167,139,250,0.3)', background:'rgba(167,139,250,0.08)', cursor:'pointer', color:'#a78bfa' }}>
                                  {copySuccess===id ? '✓ Copied!' : '⎘ Copy full SQL'}
                                </button>
                                <a href={SUPABASE_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid rgba(34,209,194,0.3)', background:'none', color:'#22d3ee', textDecoration:'none' }}>
                                  Open Supabase SQL Editor →
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Step-by-step instructions for unapplied */}
                      {!st?.applied && !result && (
                        <div style={{ fontSize:11, color:'var(--pios-dim)', lineHeight:1.65 }}>
                          <strong style={{ color:'var(--pios-muted)' }}>To apply:</strong> Click "▶ Run" to attempt automatic execution, or "⎘ Copy SQL" → paste into Supabase SQL Editor → Run.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Run all result */}
        {results.all && (
          <div style={{ marginTop:16, padding:'14px 16px', borderRadius:8, background:'var(--pios-surface2)', border:'1px solid var(--pios-border)' }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Run All Results</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {results.all.results?.map((r: unknown) => (
                <div key={r.id} style={{ display:'flex', gap:10, alignItems:'center', fontSize:12 }}>
                  <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, fontFamily:'monospace', background:'var(--pios-surface)', border:'1px solid var(--pios-border)' }}>{r.id}</span>
                  <span style={{ flex:1 }}>{r.name}</span>
                  <span style={{ fontSize:11, color:r.status==='applied'?'#22c55e':r.status==='skipped'?'var(--pios-dim)':'#ef4444' }}>
                    {r.status==='applied'?'✓ Applied':r.status==='skipped'?'○ Skipped':'✗ Error'}
                  </span>
                </div>
              ))}
            </div>
            {results.all.message && <p style={{ fontSize:11, color:'var(--pios-dim)', marginTop:10 }}>{results.all.message}</p>}
          </div>
        )}
      </div>

      {/* Supabase direct links */}
      <div className="pios-card" style={{ marginTop:16 }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Supabase Dashboard</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {[
            { label:'SQL Editor',    url:'https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/sql/new',        colour:'#6c8eff' },
            { label:'Table Editor',  url:'https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/editor',         colour:'#22c55e' },
            { label:'Auth Users',    url:'https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/auth/users',      colour:'#f59e0b' },
            { label:'Storage',       url:'https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/storage/buckets', colour:'#2dd4a0' },
            { label:'RLS Policies',  url:'https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/auth/policies',   colour:'#a78bfa' },
            { label:'API Settings',  url:'https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/settings/api',   colour:'#e05a7a' },
          ].map(l=>(
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
              style={{ padding:'10px 14px', borderRadius:8, border:`1px solid ${l.colour}30`, background:`${l.colour}08`, textDecoration:'none', display:'block', transition:'background 0.1s' }}>
              <div style={{ fontSize:12, fontWeight:600, color:l.colour, marginBottom:2 }}>{l.label}</div>
              <div style={{ fontSize:10, color:'var(--pios-dim)' }}>open dashboard →</div>
            </a>
          ))}
        </div>
      </div>

      {/* Environment variables checklist */}
      <div className="pios-card" style={{ marginTop:16 }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Vercel Environment Variables</div>
        <p style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.65, marginBottom:14 }}>
          Set these in your Vercel project settings → Environment Variables.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {[
            { key:'NEXT_PUBLIC_SUPABASE_URL',      value:'https://vfvfulbcaurqkygjrrhh.supabase.co', required:true },
            { key:'NEXT_PUBLIC_SUPABASE_ANON_KEY', value:'Your Supabase anon key',                  required:true },
            { key:'SUPABASE_SERVICE_ROLE_KEY',     value:'Your Supabase service role key',           required:true },
            { key:'ANTHROPIC_API_KEY',             value:'sk-ant-...',                               required:true },
            { key:'NEXT_PUBLIC_APP_URL',           value:'https://pios.sustain-intl.com', required:true },
            { key:'STRIPE_SECRET_KEY',             value:'sk_live_... or sk_test_...',               required:false },
            { key:'STRIPE_WEBHOOK_SECRET',         value:'whsec_...',                                required:false },
            { key:'STRIPE_PRICE_STUDENT',          value:'price_...',                                required:false },
            { key:'STRIPE_PRICE_INDIVIDUAL',       value:'price_...',                                required:false },
            { key:'STRIPE_PRICE_PROFESSIONAL',     value:'price_...',                                required:false },
            { key:'SUPABASE_SE_SERVICE_KEY',       value:'SE project service role key (for Command Centre live data)', required:false },
            { key:'SUPABASE_IS_SERVICE_KEY',       value:'InvestiScript service role key (for Command Centre live data)', required:false },
            { key:'CRON_SECRET',                   value:'Secret token for Vercel cron jobs (Bearer auth on /api/cron/*)', required:true },
          ].map(v=>(
            <div key={v.key} style={{ display:'flex', gap:10, alignItems:'center', padding:'6px 10px', borderRadius:6, background:'var(--pios-surface2)', fontFamily:'monospace', fontSize:11 }}>
              <span style={{ fontWeight:700, color:'#a78bfa', minWidth:240 }}>{v.key}</span>
              <span style={{ flex:1, color:'var(--pios-dim)' }}>{v.value}</span>
              <span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:v.required?'rgba(239,68,68,0.1)':'rgba(100,116,139,0.1)', color:v.required?'#ef4444':'var(--pios-dim)', fontWeight:600 }}>
                {v.required?'Required':'Optional'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
