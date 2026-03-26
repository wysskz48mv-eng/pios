'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, BookOpen, Award, Briefcase, Zap,
  ChevronRight, ChevronLeft, Check, Loader2, AlertCircle,
} from 'lucide-react'

const PERSONAS = [
  // ── PROFESSIONAL PERSONAS (PRIMARY) ──────────────────────────────────────
  { id:'founder',         label:'Founder / CEO',             sub:'Running one or more companies',              color:'#0d9488', features:['Daily AI Brief (7am)','Command Centre cockpit','Payroll detect engine','IP Vault + frameworks','Group strategy roadmap'],      milestones:'Professional OS', professional:true },
  { id:'consultant',      label:'Consultant / Advisor',      sub:'Client-facing advisory or interim work',     color:'#4f46e5', features:['Consulting framework engine (15 tools)','Client engagement tracker','Proposal generator','SE-MIL knowledge base','Stakeholder atlas'], milestones:'Consulting OS', professional:true },
  { id:'executive',       label:'Executive / Manager',       sub:'C-suite, director, or senior manager',       color:'#7c3aed', features:['Executive OS (EOSA™)','OKR + KPI tracker','Decision architecture','Stakeholder CRM','Board report pack'],                        milestones:'Executive OS', professional:true },
  // ── ACADEMIC / CPD PERSONAS (SECONDARY) ──────────────────────────────────
  { id:'doctoral',        label:'Doctoral Researcher',       sub:'DBA, PhD, EdD, DProf',                       color:'#8B5CF6', features:['Thesis word count','Supervisor session log','Viva preparation','Weekly writing snapshots','AI research assistant'],         milestones:'14 milestones', professional:false },
  { id:'masters',         label:"Master's Student",           sub:'MBA, MSc, MA, LLM, MArch',                   color:'#0EA5E9', features:['Module tracking','Dissertation progress','Assignment calendar','Research log','Grade tracker'],                              milestones:'11 milestones', professional:false },
  { id:'undergraduate',   label:'Undergraduate',              sub:'BA, BSc, BEng, LLB + Placement',             color:'#10B981', features:['Year planner','Module grades','Final year project tracker','Placement coordinator','Assignment deadlines'],                   milestones:'8 milestones', professional:false },
  { id:'cpd_professional',label:'CPD Professional',           sub:'RICS, ICAEW, ACCA, CIPD, CIMA, ICE…',       color:'#F59E0B', features:['CPD hours tracker','Annual declaration reminders','Ethics CPD flag','Certificate log','Multi-body support'],                  milestones:'8 CPD checkpoints', professional:false },
  { id:'short_course',    label:'Short Course / Cert',        sub:'Online course, bootcamp, certification',     color:'#F97316', features:['Course tracker','Certificate portfolio','Learning streak','Skills log','Quick milestones'],                                    milestones:'5 milestones', professional:false },
  { id:'apprentice',      label:'Apprentice',                 sub:'Degree or Higher Apprenticeship',            color:'#06B6D4', features:['Training log','Portfolio builder','EPA prep','Knowledge modules','Employer coordination'],                                     milestones:'6 milestones', professional:false },
] as const

const CPD_BODIES = [
  { id:'RICS',  name:'RICS',  sub:'20h/yr · 10h verifiable' },
  { id:'ICAEW', name:'ICAEW', sub:'20h/yr · 5h verifiable + ethics' },
  { id:'ACCA',  name:'ACCA',  sub:'40h/yr · 21h verifiable' },
  { id:'CIPD',  name:'CIPD',  sub:'30h/yr · reflective' },
  { id:'CIMA',  name:'CIMA',  sub:'40h/yr · 20h verifiable' },
  { id:'CIPS',  name:'CIPS',  sub:'30h/yr · 15h verifiable' },
  { id:'ICE',   name:'ICE',   sub:'30h/yr · 15h verifiable' },
  { id:'IET',   name:'IET',   sub:'30h/yr · 15h verifiable' },
  { id:'GMC',   name:'GMC',   sub:'50h/yr · 25h verifiable' },
  { id:'NMC',   name:'NMC',   sub:'35h/yr · all verifiable' },
  { id:'IFMA',  name:'IFMA',  sub:'30h/yr · 15h verifiable' },
  { id:'OTHER', name:'Other', sub:'Custom target' },
]

type PersonaId = typeof PERSONAS[number]['id']
type PersonaEntry = typeof PERSONAS[number]

