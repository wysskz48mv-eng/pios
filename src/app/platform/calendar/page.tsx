'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { domainColour, domainLabel } from '@/lib/utils'

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])
  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7)
    const { data } = await supabase.from('calendar_events').select('*').eq('user_id',user.id).gte('start_time',weekStart.toISOString()).lte('start_time',weekEnd.toISOString()).order('start_time')
    setEvents(data ?? [])
    setLoading(false)
  }

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const today = new Date()
  const weekDays = Array.from({length:7},(_,i)=>{ const d=new Date(today); d.setDate(today.getDate()-today.getDay()+i); return d })

  return (
    <div className="fade-in">
      <div style={{ marginBottom:'24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, marginBottom:'4px' }}>Calendar</h1>
          <p style={{ fontSize:'13px', color:'var(--pios-muted)' }}>AI-scheduled · Google Calendar synced</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button className="pios-btn pios-btn-ghost" style={{ fontSize:'12px' }}>↻ Sync Google</button>
          <button className="pios-btn pios-btn-primary" style={{ fontSize:'12px' }}>+ Event</button>
        </div>
      </div>

      {/* Week strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'8px', marginBottom:'24px' }}>
        {weekDays.map((d,i) => {
          const isToday = d.toDateString() === today.toDateString()
          const dayEvents = events.filter(e => new Date(e.start_time).toDateString() === d.toDateString())
          return (
            <div key={i} style={{
              padding:'12px 8px', borderRadius:'10px', textAlign:'center',
              background: isToday ? 'rgba(167,139,250,0.15)' : 'var(--pios-surface)',
              border: `1px solid ${isToday?'rgba(167,139,250,0.4)':'var(--pios-border)'}`,
            }}>
              <div style={{ fontSize:'11px', color:'var(--pios-dim)', marginBottom:'4px' }}>{DAYS[i]}</div>
              <div style={{ fontSize:'18px', fontWeight:700, color:isToday?'var(--ai)':'var(--pios-text)', marginBottom:'8px' }}>{d.getDate()}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                {dayEvents.slice(0,3).map(e=>(
                  <div key={e.id} style={{ fontSize:'9px', padding:'2px 4px', borderRadius:'3px', background:`${domainColour(e.domain||'personal')}30`, color:domainColour(e.domain||'personal'), overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.title}</div>
                ))}
                {dayEvents.length>3 && <div style={{ fontSize:'9px', color:'var(--pios-dim)' }}>+{dayEvents.length-3}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Events list */}
      {loading ? <p style={{ textAlign:'center', padding:'40px', color:'var(--pios-muted)' }}>Loading…</p> : events.length === 0 ? (
        <div className="pios-card" style={{ textAlign:'center', padding:'48px' }}>
          <div style={{ fontSize:'32px', marginBottom:'12px' }}>📅</div>
          <h2 style={{ fontSize:'16px', fontWeight:600, marginBottom:'8px' }}>No events this week</h2>
          <p style={{ color:'var(--pios-muted)', fontSize:'13px', marginBottom:'20px' }}>Sync your Google Calendar to see events, or add one manually.</p>
          <button className="pios-btn pios-btn-primary" style={{ fontSize:'13px' }}>Sync Google Calendar</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {events.map(e => (
            <div key={e.id} className="pios-card-sm" style={{ display:'flex', alignItems:'center', gap:'14px', borderLeft:`3px solid ${domainColour(e.domain||'personal')}` }}>
              <div style={{ textAlign:'center', minWidth:'48px' }}>
                <div style={{ fontSize:'11px', color:'var(--pios-dim)' }}>{new Date(e.start_time).toLocaleDateString('en-GB',{weekday:'short'})}</div>
                <div style={{ fontSize:'16px', fontWeight:700 }}>{new Date(e.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', fontWeight:600 }}>{e.title}</div>
                {e.location && <div style={{ fontSize:'11px', color:'var(--pios-muted)' }}>{e.location}</div>}
              </div>
              <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'20px', background:`${domainColour(e.domain||'personal')}20`, color:domainColour(e.domain||'personal') }}>{domainLabel(e.domain||'personal')}</span>
              {e.is_ai_blocked && <span style={{ fontSize:'10px', color:'var(--ai)', padding:'2px 8px', borderRadius:'20px', background:'rgba(167,139,250,0.1)' }}>AI blocked</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
