'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const baseLinks = [
  { href: '/platform/consulting/engagements', label: 'Engagements' },
  { href: '/platform/consulting/frameworks', label: 'Frameworks' },
  { href: '/platform/consulting/templates', label: 'Templates' },
]

export default function ConsultingSubnav() {
  const pathname = usePathname()
  const [fmEnabled, setFmEnabled] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const response = await fetch('/api/profile')
        if (!response.ok) return
        const json = await response.json()
        const moduleCodes = Array.isArray(json?.profile?.active_module_codes)
          ? (json.profile.active_module_codes as string[])
          : []
        if (active) setFmEnabled(moduleCodes.includes('FM_CONSULTANT'))
      } catch {
        if (active) setFmEnabled(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const links = fmEnabled
    ? [...baseLinks, { href: '/platform/consulting/fm', label: 'FM' }]
    : baseLinks

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
      {links.map((link) => {
        const active = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: `1px solid ${active ? 'var(--ai)' : 'var(--pios-border)'}`,
              color: active ? 'var(--ai)' : 'var(--pios-muted)',
              fontSize: 12,
              textDecoration: 'none',
              background: active ? 'rgba(99,73,255,0.08)' : 'transparent',
            }}
          >
            {link.label}
          </Link>
        )
      })}
    </div>
  )
}
