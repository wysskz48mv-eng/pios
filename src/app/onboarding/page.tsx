'use client'
/**
 * /onboarding — PIOS onboarding flow
 * Step 1: Persona selection
 * Step 2: Goals + optional CV upload
 * Step 3: Module selection + deployment mode
 * Step 4: Integrations + launch
 *
 * VeritasIQ Technologies Ltd · PIOS
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildGoogleOAuthOptions } from '@/lib/auth/google-oauth'

type Persona = 'starter' | 'pro' | 'executive' | 'enterprise'
type DeployMode = 'full' | 'hybrid' | 'standalone'

type ModuleOption = {
  id: string
  label: string
  description: string
}

type OnboardingDraft = {
  step: number
  persona: Persona | null
  goals: string
  selectedModules: string[]
  deployMode: DeployMode
  emailTriageConsent: boolean
  googleConnected: boolean
  microsoftConnected: boolean
}

const PERSONAS: { key: Persona; label: string; icon: string; who: string }[] = [
  { key: 'starter',    label: 'Starter',    icon: '🎓', who: 'Undergraduate and postgraduate students' },
  { key: 'pro',        label: 'Pro',        icon: '💼', who: 'Professionals, consultants, solo founders' },
  { key: 'executive',  label: 'Executive',  icon: '⚡', who: 'CEOs, founders, directors, senior executives' },
  { key: 'enterprise', label: 'Enterprise', icon: '🏢', who: 'Corporations, universities, white-label partners' },
]

const PERSONA_LABELS: Record<Persona, string> = {
  starter: 'Student',
  pro: 'Professional',
  executive: 'Executive',
  enterprise: 'Enterprise',
}

const PERSONA_DEFAULTS: Record<Persona, ModuleOption[]> = {
  starter: [
    { id: 'command_centre', label: 'Command Centre', description: 'One surface for deadlines, priorities, and your live brief.' },
    { id: 'morning_brief', label: 'Morning Brief', description: 'A daily summary calibrated to deadlines, study load, and admin.' },
    { id: 'tasks', label: 'Tasks', description: 'Structured execution for coursework, supervision prep, and personal admin.' },
    { id: 'academic_suite', label: 'Academic Suite', description: 'Thesis, literature, viva, and supervisor-prep workflows.' },
    { id: 'wellness', label: 'Wellness', description: 'Signals when workload is becoming cognitively unsustainable.' },
  ],
  pro: [
    { id: 'command_centre', label: 'Command Centre', description: 'A single control surface for work, clients, and personal load.' },
    { id: 'morning_brief', label: 'Morning Brief', description: 'Daily priorities, risk flags, and time protection.' },
    { id: 'tasks', label: 'Tasks', description: 'Execution tracking across billable and non-billable work.' },
    { id: 'email_intel', label: 'Email Intelligence', description: 'Inbox triage, draft suggestions, and action extraction.' },
    { id: 'coaching', label: 'Coaching', description: 'NemoClaw support for judgement, planning, and follow-through.' },
  ],
  executive: [
    { id: 'command_centre', label: 'Command Centre', description: 'A strategic operating layer over meetings, decisions, and execution.' },
    { id: 'morning_brief', label: 'Morning Brief', description: 'A decision-ready intelligence brief every morning.' },
    { id: 'email_intel', label: 'Email Intelligence', description: 'Fast inbox triage with urgency, delegation, and draft support.' },
    { id: 'stakeholders', label: 'Stakeholders', description: 'Institutional memory for high-value relationships and follow-ups.' },
    { id: 'chief_of_staff', label: 'Chief of Staff', description: 'Weekly execution and decision support across active workstreams.' },
  ],
  enterprise: [
    { id: 'command_centre', label: 'Command Centre', description: 'The primary operating surface for leadership and programme oversight.' },
    { id: 'morning_brief', label: 'Morning Brief', description: 'Executive daily intelligence across organisational priorities.' },
    { id: 'email_intel', label: 'Email Intelligence', description: 'Connected email for triage, drafting, and escalation handling.' },
    { id: 'documents', label: 'Documents', description: 'Drive-informed document access and knowledge organisation.' },
    { id: 'board_pack', label: 'Board Pack', description: 'Strategic reporting and board-grade narrative support.' },
  ],
}

const DEPLOY_MODES: { key: DeployMode; label: string; description: string }[] = [
  { key: 'full', label: 'Full deployment', description: 'Enable the full command-centre experience across modules and integrations.' },
  { key: 'hybrid', label: 'Hybrid rollout', description: 'Start with core workflows and add integrations once the team is ready.' },
  { key: 'standalone', label: 'Standalone', description: 'Use PIOS without external integrations while IT or compliance catches up.' },
]

const DRAFT_KEY = 'pios-onboarding-draft-v1'

const S = {
  page:  { minHeight: '100vh', background: 'var(--pios-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' } as React.CSSProperties,
  card:  { width: '100%', maxWidth: 640, background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 16, padding: '40px 40px 36px' } as React.CSSProperties,
  logo:  { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--pios-text)', marginBottom: 32, letterSpacing: '-0.02em' } as React.CSSProperties,
  steps: { display: 'flex', gap: 6, marginBottom: 32 } as React.CSSProperties,
  dot:   (active: boolean, done: boolean) => ({ width: 6, height: 6, borderRadius: '50%', background: done ? 'var(--ai)' : active ? 'var(--pios-text)' : 'var(--pios-border)', transition: 'background 0.2s' }) as React.CSSProperties,
  h1:    { fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 8px', letterSpacing: '-0.02em' } as React.CSSProperties,
  sub:   { fontSize: 14, color: 'var(--pios-muted)', margin: '0 0 28px', lineHeight: 1.5 } as React.CSSProperties,
  btn:   { width: '100%', padding: '12px 20px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8, transition: 'opacity 0.15s' } as React.CSSProperties,
  btnSec:{ width: '100%', padding: '11px 20px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer', marginTop: 8 } as React.CSSProperties,
  pCard: (sel: boolean) => ({ padding: '14px 16px', border: `1px solid ${sel ? 'var(--ai)' : 'var(--pios-border)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, background: sel ? 'rgba(139,124,248,0.06)' : 'transparent', transition: 'all 0.15s' }) as React.CSSProperties,
  section: { marginBottom: 18 } as React.CSSProperties,
}

function mapDbPersonaToPersona(personaType: string | null | undefined): Persona | null {
  if (personaType === 'academic' || personaType === 'student') return 'starter'
  if (personaType === 'consultant' || personaType === 'professional') return 'pro'
  if (personaType === 'executive' || personaType === 'founder') return 'executive'
  return null
}

function parseLocalDraft(): Partial<OnboardingDraft> | null {
  try {
    const rawDraft = window.localStorage.getItem(DRAFT_KEY)
    if (!rawDraft) return null

    return JSON.parse(rawDraft) as Partial<OnboardingDraft>
  } catch {
    window.localStorage.removeItem(DRAFT_KEY)
    return null
  }
}

function normaliseDraft(input: Record<string, unknown> | null | undefined): Partial<OnboardingDraft> | null {
  if (!input) return null

  const persona = typeof input.persona === 'string' && ['starter', 'pro', 'executive', 'enterprise'].includes(input.persona)
    ? input.persona as Persona
    : null
  const deployMode = typeof input.deploy_mode === 'string' && ['full', 'hybrid', 'standalone'].includes(input.deploy_mode)
    ? input.deploy_mode as DeployMode
    : typeof input.deployMode === 'string' && ['full', 'hybrid', 'standalone'].includes(input.deployMode)
    ? input.deployMode as DeployMode
    : undefined
  const selectedModules = Array.isArray(input.active_modules)
    ? input.active_modules.filter((item): item is string => typeof item === 'string')
    : Array.isArray(input.selectedModules)
    ? input.selectedModules.filter((item): item is string => typeof item === 'string')
    : undefined

  return {
    step: typeof input.step === 'number' ? Math.min(Math.max(input.step, 0), 3) : undefined,
    persona,
    goals: typeof input.goals === 'string' ? input.goals : undefined,
    selectedModules,
    deployMode,
    emailTriageConsent: typeof input.email_triage_consent === 'boolean'
      ? input.email_triage_consent
      : typeof input.emailTriageConsent === 'boolean'
      ? input.emailTriageConsent
      : undefined,
    googleConnected: typeof input.google_connected === 'boolean'
      ? input.google_connected
      : typeof input.googleConnected === 'boolean'
      ? input.googleConnected
      : undefined,
    microsoftConnected: typeof input.microsoft_connected === 'boolean'
      ? input.microsoft_connected
      : typeof input.microsoftConnected === 'boolean'
      ? input.microsoftConnected
      : undefined,
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [goals, setGoals] = useState('')
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [deployMode, setDeployMode] = useState<DeployMode>('full')
  const [emailTriageConsent, setEmailTriageConsent] = useState(true)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [microsoftConnected, setMicrosoftConnected] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [cvUploaded, setCvUploaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [integrationErr, setIntegrationErr] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const hydratedDraftRef = useRef(false)
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const moduleOptions = useMemo(
    () => (persona ? PERSONA_DEFAULTS[persona] : []),
    [persona]
  )

  const applyDraft = useCallback((draft: Partial<OnboardingDraft>) => {
    if (typeof draft.step === 'number') setStep(Math.min(Math.max(draft.step, 0), 3))
    if (draft.persona) setPersona(draft.persona)
    if (typeof draft.goals === 'string') setGoals(draft.goals)
    if (Array.isArray(draft.selectedModules)) setSelectedModules(draft.selectedModules)
    if (draft.deployMode) setDeployMode(draft.deployMode)
    if (typeof draft.emailTriageConsent === 'boolean') setEmailTriageConsent(draft.emailTriageConsent)
    if (typeof draft.googleConnected === 'boolean') setGoogleConnected(draft.googleConnected)
    if (typeof draft.microsoftConnected === 'boolean') setMicrosoftConnected(draft.microsoftConnected)
  }, [router])

  const persistDraft = useCallback(async (draftOverride?: Partial<OnboardingDraft>) => {
    const payload = {
      step: draftOverride?.step ?? step,
      persona: draftOverride?.persona ?? persona,
      goals: draftOverride?.goals ?? goals,
      active_modules: draftOverride?.selectedModules ?? selectedModules,
      deploy_mode: draftOverride?.deployMode ?? deployMode,
      email_triage_consent: draftOverride?.emailTriageConsent ?? emailTriageConsent,
      google_connected: draftOverride?.googleConnected ?? googleConnected,
      microsoft_connected: draftOverride?.microsoftConnected ?? microsoftConnected,
    }

    if (!payload.persona && !payload.goals && payload.active_modules.length === 0 && payload.step === 0) {
      return
    }

    await fetch('/api/onboarding/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }, [deployMode, emailTriageConsent, goals, googleConnected, microsoftConnected, persona, selectedModules, step])

  useEffect(() => {
    const localDraft = parseLocalDraft()
    if (localDraft) {
      applyDraft(localDraft)
    }

    async function loadStatus() {
      try {
        const res = await fetch('/api/onboarding/status', { cache: 'no-store' })
        if (!res.ok) {
          if (res.status === 401) {
            router.replace('/auth/login?next=%2Fonboarding')
            return
          }
          setStatusLoading(false)
          return
        }

        const data = await res.json()
        const serverDraft = normaliseDraft(data.draft)
        const mappedPersona = mapDbPersonaToPersona(data.profile?.persona_type)
        setCvUploaded(data.profile?.cv_processing_status === 'complete')

        if (serverDraft) {
          applyDraft(serverDraft)
        } else {
          setGoogleConnected(!!data.integrations?.google_connected)
          setMicrosoftConnected(!!data.integrations?.microsoft_connected)
          setPersona(current => current ?? mappedPersona)
          setSelectedModules(current => {
            if (current.length > 0) return current
            if (Array.isArray(data.profile?.active_modules) && data.profile.active_modules.length > 0) {
              return data.profile.active_modules
            }
            if (mappedPersona) {
              return PERSONA_DEFAULTS[mappedPersona].map(module => module.id)
            }
            return current
          })
          if (data.profile?.deployment_mode === 'full' || data.profile?.deployment_mode === 'hybrid' || data.profile?.deployment_mode === 'standalone') {
            setDeployMode(data.profile.deployment_mode)
          }
        }
      } catch {
        setIntegrationErr('Could not load integration status right now.')
      } finally {
        hydratedDraftRef.current = true
        setStatusLoading(false)
      }
    }

    void loadStatus()
  }, [applyDraft, router])

  useEffect(() => {
    if (!hydratedDraftRef.current || !persona) return

    const draft = {
      step,
      persona,
      goals,
      selectedModules,
      deployMode,
      emailTriageConsent,
      googleConnected,
      microsoftConnected,
    }

    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...draft,
    }))

    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current)
    draftSaveTimerRef.current = setTimeout(() => {
      void persistDraft()
    }, 400)

    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current)
    }
  }, [deployMode, emailTriageConsent, goals, googleConnected, microsoftConnected, persona, persistDraft, selectedModules, step])

  const selectPersona = useCallback((nextPersona: Persona) => {
    setPersona(nextPersona)
    setSelectedModules(PERSONA_DEFAULTS[nextPersona].map(module => module.id))
  }, [])

  const handleCV = useCallback(async (file: File) => {
    setUploading(true)
    setUploadErr('')
    try {
      const fd = new FormData()
      fd.append('cv', file)
      const res = await fetch('/api/cv', { method: 'POST', body: fd })
      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/auth/login?next=%2Fonboarding')
          return
        }
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }
      setCvUploaded(true)
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const toggleModule = useCallback((moduleId: string) => {
    setSelectedModules(current => (
      current.includes(moduleId)
        ? current.filter(id => id !== moduleId)
        : [...current, moduleId]
    ))
  }, [])

  const connectGoogle = useCallback(async () => {
    setConnectingGoogle(true)
    setIntegrationErr('')
    try {
      const draft = {
        step: 3,
        persona,
        goals,
        selectedModules,
        deployMode,
        emailTriageConsent,
        googleConnected,
        microsoftConnected,
      }
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      await persistDraft(draft)

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: buildGoogleOAuthOptions(window.location.origin, '/onboarding', 'workspace'),
      })

      if (oauthError) {
        setIntegrationErr(oauthError.message)
        setConnectingGoogle(false)
      }
    } catch {
      setIntegrationErr('Google connection failed. Please try again.')
      setConnectingGoogle(false)
    }
  }, [deployMode, emailTriageConsent, goals, googleConnected, microsoftConnected, persona, persistDraft, selectedModules, supabase])

  async function complete() {
    if (!persona) return
    if (selectedModules.length === 0) {
      setError('Select at least one module to activate.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona,
          deploy_mode: deployMode,
          active_modules: selectedModules,
          integrations: {
            google_connected: googleConnected,
            microsoft_connected: microsoftConnected,
            email_triage: emailTriageConsent,
          },
          goals,
          email_triage_consent: emailTriageConsent,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/auth/login?next=%2Fonboarding')
          return
        }
        setError(data.error ?? 'Setup failed — please try again.')
        setSaving(false)
        return
      }
      window.localStorage.removeItem(DRAFT_KEY)
      void fetch('/api/onboarding/draft', { method: 'DELETE' })
      router.push('/platform/dashboard')
    } catch {
      setError('Network error — please check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>PIOS</div>

        {/* Progress dots */}
        <div style={S.steps}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={S.dot(step === i, step > i)} />
          ))}
        </div>

        {/* Step 1 — Persona */}
        {step === 0 && (
          <>
            <h1 style={S.h1}>Who are you?</h1>
            <p style={S.sub}>This configures your intelligence stack. You can change it later.</p>

            {PERSONAS.map(p => (
              <div
                key={p.key}
                onClick={() => selectPersona(p.key)}
                style={S.pCard(persona === p.key)}
              >
                <span style={{ fontSize: 22 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 2 }}>{p.who}</div>
                </div>
              </div>
            ))}

            <button
              onClick={() => persona && setStep(1)}
              disabled={!persona}
              style={{ ...S.btn, opacity: persona ? 1 : 0.4 }}
            >
              Continue →
            </button>
          </>
        )}

        {/* Step 2 — Goals + CV */}
        {step === 1 && (
          <>
            <h1 style={S.h1}>What do you want to achieve?</h1>
            <p style={S.sub}>In 90 days, what would have to be true for you to say PIOS made a real difference?</p>

            <textarea
              value={goals}
              onChange={e => setGoals(e.target.value)}
              placeholder="e.g. My thesis chapter is submitted, my client proposals are on time, and I'm not dropping balls across any domain..."
              rows={4}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14,
                background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
                color: 'var(--pios-text)', resize: 'vertical', fontFamily: 'inherit',
                outline: 'none', marginBottom: 16, lineHeight: 1.5,
              }}
            />

            {/* CV upload */}
            <div style={{
              padding: '14px 16px', border: '1px dashed var(--pios-border)',
              borderRadius: 10, textAlign: 'center', marginBottom: 16,
              cursor: 'pointer',
            }} onClick={() => fileRef.current?.click()}>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCV(f); e.target.value = '' }}
              />
              {cvUploaded ? (
                <p style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>✓ CV uploaded — NemoClaw is calibrating</p>
              ) : uploading ? (
                <p style={{ fontSize: 13, color: 'var(--ai)' }}>Uploading...</p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--pios-sub)' }}>Upload your CV (optional)</p>
                  <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 4 }}>PDF, DOC, DOCX, TXT — makes NemoClaw significantly more accurate</p>
                </>
              )}
            </div>
            {uploadErr && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>⚠ {uploadErr}</p>}

            {error && (
              <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8, padding: '8px 12px', background: 'rgba(248,113,113,0.06)', borderRadius: 8, border: '1px solid rgba(248,113,113,0.15)' }}>
                ⚠ {error}
              </p>
            )}

            <button
              onClick={() => setStep(2)}
              style={S.btn}
            >
              Continue to modules →
            </button>

            <button
              onClick={() => setStep(0)}
              style={S.btnSec}
            >
              ← Back
            </button>
          </>
        )}

        {step === 2 && persona && (
          <>
            <h1 style={S.h1}>Choose your starting stack</h1>
            <p style={S.sub}>Recommended modules for your {PERSONA_LABELS[persona].toLowerCase()} workflow are pre-selected. Adjust anything you want before launch.</p>

            <div style={S.section}>
              {moduleOptions.map(module => {
                const selected = selectedModules.includes(module.id)
                return (
                  <div
                    key={module.id}
                    onClick={() => toggleModule(module.id)}
                    style={{
                      ...S.pCard(selected),
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: `1px solid ${selected ? 'var(--ai)' : 'var(--pios-border)'}`,
                      background: selected ? 'var(--ai)' : 'transparent',
                      color: '#fff',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                      flexShrink: 0,
                    }}>
                      {selected ? '✓' : ''}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>{module.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.5 }}>{module.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={S.section}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 10, letterSpacing: '0.02em' }}>Deployment mode</div>
              {DEPLOY_MODES.map(mode => {
                const selected = deployMode === mode.key
                return (
                  <div
                    key={mode.key}
                    onClick={() => setDeployMode(mode.key)}
                    style={{
                      ...S.pCard(selected),
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>{mode.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.5 }}>{mode.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={() => setStep(3)} style={S.btn}>
              Continue to integrations →
            </button>

            <button onClick={() => setStep(1)} style={S.btnSec}>
              ← Back
            </button>
          </>
        )}

        {step === 3 && persona && (
          <>
            <h1 style={S.h1}>Connect the inputs that matter</h1>
            <p style={S.sub}>You can launch now and connect more later, but Gmail and Calendar make the morning brief materially better.</p>

            <div style={S.section}>
              <div style={{
                ...S.pCard(googleConnected),
                alignItems: 'flex-start',
                cursor: googleConnected ? 'default' : 'pointer',
              }} onClick={() => { if (!googleConnected && !connectingGoogle) void connectGoogle() }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>Google Workspace</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.5 }}>
                    Gmail, Calendar, and Drive context for triage, briefing, and file organisation.
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: googleConnected ? '#10b981' : 'var(--pios-muted)' }}>
                  {statusLoading ? 'Checking…' : googleConnected ? 'Connected' : connectingGoogle ? 'Redirecting…' : 'Connect'}
                </div>
              </div>

              <div style={{
                ...S.pCard(microsoftConnected),
                alignItems: 'flex-start',
                cursor: 'default',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>Microsoft 365</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.5 }}>
                    Outlook and calendar support are present in the platform, but this workspace still needs Azure OAuth configured before users can connect it.
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: microsoftConnected ? '#10b981' : 'var(--pios-muted)' }}>
                  {microsoftConnected ? 'Connected' : 'Pending setup'}
                </div>
              </div>
            </div>

            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--pios-surface2)',
              border: '1px solid var(--pios-border)',
              marginBottom: 12,
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={emailTriageConsent}
                onChange={event => setEmailTriageConsent(event.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.6 }}>
                Enable AI triage on connected inboxes. Nothing sends without review, but PIOS can classify, prioritise, and draft responses immediately.
              </span>
            </label>

            {integrationErr && (
              <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>
                ⚠ {integrationErr}
              </p>
            )}

            {error && (
              <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8, padding: '8px 12px', background: 'rgba(248,113,113,0.06)', borderRadius: 8, border: '1px solid rgba(248,113,113,0.15)' }}>
                ⚠ {error}
              </p>
            )}

            <button
              onClick={complete}
              disabled={saving}
              style={{ ...S.btn, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Setting up your command centre...' : 'Take me to my command centre →'}
            </button>

            <button onClick={() => setStep(2)} style={S.btnSec}>
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
