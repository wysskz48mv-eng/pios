'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/platform/consulting/engagements', label: 'Engagements' },
  { href: '/platform/consulting/frameworks', label: 'Frameworks' },
  { href: '/platform/consulting/templates', label: 'Templates' },
]

export default function ConsultingSubnav() {
  const pathname = usePathname()

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
