'use client'

import { useEffect } from 'react'
import { useNemoclawStore } from '@/stores/useNemoclawStore'

export default function AiPage() {
  const { open, setFullscreen } = useNemoclawStore()

  useEffect(() => {
    open()
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [open, setFullscreen])

  return (
    <div className="pios-card" style={{ maxWidth: 860, margin: '24px auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>NemoClaw Workspace</h1>
      <p style={{ color: 'var(--pios-muted)', lineHeight: 1.7 }}>
        NemoClaw is now the single persistent assistant across PIOS. This page opens the same assistant in expanded mode,
        while every module keeps the docked panel available with the same session and memory.
      </p>
      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--pios-dim)' }}>
        Tip: use the panel "Dock" button to return to split-screen while staying on this page.
      </p>
    </div>
  )
}
