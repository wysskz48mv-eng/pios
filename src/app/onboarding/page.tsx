'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PERSONA_PACKAGING, type CanonicalPersona } from '@/lib/persona-packaging'
import type { PersonaCode } from '@/types/persona-modules'
import styles from './onboarding.module.css'

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6

type CalibrationQuestion = {
  id: string
  prompt: string
  options: string[]
}

type CompetencyItem = {
  dimension: string
  score: number
  confidence: number
}

function clampStep(step: unknown): OnboardingStep {
  const n = Number(step)
  if (!Number.isFinite(n)) return 1
  return Math.min(6, Math.max(1, Math.round(n))) as OnboardingStep
}

type LocalOnboardingState = {
  current_step?: OnboardingStep
  persona_selected?: CanonicalPersona | null
  calibration_answers?: Record<string, string>
  cv_uploaded?: boolean
  cv_analyzed?: boolean
  cv_skipped?: boolean
  onboarding_complete?: boolean
  calibration_summary?: string
  top_competencies?: CompetencyItem[]
}

const LOCAL_STORAGE_KEY = 'pios:onboarding:state'

type PersonaChoice = {
  id: 'FOUNDER' | 'FM_CONSULTANT' | 'MANAGEMENT_CONSULTANT' | 'ACADEMIC_PHD'
  label: string
  tagline: string
  description: string
  persona: CanonicalPersona
  fmConsultant?: boolean
}

const ONBOARDING_PERSONA_CHOICES: PersonaChoice[] = [
  {
    id: 'FOUNDER',
    label: 'Founder',
    tagline: 'Build · Lead · Scale',
    description: 'Neutral strategic frameworks with founder operating context.',
    persona: 'CEO',
  },
  {
    id: 'FM_CONSULTANT',
    label: 'FM Consultant',
    tagline: 'Comply · Deliver · Transition',
    description: 'Consulting workflows with FM-specific approach activation.',
    persona: 'CONSULTANT',
    fmConsultant: true,
  },
  {
    id: 'MANAGEMENT_CONSULTANT',
    label: 'Management Consultant',
    tagline: 'Diagnose · Prioritise · Recommend',
    description: 'Neutral consulting workbench, without FM-specific activation.',
    persona: 'CONSULTANT',
  },
  {
    id: 'ACADEMIC_PHD',
    label: 'Academic / PhD',
    tagline: 'Research · Publish · Defend',
    description: 'Research workflows with citation graph and CPD support.',
    persona: 'ACADEMIC',
  },
]

function readLocalState(): LocalOnboardingState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as LocalOnboardingState
  } catch (error) {
    console.error('[onboarding] failed to read local fallback state', error)
    return {}
  }
}

