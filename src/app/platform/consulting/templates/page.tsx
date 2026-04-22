import ConsultingSubnav from '@/components/consulting/ConsultingSubnav'

const TEMPLATE_GROUPS = [
  {
    title: 'Kickoff & Discovery',
    templates: [
      'Kickoff briefing agenda',
      'Stakeholder map and decision authority matrix',
      'Scope and constraints checklist',
    ],
  },
  {
    title: 'Execution & Governance',
    templates: [
      'Interim progress report',
      'Meeting minutes with action tracking',
      'Risk register (ISO-aligned)',
    ],
  },
  {
    title: 'Closeout & Handover',
    templates: [
      'Final recommendations report',
      'Soft landing knowledge transfer checklist',
      'Closeout lessons learned summary',
    ],
  },
]

export default function ConsultingTemplatesPage() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, margin: '0 0 6px', color: 'var(--pios-text)' }}>Consulting Templates</h1>
      <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 14 }}>
        Standardized templates aligned with FM Consultant execution and quality gates.
      </p>

      <ConsultingSubnav />

      <div style={{ display: 'grid', gap: 12 }}>
        {TEMPLATE_GROUPS.map((group) => (
          <section
            key={group.title}
            style={{
              border: '1px solid var(--pios-border)',
              borderRadius: 10,
              padding: '12px 14px',
              background: 'var(--pios-card)',
            }}
          >
            <h2 style={{ fontSize: 16, margin: 0, color: 'var(--pios-text)' }}>{group.title}</h2>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
              {group.templates.map((template) => (
                <li key={template} style={{ fontSize: 13, color: 'var(--pios-sub)', marginBottom: 6 }}>
                  {template}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
