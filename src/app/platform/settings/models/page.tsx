'use client'
// PIOS™ v3.3.0 | Sprint G — AI Model Routing | VeritasIQ Technologies Ltd
import { useState, useEffect } from 'react'
import { Loader2, Zap, Settings, CheckCircle2, Activity } from 'lucide-react'

interface ModelInfo { label:string; tier:string; speed:string; cost:string; best_for:string; colour:string }
interface RouteConfig { model:string; rationale:string }

const SPEED_LABEL: Record<string,string> = {fastest:'⚡ Fastest',medium:'⏱ Medium',slow:'🧠 Deep'}
const COST_LABEL:  Record<string,string> = {lowest:'💚 Lowest',medium:'💛 Medium',highest:'🔴 Highest'}

export default function ModelRoutingPage() {
  const [routes,     setRoutes]     = useState<Record<string,RouteConfig>>({})
  const [models,     setModels]     = useState<Record<string,ModelInfo>>({})
  const [taskLabels, setTaskLabels] = useState<Record<string,string>>({})
  const [defaults,   setDefaults]   = useState<Record<string,RouteConfig>>({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [testing,    setTesting]    = useState<string|null>(null)
  const [testResult, setTestResult] = useState<any>(null)
  const [benchmarking,setBenchmarking]=useState(false)
  const [benchmark,  setBenchmark]  = useState<any[]>([])
  const [localRoutes,setLocalRoutes]= useState<Record<string,string>>({})

  useEffect(() => {
    fetch('/api/ai/model-router').then(r=>r.json()).then(d => {
      if (d.ok) {
        setRoutes(d.routes)
        setModels(d.models)
        setTaskLabels(d.task_labels)
        setDefaults(d.defaults)
        const local: Record<string,string> = {}
        for (const [t,cfg] of Object.entries(d.routes as Record<string,RouteConfig>)) {
          local[t] = cfg.model
        }
        setLocalRoutes(local)
      }
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true); setSaved(false)
    try {
      const r = await fetch('/api/ai/model-router', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'save', routes: localRoutes }),
      })
      if (r.ok) setSaved(true)
    } catch {}
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
  }

  async function testRoute(task: string) {
    setTesting(task); setTestResult(null)
    const model = localRoutes[task] ?? routes[task]?.model
    try {
      const r = await fetch('/api/ai/model-router', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'test', task, model }),
      })
      const d = await r.json()
      setTestResult(d)
    } catch {}
    setTesting(null)
  }

  async function runBenchmark() {
    setBenchmarking(true); setBenchmark([])
    try {
      const r = await fetch('/api/ai/model-router', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'benchmark' }),
      })
      const d = await r.json()
      setBenchmark(d.results ?? [])
    } catch {}
    setBenchmarking(false)
  }

  const hasChanges = Object.entries(localRoutes).some(([t,m]) => m !== defaults[t]?.model)

  const S = {
    card:  {background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:12,padding:'16px 18px',marginBottom:10} as const,
    label: {fontSize:11,fontWeight:500 as const,letterSpacing:'0.08em',textTransform:'uppercase' as const,color:'var(--color-text-tertiary)',display:'block',marginBottom:6},
    btn:   (bg:string,col:string='#fff') => ({borderRadius:8,border:'none',background:bg,color:col,padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:500 as const,display:'flex',alignItems:'center' as const,gap:6}),
  }
  const C = {navy:'#0D2B52',teal:'#0A7A7A',gold:'#C9A84C'}

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'3rem',color:'var(--color-text-tertiary)',fontSize:13}}>
      <Loader2 size={16}/> Loading model routing config…
    </div>
  )

  return (
    <div style={{fontFamily:'var(--font-sans,system-ui)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:20}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:500,color:'var(--color-text-primary)',margin:0,display:'flex',alignItems:'center',gap:8}}>
            <Settings size={18} color={C.navy}/> AI Model Routing
          </h1>
          <p style={{fontSize:12,color:'var(--color-text-tertiary)',marginTop:4}}>
            Configure which Claude model handles each PIOS task. Balance speed, cost, and intelligence per workload.
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={runBenchmark} disabled={benchmarking}
            style={{...S.btn('transparent','var(--color-text-secondary)'),border:'0.5px solid var(--color-border-secondary)'}}>
            {benchmarking?<><Loader2 size={12}/>Benchmarking…</>:<><Activity size={12}/>Benchmark all</>}
          </button>
          {hasChanges && (
            <button onClick={save} disabled={saving}
              style={S.btn(saved?'#22c55e':C.navy)}>
              {saving?<><Loader2 size={12}/>Saving…</>:saved?<><CheckCircle2 size={12}/>Saved!</>:<>Save changes</>}
            </button>
          )}
        </div>
      </div>

      {/* Model cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
        {Object.entries(models).map(([modelId, info]) => (
          <div key={modelId} style={{...S.card,borderTop:`3px solid ${info.colour}`}}>
            <p style={{fontSize:14,fontWeight:500,color:'var(--color-text-primary)',marginBottom:4}}>{info.label}</p>
            <p style={{fontSize:11,color:'var(--color-text-tertiary)',marginBottom:8,lineHeight:1.5}}>{info.best_for}</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'var(--color-background-secondary)',color:'var(--color-text-secondary)'}}>{SPEED_LABEL[info.speed]}</span>
              <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'var(--color-background-secondary)',color:'var(--color-text-secondary)'}}>{COST_LABEL[info.cost]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Route configuration */}
      <div style={S.card}>
        <span style={{...S.label,marginBottom:14}}>Task routing configuration</span>
        {Object.entries(routes).map(([task, cfg]) => {
          const selectedModel = localRoutes[task] ?? cfg.model
          const modelInfo = models[selectedModel]
          const isDefault = selectedModel === defaults[task]?.model
          return (
            <div key={task} style={{display:'grid',gridTemplateColumns:'200px 1fr auto auto',gap:12,alignItems:'center',padding:'10px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
              <div>
                <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',marginBottom:2}}>{taskLabels[task]??task}</p>
                {!isDefault && <span style={{fontSize:10,color:C.gold,fontWeight:500}}>modified</span>}
              </div>

              <select value={selectedModel}
                onChange={e=>setLocalRoutes(prev=>({...prev,[task]:e.target.value}))}
                style={{fontSize:12,padding:'6px 10px',borderRadius:8,border:`1px solid ${modelInfo?.colour??'var(--color-border-secondary)'}44`,background:'var(--color-background-secondary)',color:'var(--color-text-primary)'}}>
                {Object.entries(models).map(([mid,m])=>(
                  <option key={mid} value={mid}>{m.label}</option>
                ))}
              </select>

              <p style={{fontSize:11,color:'var(--color-text-tertiary)',maxWidth:240,lineHeight:1.5}}>{cfg.rationale}</p>

              <button onClick={()=>testRoute(task)} disabled={testing===task}
                style={{...S.btn('transparent',C.navy),border:`0.5px solid ${C.navy}44`,padding:'5px 10px',fontSize:11,whiteSpace:'nowrap' as const}}>
                {testing===task?<Loader2 size={10}/>:<Zap size={10}/>}
                {testing===task?'Testing…':'Test'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Test result */}
      {testResult && (
        <div style={{...S.card,borderLeft:`3px solid ${models[testResult.model]?.colour??C.navy}`}}>
          <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:10,flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:500,color:'var(--color-text-primary)'}}>{taskLabels[testResult.task]??testResult.task}</span>
            <span style={{fontSize:11,color:'var(--color-text-tertiary)'}}>via {models[testResult.model]?.label}</span>
            <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'var(--color-background-success)',color:'var(--color-text-success)',fontWeight:500}}>{testResult.latency_ms}ms</span>
            <span style={{fontSize:11,color:'var(--color-text-tertiary)'}}>{testResult.output_tokens} tokens</span>
          </div>
          <p style={{fontSize:13,color:'var(--color-text-primary)',lineHeight:1.7,fontStyle:'italic'}}>"{testResult.response}"</p>
        </div>
      )}

      {/* Benchmark results */}
      {benchmark.length > 0 && (
        <div style={S.card}>
          <span style={{...S.label,marginBottom:12}}>Benchmark results — same prompt, all models</span>
          {benchmark.map((r:any) => {
            const m = models[r.model]
            return (
              <div key={r.model} style={{display:'grid',gridTemplateColumns:'160px 1fr auto auto',gap:12,alignItems:'center',padding:'10px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:m?.colour??'#999',flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:500,color:'var(--color-text-primary)'}}>{m?.label}</span>
                </div>
                <p style={{fontSize:12,color:'var(--color-text-secondary)',lineHeight:1.5}}>{r.ok?r.response:'Error: '+r.error}</p>
                <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'var(--color-background-secondary)',color:'var(--color-text-secondary)',fontWeight:500,whiteSpace:'nowrap' as const}}>{r.latency_ms}ms</span>
                <span style={{fontSize:11,color:'var(--color-text-tertiary)',whiteSpace:'nowrap' as const}}>{r.tokens} tok</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