function writeLocalState(next: LocalOnboardingState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    console.error('[onboarding] failed to write local fallback state', error)
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [hydrating, setHydrating] = useState(true)
  const [step, setStep] = useState<OnboardingStep>(1)
  const [persona, setPersona] = useState<CanonicalPersona | null>(null)
  const [selectedPersonaChoice, setSelectedPersonaChoice] = useState<PersonaChoice['id'] | null>(null)
  const [cvSuggestedPersonas, setCvSuggestedPersonas] = useState<PersonaCode[]>([])
  const [questions, setQuestions] = useState<CalibrationQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvUploading, setCvUploading] = useState(false)
  const [calibrationSummary, setCalibrationSummary] = useState('')
  const [topCompetencies, setTopCompetencies] = useState<CompetencyItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [syncWarning, setSyncWarning] = useState('')

  const personaOptions = useMemo(() => ONBOARDING_PERSONA_CHOICES, [])

  function mergeLocalState(payload: Record<string, unknown>) {
    const previous = readLocalState()
    const next: LocalOnboardingState = {
      ...previous,
      ...payload,
      current_step: clampStep(payload.current_step ?? previous.current_step ?? step),
      calibration_answers: {
        ...(previous.calibration_answers ?? {}),
        ...(typeof payload.calibration_answers === 'object' ? payload.calibration_answers as Record<string, string> : {}),
      },
      persona_selected: typeof payload.persona_selected === 'string'
        ? payload.persona_selected as CanonicalPersona
        : previous.persona_selected ?? persona,
      calibration_summary: typeof payload.calibration_summary === 'string'
        ? payload.calibration_summary
        : previous.calibration_summary ?? calibrationSummary,
      top_competencies: Array.isArray(payload.top_competencies)
        ? payload.top_competencies as CompetencyItem[]
        : previous.top_competencies ?? topCompetencies,
    }
    writeLocalState(next)
  }

  async function patchState(payload: Record<string, unknown>, options?: { suppressWarning?: boolean }) {
    mergeLocalState(payload)

    try {
      const res = await fetch('/api/onboarding/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({})) as { error?: string; warning?: string; persisted?: boolean }

      if (!res.ok) {
        console.error('[onboarding] state PATCH failed', { payload, status: res.status, data })
        if (!options?.suppressWarning) setSyncWarning('Progress is being saved locally. We will sync when backend storage is available.')
        return { persisted: false }
      }

      if (data?.warning || data?.persisted === false) {
        console.warn('[onboarding] state PATCH degraded', { payload, data })
        if (!options?.suppressWarning) setSyncWarning('Progress is being saved locally. We will sync when backend storage is available.')
        return { persisted: false }
      }

      if (!options?.suppressWarning) setSyncWarning('')
      return { persisted: true }
    } catch (error) {
      console.error('[onboarding] state PATCH request error', { payload, error })
      if (!options?.suppressWarning) setSyncWarning('Progress is being saved locally. We will sync when backend storage is available.')
      return { persisted: false }
    }
  }

  async function loadState() {
    setHydrating(true)
    setError('')

    const local = readLocalState()

    try {
      const res = await fetch('/api/onboarding/state', { cache: 'no-store' })
      if (!res.ok) {
        const details = await res.text().catch(() => '')
        throw new Error(`Could not load onboarding state (status=${res.status}) ${details}`.trim())
      }
      const data = await res.json()

      const nextStep = clampStep(data?.state?.current_step ?? local.current_step ?? 1)
      setStep(nextStep)

      const p = data?.state?.persona_selected ?? data?.profile?.persona_type ?? local.persona_selected ?? null
      if (typeof p === 'string') {
        const canonical = p as CanonicalPersona
        setPersona(canonical)
        const mappedChoice = ONBOARDING_PERSONA_CHOICES.find((choice) => choice.persona === canonical)
        setSelectedPersonaChoice(mappedChoice?.id ?? null)
      }

      if (Array.isArray(data?.calibration?.recommended_personas)) {
        setCvSuggestedPersonas(data.calibration.recommended_personas as PersonaCode[])
      }

      const personaConfig = data?.persona_config
      if (Array.isArray(personaConfig?.questions)) {
        setQuestions(personaConfig.questions)
      }

      if (data?.state?.calibration_answers && typeof data.state.calibration_answers === 'object') {
        const values = Object.fromEntries(
          Object.entries(data.state.calibration_answers).map(([k, v]) => [k, String(v)])
        )
        setAnswers(values)
      } else if (local.calibration_answers) {
        setAnswers(local.calibration_answers)
      }

      if (typeof data?.calibration?.cv_profile_summary === 'string') {
        setCalibrationSummary(data.calibration.cv_profile_summary)
      } else if (typeof data?.calibration?.calibration_summary === 'string') {
        setCalibrationSummary(data.calibration.calibration_summary)
      } else if (typeof local.calibration_summary === 'string') {
        setCalibrationSummary(local.calibration_summary)
      }

      if (Array.isArray(data?.calibration?.top_competencies)) {
        setTopCompetencies(data.calibration.top_competencies)
      } else if (Array.isArray(local.top_competencies)) {
        setTopCompetencies(local.top_competencies)
      }

      mergeLocalState({
        current_step: nextStep,
        persona_selected: p,
        calibration_answers: data?.state?.calibration_answers,
      })

      if (data?.warning) {
        setSyncWarning('Progress is being saved locally. We will sync when backend storage is available.')
      }
    } catch (e: unknown) {
      console.error('[onboarding] loadState failed, using local fallback', e)
      const fallbackStep = clampStep(local.current_step ?? 1)
      setStep(fallbackStep)
      if (typeof local.persona_selected === 'string') {
        setPersona(local.persona_selected)
        const mappedChoice = ONBOARDING_PERSONA_CHOICES.find((choice) => choice.persona === local.persona_selected)
        setSelectedPersonaChoice(mappedChoice?.id ?? null)
      }
      if (local.calibration_answers) setAnswers(local.calibration_answers)
      if (typeof local.calibration_summary === 'string') setCalibrationSummary(local.calibration_summary)
      if (Array.isArray(local.top_competencies)) setTopCompetencies(local.top_competencies)
      setSyncWarning('Using local backup for onboarding progress. Backend sync will retry automatically.')
    } finally {
      setHydrating(false)
    }
  }

  useEffect(() => {
    void loadState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function gotoStep(next: OnboardingStep) {
    setError('')
    setStep(next)
    await patchState({ current_step: next })
  }

  async function handlePersonaSelect(choice: PersonaChoice) {
    setBusy(true)
    setError('')
    setPersona(choice.persona)
    setSelectedPersonaChoice(choice.id)
    mergeLocalState({ persona_selected: choice.persona, current_step: 3 })

    try {
      const res = await fetch('/api/onboarding/persona', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: choice.persona, fm_consultant: Boolean(choice.fmConsultant) }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error('[onboarding] persona PATCH failed', { status: res.status, data })
        setSyncWarning('Persona saved locally. We will sync when backend storage is available.')
      }

      if (Array.isArray(data?.config?.questions)) setQuestions(data.config.questions)
      await gotoStep(3)
    } catch (e: unknown) {
      console.error('[onboarding] persona PATCH request error', e)
      setSyncWarning('Persona saved locally. We will sync when backend storage is available.')
      await gotoStep(3)
    } finally {
      setBusy(false)
    }
  }

  async function handleCalibrationContinue() {
    if (!persona) {
      setError('Please select your persona first.')
      return
    }

    const unanswered = questions.some((q) => !answers[q.id])
    if (unanswered) {
      setError('Please answer all calibration questions before continuing.')
      return
    }

    setBusy(true)
    setError('')
    mergeLocalState({ persona_selected: persona, calibration_answers: answers, current_step: 4 })

    try {
      const res = await fetch('/api/onboarding/calibration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona, answers }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[onboarding] calibration PATCH failed', { status: res.status, data })
        setSyncWarning('Calibration answers saved locally. We will sync when backend storage is available.')
      }

      await gotoStep(4)
    } catch (e: unknown) {
      console.error('[onboarding] calibration PATCH request error', e)
      setSyncWarning('Calibration answers saved locally. We will sync when backend storage is available.')
      await gotoStep(4)
    } finally {
      setBusy(false)
    }
  }

  async function handleCVUpload() {
    if (!cvFile) {
      setError('Choose a CV file or skip for now.')
      return
    }

    setCvUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('cv', cvFile)

      const res = await fetch('/api/cv', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) throw new Error(data.error ?? 'CV upload failed')

      if (typeof data?.calibration?.calibration_summary === 'string') {
        setCalibrationSummary(data.calibration.calibration_summary)
      }
      if (Array.isArray(data?.top_competencies)) {
        setTopCompetencies(data.top_competencies)
      }
      if (Array.isArray(data?.suggested_personas)) {
        setCvSuggestedPersonas(data.suggested_personas as PersonaCode[])
      }

      mergeLocalState({
        current_step: 5,
        cv_uploaded: true,
        cv_analyzed: true,
        cv_skipped: false,
        calibration_summary: typeof data?.calibration?.calibration_summary === 'string' ? data.calibration.calibration_summary : calibrationSummary,
        top_competencies: Array.isArray(data?.top_competencies) ? data.top_competencies : topCompetencies,
      })

      await patchState({ current_step: 5, cv_uploaded: true, cv_analyzed: true, cv_skipped: false })
      setStep(5)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'CV processing failed')
    } finally {
      setCvUploading(false)
    }
  }

  async function handleSkipCV() {
    setBusy(true)
    setError('')
    mergeLocalState({ current_step: 5, cv_skipped: true, cv_uploaded: false, cv_analyzed: false })
    await patchState({ current_step: 5, cv_skipped: true, cv_uploaded: false, cv_analyzed: false })
    setStep(5)
    setBusy(false)
  }

  async function handleComplete() {
    setBusy(true)
    setError('')
    mergeLocalState({ current_step: 6, onboarding_complete: true })

    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_type: persona ?? undefined, command_centre_theme: 'onyx' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[onboarding] complete POST failed', { status: res.status, data })
        setSyncWarning('Onboarding finalization is running in degraded mode. Attempting platform entry…')
      }

      await patchState({ current_step: 6, onboarding_complete: true }, { suppressWarning: true })
      router.push('/platform/dashboard?welcome=1')
    } catch (e: unknown) {
      console.error('[onboarding] complete POST request error', e)
      setSyncWarning('Onboarding finalization is running in degraded mode. Attempting platform entry…')
      await patchState({ current_step: 6, onboarding_complete: true }, { suppressWarning: true })
      router.push('/platform/dashboard?welcome=1')
    } finally {
      setBusy(false)
    }
  }

  const progressPct = Math.round((step / 6) * 100)

  if (hydrating) {
    return (
      <div className={styles.page}>
        <div className={styles.stepContent}>
          <p className={styles.stepSub}>Loading your onboarding workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.stepHeader}>
        <div className={styles.logo}>PIOS</div>
        <div className={styles.progressMeta}>
          <span>Step {step} of 6</span>
          <span>{progressPct}%</span>
        </div>
      </div>

      <div className={styles.progressRail}><div className={styles.progressFill} style={{ width: `${progressPct}%` }} /></div>

      <div className={styles.stepContent}>
        {step === 1 && (
          <section>
            <span className={styles.stepTag}>Welcome</span>
            <h2 className={styles.stepTitle}>Your intelligence command centre starts now.</h2>
            <p className={styles.stepSub}>
              NemoClaw™ will calibrate to your professional operating context through six short steps.
            </p>
            <div className={styles.stepActions}>
              <button className={styles.nextBtn} onClick={() => gotoStep(2)}>Begin calibration →</button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <span className={styles.stepTag}>Persona</span>
            <h2 className={styles.stepTitle}>Select your primary operating persona.</h2>
            <p className={styles.stepSub}>This sets your default modules, decision language, and workflow emphasis.</p>

            <div className={styles.personaGrid}>
              {personaOptions.map((option) => {
                const isSelected = selectedPersonaChoice === option.id
                const isSuggested = cvSuggestedPersonas.includes(option.persona as PersonaCode)

                return (
                  <button
                    key={option.id}
                    className={`${styles.personaCard} ${isSelected ? styles.personaCardSelected : ''}`}
                    onClick={() => handlePersonaSelect(option)}
                    disabled={busy}
                  >
                    <div className={styles.pcTag}>{option.label}</div>
                    <div className={styles.pcTitle}>{option.tagline}</div>
                    <p className={styles.pcDesc}>{option.description}</p>
                    {isSuggested && <div className={styles.pcHint}>Suggested from CV</div>}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <span className={styles.stepTag}>Calibration</span>
            <h2 className={styles.stepTitle}>Answer a few context questions.</h2>
            <p className={styles.stepSub}>These answers tune NemoClaw’s communication and recommendation style.</p>

            <div className={styles.questionsWrap}>
              {questions.map((question) => (
                <div key={question.id} className={styles.questionBlock}>
                  <p className={styles.questionPrompt}>{question.prompt}</p>
                  <div className={styles.questionOptions}>
                    {question.options.map((option) => (
                      <button
                        key={option}
                        className={`${styles.optionBtn} ${answers[question.id] === option ? styles.optionBtnSelected : ''}`}
                        onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.stepActions}>
              <button className={styles.backBtn} onClick={() => gotoStep(2)}>← Back</button>
              <button className={styles.nextBtn} onClick={handleCalibrationContinue} disabled={busy}>
                {busy ? 'Saving…' : 'Continue →'}
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <span className={styles.stepTag}>CV Upload</span>
            <h2 className={styles.stepTitle}>Upload your CV (optional).</h2>
            <p className={styles.stepSub}>PDF, DOC, DOCX, or TXT. NemoClaw maps your profile into 23 competency dimensions.</p>

            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              style={{ display: 'none' }}
              onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
            />

            <div className={styles.cvDrop} onClick={() => fileRef.current?.click()}>
              {cvFile ? (
                <p className={styles.cvFileName}>✓ {cvFile.name}</p>
              ) : (
                <p className={styles.cvText}>Click to select your CV file</p>
              )}
            </div>

            <div className={styles.stepActions}>
              <button className={styles.backBtn} onClick={() => gotoStep(3)} disabled={cvUploading}>← Back</button>
              <div className={styles.actionInlineGroup}>
                <button className={styles.backBtn} onClick={handleSkipCV} disabled={cvUploading || busy}>Skip for now</button>
                <button className={styles.nextBtn} onClick={handleCVUpload} disabled={cvUploading}>
                  {cvUploading ? 'Analysing…' : 'Upload & analyse →'}
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 5 && (
          <section>
            <span className={styles.stepTag}>NemoClaw Summary</span>
            <h2 className={styles.stepTitle}>Your initial calibration is ready.</h2>
            <p className={styles.stepSub}>You can refine this over time as NemoClaw learns from your activity.</p>

            <div className={styles.summaryCard}>
              <h3>Calibration insight</h3>
              <p>{calibrationSummary || 'CV skipped. NemoClaw will start with persona-based defaults and adapt as you work.'}</p>
            </div>

            {topCompetencies.length > 0 && (
              <div className={styles.competencyGrid}>
                {topCompetencies.map((item) => (
                  <div key={item.dimension} className={styles.competencyCard}>
                    <span>{item.dimension}</span>
                    <strong>{item.score}%</strong>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.stepActions}>
              <button className={styles.backBtn} onClick={() => gotoStep(4)}>← Back</button>
              <button className={styles.nextBtn} onClick={() => gotoStep(6)}>Proceed to command centre →</button>
            </div>
          </section>
        )}

        {step === 6 && (
          <section>
            <span className={styles.stepTag}>Complete</span>
            <h2 className={styles.stepTitle}>Welcome to your command centre.</h2>
            <p className={styles.stepSub}>
              NemoClaw™ is activated with your onboarding profile. Your first personalised welcome message is now waiting in AI chat.
            </p>
            <div className={styles.stepActions}>
              <button className={styles.completeBtn} onClick={handleComplete} disabled={busy}>
                {busy ? 'Finalising…' : 'Enter command centre →'}
              </button>
            </div>
          </section>
        )}

        {error && <p className={styles.errorMsg}>{error}</p>}
        {!error && syncWarning && <p className={styles.stepSub}>{syncWarning}</p>}
      </div>
    </div>
  )
}
