'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import ConsultingSubnav from '@/components/consulting/ConsultingSubnav'
import type {
  EngagementRisk,
  FMEngagementType,
  FMOption,
  FMPrecedent,
  FMRiskLibraryItem,
  ProbabilityLevel,
  RiskStatus,
} from '@/types/consulting'

const STEPS = [
  { step: 1, label: 'Define' },
  { step: 2, label: 'Structure' },
  { step: 3, label: 'Prioritize' },
  { step: 4, label: 'Plan' },
  { step: 5, label: 'Analyze' },
  { step: 6, label: 'Synthesize' },
  { step: 7, label: 'Recommend' },
] as const

const PHASES = [
  { code: 'setup', label: 'Setup' },
  { code: 'execution', label: 'Execution' },
  { code: 'reporting', label: 'Reporting' },
  { code: 'soft_landing', label: 'Soft Landing' },
  { code: 'closeout', label: 'Closeout' },
] as const

const createEngagementSchema = z.object({
  client_name: z.string().min(2, 'Client name is required'),
  title: z.string().min(3, 'Title is required'),
  engagement_type: z.enum(['strategy', 'operations', 'change', 'commercial', 'diagnostic', 'other']),
  fm_engagement_type_code: z.string().optional(),
  industry_sector: z.string().optional(),
  building_type: z.string().optional(),
  project_scale: z.string().optional(),
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
  current_phase?: string
  fm_engagement_type_code?: string | null
}

type EngagementDetail = {
  engagement: Record<string, any>
  steps: Array<Record<string, any>>
  frameworks: Array<Record<string, any>>
  deliverables: Array<Record<string, any>>
  risks: EngagementRisk[]
  options: FMOption[]
  stakeholders: Array<Record<string, any>>
}

type DashboardWidgets = {
  risk_heatmap: Array<{ probability: string; impact: string; count: number }>
  active_fm_engagements_by_type: Array<{ type_code: string; name: string; count: number }>
  compliance_status_percent: number
  top_risks_across_portfolio: Array<{ title: string; count: number }>
}

function toCsvRow(cells: Array<string | number | null | undefined>) {
  return cells
    .map((value) => {
      const text = String(value ?? '')
      return `"${text.replace(/"/g, '""')}"`
    })
    .join(',')
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const csv = [toCsvRow(headers), ...rows.map((row) => toCsvRow(row))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ConsultingEngagementsPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<EngagementDetail | null>(null)
  const [frameworks, setFrameworks] = useState<Array<Record<string, any>>>([])
  const [engagementTypes, setEngagementTypes] = useState<FMEngagementType[]>([])
  const [riskLibrary, setRiskLibrary] = useState<FMRiskLibraryItem[]>([])
  const [precedents, setPrecedents] = useState<FMPrecedent[]>([])
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidgets | null>(null)
  const [activeTab, setActiveTab] = useState<'workbench' | 'risks' | 'options' | 'precedents' | 'reports'>('workbench')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [generatingOptions, setGeneratingOptions] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [fmEnabled, setFmEnabled] = useState(false)
  const [reportFormat, setReportFormat] = useState<'markdown' | 'html' | 'pdf'>('html')
  const [reportColor, setReportColor] = useState('#6349ff')
  const [latestReportUrl, setLatestReportUrl] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<Record<string, any> | null>(null)
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null)
  const [riskScenario, setRiskScenario] = useState('')
  const [riskSuggestions, setRiskSuggestions] = useState<FMRiskLibraryItem[]>([])

  const createForm = useForm<CreateEngagementInput>({
    resolver: zodResolver(createEngagementSchema),
    defaultValues: {
      client_name: '',
      title: '',
      engagement_type: 'strategy',
      fm_engagement_type_code: '',
      industry_sector: '',
      building_type: '',
      project_scale: '',
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

  const riskForm = useForm<{
    risk_library_id?: string
    custom_title?: string
    custom_description?: string
    probability: ProbabilityLevel
    impact: ProbabilityLevel
    mitigation_plan?: string
  }>({
    defaultValues: {
      risk_library_id: '',
      custom_title: '',
      custom_description: '',
      probability: 'medium',
      impact: 'medium',
      mitigation_plan: '',
    },
  })

  const currentStep = Number(detail?.engagement?.current_step ?? 1)
  const activeStep = Math.min(7, Math.max(1, currentStep))
  const selectedRisk = detail?.risks?.find((risk) => risk.id === selectedRiskId) ?? detail?.risks?.[0] ?? null

  const selectedFmType = useMemo(
    () =>
      engagementTypes.find((type) => type.type_code === createForm.watch('fm_engagement_type_code')) ??
      (detail?.engagement?.fm_engagement_type_code
        ? engagementTypes.find((type) => type.type_code === detail.engagement.fm_engagement_type_code)
        : undefined),
    [createForm, detail?.engagement?.fm_engagement_type_code, engagementTypes]
  )

  const previousStepPassed = useMemo(() => {
    if (!detail || activeStep === 1) return true
    return detail.steps.some((step) => Number(step.step_number) === activeStep - 1 && step.gate_status === 'passed')
  }, [detail, activeStep])

  const riskMatrix = useMemo(() => {
    const rows = ['low', 'medium', 'high'] as const
    const cols = ['low', 'medium', 'high'] as const
    return rows.map((probability) =>
      cols.map((impact) =>
        detail?.risks?.filter((risk) => risk.probability === probability && risk.impact === impact).length ?? 0
      )
    )
  }, [detail?.risks])

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
    setSelectedRiskId((current) => current ?? json.risks?.[0]?.id ?? null)
  }, [])

  const loadStepFrameworks = useCallback(async (step: number) => {
    const response = await fetch(`/api/frameworks?mode=consulting&step=${step}`)
    if (!response.ok) return
    const json = await response.json()
    setFrameworks(json.frameworks ?? [])
  }, [])

  const loadFmBootData = useCallback(async () => {
    const [typesRes, riskRes, widgetRes] = await Promise.all([
      fetch('/api/fm/engagement-types'),
      fetch('/api/fm/risks/library?limit=120'),
      fetch('/api/fm/dashboard/widgets'),
    ])

    if (typesRes.ok) {
      const json = await typesRes.json()
      setEngagementTypes(json.engagement_types ?? [])
      setFmEnabled(true)
    } else {
      setFmEnabled(false)
    }

    if (riskRes.ok) {
      const json = await riskRes.json()
      setRiskLibrary(json.risks ?? [])
    }

    if (widgetRes.ok) {
      const json = await widgetRes.json()
      setDashboardWidgets(json)
    }
  }, [])

  useEffect(() => {
    loadEngagements()
    loadFmBootData()
  }, [loadEngagements, loadFmBootData])

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

  useEffect(() => {
    if (!riskScenario.trim()) {
      setRiskSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      const res = await fetch(`/api/fm/risks/library?suggest=${encodeURIComponent(riskScenario)}&limit=80`)
      if (!res.ok) return
      const json = await res.json()
      setRiskSuggestions(json.suggested ?? [])
    }, 450)

    return () => clearTimeout(timer)
  }, [riskScenario])

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
      createForm.reset({
        client_name: '',
        title: '',
        engagement_type: 'strategy',
        fm_engagement_type_code: '',
        industry_sector: '',
        building_type: '',
        project_scale: '',
        brief: '',
      })
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

  async function savePhase(phase: string) {
    if (!selectedId) return
    await fetch(`/api/engagements/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_phase: phase }),
    })
    await Promise.all([loadEngagements(), loadEngagementDetail(selectedId)])
  }

  async function createRisk(values: any) {
    if (!selectedId) return
    const response = await fetch(`/api/engagements/${selectedId}/risks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const json = await response.json()
    if (!response.ok) {
      riskForm.setError('root', { message: json.error ?? 'Failed to add risk' })
      return
    }

    riskForm.reset({
      risk_library_id: '',
      custom_title: '',
      custom_description: '',
      probability: 'medium',
      impact: 'medium',
      mitigation_plan: '',
    })
    await loadEngagementDetail(selectedId)
    setSelectedRiskId(json.risk?.id ?? null)
  }

  async function updateRisk(status: RiskStatus) {
    if (!selectedId || !selectedRisk) return
    await fetch(`/api/engagements/${selectedId}/risks/${selectedRisk.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mitigation_status: status,
        mitigation_plan: selectedRisk.mitigation_plan,
        notes: selectedRisk.notes,
        target_closure_date: selectedRisk.target_closure_date,
      }),
    })
    await loadEngagementDetail(selectedId)
  }

  async function deleteRisk(riskId: string) {
    if (!selectedId) return
    await fetch(`/api/engagements/${selectedId}/risks/${riskId}`, { method: 'DELETE' })
    await loadEngagementDetail(selectedId)
  }

  async function correlateRiskEmails() {
    if (!selectedId) return
    await fetch(`/api/engagements/${selectedId}/risks/correlate-email`, { method: 'POST' })
    await loadEngagementDetail(selectedId)
  }

  async function generateOptions() {
    if (!selectedId || !detail) return
    setGeneratingOptions(true)
    try {
      const response = await fetch(`/api/engagements/${selectedId}/options/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectives: detail.engagement.brief }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Failed to generate options')
      await loadEngagementDetail(selectedId)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to generate options')
    } finally {
      setGeneratingOptions(false)
    }
  }

  async function recommendOption(optionId: string) {
    if (!selectedId) return
    await fetch(`/api/engagements/${selectedId}/options/${optionId}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reasoning: 'Best value-to-risk profile for this engagement context.' }),
    })
    await loadEngagementDetail(selectedId)
  }

  async function saveOption(option: FMOption) {
    if (!selectedId) return
    await fetch(`/api/engagements/${selectedId}/options/${option.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(option),
    })
    await loadEngagementDetail(selectedId)
  }

  async function searchPrecedents() {
    const params = new URLSearchParams()
    if (detail?.engagement?.fm_engagement_type_code) params.set('engagement_type', detail.engagement.fm_engagement_type_code)
    if (detail?.engagement?.industry_sector) params.set('industry_sector', detail.engagement.industry_sector)
    if (detail?.engagement?.project_scale) params.set('project_scale', detail.engagement.project_scale)

    const res = await fetch(`/api/fm/precedents/search?${params.toString()}`)
    if (!res.ok) return
    const json = await res.json()
    setPrecedents(json.precedents ?? [])
  }

  async function createPrecedentFromEngagement() {
    if (!selectedId) return
    const res = await fetch('/api/fm/precedents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engagement_id: selectedId }),
    })
    if (res.ok) searchPrecedents()
  }

  async function generateReport() {
    if (!selectedId) return
    setGeneratingReport(true)
    try {
      const res = await fetch(`/api/engagements/${selectedId}/reports/generate?format=${reportFormat}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branding: {
            color_scheme: reportColor,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate report')
      setLatestReportUrl(json.report_url ?? null)
      await loadEngagementDetail(selectedId)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to generate report')
    } finally {
      setGeneratingReport(false)
    }
  }

  const latestReport = detail?.deliverables?.find((item) => ['markdown', 'html', 'pdf'].includes(item.deliverable_type))

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 500, margin: '0 0 6px', color: 'var(--pios-text)' }}>Consulting Engagement Manager</h1>
      <div style={{ color: 'var(--pios-muted)', marginBottom: 12, fontSize: 13 }}>
        7-step process enforcer + FM module (Types 1/2/3/9), risk register, strategic options, precedent search, and report generation.
      </div>

      <ConsultingSubnav />

      {fmEnabled && dashboardWidgets && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={widgetCardStyle}>
            <div style={widgetTitleStyle}>Risk Heatmap</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 6 }}>
              {dashboardWidgets.risk_heatmap.map((cell) => (
                <div key={`${cell.probability}-${cell.impact}`} style={{ border: '1px solid var(--pios-border)', borderRadius: 6, padding: 6, fontSize: 11 }}>
                  <div style={{ color: 'var(--pios-dim)' }}>{cell.probability[0].toUpperCase()} / {cell.impact[0].toUpperCase()}</div>
                  <div style={{ color: 'var(--pios-text)', fontWeight: 600 }}>{cell.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={widgetCardStyle}>
            <div style={widgetTitleStyle}>Active FM by Type</div>
            {(dashboardWidgets.active_fm_engagements_by_type ?? []).slice(0, 4).map((item) => (
              <div key={item.type_code} style={{ fontSize: 12, color: 'var(--pios-text)', marginTop: 6 }}>
                {item.name}: <b>{item.count}</b>
              </div>
            ))}
          </div>

          <div style={widgetCardStyle}>
            <div style={widgetTitleStyle}>Compliance Status</div>
            <div style={{ fontSize: 26, color: 'var(--ai)', marginTop: 8 }}>{dashboardWidgets.compliance_status_percent}%</div>
            <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>engagements with required ISO coverage</div>
          </div>

          <div style={widgetCardStyle}>
            <div style={widgetTitleStyle}>Top Risks</div>
            {(dashboardWidgets.top_risks_across_portfolio ?? []).slice(0, 3).map((item) => (
              <div key={item.title} style={{ fontSize: 11, color: 'var(--pios-text)', marginTop: 6 }}>
                {item.title} ({item.count})
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 16, alignItems: 'start' }}>
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

            {fmEnabled && (
              <>
                <select {...createForm.register('fm_engagement_type_code')} style={inputStyle}>
                  <option value="">General consulting engagement</option>
                  {engagementTypes.map((type) => (
                    <option key={type.type_code} value={type.type_code}>
                      {type.type_number}. {type.name}
                    </option>
                  ))}
                </select>

                <input placeholder="Industry sector (e.g. healthcare)" {...createForm.register('industry_sector')} style={inputStyle} />
                <input placeholder="Building type" {...createForm.register('building_type')} style={inputStyle} />
                <input placeholder="Project scale (small/medium/large/portfolio)" {...createForm.register('project_scale')} style={inputStyle} />
              </>
            )}

            <textarea placeholder="Brief / context" {...createForm.register('brief')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />

            {selectedFmType && (
              <div style={{ border: '1px solid var(--pios-border)', borderRadius: 8, padding: 8, background: 'var(--pios-surface)' }}>
                <div style={{ fontSize: 12, color: 'var(--pios-text)', fontWeight: 600 }}>{selectedFmType.name}</div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 4 }}>{selectedFmType.description}</div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 4 }}>
                  ISO: {selectedFmType.iso_standards?.join(', ') || 'n/a'} · Typical duration: {selectedFmType.typical_duration_weeks ?? 'n/a'} weeks
                </div>
              </div>
            )}

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
                <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>
                  {engagement.client_name} · {engagement.fm_engagement_type_code ?? 'general'} · Step {engagement.current_step}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 10, padding: 16 }}>
          {!detail ? (
            <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>Select an engagement to open the FM-enabled workbench.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 18, color: 'var(--pios-text)', fontWeight: 500 }}>{detail.engagement.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
                    {detail.engagement.client_name} · {detail.engagement.fm_engagement_type_code ?? detail.engagement.engagement_type}
                  </div>
                </div>
                <button onClick={archiveEngagement} style={ghostButtonStyle}>Archive</button>
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PHASES.map((phase) => (
                  <button
                    key={phase.code}
                    onClick={() => savePhase(phase.code)}
                    style={{
                      ...ghostButtonStyle,
                      color: detail.engagement.current_phase === phase.code ? 'var(--ai)' : 'var(--pios-muted)',
                      borderColor: detail.engagement.current_phase === phase.code ? 'var(--ai)' : 'var(--pios-border)',
                    }}
                  >
                    {phase.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--pios-border)', paddingBottom: 8 }}>
                {[
                  { id: 'workbench', label: 'Workbench' },
                  { id: 'risks', label: `Risk Register (${detail.risks?.length ?? 0})` },
                  { id: 'options', label: `Options (${detail.options?.length ?? 0})` },
                  { id: 'precedents', label: 'Precedents' },
                  { id: 'reports', label: 'Report Generator' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: activeTab === tab.id ? 'var(--ai)' : 'var(--pios-muted)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'workbench' && (
                <>
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

              {activeTab === 'risks' && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, color: 'var(--pios-text)', fontWeight: 600 }}>Risk Matrix (3x3)</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={correlateRiskEmails} style={ghostButtonStyle}>Correlate Emails</button>
                        <button
                          onClick={() =>
                            downloadCsv(
                              `risk-register-${detail.engagement.title}.csv`,
                              ['Code', 'Title', 'Category', 'Probability', 'Impact', 'Score', 'Status', 'Owner'],
                              (detail.risks ?? []).map((risk) => [
                                risk.risk_library?.risk_code ?? 'Custom',
                                risk.risk_library?.title ?? risk.custom_title,
                                risk.risk_library?.category ?? 'custom',
                                risk.probability,
                                risk.impact,
                                risk.risk_score,
                                risk.mitigation_status,
                                risk.owner_user_id,
                              ])
                            )
                          }
                          style={ghostButtonStyle}
                        >
                          Export CSV
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 10 }}>
                      {riskMatrix.flatMap((row, rowIndex) =>
                        row.map((count, colIndex) => (
                          <div key={`${rowIndex}-${colIndex}`} style={{ border: '1px solid var(--pios-border)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--pios-muted)' }}>P {['L', 'M', 'H'][rowIndex]} · I {['L', 'M', 'H'][colIndex]}</div>
                            <div style={{ fontSize: 18, color: 'var(--pios-text)', fontWeight: 600 }}>{count}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--pios-border)', borderRadius: 8 }}>
                      {(detail.risks ?? []).map((risk) => (
                        <div key={risk.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 55px 55px 55px 90px', gap: 8, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--pios-border)' }}>
                          <button onClick={() => setSelectedRiskId(risk.id)} style={{ ...ghostButtonStyle, fontSize: 10 }}>
                            {risk.risk_library?.risk_code ?? 'Custom'}
                          </button>
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--pios-text)' }}>{risk.risk_library?.title ?? risk.custom_title}</div>
                            <div style={{ fontSize: 10, color: 'var(--pios-muted)' }}>{risk.risk_library?.category ?? 'custom'}</div>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{risk.probability}</div>
                          <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{risk.impact}</div>
                          <div style={{ fontSize: 12, color: risk.risk_score >= 6 ? '#ef4444' : 'var(--pios-text)' }}>{risk.risk_score}</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => updateRisk('mitigated')} style={ghostButtonStyle}>Mitigate</button>
                            <button onClick={() => deleteRisk(risk.id)} style={{ ...ghostButtonStyle, color: '#ef4444' }}>Del</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 12, border: '1px solid var(--pios-border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--pios-text)', fontWeight: 600, marginBottom: 8 }}>Add Risk</div>
                      <form onSubmit={riskForm.handleSubmit(createRisk)} style={{ display: 'grid', gap: 8 }}>
                        <input
                          value={riskScenario}
                          onChange={(event) => setRiskScenario(event.target.value)}
                          placeholder="Describe risk scenario (AI assisted)"
                          style={inputStyle}
                        />
                        {riskSuggestions.length > 0 && (
                          <div style={{ border: '1px solid var(--pios-border)', borderRadius: 8, padding: 8, maxHeight: 120, overflow: 'auto' }}>
                            {riskSuggestions.slice(0, 5).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => riskForm.setValue('risk_library_id', item.id)}
                                style={{ ...ghostButtonStyle, width: '100%', textAlign: 'left', marginBottom: 5 }}
                              >
                                {item.risk_code} — {item.title}
                              </button>
                            ))}
                          </div>
                        )}

                        <select {...riskForm.register('risk_library_id')} style={inputStyle}>
                          <option value="">Custom risk</option>
                          {riskLibrary.map((risk) => (
                            <option key={risk.id} value={risk.id}>
                              {risk.risk_code} — {risk.title}
                            </option>
                          ))}
                        </select>

                        <input placeholder="Custom title" {...riskForm.register('custom_title')} style={inputStyle} />
                        <textarea placeholder="Custom description" {...riskForm.register('custom_description')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <select {...riskForm.register('probability')} style={inputStyle}>
                            <option value="low">Probability: low</option>
                            <option value="medium">Probability: medium</option>
                            <option value="high">Probability: high</option>
                          </select>
                          <select {...riskForm.register('impact')} style={inputStyle}>
                            <option value="low">Impact: low</option>
                            <option value="medium">Impact: medium</option>
                            <option value="high">Impact: high</option>
                          </select>
                        </div>

                        <textarea placeholder="Mitigation plan" {...riskForm.register('mitigation_plan')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                        {riskForm.formState.errors.root && <div style={errorStyle}>{riskForm.formState.errors.root.message}</div>}
                        <button type="submit" style={primaryButtonStyle}>Add risk</button>
                      </form>
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--pios-border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>Risk Detail</div>
                    {selectedRisk ? (
                      <>
                        <div style={{ fontSize: 14, color: 'var(--pios-text)', fontWeight: 600, marginTop: 6 }}>
                          {selectedRisk.risk_library?.risk_code ?? 'Custom'} — {selectedRisk.risk_library?.title ?? selectedRisk.custom_title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 4 }}>
                          {(selectedRisk.risk_library?.iso_references ?? []).join(', ') || 'No ISO references'}
                        </div>

                        <textarea
                          value={selectedRisk.mitigation_plan ?? ''}
                          onChange={(event) => setDetail((prev) => {
                            if (!prev) return prev
                            return {
                              ...prev,
                              risks: prev.risks.map((risk) => (risk.id === selectedRisk.id ? { ...risk, mitigation_plan: event.target.value } : risk)),
                            }
                          })}
                          rows={6}
                          style={{ ...inputStyle, marginTop: 8, width: '100%' }}
                        />

                        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          {(['open', 'mitigating', 'mitigated', 'accepted'] as RiskStatus[]).map((status) => (
                            <button key={status} onClick={() => updateRisk(status)} style={ghostButtonStyle}>
                              {status}
                            </button>
                          ))}
                        </div>

                        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--pios-muted)' }}>
                          Identified: {selectedRisk.identified_date} · Target closure: {selectedRisk.target_closure_date ?? 'n/a'}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--pios-muted)' }}>
                          Linked emails: {selectedRisk.linked_email_ids?.length ?? 0}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>Select a risk to inspect details.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'options' && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button onClick={generateOptions} style={primaryButtonStyle} disabled={generatingOptions}>
                      {generatingOptions ? 'Generating options…' : 'Generate Options'}
                    </button>
                    <button
                      onClick={() =>
                        downloadCsv(
                          `fm-options-${detail.engagement.title}.csv`,
                          ['#', 'Title', 'Risk', 'Cost Min', 'Cost Max', 'Weeks', 'Recommended'],
                          (detail.options ?? []).map((option) => [
                            option.option_number,
                            option.title,
                            option.risk_level,
                            option.estimated_cost_min,
                            option.estimated_cost_max,
                            option.implementation_time_weeks,
                            option.is_recommended ? 'Yes' : 'No',
                          ])
                        )
                      }
                      style={ghostButtonStyle}
                    >
                      Export Comparison CSV
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
                    {(detail.options ?? []).map((option) => (
                      <div key={option.id} style={{ border: '1px solid var(--pios-border)', borderRadius: 10, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontSize: 13, color: 'var(--pios-text)', fontWeight: 600 }}>
                            Option {option.option_number}: {option.title}
                          </div>
                          {option.is_recommended && <span style={{ fontSize: 10, color: '#22c55e' }}>RECOMMENDED</span>}
                        </div>
                        <textarea
                          value={option.description}
                          onChange={(event) =>
                            setDetail((prev) => {
                              if (!prev) return prev
                              return {
                                ...prev,
                                options: prev.options.map((entry) => (entry.id === option.id ? { ...entry, description: event.target.value } : entry)),
                              }
                            })
                          }
                          rows={4}
                          style={{ ...inputStyle, marginTop: 6, width: '100%' }}
                        />

                        <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 6 }}>
                          Cost: £{Number(option.estimated_cost_min ?? 0).toLocaleString()} - £{Number(option.estimated_cost_max ?? 0).toLocaleString()} ·
                          {option.implementation_time_weeks ?? 'n/a'} weeks · Risk: {option.risk_level}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 4 }}>
                          Pros: {(option.pros ?? []).slice(0, 3).join(' • ')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 4 }}>
                          Cons: {(option.cons ?? []).slice(0, 3).join(' • ')}
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={() => saveOption(option)} style={ghostButtonStyle}>Save</button>
                          <button onClick={() => recommendOption(option.id)} style={ghostButtonStyle}>Recommend</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'precedents' && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button onClick={searchPrecedents} style={ghostButtonStyle}>Search Precedents</button>
                    <button onClick={createPrecedentFromEngagement} style={ghostButtonStyle}>Create from Engagement</button>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    {precedents.length === 0 && <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>No precedents loaded yet. Use Search Precedents.</div>}
                    {precedents.map((precedent) => (
                      <div key={precedent.id} style={{ border: '1px solid var(--pios-border)', borderRadius: 8, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 13, color: 'var(--pios-text)', fontWeight: 600 }}>{precedent.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>
                              {precedent.engagement_type} · {precedent.industry_sector ?? 'n/a'} · similarity {(precedent.similarity_score ?? 0).toFixed(2)}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              runForm.setValue(
                                'prompt',
                                `Use precedent insights:\n${precedent.anonymized_excerpt ?? ''}\n\nFrameworks used: ${(precedent.frameworks_used ?? []).join(', ')}`
                              )
                              setActiveTab('workbench')
                            }}
                            style={ghostButtonStyle}
                          >
                            Apply to Engagement
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 6 }}>
                          Tags: {(precedent.tags ?? []).join(', ') || 'n/a'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 4 }}>{precedent.anonymized_excerpt}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'reports' && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>
                  <div style={{ border: '1px solid var(--pios-border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--pios-text)', fontWeight: 600, marginBottom: 8 }}>Report Settings</div>
                    <label style={{ fontSize: 11, color: 'var(--pios-muted)' }}>Format</label>
                    <select value={reportFormat} onChange={(event) => setReportFormat(event.target.value as any)} style={{ ...inputStyle, width: '100%', marginTop: 4 }}>
                      <option value="markdown">Markdown</option>
                      <option value="html">HTML</option>
                      <option value="pdf">PDF</option>
                    </select>

                    <label style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 8, display: 'block' }}>Brand color</label>
                    <input value={reportColor} onChange={(event) => setReportColor(event.target.value)} style={{ ...inputStyle, width: '100%', marginTop: 4 }} />

                    <button onClick={generateReport} style={{ ...primaryButtonStyle, width: '100%', marginTop: 10 }} disabled={generatingReport}>
                      {generatingReport ? 'Generating…' : 'Generate Report'}
                    </button>

                    {latestReportUrl && (
                      <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 8 }}>
                        Report link: <span style={{ color: 'var(--ai)' }}>{latestReportUrl}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ border: '1px solid var(--pios-border)', borderRadius: 8, padding: 10, maxHeight: 420, overflow: 'auto' }}>
                    <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 6 }}>Report preview</div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--pios-text)' }}>
                      {latestReport?.content ?? 'Generate a report to preview output.'}
                    </pre>
                  </div>
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

const widgetCardStyle: CSSProperties = {
  background: 'var(--pios-card)',
  border: '1px solid var(--pios-border)',
  borderRadius: 10,
  padding: 10,
}

const widgetTitleStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--pios-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}
