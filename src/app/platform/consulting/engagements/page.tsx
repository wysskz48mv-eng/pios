'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import ConsultingSubnav from '@/components/consulting/ConsultingSubnav'

const STEPS = [
  { step: 1, label: 'Define' },
  { step: 2, label: 'Structure' },
  { step: 3, label: 'Prioritize' },
  { step: 4, label: 'Plan' },
  { step: 5, label: 'Analyze' },
  { step: 6, label: 'Synthesize' },
  { step: 7, label: 'Recommend' },
] as const

const createEngagementSchema = z.object({
  client_name: z.string().min(2, 'Client name is required'),
  title: z.string().min(3, 'Title is required'),
  engagement_type: z.enum(['strategy', 'operations', 'change', 'commercial', 'diagnostic', 'other']),
  brief: z.string().optional(),
})

type CreateEngagementInput = z.infer<typeof createEngagementSchema>

const runFrameworkSchema = z.object({
  framework_code: z.string().min(2, 'Select a framework'),
  prompt: z.string().min(12, 'Add enough context for useful output'),
})

type RunFrameworkInput = z.infer<typeof runFrameworkSchema>

type Engagement = {
  id: string
  title: string
  client_name: string
  status: string
  current_step: number
}

type EngagementDetail = {
  engagement: Record<string, any>
  steps: Array<Record<string, any>>
  frameworks: Array<Record<string, any>>
  deliverables: Array<Record<string, any>>
}

