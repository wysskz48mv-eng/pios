'use client'
/**
 * /platform/demo — Investor Demo Mode
 * Live platform showcase: KPIs, NemoClaw™, cross-platform metrics
 * PIOS Sprint 86 | VeritasIQ Technologies Ltd
 */
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────
interface PlatformMetric { label: string; value: string; sub?: string; color: string }
interface DemoSection { id: string; label: string; icon: string }

const SECTIONS: DemoSection[] = [
  { id: 'overview',    label: 'Platform Overview', icon: '◉' },
  { id: 'nemoclaw',   label: 'NemoClaw™ AI',       icon: '⚡' },
  { id: 'executive',  label: 'Executive OS',        icon: '🎯' },
  { id: 'academic',   label: 'Academic Module',     icon: '📚' },
  { id: 'platforms',  label: 'Live Platforms',      icon: '🌐' },
  { id: 'commercial', label: 'Commercial',          icon: '💷' },
]

const FRAMEWORKS = [
  { code:'SDL™',  name:'Structured Decomposition Logic',    color:'#9b87f5' },
  { code:'POM™',  name:'Portfolio Opportunity Matrix',      color:'#4f8ef7' },
  { code:'OAE™',  name:'Organisational Alignment Engine',   color:'#0ecfb0' },
  { code:'CVDM™', name:'Customer Value Driver Map',         color:'#f59e0b' },
  { code:'CPA™',  name:'Competitive Position Analyser',     color:'#10b981' },
  { code:'UMS™',  name:'Uncontested Market Scout',          color:'#e05274' },
  { code:'VFO™',  name:'Value Flow Optimiser',              color:'#9b87f5' },
  { code:'CFE™',  name:'Constraint & Flow Engine',          color:'#4f8ef7' },
  { code:'ADF™',  name:'Adaptive Delivery Framework',       color:'#0ecfb0' },
  { code:'GSM™',  name:'Geo-Strategic Monitor',             color:'#f59e0b' },
  { code:'SPA™',  name:'Stakeholder Power Atlas',           color:'#10b981' },
  { code:'RTE™',  name:'Risk-Tiered Escalation',            color:'#e05274' },
  { code:'IML™',  name:'Institutional Memory Layer',        color:'#9b87f5' },
]

const MODULES = [
  { name:'Executive OS',       desc:'OKRs, decisions, EOSA™ brief',       icon:'⚡', color:'var(--pro)' },
  { name:'NemoClaw™ AI',       desc:'15 proprietary frameworks, CV-calibrated', icon:'◉', color:'var(--ai)' },
  { name:'Command Centre',     desc:'7am Daily Brief, live intelligence',  icon:'📡', color:'var(--academic)' },
  { name:'IP Vault',           desc:'Trademark, patent & IP register',     icon:'🛡', color:'#9b87f5' },
  { name:'Payroll Engine',     desc:'Auto-detect, reconcile & remit',      icon:'💷', color:'var(--fm)' },
  { name:'Contract Register',  desc:'60-day renewal alerts, signing flow', icon:'📄', color:'var(--saas)' },
  { name:'Academic Hub',       desc:'DBA/PhD milestone & thesis engine',   icon:'📚', color:'var(--academic)' },
  { name:'Research Hub',       desc:'RAG search, citation guard, CFP',     icon:'🔬', color:'var(--ai3)' },
  { name:'Time Sovereignty',   desc:'TSA™ visual map, protection zones',   icon:'⏱', color:'var(--ops)' },
  { name:'Wellness Intel',     desc:'Daily check-in, streak, NemoClaw insight', icon:'❤', color:'var(--dng)' },
  { name:'Board Pack',         desc:'Auto-compiled board report + risk register', icon:'📊', color:'var(--fm)' },
  { name:'Comms Hub',          desc:'BICA™ investor comms + SIA™ signals', icon:'📨', color:'#4f8ef7' },
]

function Kpi({ label, value, sub, color }: PlatformMetric) {
  return (
    <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'16px 18px' }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:'var(--pios-dim)', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.03em', color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--pios-muted)', marginTop:5 }}>{sub}</div>}
    </div>
  )
}

