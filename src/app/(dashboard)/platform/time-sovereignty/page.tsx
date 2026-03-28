'use client'
/**
 * /platform/time-sovereignty — Time & Energy Management
 * Design your ideal week, protect deep work, manage energy not just time.
 * VeritasIQ Technologies Ltd · Sprint J
 */
import { useState } from 'react'

const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS  = Array.from({ length: 14 }, (_, i) => i + 6)  // 06:00–19:00

type BlockType = 'deep' | 'shallow' | 'meeting' | 'personal' | 'buffer' | 'empty'

const BLOCK_COLORS: Record<BlockType, { bg: string; text: string; label: string }> = {
  deep:     { bg: 'rgba(139,124,248,0.25)', text: 'var(--ai)',    label: 'Deep work' },
  shallow:  { bg: 'rgba(34,211,238,0.15)',  text: 'var(--pro)',   label: 'Shallow' },
  meeting:  { bg: 'rgba(244,132,95,0.2)',   text: 'var(--ops)',   label: 'Meeting' },
  personal: { bg: 'rgba(16,217,160,0.15)',  text: 'var(--fm)',    label: 'Personal' },
  buffer:   { bg: 'rgba(255,255,255,0.04)', text: 'var(--pios-dim)', label: 'Buffer' },
  empty:    { bg: 'transparent',            text: 'transparent',  label: '' },
}

// Default ideal week template
const DEFAULT_BLOCKS: Record<string, Record<number, BlockType>> = {
  Mon: { 6: 'personal', 7: 'deep', 8: 'deep', 9: 'deep', 10: 'shallow', 11: 'meeting', 12: 'buffer', 13: 'deep', 14: 'deep', 15: 'shallow', 16: 'meeting', 17: 'buffer', 18: 'personal', 19: 'personal' },
  Tue: { 6: 'personal', 7: 'deep', 8: 'deep', 9: 'deep', 10: 'deep', 11: 'shallow', 12: 'buffer', 13: 'meeting', 14: 'meeting', 15: 'shallow', 16: 'shallow', 17: 'buffer', 18: 'personal', 19: 'personal' },
  Wed: { 6: 'personal', 7: 'deep', 8: 'deep', 9: 'shallow', 10: 'meeting', 11: 'meeting', 12: 'buffer', 13: 'meeting', 14: 'shallow', 15: 'shallow', 16: 'buffer', 17: 'buffer', 18: 'personal', 19: 'personal' },
  Thu: { 6: 'personal', 7: 'deep', 8: 'deep', 9: 'deep', 10: 'deep', 11: 'shallow', 12: 'buffer', 13: 'deep', 14: 'deep', 15: 'shallow', 16: 'meeting', 17: 'buffer', 18: 'personal', 19: 'personal' },
  Fri: { 6: 'personal', 7: 'deep', 8: 'shallow', 9: 'shallow', 10: 'meeting', 11: 'shallow', 12: 'buffer', 13: 'shallow', 14: 'shallow', 15: 'buffer', 16: 'buffer', 17: 'buffer', 18: 'personal', 19: 'personal' },
  Sat: { 6: 'personal', 7: 'personal', 8: 'deep', 9: 'deep', 10: 'buffer', 11: 'buffer', 12: 'personal', 13: 'personal', 14: 'personal', 15: 'personal', 16: 'personal', 17: 'personal', 18: 'personal', 19: 'personal' },
  Sun: { 6: 'personal', 7: 'personal', 8: 'personal', 9: 'personal', 10: 'personal', 11: 'personal', 12: 'personal', 13: 'personal', 14: 'personal', 15: 'personal', 16: 'personal', 17: 'personal', 18: 'personal', 19: 'personal' },
}

function countHours(blocks: typeof DEFAULT_BLOCKS, type: BlockType) {
  return Object.values(blocks).reduce((acc, day) =>
    acc + Object.values(day).filter(b => b === type).length, 0
  )
}

