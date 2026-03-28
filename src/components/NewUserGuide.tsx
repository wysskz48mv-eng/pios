'use client'
/**
 * NewUserGuide — shown on dashboard when user has no data yet
 * Provides actionable first steps with links to relevant pages.
 * VeritasIQ Technologies Ltd · PIOS
 */
import { useRouter } from 'next/navigation'

interface DashboardData {
  tasks?:   { total: number }
  okrs?:    { total: number }
  profile?: { onboarded: boolean; cv_status?: string }
  credits?: { used: number; limit: number }
}

interface NewUserGuideProps {
  data: DashboardData
}

const STEPS = [
  {
    id:      'cv',
    icon:    '◉',
    title:   'Calibrate NemoClaw™',
    desc:    'Upload your CV so the AI understands your background, seniority, and context. Every conversation becomes bespoke from day one.',
    action:  'Upload CV now',
    href:    '/platform/ai',
    color:   'var(--ai)',
    done:    (d: DashboardData) => d.profile?.cv_status === 'complete',
  },
  {
    id:      'okr',
    icon:    '◈',
    title:   'Set your first OKR',
    desc:    'Define what you\'re working toward this quarter. NemoClaw™ tracks progress and flags when you\'re at risk.',
    action:  'Add OKR',
    href:    '/platform/okrs',
    color:   '#1D9E75',
    done:    (d: DashboardData) => (d.okrs?.total ?? 0) > 0,
  },
  {
    id:      'task',
    icon:    '▦',
    title:   'Capture your first task',
    desc:    'Add the most important thing you need to do today. High-priority tasks appear in your morning brief.',
    action:  'Add task',
    href:    '/platform/projects',
    color:   '#4f8ef7',
    done:    (d: DashboardData) => (d.tasks?.total ?? 0) > 0,
  },
  {
    id:      'brief',
    icon:    '✦',
    title:   'Generate your morning brief',
    desc:    'Your AI daily intelligence — priorities, risks, and decisions synthesised from your live data.',
    action:  'Generate brief',
    href:    '/platform/dashboard?generate=1',
    color:   '#f0a030',
    done:    (_: DashboardData) => false,  // Always show until brief exists
  },
]

export default function NewUserGuide({ data }: NewUserGuideProps) {
  const router   = useRouter()
  const pending  = STEPS.filter(s => !s.done(data))
  const complete = STEPS.filter(s =>  s.done(data))

  if (pending.length === 0) return null

  return (
    <div style={{
      marginBottom: 24,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-sub)' }}>
          Get started — {complete.length}/{STEPS.length} steps complete
        </span>
        {complete.length > 0 && (
          <div style={{
            display: 'inline-block', marginLeft: 10,
            width: 80, height: 4, borderRadius: 2,
            background: 'var(--pios-border)', verticalAlign: 'middle', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: '#1D9E75',
              width: `${(complete.length / STEPS.length) * 100}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {pending.map(step => (
          <div
            key={step.id}
            onClick={() => router.push(step.href)}
            style={{
              padding: '14px 16px',
              borderRadius: 10,
              border: `1px solid ${step.color}25`,
              background: `${step.color}06`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = step.color + '50'
              e.currentTarget.style.background  = step.color + '0e'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = step.color + '25'
              e.currentTarget.style.background  = step.color + '06'
            }}
          >
            <span style={{ fontSize: 16, color: step.color, flexShrink: 0, marginTop: 1 }}>
              {step.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 3 }}>
                {step.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--pios-muted)', lineHeight: 1.5, marginBottom: 8 }}>
                {step.desc}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, color: step.color,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {step.action} →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
