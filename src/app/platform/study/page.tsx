'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, CheckCircle2, Coffee,
         BookOpen, Brain, Clock, TrendingUp, Settings2 } from 'lucide-react'

type Mode = 'focus' | 'short_break' | 'long_break'
type Session = { mode: Mode; duration: number; completedAt: string; subject?: string }

const DEFAULTS = { focus: 25, short_break: 5, long_break: 15 }
const MODE_CONFIG: Record<Mode, { label: string; color: string; bg: string; icon: typeof Brain }> = {
  focus:       { label: 'Focus',       color: 'var(--academic)', bg: 'rgba(79,142,247,0.12)', icon: Brain    },
  short_break: { label: 'Short Break', color: 'var(--fm)',       bg: 'rgba(16,185,129,0.12)',  icon: Coffee   },
  long_break:  { label: 'Long Break',  color: 'var(--saas)',     bg: 'rgba(245,158,11,0.12)',  icon: Coffee   },
}

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
}

export default function StudyTimerPage() {
  const [mode, setMode]           = useState<Mode>('focus')
  const [settings, setSettings]   = useState(DEFAULTS)
  const [timeLeft, setTimeLeft]   = useState(DEFAULTS.focus * 60)
  const [running, setRunning]     = useState(false)
  const [sessions, setSessions]   = useState<Session[]>([])
  const [pomCount, setPomCount]   = useState(0)     // completed focus sessions
  const [subject, setSubject]     = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const notifiedRef = useRef(false)

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pios_study_sessions')
      if (saved) setSessions(JSON.parse(saved).slice(0, 50))
      const savedSettings = localStorage.getItem('pios_study_settings')
      if (savedSettings) {
        const s = JSON.parse(savedSettings)
        setSettings(s)
        setTimeLeft(s.focus * 60)
      }
    } catch { /* silent */ }
  }, [])

  const saveSession = useCallback((m: Mode, dur: number) => {
    const sess: Session = {
      mode: m, duration: dur,
      completedAt: new Date().toISOString(),
      subject: subject.trim() || undefined,
    }
    setSessions(prev => {
      const updated = [sess, ...prev].slice(0, 50)
      try { localStorage.setItem('pios_study_sessions', JSON.stringify(updated)) } catch { /* silent */ }
      return updated
    })
    if (m === 'focus') {
      setPomCount(p => p + 1)
      // Log CPD via API (non-blocking)
      if (subject.trim()) {
        fetch('/api/learning-journey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log_cpd',
            title: `Focus session: ${subject.trim()}`,
            duration_minutes: dur,
            category: 'study',
            reflection: `Completed ${dur}-minute focus session on ${subject.trim()}`,
          }),
        }).catch(() => {})
      }
    }
  }, [subject])

  useEffect(() => {
    if (!running) { if (intervalRef.current) clearInterval(intervalRef.current); return }
    notifiedRef.current = false
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current!)
          setRunning(false)
          if (!notifiedRef.current) {
            notifiedRef.current = true
            saveSession(mode, settings[mode])
            // Browser notification
            if (typeof window !== 'undefined' && 'Notification' in window) {
              Notification.requestPermission().then(p => {
                if (p === 'granted') {
                  new Notification(
                    mode === 'focus' ? '🎯 Focus session complete!' : '⏰ Break over!',
                    { body: mode === 'focus' ? 'Time for a break.' : 'Back to work!', icon: '/favicon.ico' }
                  )
                }
              })
            }
          }
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, mode, settings, saveSession])

  function switchMode(m: Mode) {
    setMode(m)
    setRunning(false)
    setTimeLeft(settings[m] * 60)
    notifiedRef.current = false
  }

  function toggle() { setRunning(r => !r) }

  function reset() {
    setRunning(false)
    setTimeLeft(settings[mode] * 60)
    notifiedRef.current = false
  }

  function saveSettings(s: typeof DEFAULTS) {
    setSettings(s)
    setTimeLeft(s[mode] * 60)
    setRunning(false)
    try { localStorage.setItem('pios_study_settings', JSON.stringify(s)) } catch { /* silent */ }
    setShowSettings(false)
  }

  const cfg        = MODE_CONFIG[mode]
  const Icon       = cfg.icon
  const total      = settings[mode] * 60
  const progress   = total > 0 ? ((total - timeLeft) / total) * 100 : 0
  const radius     = 90
  const circumference = 2 * Math.PI * radius
  const strokeDash = circumference - (progress / 100) * circumference

  const focusSessions  = sessions.filter(s => s.mode === 'focus')
  const totalFocusMins = focusSessions.reduce((s, x) => s + x.duration, 0)
  const todaySessions  = focusSessions.filter(s =>
    new Date(s.completedAt).toDateString() === new Date().toDateString()
  ).length

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Study Timer</h1>
          <p className="text-sm text-[var(--pios-muted)] mt-0.5">Pomodoro focus sessions · logged to CPD</p>
        </div>
        <button onClick={() => setShowSettings(s => !s)}
          className="p-2 rounded-lg border border-[var(--pios-border)] text-[var(--pios-muted)] hover:bg-[var(--pios-surface)]">
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel current={settings} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      )}

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(MODE_CONFIG) as Mode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              background: mode === m ? cfg.bg : 'transparent',
              color:      mode === m ? cfg.color : 'var(--pios-muted)',
              border:     `1px solid ${mode === m ? cfg.color + '40' : 'var(--pios-border)'}`,
            }}>
            {MODE_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* Subject input */}
      <div className="mb-6">
        <input value={subject} onChange={e => setSubject(e.target.value)}
          placeholder="What are you studying? (optional — logged to CPD)"
          className="w-full px-3 py-2 text-sm border border-[var(--pios-border)] rounded-lg bg-background focus:outline-none focus:border-primary/60" />
      </div>

      {/* Timer circle */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative" style={{ width: 220, height: 220 }}>
          <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="110" cy="110" r={radius} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="110" cy="110" r={radius} fill="none"
              stroke={cfg.color} strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDash}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Icon className="w-5 h-5 mb-1" style={{ color: cfg.color }} />
            <span className="text-5xl font-bold font-mono" style={{ color: cfg.color }}>
              {fmt(timeLeft)}
            </span>
            <span className="text-xs mt-1" style={{ color: cfg.color + 'AA' }}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-6">
          <button onClick={reset}
            className="p-3 rounded-full border border-[var(--pios-border)] text-[var(--pios-muted)] hover:bg-[var(--pios-surface)]">
            <RotateCcw className="w-5 h-5" />
          </button>
          <button onClick={toggle}
            className="w-16 h-16 rounded-full flex items-center justify-center text-white"
            style={{ background: cfg.color }}>
            {running
              ? <Pause className="w-7 h-7" />
              : <Play  className="w-7 h-7 ml-1" />}
          </button>
          <div className="p-3 rounded-full border border-[var(--pios-border)] text-center min-w-[48px]">
            <span className="text-sm font-bold" style={{ color: cfg.color }}>{pomCount}</span>
            <div className="text-[9px] text-[var(--pios-muted)]">done</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Today',       value: todaySessions, unit: 'sessions', icon: Clock },
          { label: 'Total focus', value: totalFocusMins, unit: 'min',     icon: TrendingUp },
          { label: 'Streak',      value: pomCount,       unit: 'today',   icon: CheckCircle2 },
        ].map(({ label, value, unit, icon: I }) => (
          <div key={label} className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-3 text-center">
            <I className="w-4 h-4 mx-auto mb-1 text-[var(--pios-muted)]" />
            <div className="text-lg font-bold">{value}</div>
            <div className="text-[10px] text-[var(--pios-muted)]">{unit}</div>
            <div className="text-[10px] text-[var(--pios-muted)]">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--pios-border)]">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Recent Sessions
            </h2>
          </div>
          <div className="divide-y divide-border">
            {sessions.slice(0, 8).map((s, i) => {
              const sc = MODE_CONFIG[s.mode]
              const date = new Date(s.completedAt)
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{s.subject ?? sc.label}</span>
                  </div>
                  <span className="text-xs text-[var(--pios-muted)]">{s.duration} min</span>
                  <span className="text-xs text-[var(--pios-muted)]">
                    {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsPanel({
  current, onSave, onClose,
}: { current: typeof DEFAULTS; onSave: (s: typeof DEFAULTS) => void; onClose: () => void }) {
  const [v, setV] = useState(current)
  return (
    <div className="bg-[var(--pios-surface)] border border-primary/20 rounded-xl p-5 mb-6">
      <h3 className="text-sm font-semibold mb-4">Timer Settings (minutes)</h3>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {([['focus','Focus'], ['short_break','Short Break'], ['long_break','Long Break']] as const).map(([k, label]) => (
          <div key={k}>
            <label className="text-xs text-[var(--pios-muted)] mb-1 block">{label}</label>
            <input type="number" min={1} max={90} value={v[k]}
              onChange={e => setV(p => ({ ...p, [k]: Math.max(1, Math.min(90, +e.target.value)) }))}
              className="w-full px-3 py-2 text-sm border border-[var(--pios-border)] rounded-lg bg-background focus:outline-none" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => onSave(v)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
          Save
        </button>
        <button onClick={onClose}
          className="px-4 py-2 text-[var(--pios-muted)] border border-[var(--pios-border)] rounded-lg text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}