export default function LearningWizardPage() {
  const router   = useRouter()
  const [step,    setStep]    = useState(0)
  const [persona, setPersona] = useState<PersonaId | ''>('')
  const [cpdBody, setCpdBody] = useState('')
  const [form,    setForm]    = useState({
    programme_name:'', university:'', expected_graduation:'',
    supervisor_name:'', supervisor_email:'', study_mode:'part_time',
    cpd_hours_target:'',
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string|null>(null)

  const isCpd         = persona === 'cpd_professional'
  const isProfessional = ['founder','consultant','executive'].includes(persona as string)
  const isDba  = persona === 'doctoral'
  const steps  = isProfessional ? ['Persona','Business','Review','Launch']
               : isCpd           ? ['Persona','Body','Target','Review','Launch']
               : isDba           ? ['Persona','Programme','Supervision','Review','Launch']
               :                   ['Persona','Programme','Review','Launch']

  const sel = PERSONAS.find(p => p.id === persona)
  const bod = CPD_BODIES.find(b => b.id === cpdBody)

  const C = { bg:'#070C12', card:'#0F1A26', bd:'rgba(255,255,255,0.08)', text:'#F1F5F9', sub:'#94A3B8', muted:'#64748B', gold:'#C9A84C', teal:'#0ECFB0' }
  const inp = { width:'100%', background:'#132030', border:`1px solid ${C.bd}`, borderRadius:8, padding:'9px 12px', fontSize:13, color:C.text, boxSizing:'border-box' as const }

  async function launch() {
    setSaving(true); setError(null)
    try {
      const r = await fetch('/api/learning-journey', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action: isProfessional ? 'complete_professional_wizard' : 'complete_wizard', persona,
          cpd_body:         isCpd ? cpdBody : null,
          cpd_hours_target: form.cpd_hours_target ? parseInt(form.cpd_hours_target) : 0,
          study_mode:       form.study_mode,
          supervisor_name:  form.supervisor_name || null,
          supervisor_email: form.supervisor_email || null,
          programme_name:   form.programme_name || null,
          wizard_persona:   { ...form, persona, cpdBody },
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error ?? 'Setup failed')
      router.push(d.redirect ?? (isProfessional ? '/platform/dashboard' : '/platform/learning'))
    } catch(e: unknown) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, padding:'32px 16px', fontFamily:'var(--font-sans),sans-serif' }}>
      <div style={{ maxWidth:620, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>&#127891;</div>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.text, margin:0 }}>Set up your learning journey</h1>
          <p style={{ fontSize:13, color:C.sub, marginTop:6 }}>PIOS configures itself around you — takes 2 minutes</p>
          <button onClick={() => router.push('/platform/learning')} style={{ marginTop:10, background:'none', border:'none', fontSize:12, color:C.muted, cursor:'pointer', textDecoration:'underline' }}>
            Skip for now →
          </button>
        </div>

        {/* Steps */}
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:6, marginBottom:28, flexWrap:'wrap' }}>
          {steps.map((s,i) => (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, background: i<step ? C.teal : i===step ? C.gold : C.bd, color: i<=step ? '#0a0f14' : C.muted }}>
                {i<step ? '✓' : i+1}
              </div>
              <span style={{ fontSize:10, color: i===step ? C.text : C.muted }}>{s}</span>
              {i<steps.length-1 && <div style={{ width:14, height:1, background:C.bd }} />}
            </div>
          ))}
        </div>

        {/* ── STEP 0: Persona ── */}
        {step===0 && (
          <div>
            {/* Professional (PRIMARY) */}
            <div style={{ marginBottom:16 }}>
              <p style={{ fontSize:10, fontWeight:700, color:C.teal, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 8px' }}>
                ★ Professional — Primary Mode
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {PERSONAS.filter(p => (p as any).professional).map(p => (
                  <button key={p.id} onClick={() => { setPersona(p.id); setStep(1) }}
                    style={{ background: persona===p.id ? p.color+'25' : C.card, border:`2px solid ${persona===p.id ? p.color : C.teal+'40'}`, borderRadius:12, padding:'14px 12px', cursor:'pointer', textAlign:'left' }}>
                    <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:'0 0 2px' }}>{p.label}</p>
                    <p style={{ fontSize:10, color:C.sub, margin:'0 0 6px' }}>{p.sub}</p>
                    <p style={{ fontSize:10, color:p.color, margin:0, fontWeight:600 }}>{p.milestones}</p>
                  </button>
                ))}
              </div>
            </div>
            {/* Academic / CPD (SECONDARY) */}
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:C.sub, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 8px' }}>
                Academic / CPD — Secondary Module Cluster
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {PERSONAS.filter(p => !(p as any).professional).map(p => (
                  <button key={p.id} onClick={() => { setPersona(p.id); setStep(1) }}
                    style={{ background: persona===p.id ? p.color+'20' : C.card, border:`2px solid ${persona===p.id ? p.color : C.bd}`, borderRadius:12, padding:'14px 12px', cursor:'pointer', textAlign:'left' }}>
                    <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:'0 0 2px' }}>{p.label}</p>
                    <p style={{ fontSize:10, color:C.sub, margin:'0 0 6px' }}>{p.sub}</p>
                    <p style={{ fontSize:10, color:p.color, margin:0 }}>{p.milestones}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* ── STEP 1: Business (Professional path) ── */}
        {step===1 && isProfessional && (
          <div style={{ background:C.card, border:`1px solid ${C.bd}`, borderRadius:14, padding:22 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:C.text, margin:'0 0 6px' }}>Business profile</h3>
            <p style={{ fontSize:11, color:C.sub, margin:'0 0 18px' }}>PIOS uses this to configure your Command Centre, Daily Brief, and Payroll Engine</p>
            <div style={{ display:'grid', gap:12 }}>
              {([
                ['programme_name','Company / trading name','e.g. VeritasIQ Technologies Ltd','text'],
                ['university','Industry / sector','e.g. SaaS, FM Consulting, Professional Services','text'],
              ] as [string,string,string,string][]).map(([k,l,ph,t]) => (
                <div key={k}>
                  <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>{l}</label>
                  <input type={t} placeholder={ph} value={String((form as Record<string, unknown>)[k] ?? '')} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} style={inp} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>Primary currency</label>
                <select value={form.study_mode} onChange={e => setForm(p => ({...p,study_mode:e.target.value}))} style={{ ...inp, padding:'9px 12px' }}>
                  <option value='GBP'>GBP — British Pound</option>
                  <option value='USD'>USD — US Dollar</option>
                  <option value='EUR'>EUR — Euro</option>
                  <option value='AED'>AED — UAE Dirham</option>
                  <option value='SAR'>SAR — Saudi Riyal</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: Programme (non-CPD) ── */}
        {step===1 && !isCpd && !isProfessional && (
          <div style={{ background:C.card, border:`1px solid ${C.bd}`, borderRadius:14, padding:22 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:C.text, margin:'0 0 18px' }}>Programme details</h3>
            <div style={{ display:'grid', gap:12 }}>
              {([['programme_name','Programme name','e.g. DBA — Strategy & Innovation','text'],['university','Institution','e.g. University of Portsmouth','text'],['expected_graduation','Expected completion','','date']] as [string,string,string,string][]).map(([k,l,ph,t]) => (
                <div key={k}>
                  <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>{l}</label>
                  <input type={t} placeholder={ph} value={String((form as Record<string, unknown>)[k] ?? "")} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} style={inp} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>Study mode</label>
                <select value={form.study_mode} onChange={e => setForm(p => ({...p,study_mode:e.target.value}))} style={{ ...inp, padding:'9px 12px' }}>
                  {['full_time','part_time','online','blended','distance'].map(m => <option key={m} value={m}>{m.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: CPD Body ── */}
        {step===1 && isCpd && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {CPD_BODIES.map(b => (
              <button key={b.id} onClick={() => { setCpdBody(b.id); setStep(2) }}
                style={{ background: cpdBody===b.id ? 'rgba(201,168,76,0.15)' : C.card, border:`2px solid ${cpdBody===b.id ? C.gold : C.bd}`, borderRadius:10, padding:'12px 12px', cursor:'pointer', textAlign:'left' }}>
                <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:'0 0 3px' }}>{b.name}</p>
                <p style={{ fontSize:10, color:C.sub, margin:0 }}>{b.sub}</p>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 2: Supervision (doctoral) ── */}
        {step===2 && isDba && (
          <div style={{ background:C.card, border:`1px solid ${C.bd}`, borderRadius:14, padding:22 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:C.text, margin:'0 0 18px' }}>Supervision (optional)</h3>
            <div style={{ display:'grid', gap:12 }}>
              {([['supervisor_name','Supervisor name','Prof. Jane Smith'],['supervisor_email','Supervisor email','jane@university.ac.uk']] as [string,string,string][]).map(([k,l,ph]) => (
                <div key={k}>
                  <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>{l}</label>
                  <input type="text" placeholder={ph} value={String((form as Record<string, unknown>)[k] ?? "")} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} style={inp} />
                </div>
              ))}
            </div>
            <p style={{ fontSize:11, color:C.muted, marginTop:10 }}>Enables email alerts before milestone deadlines</p>
          </div>
        )}

        {/* ── STEP 2: CPD hours target ── */}
        {step===2 && isCpd && (
          <div style={{ background:C.card, border:`1px solid ${C.bd}`, borderRadius:14, padding:22 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:C.text, margin:'0 0 12px' }}>Annual hours target</h3>
            {bod && <div style={{ background:'rgba(201,168,76,0.1)', borderRadius:8, padding:'8px 12px', marginBottom:14 }}><p style={{ fontSize:12, color:C.gold, margin:0 }}>{bod.name} requires {bod.sub}</p></div>}
            <div>
              <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>Total hours target</label>
              <input type="number" placeholder={String(bod ? parseInt(bod.sub) : 20)} value={form.cpd_hours_target} onChange={e => setForm(p => ({...p,cpd_hours_target:e.target.value}))} style={inp} />
            </div>
          </div>
        )}

        {/* ── Features review step ── */}
        {step===steps.length-2 && sel && (
          <div style={{ background:C.card, border:`1px solid ${C.bd}`, borderRadius:14, padding:22 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:C.text, margin:'0 0 6px' }}>{isProfessional ? 'Your Professional OS is ready' : 'What PIOS will track for you'}</h3>
            {isProfessional && <p style={{ fontSize:11, color:C.sub, margin:'0 0 14px' }}>Your Command Centre, Daily Brief, and all 15 NemoClaw™ consulting frameworks will be activated.</p>}
            <div style={{ display:'grid', gap:8 }}>
              {(isProfessional
                ? [...sel.features, 'Email AI (6 templates)', 'Payroll Engine', 'SE-MIL Knowledge Base', 'Group P&L Dashboard', 'Contract Register']
                : [...sel.features, 'AI Morning Brief', 'Smart Calendar', 'Task Manager', 'File Storage', 'Research Library']
              ).map((f,i) => (
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Check size={13} style={{ color: i < sel.features.length ? C.teal : C.muted, flexShrink:0 }} />
                  <span style={{ fontSize:13, color: i < sel.features.length ? C.text : C.sub }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Final launch step ── */}
        {step===steps.length-1 && (
          <div style={{ display:'grid', gap:12 }}>
            <div style={{ background:C.card, border:`1px solid ${C.bd}`, borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:C.text, margin:'0 0 14px' }}>Your setup</h3>
              {[['Journey',sel?.label],['Programme',form.programme_name||null],['Institution',form.university||null],['CPD body',cpdBody||null],['Supervisor',form.supervisor_name||null],['Milestones',sel?.milestones]].filter(([,v])=>v).map(([k,v])=>(
                <div key={String(k)} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:`1px solid ${C.bd}` }}>
                  <span style={{ fontSize:12, color:C.sub }}>{k}</span>
                  <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{String(v)}</span>
                </div>
              ))}
            </div>
            {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#f87171', display:'flex', gap:8 }}><AlertCircle size={13} style={{ marginTop:1 }} />{error}</div>}
            <button onClick={launch} disabled={saving} style={{ background:C.gold, color:'#0a0f14', border:'none', borderRadius:10, padding:14, fontSize:14, fontWeight:800, cursor: saving?'wait':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:saving?.7:1 }}>
              {saving ? <><Loader2 size={15} />Setting up…</> : <><Check size={15} />Launch my PIOS</>}
            </button>
          </div>
        )}

        {/* Navigation */}
        {step>0 && step<steps.length-1 && (
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:20 }}>
            <button onClick={() => setStep(s=>s-1)} style={{ background:'transparent', border:`1px solid ${C.bd}`, borderRadius:8, padding:'8px 16px', fontSize:13, color:C.sub, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              <ChevronLeft size={14} />Back
            </button>
            <button onClick={() => setStep(s=>s+1)} style={{ background:C.gold, border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, color:'#0a0f14', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              Continue<ChevronRight size={14} />
            </button>
          </div>
        )}
        {step===steps.length-1 && <div style={{ textAlign:'center', marginTop:12 }}><button onClick={() => setStep(s=>s-1)} style={{ background:'none', border:'none', fontSize:12, color:C.muted, cursor:'pointer' }}>← Back and edit</button></div>}
      </div>
    </div>
  )
}