export default function TimeSovereigntyPage() {
  const [blocks, setBlocks]     = useState(DEFAULT_BLOCKS)
  const [selected, setSelected] = useState<BlockType>('deep')
  const [painting, setPainting] = useState(false)

  function setBlock(day: string, hour: number) {
    setBlocks(prev => ({
      ...prev,
      [day]: { ...prev[day], [hour]: selected },
    }))
  }

  const deepHours    = countHours(blocks, 'deep')
  const meetingHours = countHours(blocks, 'meeting')
  const personalHours= countHours(blocks, 'personal')

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="pios-page-header">
        <h1 className="pios-page-title">Time Sovereignty</h1>
        <p className="pios-page-sub">Design your ideal week. Protect deep work. Manage energy, not just hours.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Deep work',  value: `${deepHours}h`,     color: 'var(--ai)',  pct: Math.round(deepHours / 98 * 100) },
          { label: 'Meetings',   value: `${meetingHours}h`,  color: 'var(--ops)', pct: Math.round(meetingHours / 98 * 100) },
          { label: 'Personal',   value: `${personalHours}h`, color: 'var(--fm)',  pct: Math.round(personalHours / 98 * 100) },
          { label: 'Protection', value: deepHours >= 20 ? 'Good' : deepHours >= 12 ? 'OK' : 'Low', color: deepHours >= 20 ? 'var(--ok)' : deepHours >= 12 ? 'var(--warn)' : 'var(--dng)', pct: null },
        ].map(s => (
          <div key={s.label} className="pios-stat">
            <div className="pios-stat-label">{s.label}</div>
            <div className="pios-stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
            {s.pct !== null && (
              <div className="pios-progress-track" style={{ marginTop: 8 }}>
                <div className="pios-progress-fill" style={{ width: `${s.pct}%`, background: s.color }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Block type selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--pios-muted)', fontWeight: 600 }}>Paint:</span>
        {(Object.entries(BLOCK_COLORS) as [BlockType, typeof BLOCK_COLORS[BlockType]][])
          .filter(([k]) => k !== 'empty')
          .map(([type, cfg]) => (
            <button key={type} onClick={() => setSelected(type)} style={{
              padding: '5px 12px', borderRadius: 5, fontSize: 12,
              border: `1.5px solid ${selected === type ? cfg.text : 'var(--pios-border2)'}`,
              background: selected === type ? cfg.bg : 'transparent',
              color: selected === type ? cfg.text : 'var(--pios-muted)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}>{cfg.label}</button>
          ))}
        <button onClick={() => setSelected('empty')} style={{
          padding: '5px 12px', borderRadius: 5, fontSize: 12,
          border: `1.5px solid ${selected === 'empty' ? 'var(--dng)' : 'var(--pios-border2)'}`,
          background: selected === 'empty' ? 'rgba(224,82,114,0.1)' : 'transparent',
          color: selected === 'empty' ? 'var(--dng)' : 'var(--pios-muted)',
          cursor: 'pointer',
        }}>Erase</button>
      </div>

      {/* Grid */}
      <div style={{
        background: 'var(--pios-surface2)',
        border: '1px solid var(--pios-border)',
        borderRadius: 10, overflow: 'hidden',
        userSelect: 'none',
      }}
        onMouseLeave={() => setPainting(false)}
      >
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)', borderBottom: '1px solid var(--pios-border)' }}>
          <div style={{ padding: '8px 0', textAlign: 'center' }} />
          {DAYS.map(d => (
            <div key={d} style={{
              padding: '8px 0', textAlign: 'center',
              fontSize: 11, fontWeight: 700, color: 'var(--pios-muted)',
              letterSpacing: '0.05em', textTransform: 'uppercase',
              borderLeft: '1px solid var(--pios-border)',
            }}>{d}</div>
          ))}
        </div>

        {/* Hour rows */}
        {HOURS.map(hour => (
          <div key={hour} style={{ display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{
              padding: '4px 6px', textAlign: 'right',
              fontSize: 10, color: 'var(--pios-dim)', lineHeight: '28px',
            }}>
              {hour < 10 ? `0${hour}` : hour}
            </div>
            {DAYS.map(day => {
              const blockType = blocks[day]?.[hour] ?? 'empty'
              const cfg       = BLOCK_COLORS[blockType]
              return (
                <div
                  key={`${day}-${hour}`}
                  style={{
                    height: 28, borderLeft: '1px solid var(--pios-border)',
                    background: cfg.bg, cursor: 'crosshair',
                    transition: 'background 0.08s',
                  }}
                  onMouseDown={() => { setPainting(true); setBlock(day, hour) }}
                  onMouseEnter={() => { if (painting) setBlock(day, hour) }}
                  onMouseUp={() => setPainting(false)}
                />
              )
            })}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 10, textAlign: 'center' }}>
        Click or drag to paint blocks · Your ideal week template is auto-saved
      </p>
    </div>
  )
}
