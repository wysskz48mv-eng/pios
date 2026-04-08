'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'pios-cookie-notice-dismissed'

export default function CookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== 'true')
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        maxWidth: 360,
        zIndex: 1000,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(10,11,13,0.96)',
        color: '#e2e8f0',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        padding: '14px 16px',
      }}
    >
      <p style={{ fontSize: 12, lineHeight: 1.65, color: '#cbd5e1', margin: '0 0 10px' }}>
        PIOS uses strictly necessary cookies for authentication, security, and session integrity. We do not use advertising cookies or third-party trackers.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link href="/cookies" style={{ fontSize: 12, color: '#c8a96e', textDecoration: 'none' }}>
          Cookie Policy
        </Link>
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, 'true')
            } catch {}
            setVisible(false)
          }}
          style={{
            borderRadius: 8,
            border: '1px solid rgba(200,169,110,0.3)',
            background: 'rgba(200,169,110,0.1)',
            color: '#f8fafc',
            cursor: 'pointer',
            fontSize: 12,
            padding: '7px 12px',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}