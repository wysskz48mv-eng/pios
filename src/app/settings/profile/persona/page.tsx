'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type PersonaCardKey = 'FOUNDER' | 'FM_CONSULTANT' | 'MANAGEMENT_CONSULTANT' | 'ACADEMIC'

type ApiState = {
  active_personas: string[]
  active_modules: string[]
}

const PERSONA_CARDS: Array<{
  key: PersonaCardKey
  title: string
  personaCode: 'CEO' | 'CONSULTANT' | 'ACADEMIC'
  description: string
  modules: string[]
}> = [
  {
    key: 'FOUNDER',
    title: 'Founder',
    personaCode: 'CEO',
    description: 'Neutral consulting substrate for strategic founder execution.',
    modules: ['CONSULTING_HUB'],
  },
  {
    key: 'FM_CONSULTANT',
    title: 'FM Consultant',
    personaCode: 'CONSULTANT',
    description: 'Consulting workflows plus FM-specific approach activation.',
    modules: ['CONSULTING_HUB', 'CPD', 'FM_CONSULTANT'],
  },
  {
    key: 'MANAGEMENT_CONSULTANT',
    title: 'Management Consultant',
    personaCode: 'CONSULTANT',
    description: 'Neutral consulting frameworks with CPD support.',
    modules: ['CONSULTING_HUB', 'CPD'],
  },
  {
    key: 'ACADEMIC',
    title: 'Academic / PhD',
    personaCode: 'ACADEMIC',
    description: 'Research workflows, thesis context, and citation intelligence.',
    modules: ['ACADEMIC', 'CITATION_GRAPH', 'CPD'],
  },
]

function toCardSelection(state: ApiState | null): PersonaCardKey[] {
  if (!state) return []
  const set = new Set<PersonaCardKey>()

  if (state.active_personas.includes('CEO')) set.add('FOUNDER')
  if (state.active_personas.includes('ACADEMIC')) set.add('ACADEMIC')

  const hasConsultant = state.active_personas.includes('CONSULTANT')
  const hasFm = state.active_modules.includes('FM_CONSULTANT')
  if (hasConsultant && hasFm) set.add('FM_CONSULTANT')
  else if (hasConsultant) set.add('MANAGEMENT_CONSULTANT')

  return [...set]
}

export default function PersonaSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<PersonaCardKey[]>([])
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/profile/personas', { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as ApiState
      const cards = toCardSelection(data)
      setSelected(cards)
      setActiveModules(data.active_modules ?? [])
      setLoading(false)
    }
    void load()
  }, [])

  const activationPreview = useMemo(() => {
    const cards = PERSONA_CARDS.filter((c) => selected.includes(c.key))
    const moduleSet = new Set<string>()
    cards.forEach((c) => c.modules.forEach((m) => moduleSet.add(m)))
    return [...moduleSet]
  }, [selected])

  function toggleCard(card: PersonaCardKey) {
    setMessage('')
    setSelected((prev) => (prev.includes(card) ? prev.filter((p) => p !== card) : [...prev, card]))
  }

  async function save() {
    setSaving(true)
    setMessage('')

    const cards = PERSONA_CARDS.filter((c) => selected.includes(c.key))
    const personas = [...new Set(cards.map((c) => c.personaCode))]
    const fmConsultant = selected.includes('FM_CONSULTANT')

    const res = await fetch('/api/profile/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personas,
        primary_persona: personas[0],
        fm_consultant: fmConsultant,
      }),
    })

    const data = await res.json().catch(() => ({})) as ApiState & { error?: string }

    if (!res.ok) {
      setMessage(data.error ?? 'Failed to save persona profile')
      setSaving(false)
      return
    }

    setActiveModules(data.active_modules ?? activationPreview)
    setMessage('Profile configuration saved.')
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 20px', color: '#e6e7ee' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Configure Profile</h1>
        <Link href="/platform/dashboard" style={{ color: '#9ea5ff', textDecoration: 'none' }}>
          Back to dashboard →
        </Link>
      </div>

      <p style={{ color: '#9aa0b5', marginBottom: 20 }}>
        Select one or more personas. Frameworks remain neutral by default; FM-specific approaches only activate for FM Consultant profile.
      </p>

      {loading ? (
        <p>Loading profile…</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {PERSONA_CARDS.map((card) => {
              const active = selected.includes(card.key)
              return (
                <button
                  key={card.key}
                  onClick={() => toggleCard(card.key)}
                  style={{
                    textAlign: 'left',
                    padding: 16,
                    borderRadius: 12,
                    border: active ? '1px solid #6f73ff' : '1px solid rgba(255,255,255,0.12)',
                    background: active ? 'rgba(111,115,255,0.14)' : 'rgba(255,255,255,0.02)',
                    color: '#f6f7ff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{card.title}</div>
                  <div style={{ color: '#aeb3c6', marginTop: 8, fontSize: 13 }}>{card.description}</div>
                  <div style={{ marginTop: 10, fontSize: 11, color: '#7fd0c3' }}>
                    Activates: {card.modules.join(' · ')}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 18, padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 12, color: '#aeb3c6' }}>Module activation preview</div>
            <div style={{ marginTop: 8, fontSize: 14 }}>{activationPreview.length ? activationPreview.join(', ') : 'None selected'}</div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={save}
              disabled={saving || selected.length === 0}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #6f73ff',
                background: '#6f73ff',
                color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            {message && <span style={{ color: '#9aa0b5', fontSize: 13 }}>{message}</span>}
          </div>

          <div style={{ marginTop: 18, fontSize: 12, color: '#aeb3c6' }}>
            Active modules: {activeModules.length ? activeModules.join(', ') : 'None'}
          </div>
        </>
      )}
    </div>
  )
}
