'use client'

import { useEffect, useState } from 'react'
import ConsultingSubnav from '@/components/consulting/ConsultingSubnav'

type FrameworkRow = {
  code: string
  name: string
  step_number: number
  description: string
  usage_prompt: string | null
}

export default function ConsultingFrameworksPage() {
  const [frameworks, setFrameworks] = useState<FrameworkRow[]>([])

  useEffect(() => {
    fetch('/api/frameworks?mode=consulting')
      .then((response) => response.json())
      .then((json) => setFrameworks(json.frameworks ?? []))
      .catch(() => setFrameworks([]))
  }, [])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, margin: '0 0 6px', color: 'var(--pios-text)' }}>Consulting Framework Library</h1>
      <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 14 }}>
        Curated frameworks mapped to the 7-step consulting loop.
      </p>

      <ConsultingSubnav />

      <div style={{ display: 'grid', gap: 10 }}>
        {frameworks.map((framework) => (
          <div
            key={framework.code}
            style={{
              border: '1px solid var(--pios-border)',
              borderRadius: 10,
              padding: '12px 14px',
              background: 'var(--pios-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--pios-dim)' }}>Step {framework.step_number}</div>
                <div style={{ fontSize: 15, color: 'var(--pios-text)', fontWeight: 600 }}>{framework.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ai)', marginTop: 2 }}>{framework.code}</div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--pios-sub)' }}>{framework.description}</div>
            {framework.usage_prompt && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--pios-muted)' }}>
                <strong>Usage prompt:</strong> {framework.usage_prompt}
              </div>
            )}
          </div>
        ))}

        {frameworks.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
            No consulting frameworks found yet.
          </div>
        )}
      </div>
    </div>
  )
}
