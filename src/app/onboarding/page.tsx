'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CCTheme } from '@/lib/themes'
import { PERSONA_PACKAGING, type CanonicalPersona } from '@/lib/persona-packaging'
import styles from './onboarding.module.css'

type Persona = CanonicalPersona

interface PersonaOption {
  id: Persona
  label: string
  tagline: string
  desc: string
  modules: string[]
  price: string
}

interface ThemeOption {
  id: CCTheme
  name: string
  tagline: string
  persona: string
  recommendedFor: Persona[]
  bg: string
  surf: string
  accent: string
  text: string
  preview: string[]
}

const PERSONAS: PersonaOption[] = [
  ...PERSONA_PACKAGING.map((persona) => ({
    id: persona.id,
    label: persona.label,
    tagline: persona.tagline,
    desc: persona.description,
    modules: persona.modules,
    price: persona.priceLabel,
  })),
]

const THEMES: ThemeOption[] = [
  {
    id: 'onyx',
    name: 'Onyx',
    tagline: 'Executive intelligence',
    persona: 'Dark · Gold · Editorial',
    recommendedFor: ['CEO', 'EXECUTIVE'],
    bg: '#07080D',
    surf: '#0F1117',
    accent: '#C8A96E',
    text: '#E8E3DC',
    preview: ['Morning Brief', 'Decision Queue', 'Stakeholders', 'NemoClaw™'],
  },
  {
    id: 'meridian',
    name: 'Meridian',
    tagline: 'Professional precision',
    persona: 'Light · Navy · Minimal',
    recommendedFor: ['CONSULTANT'],
    bg: '#FAFAF8',
    surf: '#FFFFFF',
    accent: '#2563EB',
    text: '#0F172A',
    preview: ['Email Triage', 'Engagements', 'Frameworks', 'Financials'],
  },
  {
    id: 'signal',
    name: 'Signal',
    tagline: 'Academic clarity',
    persona: 'Warm Dark · Amber · Organic',
    recommendedFor: ['ACADEMIC'],
    bg: '#0F1311',
    surf: '#161C19',
    accent: '#E8A030',
    text: '#E4E8E1',
    preview: ['Thesis Progress', 'Deadlines', 'Literature', 'Supervision'],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [persona, setPersona] = useState<Persona>('CEO')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [org, setOrg] = useState('')
  const [theme, setTheme] = useState<CCTheme>('onyx')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedTheme = window.sessionStorage.getItem('pios_onboarding_theme')
    if (savedTheme === 'onyx' || savedTheme === 'meridian' || savedTheme === 'signal') {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem('pios_onboarding_theme', theme)
  }, [theme])

  function handlePersonaSelect(nextPersona: Persona) {
    setPersona(nextPersona)
  }

  async function handleComplete() {
    if (!supabase) {
      setError('PIOS is temporarily unavailable. Please refresh in a moment.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let cvFilename: string | null = null
      let cvStoragePath: string | null = null

      if (cvFile) {
        const ext = cvFile.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const path = `${user.id}/cv-${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('pios-cv')
          .upload(path, cvFile, { upsert: true, contentType: cvFile.type || undefined })

        if (uploadErr) {
          throw new Error(uploadErr.message || 'Could not save CV. Please try again.')
        }

        cvFilename = cvFile.name
        cvStoragePath = path
      }

      await fetch('/api/onboarding/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 2,
          persona,
          goals: '',
          active_modules: [],
          deploy_mode: 'full',
        }),
      })

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_type: persona,
          goals: '',
          command_centre_theme: theme,
          ...(name && { full_name: name }),
          ...(role && { job_title: role }),
          ...(org && { organisation: org }),
          ...(cvFilename && { cv_filename: cvFilename }),
          ...(cvStoragePath && { cv_storage_path: cvStoragePath }),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Onboarding failed')
      }

      router.push('/platform/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
    return (
      <div className={styles.page}>
        <div className={styles.stepHeader}>
          <div className={styles.logo}>PIOS</div>
          <div className={styles.progress}>
            <div className={`${styles.progressStep} ${styles.active}`}>1</div>
            <div className={styles.progressLine}></div>
            <div className={styles.progressStep}>2</div>
          </div>
        </div>
        <div className={styles.stepContent}>
          <div className={styles.stepIntro}>
            <span className={styles.stepTag}>Step 1 of 2</span>
            <h2 className={styles.stepTitle}>Who are you?</h2>
            <p className={styles.stepSub}>
              Select your primary context. Your command centre modules, morning brief, and
              NemoClaw™ calibration will be built around this.
            </p>
          </div>
          <div className={styles.personaGrid}>
            {PERSONAS.map((option) => (
              <button
                key={option.id}
                className={`${styles.personaCard} ${persona === option.id ? styles.personaCardSelected : ''}`}
                onClick={() => handlePersonaSelect(option.id)}
              >
                <div className={styles.pcTag}>{option.label}</div>
                <div className={styles.pcTitle}>{option.tagline}</div>
                <p className={styles.pcDesc}>{option.desc}</p>
                <div className={styles.pcModules}>
                  {option.modules.map((module) => (
                    <span key={module} className={styles.pcMod}>{module}</span>
                  ))}
                </div>
                <div className={styles.pcPrice}>{option.price}</div>
              </button>
            ))}
          </div>
          <div className={styles.stepActions}>
            <button className={styles.nextBtn} onClick={() => setStep(2)}>
              Continue →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.stepHeader}>
        <div className={styles.logo}>PIOS</div>
        <div className={styles.progress}>
          <div className={`${styles.progressStep} ${styles.done}`}>✓</div>
          <div className={`${styles.progressLine} ${styles.done}`}></div>
          <div className={`${styles.progressStep} ${styles.active}`}>2</div>
        </div>
      </div>

      <div className={styles.stepContent}>
        <div className={styles.stepIntro}>
          <span className={styles.stepTag}>Step 2 of 2</span>
          <h2 className={styles.stepTitle}>Calibrate your command centre.</h2>
          <p className={styles.stepSub}>
            Tell NemoClaw™ who you are, and choose the command centre design that
            feels right for how you work.
          </p>
        </div>

        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Full name</label>
            <input
              className={styles.fieldInput}
              type="text"
              placeholder="Douglas Masuku"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Role / title</label>
            <input
              className={styles.fieldInput}
              type="text"
              placeholder="CEO & Founder"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.fieldFull}>
          <label className={styles.fieldLabel}>Organisation</label>
          <input
            className={styles.fieldInput}
            type="text"
            placeholder="VeritasIQ Technologies Ltd"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          />
        </div>

        <div className={styles.themeSection}>
          <h3 className={styles.themeSectionTitle}>Choose your command centre</h3>
          <p className={styles.themeSectionSub}>
            You can change this at any time from Settings. Your choice affects the
            layout, colour scheme, and module arrangement.
          </p>
          <div className={styles.themeGrid}>
            {THEMES.map((option) => (
              <button
                key={option.id}
                className={`${styles.themeCard} ${theme === option.id ? styles.themeCardSelected : ''}`}
                onClick={() => setTheme(option.id)}
              >
                <div className={styles.themePreview} style={{ background: option.bg, border: `1px solid ${option.accent}22` }}>
                  <div className={styles.tpNav} style={{ background: option.surf, borderBottom: `1px solid ${option.accent}18` }}>
                    <div className={styles.tpLogo} style={{ color: option.accent, fontFamily: 'Cormorant Garamond, serif' }}>PIOS</div>
                    <div className={styles.tpDots}>
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className={styles.tpDot} style={{ background: index === 0 ? option.accent : `${option.text}18` }}></div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.tpBody}>
                    <div className={styles.tpSidebar} style={{ background: option.surf, borderRight: `1px solid ${option.accent}18` }}>
                      {[0, 1, 2, 3, 4].map((index) => (
                        <div
                          key={index}
                          className={styles.tpSideItem}
                          style={{ background: index === 0 ? `${option.accent}18` : 'transparent', borderRadius: '3px' }}
                        >
                          <div className={styles.tpSideIcon} style={{ background: index === 0 ? option.accent : `${option.text}22`, borderRadius: '3px' }}></div>
                        </div>
                      ))}
                    </div>
                    <div className={styles.tpMain}>
                      <div className={styles.tpCard} style={{ background: option.surf, border: `1px solid ${option.accent}18` }}>
                        <div className={styles.tpCardLine} style={{ background: `${option.accent}60`, width: '70%' }}></div>
                        <div className={styles.tpCardLine} style={{ background: `${option.text}20`, width: '90%' }}></div>
                        <div className={styles.tpCardLine} style={{ background: `${option.text}15`, width: '60%' }}></div>
                      </div>
                      <div className={styles.tpModuleRow}>
                        {[0, 1, 2].map((index) => (
                          <div key={index} className={styles.tpModule} style={{ background: option.surf, border: `1px solid ${option.accent}18`, flex: 1 }}>
                            <div style={{ width: '16px', height: '3px', background: option.accent, opacity: 0.5, borderRadius: '2px', marginBottom: '4px' }}></div>
                            <div style={{ width: '24px', height: '2px', background: `${option.text}25`, borderRadius: '1px' }}></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={styles.tpModuleList} style={{ borderTop: `1px solid ${option.accent}18` }}>
                    {option.preview.map((preview) => (
                      <span
                        key={preview}
                        className={styles.tpModulePill}
                        style={{ color: option.accent, background: `${option.accent}12`, border: `1px solid ${option.accent}20` }}
                      >
                        {preview}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.themeInfo}>
                  <div className={styles.themeInfoRow}>
                    <span className={styles.themeName}>{option.name}</span>
                    {theme === option.id && <span className={styles.themeSelected}>Selected</span>}
                  </div>
                  <span className={styles.themeTagline}>{option.tagline}</span>
                  {option.recommendedFor.includes(persona) && (
                    <span className={styles.themeRecommended}>Recommended for {PERSONAS.find((p) => p.id === persona)?.label}</span>
                  )}
                  <span className={styles.themePersona}>{option.persona}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.cvSection}>
          <h3 className={styles.cvTitle}>Calibrate NemoClaw™ <span>(optional)</span></h3>
          <p className={styles.cvSub}>
            Upload your CV, LinkedIn export, or bio. NemoClaw™ reads it once to ground
            every response in your actual professional context. Never stored externally.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            style={{ display: 'none' }}
            onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
          />
          <div className={styles.cvDrop} onClick={() => fileRef.current?.click()}>
            {cvFile ? (
              <p className={styles.cvFileName}>
                ✓ {cvFile.name}
                <button
                  onClick={(e) => { e.stopPropagation(); setCvFile(null) }}
                  className={styles.cvRemove}
                >
                  ✕
                </button>
              </p>
            ) : (
              <>
                <div className={styles.cvIcon}>⬆</div>
                <p className={styles.cvText}>
                  Drop your CV here or click to browse<br />
                  <span>PDF · DOCX · Max 10MB</span>
                </p>
              </>
            )}
          </div>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <div className={styles.stepActions}>
          <button className={styles.backBtn} onClick={() => setStep(1)}>
            ← Back
          </button>
          <button className={styles.completeBtn} onClick={handleComplete} disabled={loading}>
            {loading ? 'Setting up…' : 'Enter command centre →'}
          </button>
        </div>
      </div>
    </div>
  )
}
