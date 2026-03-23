'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  GraduationCap, Award, Target, Clock, CheckCircle2,
  AlertTriangle, Plus, RefreshCw, Loader2, ChevronRight,
  BookOpen, Star, FileText,
} from 'lucide-react'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  passed:      { bg:'#f0fdf4', text:'#15803d' },
  in_progress: { bg:'#eff6ff', text:'#1d4ed8' },
  upcoming:    { bg:'#f9fafb', text:'#6b7280' },
  overdue:     { bg:'#fef2f2', text:'#b91c1c' },
  failed:      { bg:'#fef2f2', text:'#b91c1c' },
  deferred:    { bg:'#fefce8', text:'#a16207' },
  waived:      { bg:'#f3f4f6', text:'#9ca3af' },
}

function fmt(d: string|null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

export default function LearningHubPage() {
  const [data,    setData]    = useState<any>(null)
  const [cpdData, setCpdData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'milestones'|'cpd'|'activities'>('milestones')
  const [marking, setMarking] = useState<string|null>(null)
  const [cpdForm, setCpdForm] = useState({ title:'', activity_type:'course', provider:'', hours_verifiable:'', hours_non_verifiable:'', completed_date:'', reflection:'' })
  const [savingCpd, setSavingCpd] = useState(false)
  const [showCpdForm, setShowCpdForm] = useState(false)

  const load = async () => {
    setLoading(true)
    const [ms, cpd] = await Promise.all([
      fetch('/api/learning-journey').then(r => r.json()),
      fetch('/api/learning-journey?view=cpd').then(r => r.json()),
    ])
    setData(ms)
    setCpdData(cpd)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // wizard_completed=false: show inline prompt, don't hard redirect
  const showWizardPrompt = data && !loading && data.profile?.wizard_completed === false

  async function markDone(id: string) {
    setMarking(id)
    await fetch(`/api/learning-journey?id=${id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status:'passed' }),
    })
    setData((prev: any) => ({
      ...prev,
      milestones: prev?.milestones?.map((m: any) =>
        m.id === id ? { ...m, status:'passed', completed_date: new Date().toISOString().slice(0,10) } : m
      ),
    }))
    setMarking(null)
  }

  async function logCpd() {
    setSavingCpd(true)
    await fetch('/api/learning-journey', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'log_cpd', cpd_body: data?.profile?.cpd_body, ...cpdForm }),
    })
    setSavingCpd(false)
    setShowCpdForm(false)
    setCpdForm({ title:'', activity_type:'course', provider:'', hours_verifiable:'', hours_non_verifiable:'', completed_date:'', reflection:'' })
    const cpd = await fetch('/api/learning-journey?view=cpd').then(r => r.json())
    setCpdData(cpd)
  }

  if (loading) return <div className="flex items-center justify-center p-16"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>

  const profile  = data?.profile
  const summary  = data?.summary
  const ms       = (data?.milestones ?? []) as any[]
  const cpdSum   = cpdData?.summary
  const isCpd    = profile?.persona === 'cpd_professional'

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GraduationCap size={20} className="text-purple-500" />
            Learning Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profile?.programme_name ?? profile?.persona?.replace('_',' ')} · {profile?.university ?? ''}
            {isCpd && profile?.cpd_body && ` · ${profile.cpd_body}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs text-muted-foreground hover:bg-accent">
            <RefreshCw size={12} /> Refresh
          </button>
          <Link href="/platform/learning/wizard" className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs text-muted-foreground hover:bg-accent">
            Edit setup
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Progress',      value:`${summary?.pct ?? 0}%`,        sub:`${summary?.passed ?? 0}/${summary?.total ?? 0} done`, icon:Target,       color:'#8B5CF6' },
          { label:'Overdue',       value:String(summary?.overdue ?? 0),  sub:'need attention',                                      icon:AlertTriangle, color:summary?.overdue > 0 ? '#ef4444' : '#6b7280' },
          ...(isCpd ? [
            { label:'CPD hours',   value:`${cpdSum?.totalHours ?? 0}h`,  sub:`of ${cpdSum?.target ?? 0}h target (${cpdSum?.pct ?? 0}%)`, icon:Clock, color:'#F59E0B' },
            { label:'Verifiable',  value:`${cpdSum?.verifiable ?? 0}h`,  sub:`of ${cpdSum?.verifiableTarget ?? 0}h required`,       icon:Award,        color:'#10b981' },
          ] : [
            { label:'Next due',    value: summary?.nextDue?.target_date ? fmt(summary.nextDue.target_date).split(' ').slice(0,2).join(' ') : 'None', sub: summary?.nextDue?.title?.slice(0,18) ?? '—', icon:Clock, color:'#0EA5E9' },
            { label:'Completed',   value:String(summary?.passed ?? 0),   sub:'milestones passed',                                   icon:CheckCircle2,  color:'#10b981' },
          ]),
        ].map(k => (
          <div key={k.label} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <k.icon size={13} style={{ color: k.color }} />
            </div>
            <p className="text-base font-bold">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {([
          ['milestones',  'Milestones'],
          ...(isCpd ? [['activities','CPD Log']] : []),
        ] as [string,string][]).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab===t ? 'border-purple-500 text-purple-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Milestones tab */}
      {tab==='milestones' && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {ms.length === 0 ? (
              <div className="p-10 text-center space-y-4">
                <div className="text-4xl">🎓</div>
                <p className="text-base font-semibold">Set up your learning journey</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  PIOS tracks your academic milestones, CPD hours, and thesis progress — configured around your programme in 2 minutes.
                </p>
                <Link
                  href="/platform/learning/wizard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}
                >
                  Start setup wizard →
                </Link>
              </div>
            ) : ms.map(m => {
              const sc = STATUS_COLORS[m.status] ?? STATUS_COLORS.upcoming
              const isOverdue = m.status === 'upcoming' && m.target_date && new Date(m.target_date) < new Date()
              return (
                <div key={m.id} className="px-4 py-3 flex items-center gap-4 hover:bg-muted/10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${m.status==='passed' ? 'line-through text-muted-foreground' : ''}`}>{m.title}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium capitalize" style={{ background:sc.bg, color:sc.text }}>
                        {isOverdue ? 'OVERDUE' : m.status.replace('_',' ')}
                      </span>
                    </div>
                    {m.target_date && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                        {m.status==='passed' ? `Completed ${fmt(m.completed_date)}` : `Due ${fmt(m.target_date)}`}
                      </p>
                    )}
                  </div>
                  {m.status !== 'passed' && m.status !== 'waived' && (
                    <button onClick={() => markDone(m.id)} disabled={marking===m.id}
                      className="flex items-center gap-1 text-xs text-green-600 hover:underline font-medium px-2 py-1 rounded hover:bg-green-50 flex-shrink-0">
                      {marking===m.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                      Mark done
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CPD activities tab */}
      {tab==='activities' && isCpd && (
        <div className="space-y-4">
          {/* CPD progress bar */}
          {cpdSum && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">CPD {new Date().getFullYear()} progress</span>
                <span className="text-muted-foreground">{cpdSum.totalHours}h / {cpdSum.target}h ({cpdSum.pct}%)</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(cpdSum.pct,100)}%`, background: cpdSum.pct>=100 ? '#10b981' : cpdSum.onTrack ? '#F59E0B' : '#ef4444' }} />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Verifiable: {cpdSum.verifiable}h / {cpdSum.verifiableTarget}h</span>
                <span>Non-verifiable: {cpdSum.nonVerifiable}h</span>
              </div>
            </div>
          )}

          {/* Log activity button */}
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium">CPD activities this year</p>
            <button onClick={() => setShowCpdForm(f => !f)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium">
              <Plus size={11} /> Log activity
            </button>
          </div>

          {/* Log CPD form */}
          {showCpdForm && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Activity title *</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="e.g. RICS Annual Conference 2026"
                    value={cpdForm.title} onChange={e => setCpdForm(p => ({...p,title:e.target.value}))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={cpdForm.activity_type} onChange={e => setCpdForm(p => ({...p,activity_type:e.target.value}))}>
                    {['course','webinar','conference','workshop','reading','podcast','mentoring','coaching','research','publication','presentation','other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Provider</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="e.g. RICS, Coursera"
                    value={cpdForm.provider} onChange={e => setCpdForm(p => ({...p,provider:e.target.value}))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Verifiable hours</label>
                  <input type="number" step="0.5" className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={cpdForm.hours_verifiable} onChange={e => setCpdForm(p => ({...p,hours_verifiable:e.target.value}))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Non-verifiable hours</label>
                  <input type="number" step="0.5" className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={cpdForm.hours_non_verifiable} onChange={e => setCpdForm(p => ({...p,hours_non_verifiable:e.target.value}))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Completion date</label>
                  <input type="date" className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={cpdForm.completed_date} onChange={e => setCpdForm(p => ({...p,completed_date:e.target.value}))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Reflection (optional)</label>
                  <textarea rows={2} className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none" placeholder="What did you learn and how will you apply it?"
                    value={cpdForm.reflection} onChange={e => setCpdForm(p => ({...p,reflection:e.target.value}))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={logCpd} disabled={savingCpd || !cpdForm.title} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-amber-500 text-white text-sm font-medium disabled:opacity-50">
                  {savingCpd ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save
                </button>
                <button onClick={() => setShowCpdForm(false)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </div>
          )}

          {/* Activities list */}
          <div className="rounded-xl border bg-card overflow-hidden">
            {(cpdData?.activities ?? []).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No CPD activities logged yet this year.</p>
            ) : (cpdData?.activities ?? []).map((a: any) => (
              <div key={a.id} className="px-4 py-3 border-b last:border-0 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.activity_type} · {a.provider ?? '—'} · {fmt(a.completed_date)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {Number(a.hours_verifiable)>0 && <p className="text-xs font-semibold text-green-600">{a.hours_verifiable}h verifiable</p>}
                  {Number(a.hours_non_verifiable)>0 && <p className="text-xs text-muted-foreground">{a.hours_non_verifiable}h non-ver.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