function SectionBtn({ s, active, onClick }: { s: DemoSection; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:7, padding:'8px 14px', borderRadius:9,
      fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
      background: active ? 'rgba(155,135,245,0.12)' : 'transparent',
      border: active ? '1px solid rgba(155,135,245,0.3)' : '1px solid transparent',
      color: active ? 'var(--ai)' : 'var(--pios-muted)',
    }}>
      <span style={{ fontSize:14 }}>{s.icon}</span> {s.label}
    </button>
  )
}

export default function DemoPage() {
  const [active, setActive]   = useState('overview')
  const [dash,   setDash]     = useState<Record<string,any> | null>(null)
  const [veLive, setVeLive]   = useState<Record<string,any> | null>(null)
  const [isLive, setIsLive]   = useState<Record<string,any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [nemoQ,  setNemoQ]    = useState('')
  const [nemoA,  setNemoA]    = useState('')
  const [nemoLoading, setNemoLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [dashR, veR, isR] = await Promise.allSettled([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/live/veritasedge').then(r => r.json()).catch(() => ({ connected: false })),
      fetch('/api/live/investiscript').then(r => r.json()).catch(() => ({ connected: false })),
    ])
    if (dashR.status === 'fulfilled') setDash(dashR.value)
    if (veR.status   === 'fulfilled') setVeLive(veR.value)
    if (isR.status   === 'fulfilled') setIsLive(isR.value)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const askNemoClaw = async () => {
    if (!nemoQ.trim()) return
    setNemoLoading(true); setNemoA('')
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: nemoQ }],
          domainContext: 'You are being demoed to a potential investor. Be sharp, strategic, and demonstrate the depth of NemoClaw™ intelligence.',
        }),
      })
      const d = await r.json()
      setNemoA(d.reply ?? d.content ?? d.message ?? d.error ?? 'No response')
    } catch { setNemoA('Connection error — check Anthropic API key') }
    finally { setNemoLoading(false) }
  }

  const tasks        = (dash?.tasks        ?? []) as Record<string,any>[]
  const projects     = (dash?.projects     ?? []) as Record<string,any>[]
  const execSnap     = (dash?.execSnapshot ?? {}) as Record<string,any>
  const okrs         = (execSnap?.okrs     ?? []) as Record<string,any>[]
  const decisions    = (execSnap?.decisions ?? []) as Record<string,any>[]

  return (
    <div style={{ padding:'24px 28px', maxWidth:1280, margin:'0 auto' }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:16 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--ai)', background:'rgba(155,135,245,0.1)', border:'1px solid rgba(155,135,245,0.2)', padding:'3px 10px', borderRadius:20 }}>
              INVESTOR DEMO
            </span>
            <span style={{ fontSize:10, color:'var(--pios-dim)' }}>Live data · No mocks</span>
          </div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:400, letterSpacing:'-0.04em', color:'var(--pios-text)', margin:'0 0 4px' }}>
            PIOS — Personal Intelligent Operating System
          </h1>
          <p style={{ fontSize:13, color:'var(--pios-muted)', margin:0 }}>
            The AI-powered operating system for founders, executives, and researchers.
            41 modules · 15 proprietary frameworks · NemoClaw™ intelligence engine.
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/platform/dashboard" style={{ padding:'9px 18px', borderRadius:9, fontSize:12, fontWeight:600, textDecoration:'none', background:'rgba(155,135,245,0.1)', border:'1px solid rgba(155,135,245,0.25)', color:'var(--ai)' }}>
            ← Back to Dashboard
          </Link>
          <Link href="/pricing" target="_blank" style={{ padding:'9px 18px', borderRadius:9, fontSize:12, fontWeight:600, textDecoration:'none', background:'var(--ai)', color:'#fff' }}>
            View Pricing →
          </Link>
        </div>
      </div>

      {/* ── Section nav ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:24, padding:'4px 0', borderBottom:'1px solid var(--pios-border)' }}>
        {SECTIONS.map(s => <SectionBtn key={s.id} s={s} active={active===s.id} onClick={() => setActive(s.id)} />)}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION: OVERVIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {active === 'overview' && (
        <div>
          {/* KPI strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:28 }}>
            <Kpi label="Platform Modules"     value="41"    sub="Fully integrated" color="var(--ai)" />
            <Kpi label="Proprietary Frameworks" value="15" sub="NemoClaw™ IP" color="#9b87f5" />
            <Kpi label="Active Tasks"          value={loading ? '—' : String(tasks.filter(t => t.status !== 'done').length)} sub="Live from DB" color="var(--saas)" />
            <Kpi label="Active Projects"       value={loading ? '—' : String(projects.filter((p:any)=>p.status==='active').length)} sub="Live from DB" color="var(--fm)" />
            <Kpi label="Open OKRs"             value={loading ? '—' : String(okrs.length)} sub="Q2 2026" color="var(--pro)" />
            <Kpi label="Open Decisions"        value={loading ? '—' : String(decisions.length)} sub="Awaiting resolution" color="var(--academic)" />
          </div>

          {/* Module grid */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>Platform Modules (12 of 41)</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
              {MODULES.map(m => (
                <div key={m.name} style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:10, padding:'12px 14px', borderLeft:`3px solid ${m.color}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:16 }}>{m.icon}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--pios-text)' }}>{m.name}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--pios-muted)', lineHeight:1.4 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Value props */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:12 }}>
            {[
              { icon:'🎯', title:'Built for founders', body:'Executive OKR pulse, decision architecture, stakeholder CRM, IP vault, and board pack — all in one place. Replace 7 different tools.' },
              { icon:'🧠', title:'Calibrated to you', body:'Upload your CV and NemoClaw™ reads your background, selects the relevant frameworks, and adjusts its communication register to your seniority.' },
              { icon:'📡', title:'Live context, always', body:'7am Daily Brief aggregates your tasks, OKRs, expenses, academic milestones, FM news, and wellness data into one AI-curated briefing.' },
              { icon:'🌍', title:'Built for GCC & UK', body:'DBA/academic modules calibrated for University of Portsmouth. FM consulting tools referencing REGA, MOMRA, RICS. Dual-currency billing.' },
            ].map(vp => (
              <div key={vp.title} style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'16px 18px' }}>
                <div style={{ fontSize:24, marginBottom:10 }}>{vp.icon}</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--pios-text)', marginBottom:6 }}>{vp.title}</div>
                <div style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.6 }}>{vp.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION: NEMOCLAW AI
      ════════════════════════════════════════════════════════════════════════ */}
      {active === 'nemoclaw' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
            {/* Left: framework library */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>
                15 Proprietary Frameworks — NemoClaw™ IP Library
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {FRAMEWORKS.map(fw => (
                  <div key={fw.code} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:5, background:`${fw.color}18`, border:`1px solid ${fw.color}30`, color:fw.color, minWidth:52, textAlign:'center' }}>{fw.code}</span>
                    <span style={{ fontSize:12, color:'var(--pios-text)' }}>{fw.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: live NemoClaw chat */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>
                Live NemoClaw™ — Ask Anything
              </div>
              <div style={{ background:'var(--pios-surface)', border:'1px solid rgba(155,135,245,0.25)', borderRadius:12, padding:'18px' }}>
                <div style={{ fontSize:12, color:'var(--pios-muted)', marginBottom:12, lineHeight:1.6 }}>
                  NemoClaw™ is calibrated to your CV and live platform context — tasks, OKRs, decisions, wellness, IP vault, and contracts. Ask a real strategic question.
                </div>

                {/* Quick prompts */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                  {[
                    'Which framework applies to entering a new GCC market?',
                    'What should I prioritise today?',
                    'Apply SDL™ to my DBA research challenge',
                    'What OKRs are at risk this quarter?',
                  ].map(q => (
                    <button key={q} onClick={() => setNemoQ(q)} style={{ fontSize:11, padding:'5px 10px', borderRadius:6, cursor:'pointer', background:'rgba(155,135,245,0.08)', border:'1px solid rgba(155,135,245,0.2)', color:'var(--ai)', textAlign:'left' }}>
                      {q}
                    </button>
                  ))}
                </div>

                <textarea
                  value={nemoQ}
                  onChange={e => setNemoQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.metaKey && askNemoClaw()}
                  placeholder="Ask NemoClaw™ a strategic question… (⌘Enter to send)"
                  rows={3}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:9, background:'var(--pios-surface2)', border:'1px solid var(--pios-border2)', color:'var(--pios-text)', fontSize:13, resize:'vertical', fontFamily:'var(--font-sans)', boxSizing:'border-box', marginBottom:10 }}
                />
                <button
                  onClick={askNemoClaw}
                  disabled={nemoLoading || !nemoQ.trim()}
                  style={{ padding:'9px 20px', borderRadius:9, fontSize:12, fontWeight:700, cursor: nemoLoading||!nemoQ.trim() ? 'not-allowed':'pointer',
                    background: nemoLoading||!nemoQ.trim() ? 'rgba(155,135,245,0.1)':'var(--ai)',
                    color: nemoLoading||!nemoQ.trim() ? 'var(--ai)':'#fff',
                    border:'none', transition:'all 0.15s', marginBottom: nemoA ? 16 : 0 }}
                >
                  {nemoLoading ? '◉ Thinking…' : '◉ Ask NemoClaw™'}
                </button>

                {nemoA && (
                  <div style={{ background:'linear-gradient(135deg,rgba(155,135,245,0.07),rgba(79,142,247,0.04))', border:'1px solid rgba(155,135,245,0.2)', borderRadius:10, padding:'14px 16px', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,var(--ai),var(--academic))' }} />
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--ai)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>◉ NemoClaw™ Response</div>
                    <div style={{ fontSize:13, color:'var(--pios-text)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{nemoA}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION: EXECUTIVE OS
      ════════════════════════════════════════════════════════════════════════ */}
      {active === 'executive' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            {/* OKRs */}
            <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>Active OKRs</div>
              {loading ? <div style={{ color:'var(--pios-muted)', fontSize:13 }}>Loading…</div>
              : okrs.length === 0 ? (
                <div style={{ color:'var(--pios-muted)', fontSize:12, textAlign:'center', padding:'20px 0' }}>
                  No OKRs yet — <Link href="/platform/executive" style={{ color:'var(--ai)' }}>add your first OKR →</Link>
                </div>
              ) : okrs.map((o:any) => (
                <div key={o.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--pios-border)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--pios-text)' }}>{o.title}</span>
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:5,
                      background: o.health==='on_track' ? 'rgba(16,185,129,0.1)' : o.health==='at_risk' ? 'rgba(245,158,11,0.1)' : 'rgba(224,82,114,0.1)',
                      color: o.health==='on_track' ? 'var(--fm)' : o.health==='at_risk' ? 'var(--saas)' : 'var(--dng)' }}>
                      {o.health?.replace('_',' ')}
                    </span>
                  </div>
                  <div style={{ height:4, borderRadius:4, background:'var(--pios-surface2)', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:4, width:`${o.progress ?? 0}%`,
                      background: o.health==='on_track' ? 'var(--fm)' : o.health==='at_risk' ? 'var(--saas)' : 'var(--dng)' }} />
                  </div>
                  <div style={{ fontSize:10, color:'var(--pios-dim)', marginTop:3 }}>{o.progress ?? 0}% · {o.period}</div>
                </div>
              ))}
            </div>

            {/* Open decisions */}
            <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>Open Decisions</div>
              {loading ? <div style={{ color:'var(--pios-muted)', fontSize:13 }}>Loading…</div>
              : decisions.length === 0 ? (
                <div style={{ color:'var(--pios-muted)', fontSize:12, textAlign:'center', padding:'20px 0' }}>
                  No open decisions — <Link href="/platform/executive" style={{ color:'var(--ai)' }}>add one →</Link>
                </div>
              ) : decisions.map((d:any) => (
                <div key={d.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--pios-border)' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--pios-text)', marginBottom:4 }}>{d.title}</div>
                  {d.framework_used && (
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(155,135,245,0.1)', color:'var(--ai)' }}>
                      {d.framework_used}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Tasks snapshot */}
            <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>Task Snapshot (Live)</div>
              {loading ? <div style={{ color:'var(--pios-muted)', fontSize:13 }}>Loading…</div>
              : tasks.slice(0, 6).map((t:any) => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid var(--pios-border)' }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:
                    t.priority==='critical' ? 'var(--dng)' : t.priority==='high' ? 'var(--saas)' : 'var(--pios-dim)',
                    flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--pios-text)', flex:1 }}>{t.title}</span>
                  <span style={{ fontSize:10, color:'var(--pios-dim)', flexShrink:0 }}>{t.domain}</span>
                </div>
              ))}
            </div>

            {/* Projects snapshot */}
            <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>Active Projects (Live)</div>
              {loading ? <div style={{ color:'var(--pios-muted)', fontSize:13 }}>Loading…</div>
              : projects.filter((p:any)=>p.status==='active').map((p:any) => (
                <div key={p.id} style={{ padding:'8px 0', borderBottom:'1px solid var(--pios-border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <span style={{ width:7, height:7, borderRadius:2, background:p.colour ?? 'var(--ai)', flexShrink:0 }} />
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--pios-text)' }}>{p.title}</span>
                    <span style={{ fontSize:10, color:'var(--pios-dim)', marginLeft:'auto' }}>{p.progress ?? 0}%</span>
                  </div>
                  <div style={{ height:3, borderRadius:3, background:'var(--pios-surface2)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${p.progress ?? 0}%`, background:p.colour ?? 'var(--ai)', borderRadius:3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION: ACADEMIC
      ════════════════════════════════════════════════════════════════════════ */}
      {active === 'academic' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>Academic Module — DBA Track</div>
            {[
              { icon:'📖', title:'Thesis Chapter Tracker', desc:'Word count targets, velocity per chapter, AI writing assistant with STT + sensemaking grounding', href:'/platform/academic' },
              { icon:'🔬', title:'Research Hub', desc:'Semantic search across 200+ uploaded papers. Citation guard. Concept mapping. AI synthesis.', href:'/platform/research' },
              { icon:'📅', title:'CPD Engine', desc:'12 professional body frameworks (RICS, CIOB, CIBSE…). Deadline alerts. Portfolio builder.', href:'/platform/academic' },
              { icon:'🎓', title:'Supervisor Log', desc:'Session notes, action item extraction, progress metrics. Supervisor relationship health score.', href:'/platform/academic' },
              { icon:'📝', title:'AI Chapter Writer', desc:'Section-by-section NemoClaw™ drafts grounded in GCC FM context, your case sites (KSP-001, Qiddiya), and uploaded literature.', href:'/platform/academic/writer' },
              { icon:'🏆', title:'Milestone Engine', desc:'14 DBA/PhD milestones, from ethics approval to viva submission. Kanban view with deadline alerts.', href:'/platform/academic' },
            ].map(item => (
              <Link key={item.title} href={item.href} style={{ textDecoration:'none', display:'block', padding:'12px 14px', borderRadius:10, background:'var(--pios-surface)', border:'1px solid var(--pios-border)', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:16 }}>{item.icon}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--academic)' }}>{item.title}</span>
                  <span style={{ fontSize:11, color:'var(--pios-dim)', marginLeft:'auto' }}>→</span>
                </div>
                <div style={{ fontSize:11, color:'var(--pios-muted)', lineHeight:1.5 }}>{item.desc}</div>
              </Link>
            ))}
          </div>
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>DBA Research Context</div>
            <div style={{ background:'var(--pios-surface)', border:'1px solid rgba(79,142,247,0.25)', borderRadius:12, padding:'18px', marginBottom:14 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--academic)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10 }}>Research Parameters</div>
              {[
                { label:'University',      value:'University of Portsmouth' },
                { label:'Programme',       value:'Doctor of Business Administration' },
                { label:'Supervisor',      value:'Prof. Sarah Mitchell' },
                { label:'Research focus',  value:'AI-enabled FM cost forecasting in GCC' },
                { label:'Theory',          value:'Socio-Technical Systems + Sensemaking' },
                { label:'Case site 1',     value:'King Salman Park (SAR 229.6M)' },
                { label:'Case site 2',     value:'Qiddiya City (QPMO-410-CT-07922)' },
                { label:'Evidential levels', value:'L1: Technical · L2: Operational · L3: Governance' },
              ].map(r => (
                <div key={r.label} style={{ display:'flex', gap:10, padding:'6px 0', borderBottom:'1px solid var(--pios-border)', fontSize:12 }}>
                  <span style={{ color:'var(--pios-dim)', minWidth:130, flexShrink:0 }}>{r.label}</span>
                  <span style={{ color:'var(--pios-text)', fontWeight:500 }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background:'rgba(79,142,247,0.06)', border:'1px solid rgba(79,142,247,0.15)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:11, color:'var(--academic)', fontWeight:600, marginBottom:6 }}>NemoClaw™ AI is calibrated to this research context</div>
              <div style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.6 }}>
                Every AI response in the Academic module is grounded in GCC FM context, socio-technical systems theory, and your specific case sites. The AI writing assistant references your actual uploaded literature, not generic sources.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION: LIVE PLATFORMS
      ════════════════════════════════════════════════════════════════════════ */}
      {active === 'platforms' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:20, marginBottom:24 }}>

            {/* VeritasEdge */}
            <div style={{ background:'var(--pios-surface)', border:'1px solid rgba(14,207,176,0.25)', borderRadius:12, padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: veLive?.connected ? 'var(--fm)' : 'var(--dng)', boxShadow: veLive?.connected ? '0 0 6px var(--fm)' : 'none' }} />
                <span style={{ fontSize:13, fontWeight:700, color:'var(--fm)' }}>VeritasEdge™</span>
                <span style={{ fontSize:10, color:'var(--pios-dim)' }}>sustainedge.vercel.app</span>
              </div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:14 }}>GCC FM service charge intelligence platform. AI-powered OBE/LIE engines, HDCA™ allocation, REGA/MOMRA compliance.</div>
              {veLive?.connected === false ? (
                <div style={{ fontSize:11, color:'var(--saas)' }}>⚠ SUPABASE_SE_SERVICE_KEY not configured — live metrics unavailable</div>
              ) : veLive?.snapshot ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Tenants', value:veLive.snapshot.tenants ?? '—' },
                    { label:'Projects', value:veLive.snapshot.projects ?? '—' },
                    { label:'Assets', value:veLive.snapshot.assets ?? '—' },
                    { label:'OBE runs', value:veLive.snapshot.obe_runs ?? '—' },
                  ].map(m => (
                    <div key={m.label} style={{ background:'var(--pios-surface2)', borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'var(--pios-dim)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{m.label}</div>
                      <div style={{ fontSize:18, fontWeight:800, color:'var(--fm)' }}>{String(m.value)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:11, color:'var(--pios-muted)' }}>Loading live metrics…</div>
              )}
            </div>

            {/* InvestiScript */}
            <div style={{ background:'var(--pios-surface)', border:'1px solid rgba(79,142,247,0.25)', borderRadius:12, padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: isLive?.connected ? 'var(--academic)' : 'var(--dng)', boxShadow: isLive?.connected ? '0 0 6px var(--academic)' : 'none' }} />
                <span style={{ fontSize:13, fontWeight:700, color:'var(--academic)' }}>InvestiScript™</span>
                <span style={{ fontSize:10, color:'var(--pios-dim)' }}>investiscript.vercel.app</span>
              </div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:14 }}>AI-powered investigative journalism platform. 30+ AI tools, entity intelligence, publication workflow, deepfake detection.</div>
              {isLive?.connected === false ? (
                <div style={{ fontSize:11, color:'var(--saas)' }}>⚠ SUPABASE_IS_SERVICE_KEY not configured — live metrics unavailable</div>
              ) : isLive?.snapshot ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Organisations', value:isLive.snapshot.organisations ?? '—' },
                    { label:'Investigations', value:isLive.snapshot.investigations ?? '—' },
                    { label:'Scripts',        value:isLive.snapshot.scripts ?? '—' },
                    { label:'Evidence',       value:isLive.snapshot.evidence ?? '—' },
                  ].map(m => (
                    <div key={m.label} style={{ background:'var(--pios-surface2)', borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'var(--pios-dim)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{m.label}</div>
                      <div style={{ fontSize:18, fontWeight:800, color:'var(--academic)' }}>{String(m.value)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:11, color:'var(--pios-muted)' }}>Loading live metrics…</div>
              )}
            </div>

            {/* PIOS itself */}
            <div style={{ background:'var(--pios-surface)', border:'1px solid rgba(155,135,245,0.25)', borderRadius:12, padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--ai)', boxShadow:'0 0 6px var(--ai)' }} />
                <span style={{ fontSize:13, fontWeight:700, color:'var(--ai)' }}>PIOS™</span>
                <span style={{ fontSize:10, color:'var(--pios-dim)' }}>This platform</span>
              </div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:14 }}>41 modules. NemoClaw™ intelligence. Executive OS + Academic Hub + Payroll Engine + IP Vault + Wellness Intelligence.</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'Platform modules', value:'41' },
                  { label:'Prop. frameworks', value:'15' },
                  { label:'Live tasks',        value: loading ? '…' : String(tasks.filter((t:any)=>t.status!=='done').length) },
                  { label:'API routes',        value:'78+' },
                ].map(m => (
                  <div key={m.label} style={{ background:'var(--pios-surface2)', borderRadius:8, padding:'8px 10px' }}>
                    <div style={{ fontSize:9, color:'var(--pios-dim)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{m.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:'var(--ai)' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Technology stack */}
          <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'18px 20px' }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>Technology Stack</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {['Next.js 14 App Router','TypeScript','Supabase (PostgreSQL + RLS)','Anthropic Claude claude-sonnet-4-6','Vercel (3 deployments)','Tailwind CSS + Design Tokens','Stripe Billing','Resend Email','NextAuth.js v4','Railway (Python engines)','ElevenLabs TTS','OpenAI Whisper'].map(t => (
                <span key={t} style={{ fontSize:11, fontWeight:500, padding:'4px 12px', borderRadius:20, background:'var(--pios-surface2)', border:'1px solid var(--pios-border)', color:'var(--pios-text)' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION: COMMERCIAL
      ════════════════════════════════════════════════════════════════════════ */}
      {active === 'commercial' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>Pricing Model</div>
            {[
              { name:'Student', price:'£9/mo', desc:'Academic lifecycle, CPD, research tools', color:'#26aee8' },
              { name:'Professional', price:'£24/mo', desc:'Full CEO/Founder OS — all 41 modules', color:'#9b87f5', popular:true },
              { name:'Team', price:'Custom', desc:'Shared workspaces, cohort dashboard, SSO', color:'var(--fm)' },
            ].map(p => (
              <div key={p.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, background:'var(--pios-surface)', border:`1px solid ${p.color}30`, marginBottom:8, borderLeft:`3px solid ${p.color}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:p.color }}>{p.name}</span>
                    {(p as any).popular && <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:10, background:`${p.color}18`, color:p.color }}>★ Most popular</span>}
                  </div>
                  <div style={{ fontSize:11, color:'var(--pios-muted)', marginTop:2 }}>{p.desc}</div>
                </div>
                <div style={{ fontSize:16, fontWeight:800, color:p.color, flexShrink:0 }}>{p.price}</div>
              </div>
            ))}

            <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:10, padding:'14px', marginTop:16 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:10 }}>Revenue Mechanics</div>
              {[
                '14-day free trial — no credit card required',
                'Monthly recurring revenue (Stripe)',
                'Annual billing option with 20% discount',
                'Team plan scales per seat',
                'White-label licensing for enterprise (Team)',
              ].map(r => (
                <div key={r} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'4px 0', fontSize:12, color:'var(--pios-text)' }}>
                  <span style={{ color:'var(--fm)', marginTop:1, flexShrink:0 }}>✓</span> {r}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--pios-dim)', marginBottom:14 }}>Market & Opportunity</div>
            {[
              { icon:'🎯', title:'ICP', body:'Non-technical founders, senior executives, and DBA/PhD candidates who need structured intelligence — not another productivity app.' },
              { icon:'🌍', title:'Geographic focus', body:'UK and GCC (UAE, KSA, Qatar) — both markets have high concentrations of the target persona with strong appetite for premium B2B SaaS.' },
              { icon:'💡', title:'Differentiation', body:'The only platform that combines Executive OS + Academic Hub + proprietary consulting frameworks + AI calibrated to your CV. No direct competitor.' },
              { icon:'📈', title:'Network effect', body:'Each PIOS user creates knowledge entries, IP assets, and consulting engagements that compound over time — driving long-term retention and CLTV.' },
              { icon:'🔄', title:'Portfolio synergy', body:'PIOS, VeritasEdge™, and InvestiScript™ share the same Supabase + Claude + Vercel stack and target the same GCC professional market from different angles.' },
            ].map(item => (
              <div key={item.title} style={{ display:'flex', gap:12, padding:'12px 0', borderBottom:'1px solid var(--pios-border)' }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--pios-text)', marginBottom:3 }}>{item.title}</div>
                  <div style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.5 }}>{item.body}</div>
                </div>
              </div>
            ))}

            <div style={{ background:'rgba(155,135,245,0.07)', border:'1px solid rgba(155,135,245,0.2)', borderRadius:10, padding:'14px 16px', marginTop:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--ai)', marginBottom:8 }}>Current status</div>
              <div style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.7 }}>
                Three production SaaS platforms deployed and running live. VeritasEdge™ in active RFP process for Qiddiya City (QPMO-410-CT-07922, contract value TBC). All four trademarks filed with UKIPO. VeritasIQ Technologies Ltd incorporation underway. Seeking seed funding for GTM, team build-out, and GCC office establishment.
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