export default function ConsultingEngagementsPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<EngagementDetail | null>(null)
  const [frameworks, setFrameworks] = useState<Array<Record<string, any>>>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<Record<string, any> | null>(null)

  const createForm = useForm<CreateEngagementInput>({
    resolver: zodResolver(createEngagementSchema),
    defaultValues: {
      client_name: '',
      title: '',
      engagement_type: 'strategy',
      brief: '',
    },
  })

  const runForm = useForm<RunFrameworkInput>({
    resolver: zodResolver(runFrameworkSchema),
    defaultValues: {
      framework_code: '',
      prompt: '',
    },
  })

  const currentStep = Number(detail?.engagement?.current_step ?? 1)
  const activeStep = Math.min(7, Math.max(1, currentStep))

  const previousStepPassed = useMemo(() => {
    if (!detail || activeStep === 1) return true
    return detail.steps.some((step) => Number(step.step_number) === activeStep - 1 && step.gate_status === 'passed')
  }, [detail, activeStep])

  const loadEngagements = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/engagements')
      const json = await response.json()
      const rows = (json.engagements ?? []) as Engagement[]
      setEngagements(rows)
      setSelectedId((current) => {
        if (!current) return rows[0]?.id ?? null
        if (!rows.some((item) => item.id === current)) return rows[0]?.id ?? null
        return current
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEngagementDetail = useCallback(async (engagementId: string) => {
    const response = await fetch(`/api/engagements/${engagementId}`)
    if (!response.ok) return
    const json = await response.json()
    setDetail(json)
  }, [])

  const loadStepFrameworks = useCallback(async (step: number) => {
    const response = await fetch(`/api/frameworks?mode=consulting&step=${step}`)
    if (!response.ok) return
    const json = await response.json()
    setFrameworks(json.frameworks ?? [])
  }, [])

  useEffect(() => {
    loadEngagements()
  }, [loadEngagements])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    loadEngagementDetail(selectedId)
  }, [loadEngagementDetail, selectedId])

  useEffect(() => {
    loadStepFrameworks(activeStep)
  }, [activeStep, loadStepFrameworks])

  async function onCreateEngagement(values: CreateEngagementInput) {
    setSaving(true)
    try {
      const response = await fetch('/api/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error ?? 'Could not create engagement')
      }
      createForm.reset({ client_name: '', title: '', engagement_type: 'strategy', brief: '' })
      await loadEngagements()
      setSelectedId(json.engagement.id)
    } catch (error) {
      createForm.setError('root', { message: error instanceof Error ? error.message : 'Create failed' })
    } finally {
      setSaving(false)
    }
  }

  async function onRunFramework(values: RunFrameworkInput) {
    if (!selectedId || !detail) return
    setRunning(true)
    setRunResult(null)
    try {
      const response = await fetch('/api/engagements/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagement_id: selectedId,
          step_number: activeStep,
          framework_code: values.framework_code,
          prompt: values.prompt,
          context: {
            client_name: detail.engagement.client_name,
            title: detail.engagement.title,
            brief: detail.engagement.brief,
          },
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error ?? 'Framework run failed')
      }
      setRunResult(json)
      runForm.setValue('prompt', '')
      await Promise.all([loadEngagements(), loadEngagementDetail(selectedId)])
    } catch (error) {
      runForm.setError('root', { message: error instanceof Error ? error.message : 'Framework run failed' })
    } finally {
      setRunning(false)
    }
  }

  async function archiveEngagement() {
    if (!selectedId) return
    await fetch(`/api/engagements/${selectedId}`, { method: 'DELETE' })
    setSelectedId(null)
    setDetail(null)
    await loadEngagements()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 500, margin: '0 0 6px', color: 'var(--pios-text)' }}>Consulting Engagement Manager</h1>
      <div style={{ color: 'var(--pios-muted)', marginBottom: 12, fontSize: 13 }}>
        7-step process enforcer (Define → Recommend) with framework-based AI execution and progression gates.
      </div>

      <ConsultingSubnav />

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--pios-text)' }}>New engagement</div>

          <form onSubmit={createForm.handleSubmit(onCreateEngagement)} style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Client name" {...createForm.register('client_name')} style={inputStyle} />
            <input placeholder="Engagement title" {...createForm.register('title')} style={inputStyle} />
            <select {...createForm.register('engagement_type')} style={inputStyle}>
              <option value="strategy">Strategy</option>
              <option value="operations">Operations</option>
              <option value="change">Change</option>
              <option value="commercial">Commercial</option>
              <option value="diagnostic">Diagnostic</option>
              <option value="other">Other</option>
            </select>
            <textarea placeholder="Brief / context" {...createForm.register('brief')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />

            {createForm.formState.errors.root && <div style={errorStyle}>{createForm.formState.errors.root.message}</div>}
            <button disabled={saving} type="submit" style={primaryButtonStyle}>
              {saving ? 'Creating…' : 'Create engagement'}
            </button>
          </form>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--pios-muted)' }}>
            {loading ? 'Loading engagements…' : `${engagements.length} active engagements`}
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 8, maxHeight: 420, overflow: 'auto' }}>
            {engagements.map((engagement) => (
              <button
                key={engagement.id}
                onClick={() => setSelectedId(engagement.id)}
                style={{
                  textAlign: 'left',
                  borderRadius: 8,
                  border: `1px solid ${selectedId === engagement.id ? 'var(--ai)' : 'var(--pios-border)'}`,
                  background: selectedId === engagement.id ? 'rgba(99,73,255,0.08)' : 'transparent',
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--pios-text)', fontWeight: 600 }}>{engagement.title}</div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{engagement.client_name} · Step {engagement.current_step}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 10, padding: 16 }}>
          {!detail ? (
            <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>Select an engagement to open the 7-step workbench.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 18, color: 'var(--pios-text)', fontWeight: 500 }}>{detail.engagement.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{detail.engagement.client_name} · {detail.engagement.engagement_type}</div>
                </div>
                <button onClick={archiveEngagement} style={ghostButtonStyle}>Archive</button>
              </div>

              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6 }}>
                {STEPS.map((step) => {
                  const stepState = detail.steps.find((item) => Number(item.step_number) === step.step)
                  const isCurrent = step.step === activeStep
                  return (
                    <button
                      key={step.step}
                      onClick={() => fetch(`/api/engagements/${selectedId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ current_step: step.step }),
                      }).then(() => loadEngagementDetail(selectedId!)).then(() => loadEngagements())}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${isCurrent ? 'var(--ai)' : 'var(--pios-border)'}`,
                        background: isCurrent ? 'rgba(99,73,255,0.12)' : 'transparent',
                        padding: '7px 6px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 10, color: 'var(--pios-dim)' }}>Step {step.step}</div>
                      <div style={{ fontSize: 11, color: 'var(--pios-text)', fontWeight: 600 }}>{step.label}</div>
                      <div style={{ fontSize: 10, color: stepState?.gate_status === 'passed' ? '#22c55e' : stepState?.gate_status === 'failed' ? '#ef4444' : 'var(--pios-muted)' }}>
                        {stepState?.gate_status ?? 'pending'}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, padding: '10px 12px', border: '1px solid var(--pios-border)', borderRadius: 8, background: 'var(--pios-surface)' }}>
                <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>Progression gate</div>
                <div style={{ fontSize: 13, color: previousStepPassed ? '#22c55e' : '#ef4444' }}>
                  {previousStepPassed
                    ? `Step ${activeStep} can run (prior gate satisfied).`
                    : `Step ${activeStep} is blocked until Step ${activeStep - 1} is passed.`}
                </div>
              </div>

              <form onSubmit={runForm.handleSubmit(onRunFramework)} style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                <select {...runForm.register('framework_code')} style={inputStyle}>
                  <option value="">Select framework for this step</option>
                  {frameworks.map((framework) => (
                    <option key={framework.code} value={framework.code}>{framework.code} — {framework.name}</option>
                  ))}
                </select>
                <textarea
                  rows={5}
                  placeholder="What do you need from this framework run?"
                  {...runForm.register('prompt')}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
                {runForm.formState.errors.root && <div style={errorStyle}>{runForm.formState.errors.root.message}</div>}
                <button type="submit" disabled={!previousStepPassed || running} style={primaryButtonStyle}>
                  {running ? 'Running AI…' : 'Run framework'}
                </button>
              </form>

              {runResult && (
                <div style={{ marginTop: 14, border: '1px solid var(--pios-border)', borderRadius: 8, padding: 12, background: 'var(--pios-surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 6 }}>
                    Gate: {runResult.gate_status} · Confidence: {Math.round(Number(runResult.confidence_score ?? 0) * 100)}%
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--pios-text)' }}>
                    {JSON.stringify(runResult.response, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  border: '1px solid var(--pios-border)',
  borderRadius: 8,
  background: 'var(--pios-surface)',
  color: 'var(--pios-text)',
  fontSize: 13,
  padding: '8px 10px',
}

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 8,
  background: 'var(--ai)',
  color: '#fff',
  fontSize: 13,
  padding: '8px 12px',
  cursor: 'pointer',
}

const ghostButtonStyle: CSSProperties = {
  border: '1px solid var(--pios-border)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--pios-muted)',
  fontSize: 12,
  padding: '6px 10px',
  cursor: 'pointer',
}

const errorStyle: CSSProperties = {
  fontSize: 12,
  color: '#ef4444',
}
