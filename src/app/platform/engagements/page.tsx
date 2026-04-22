import Link from 'next/link'

export default function EngagementsPage() {
  return (
    <div style={{ maxWidth: 920 }}>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>Engagements</h1>
      <p style={{ color: 'var(--pios-muted)', lineHeight: 1.7 }}>
        Engagement management now runs in the Consulting Hub with a 7-step gated process, framework automation,
        and delivery templates.
      </p>

      <div style={{ marginTop: 16 }}>
        <Link
          href="/platform/consulting/engagements"
          style={{
            display: 'inline-block',
            padding: '8px 14px',
            borderRadius: 8,
            textDecoration: 'none',
            background: 'var(--ai)',
            color: '#fff',
            fontSize: 13,
          }}
        >
          Open Consulting Engagement Manager →
        </Link>
      </div>
    </div>
  )
}
