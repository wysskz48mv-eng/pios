import { createClient } from '@/lib/supabase/server'
import { formatRelative } from '@/lib/utils'
export const dynamic = 'force-dynamic'

export default async function AcademicPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const [modulesRes, chaptersRes, sessionsRes] = await Promise.all([
    supabase.from('academic_modules').select('*').eq('user_id',user.id).order('sort_order'),
    supabase.from('thesis_chapters').select('*').eq('user_id',user.id).order('chapter_num'),
    supabase.from('supervision_sessions').select('*').eq('user_id',user.id).order('session_date',{ascending:false}).limit(5),
  ])
  const modules = modulesRes.data ?? []
  const chapters = chaptersRes.data ?? []
  const sessions = sessionsRes.data ?? []
  const totalWords = chapters.reduce((s,c) => s+(c.word_count||0), 0)
  const targetWords = chapters.reduce((s,c) => s+(c.target_words||8000), 0)

  return (
    <div className="fade-in">
      <div style={{ marginBottom:'28px', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, marginBottom:'4px' }}>Academic Lifecycle</h1>
          <p style={{ color:'var(--pios-muted)', fontSize:'13px' }}>DBA — University of Portsmouth</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button className="pios-btn pios-btn-ghost" style={{ fontSize:'12px' }}>+ Add Module</button>
          <button className="pios-btn pios-btn-primary" style={{ fontSize:'12px' }}>+ Add Chapter</button>
        </div>
      </div>

      {/* Thesis progress */}
      <div className="pios-card" style={{ marginBottom:'16px', borderLeft:'3px solid #6c8eff' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <span style={{ fontSize:'13px', fontWeight:600 }}>Thesis Progress</span>
          <span style={{ fontSize:'12px', color:'#6c8eff' }}>{totalWords.toLocaleString()} / {targetWords.toLocaleString()} words</span>
        </div>
        <div style={{ height:'8px', background:'var(--pios-surface2)', borderRadius:'4px', marginBottom:'16px' }}>
          <div style={{ height:'100%', width:`${Math.min(100,(totalWords/Math.max(targetWords,1))*100).toFixed(0)}%`, background:'#6c8eff', borderRadius:'4px', transition:'width 0.3s' }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
          {chapters.length === 0 ? (
            <p style={{ color:'var(--pios-dim)', fontSize:'12px', gridColumn:'1/-1' }}>No chapters added yet. Add your first thesis chapter to begin tracking.</p>
          ) : chapters.map(ch => (
            <div key={ch.id} className="pios-card-sm" style={{ padding:'12px' }}>
              <div style={{ fontSize:'10px', color:'var(--pios-dim)', marginBottom:'4px' }}>Ch.{ch.chapter_num}</div>
              <div style={{ fontSize:'12px', fontWeight:600, marginBottom:'6px' }}>{ch.title}</div>
              <div style={{ height:'3px', background:'var(--pios-surface2)', borderRadius:'2px', marginBottom:'6px' }}>
                <div style={{ height:'100%', width:`${Math.min(100,((ch.word_count||0)/(ch.target_words||8000))*100).toFixed(0)}%`, background:'#6c8eff', borderRadius:'2px' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'10px', padding:'1px 6px', borderRadius:'3px', background:'rgba(108,142,255,0.1)', color:'#6c8eff' }}>{ch.status.replace('_',' ')}</span>
                <span style={{ fontSize:'10px', color:'var(--pios-dim)' }}>{(ch.word_count||0).toLocaleString()}w</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
        {/* Modules */}
        <div className="pios-card">
          <div style={{ fontSize:'13px', fontWeight:600, marginBottom:'14px' }}>Programme Modules</div>
          {modules.length === 0 ? (
            <p style={{ color:'var(--pios-dim)', fontSize:'12px', textAlign:'center', padding:'20px 0' }}>No modules added yet</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {modules.map(m => (
                <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px', borderRadius:'6px', background:'var(--pios-surface2)' }}>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:500 }}>{m.title}</div>
                    {m.deadline && <div style={{ fontSize:'10px', color:'var(--pios-dim)', marginTop:'2px' }}>{formatRelative(m.deadline)}</div>}
                  </div>
                  <span style={{
                    fontSize:'10px', padding:'2px 8px', borderRadius:'20px',
                    background: m.status==='passed'?'rgba(34,197,94,0.1)':m.status==='in_progress'?'rgba(108,142,255,0.1)':'rgba(255,255,255,0.05)',
                    color: m.status==='passed'?'#22c55e':m.status==='in_progress'?'#6c8eff':'var(--pios-dim)',
                  }}>{m.status.replace('_',' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supervision */}
        <div className="pios-card">
          <div style={{ fontSize:'13px', fontWeight:600, marginBottom:'14px' }}>Supervision Log</div>
          {sessions.length === 0 ? (
            <p style={{ color:'var(--pios-dim)', fontSize:'12px', textAlign:'center', padding:'20px 0' }}>No sessions logged yet</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {sessions.map(s => (
                <div key={s.id} style={{ padding:'10px', borderRadius:'6px', background:'var(--pios-surface2)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'12px', fontWeight:500 }}>{s.supervisor || 'Supervisor'}</span>
                    <span style={{ fontSize:'10px', color:'var(--pios-dim)' }}>{formatRelative(s.session_date)}</span>
                  </div>
                  {s.notes && <p style={{ fontSize:'11px', color:'var(--pios-muted)', lineHeight:1.5 }}>{s.notes.slice(0,100)}{s.notes.length>100?'…':''}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
