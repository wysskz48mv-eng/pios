'use client'
import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Policy Intelligence Coach — adaptive learning module
// Based on PIOS_Policy_Intelligence_Coach.html
// 7 lessons: Why Policies, Register, ISO 9001, ISO 27001, Auditing, VIQ Register, Action Plan
// PIOS v2.9 | VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const ROLES = [
  { key: 'ops',        icon: '🛡️', name: 'Compliance & Operations', desc: 'ISO 27001, SOC 2, HR, SOPs, Insurance' },
  { key: 'cx',         icon: '🤝', name: 'Customer Experience',      desc: 'UAT, Onboarding, Helpdesk, Training' },
  { key: 'tech',       icon: '☁️', name: 'Cloud & Infrastructure',   desc: 'Cloud, Security, Dev, Infrastructure' },
  { key: 'commercial', icon: '📈', name: 'Commercial & Marketing',   desc: 'BD, Marketing, Legal, Finance support' },
  { key: 'ceo',        icon: '👑', name: 'CEO & Founder',            desc: 'Strategy, product, investor relations' },
]

const LESSONS = [
  { id: 0, icon: '📚', title: 'Why policies exist',                   tag: 'Foundation',       mins: 8  },
  { id: 1, icon: '🗂️', title: 'The Master Policy Register',           tag: 'Policy Management', mins: 10 },
  { id: 2, icon: '🏆', title: 'ISO 9001 — Quality Management',        tag: 'ISO Standards',     mins: 12 },
  { id: 3, icon: '🔒', title: 'ISO 27001 — Information Security',      tag: 'ISO Standards',     mins: 15 },
  { id: 4, icon: '🔍', title: 'Auditing — How we know it works',       tag: 'Compliance',        mins: 10 },
  { id: 5, icon: '🏢', title: "VeritasIQ's Policy Programme",          tag: 'VeritasIQ Context', mins: 8  },
  { id: 6, icon: '🎯', title: 'Your Personalised Action Plan',         tag: 'Action Plan',       mins: 5  },
]

const TAG_COLOR: Record<string, string> = {
  'Foundation':        'var(--ai)',
  'Policy Management': '#60a5fa',
  'ISO Standards':     '#34d399',
  'Compliance':        '#fbbf24',
  'VeritasIQ Context': '#f472b6',
  'Action Plan':       '#fb923c',
}

// ─── LESSON CONTENT ───────────────────────────────────────────────────────────

function LessonContent({ lessonId, role, name, onComplete, completed }: {
  lessonId: number; role: string; name: string; onComplete: () => void; completed: boolean
}) {
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null)
  const roleName = ROLES.find(r => r.key === role)?.name ?? role

  function Callout({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
    return (
      <div style={{ padding: '14px 18px', borderRadius: 10, background: 'var(--pios-surface2)', borderLeft: '3px solid var(--ai)', margin: '16px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ai)', marginBottom: 6 }}>{icon} {title}</div>
        <div style={{ fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.75 }}>{children}</div>
      </div>
    )
  }

  function PersonaBar({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--ai-subtle)', border: '1px solid rgba(155,135,245,0.2)', margin: '0 0 20px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{ROLES.find(r => r.key === role)?.icon ?? '👤'}</span>
        <div style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.65 }}>{children}</div>
      </div>
    )
  }

  function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
    return (
      <div style={{ overflowX: 'auto', margin: '16px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--pios-surface3)' }}>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--pios-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--pios-border2)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--pios-border)' }}>
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: '8px 12px', color: 'var(--pios-sub)', verticalAlign: 'top', lineHeight: 1.5 }}
                    dangerouslySetInnerHTML={{ __html: cell }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function Quiz({ options, correctIdx, feedbacks }: { options: string[]; correctIdx: number; feedbacks: string[] }) {
    return (
      <div style={{ margin: '24px 0', padding: '18px', borderRadius: 10, background: 'var(--pios-surface2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Knowledge check</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map((opt, i) => {
            const isAnswered = quizAnswer !== null
            const isCorrect = i === correctIdx
            const isSelected = quizAnswer === i
            const bg = !isAnswered ? 'var(--pios-surface)' : isCorrect ? 'rgba(34,197,94,0.1)' : isSelected ? 'rgba(239,68,68,0.1)' : 'var(--pios-surface)'
            const border = !isAnswered ? 'var(--pios-border)' : isCorrect ? 'rgba(34,197,94,0.4)' : isSelected ? 'rgba(239,68,68,0.4)' : 'var(--pios-border)'
            return (
              <button key={i} onClick={() => !isAnswered && setQuizAnswer(i)}
                style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: `1px solid ${border}`, background: bg, cursor: isAnswered ? 'default' : 'pointer', fontSize: 13, color: 'var(--pios-text)', transition: 'all 0.15s', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, fontSize: 11, marginTop: 2, color: isAnswered && isCorrect ? 'var(--fm)' : isAnswered && isSelected ? 'var(--dng)' : 'var(--pios-dim)' }}>
                  {isAnswered && isCorrect ? '✓' : isAnswered && isSelected ? '✗' : `${String.fromCharCode(65+i)}.`}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
        {quizAnswer !== null && (
          <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 8, background: quizAnswer === correctIdx ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.65, borderLeft: `3px solid ${quizAnswer === correctIdx ? 'var(--fm)' : 'var(--dng)'}` }}>
            {feedbacks[quizAnswer]}
          </div>
        )}
      </div>
    )
  }

  function NextSteps({ steps }: { steps: { n: string; d: string }[] }) {
    return (
      <div style={{ margin: '24px 0', padding: '18px', borderRadius: 10, background: 'var(--pios-surface2)', borderLeft: '3px solid var(--fm)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fm)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your next steps</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', color: 'var(--fm)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i+1}</span>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 2 }}>{s.n}</div><div style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.55 }}>{s.d}</div></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function Footer() {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid var(--pios-border)', marginTop: 24 }}>
        {completed
          ? <span style={{ fontSize: 13, color: 'var(--fm)', fontWeight: 600 }}>✓ Lesson complete</span>
          : <button className="pios-btn pios-btn-primary" onClick={onComplete} style={{ fontSize: 13 }}>Mark complete & continue →</button>
        }
      </div>
    )
  }

  const p = { name, role, roleName }

  // ── LESSON BODIES ──────────────────────────────────────────────────────────

  if (lessonId === 0) return (
    <div>
      <PersonaBar>
        <strong>{p.name}</strong>, as <strong>{p.roleName}</strong> — this module will walk you through everything VeritasIQ needs to know about policies, procedures, and ISO certification, starting from first principles.
      </PersonaBar>
      <p style={{ fontSize: 14, color: 'var(--pios-text)', lineHeight: 1.8, marginBottom: 16 }}>
        Imagine you hired five people and said "just figure it out" — no guidance, no rules, no written expectations. Some would do things brilliantly. Others would make expensive mistakes. Two might handle customer data in completely different ways.
      </p>
      <p style={{ fontSize: 14, color: 'var(--pios-text)', lineHeight: 1.8, marginBottom: 16 }}>
        That is exactly what <strong style={{ color: 'var(--pios-text)' }}>policies and procedures exist to prevent.</strong>
      </p>
      <Callout icon="📌" title="The fundamental purpose of policies">
        Policies create <strong>consistent, repeatable, defensible behaviour</strong> across an organisation — regardless of who is doing the work, when, or whether anyone is watching. They turn individual good judgement into organisational reliability.
      </Callout>
      <p style={{ fontSize: 14, color: 'var(--pios-text)', lineHeight: 1.8, marginBottom: 16 }}>
        There is a second purpose that matters enormously for VeritasIQ specifically: <strong style={{ color: 'var(--pios-text)' }}>policies prove to the outside world that you are trustworthy.</strong> Enterprise clients, ISO certification bodies, auditors, and investors all look for documented policies. Without policies, you cannot achieve ISO certification. Without ISO certification, major clients — including Qiddiya City — will not contract with you.
      </p>
      <Callout icon="✅" title="The three things every policy does">
        <strong>1. Sets expectations</strong> — It tells everyone what behaviour is required.<br/>
        <strong>2. Enables accountability</strong> — If expectations are clear and written, you can fairly hold people to them.<br/>
        <strong>3. Provides evidence</strong> — When an auditor asks "how do you handle X?", you hand them the policy.
      </Callout>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 24, color: 'var(--pios-text)' }}>Policies vs Procedures — what is the difference?</h3>
      <Table
        headers={['Type', 'What it says', 'Example']}
        rows={[
          ['<strong>Policy</strong>', '<em>What</em> we do and <em>why</em>', '"We protect all personal data in line with UK GDPR"'],
          ['<strong>Procedure / SOP</strong>', '<em>How</em> we do it, step by step', '"Step 1: Verify client identity before sharing any data…"'],
          ['<strong>Standard</strong>', 'Specific requirements or benchmarks', '"All passwords must be minimum 12 characters with MFA"'],
          ['<strong>Guideline</strong>', 'Recommended good practice', '"Aim to reply to support tickets within 4 hours"'],
        ]}
      />
      <Callout icon="⚠️" title="The biggest policy mistake startups make">
        Writing policies nobody reads and never updates. A policy that is not <strong>communicated, trained, tested, and reviewed</strong> is worse than no policy — it gives false confidence.
      </Callout>
      <Quiz
        options={[
          "It will help us get ISO certification faster",
          "It is the easiest policy to write",
          "We hold sensitive client data, have a legal obligation under GDPR, and enterprise clients require it",
          "Our competitors all have data protection policies",
        ]}
        correctIdx={2}
        feedbacks={[
          "ISO certification helps, but the immediate driver is that we hold sensitive client and user data and are legally required under UK GDPR to protect it.",
          "Data protection is actually one of the more complex policies to write correctly — this is not the reason.",
          "Exactly right. We hold personal data across all three platforms. UK GDPR creates a legal obligation, and enterprise buyers like Qiddiya City will require evidence of our data protection controls before signing contracts.",
          "That alone is never a sufficient reason for a policy decision.",
        ]}
      />
      <NextSteps steps={[
        { n: 'Create the Google Drive folder', d: 'Set up VIQ-Policies folder in shared Google Drive. This is where every policy will live. Do this today.' },
        { n: 'Download a policy register template', d: 'Search "ISO 27001 policy register template" — download a spreadsheet version. You will customise it in Lesson 2.' },
        { n: 'Tell Douglas you have started', d: 'Send a quick message: "I have begun the PIOS policy coaching module and will have the policy register structure ready to show you at Monday stand-up."' },
      ]} />
      <Footer />
    </div>
  )

  if (lessonId === 1) return (
    <div>
      <PersonaBar>
        <strong>{p.name}</strong>, as Compliance & Operations Lead, <strong>you own and maintain the Master Policy Register</strong>. This lesson explains exactly what it is and how to build it.
      </PersonaBar>
      <p style={{ fontSize: 14, color: 'var(--pios-text)', lineHeight: 1.8, marginBottom: 16 }}>
        A <strong style={{ color: 'var(--pios-text)' }}>Master Policy Register</strong> is a single document — typically a spreadsheet — that lists every policy, procedure, standard, and guideline that VeritasIQ Technologies Ltd has created, approved, or still needs to create. It is your command centre for the entire compliance programme.
      </p>
      <Callout icon="📌" title="Why the register matters">
        When an ISO auditor arrives, the first thing they ask for is your policy register. It tells them immediately whether you have a <em>managed</em> compliance programme or an <em>ad-hoc</em> collection of random documents. A clean, complete register signals professionalism before a single policy is opened.
      </Callout>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 24, color: 'var(--pios-text)' }}>What the register must contain</h3>
      <Table
        headers={['Field', 'Description', 'Example']}
        rows={[
          ['<code style="font-size:11px;background:var(--pios-surface3);padding:2px 6px;border-radius:4px">Policy ID</code>', 'Unique reference', 'VIQ-POL-001'],
          ['<code style="font-size:11px;background:var(--pios-surface3);padding:2px 6px;border-radius:4px">Policy Name</code>', 'Clear title', 'Data Protection Policy'],
          ['<code style="font-size:11px;background:var(--pios-surface3);padding:2px 6px;border-radius:4px">Category</code>', 'Topic area', 'Information Security'],
          ['<code style="font-size:11px;background:var(--pios-surface3);padding:2px 6px;border-radius:4px">Owner</code>', 'Who maintains it', 'Siphathisiwe Masuku'],
          ['<code style="font-size:11px;background:var(--pios-surface3);padding:2px 6px;border-radius:4px">Approver</code>', 'Who signs it off', 'Douglas Masuku'],
          ['<code style="font-size:11px;background:var(--pios-surface3);padding:2px 6px;border-radius:4px">Version</code>', 'Current version number', 'v1.0'],
          ['<code style="font-size:11px;background:var(--pios-surface3);padding:2px 6px;border-radius:4px">Status</code>', 'Where it currently stands', 'Draft / Approved / Under Review'],
          ['<code style="font-size:11px;background:var(--pios-surface3);padding:2px 6px;border-radius:4px">Review Date</code>', 'Next scheduled review', '31 Mar 2027'],
          ['<code style="font-size:11px;background:var(--pios-surface3);padding:2px 6px;border-radius:4px">ISO Link</code>', 'Which standard it satisfies', 'ISO 27001 §5.2'],
        ]}
      />
      <Callout icon="✅" title="The 20 policies VeritasIQ needs">
        In order of priority: Information Security, Data Protection, Acceptable Use, Code of Conduct, Access Control, Incident Response, Business Continuity, Change Management, Supplier Security, Quality Management, HR Policy, Whistleblowing, Anti-Bribery, Financial Controls, Document Control, Risk Management, Asset Management, Physical Security, Training & Awareness, and Remote Working.
      </Callout>
      <NextSteps steps={[
        { n: 'Create your Master Policy Register spreadsheet', d: 'Use the fields from this lesson. Start with 20 rows — one per policy. Set status to "Not Started" for everything.' },
        { n: 'Schedule policy drafting time', d: 'Block 2 hours every Tuesday and Thursday specifically for policy writing. Consistent scheduled time beats ad-hoc sprints.' },
        { n: 'Download the ISO 27001 standard summary', d: 'BSI and several bodies publish free ISO 27001 plain-language guides. Download one so you have the control numbers beside you when writing.' },
      ]} />
      <Footer />
    </div>
  )

  if (lessonId === 2) return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--pios-text)', lineHeight: 1.8, marginBottom: 16 }}>
        <strong style={{ color: 'var(--pios-text)' }}>ISO 9001</strong> is the world's most recognised quality management standard. Over one million organisations in 170 countries hold it. It gives you a <strong style={{ color: 'var(--pios-text)' }}>systematic framework</strong> for consistently meeting customer requirements and improving over time.
      </p>
      <Callout icon="📌" title="The core idea of ISO 9001">
        If you <strong>say what you do, do what you say, prove it, and improve it</strong> — that is the entire philosophy of ISO 9001 in one sentence. The certification process is simply an independent verification that you are actually doing this.
      </Callout>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 24, color: 'var(--pios-text)' }}>The 7 Quality Management Principles</h3>
      <Table
        headers={['#', 'Principle', 'What it means for VeritasIQ']}
        rows={[
          ['<strong>1</strong>', 'Customer Focus', 'KSP and Qiddiya requirements drive every product decision'],
          ['<strong>2</strong>', 'Leadership', 'Douglas sets the quality tone — it must be visible and consistent'],
          ['<strong>3</strong>', 'Engagement of People', 'Every team member understands how their role affects quality'],
          ['<strong>4</strong>', 'Process Approach', 'We manage activities as interconnected processes, not isolated tasks'],
          ['<strong>5</strong>', 'Improvement', 'We formally review, learn, and iterate after every sprint and client engagement'],
          ['<strong>6</strong>', 'Evidence-Based Decisions', 'Decisions are based on data — UAT scores, bug rates, client feedback'],
          ['<strong>7</strong>', 'Relationship Management', 'Our supplier and partner relationships are managed systematically'],
        ]}
      />
      <Callout icon="✅" title="ISO 9001 and PIOS UAT">
        The UAT currently running is itself evidence of ISO 9001 alignment — it is a structured quality verification process with defined pass criteria (average ≥ 4.0/5.0). Document it as such.
      </Callout>
      <NextSteps steps={[
        { n: 'Draft the Quality Management Policy (VIQ-POL-008)', d: 'One page. Purpose: what quality means for VeritasIQ. Scope: all three products. Commitment: meeting client requirements consistently.' },
        { n: 'Connect with Samantha on UAT quality objectives', d: 'Ask Samantha: "What measurable pass/fail criteria are in your UAT test scripts?" These become our quality metrics for ISO 9001 alignment.' },
      ]} />
      <Footer />
    </div>
  )

  if (lessonId === 3) return (
    <div>
      <PersonaBar>
        <strong>{p.name}</strong> — <strong>ISO 27001 is the single most commercially critical certification VeritasIQ can achieve.</strong> Enterprise clients — especially government-linked entities like Qiddiya City — will require it. This lesson gives you everything you need to understand what you are leading.
      </PersonaBar>
      <p style={{ fontSize: 14, color: 'var(--pios-text)', lineHeight: 1.8, marginBottom: 16 }}>
        <strong style={{ color: 'var(--pios-text)' }}>ISO 27001</strong> is the international standard for Information Security Management Systems (ISMS). It provides a framework for managing the security of your information assets — client data, platform code, financial records, and intellectual property.
      </p>
      <Callout icon="📌" title="Why ISO 27001 is our top priority">
        We are a SaaS company that holds data from clients across three platforms. We are targeting enterprise government clients. We are storing financial data, FM operational data, and journalistic investigation data. <strong>Every single one of these facts makes ISO 27001 non-optional.</strong> It is the price of entry to enterprise markets.
      </Callout>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 24, color: 'var(--pios-text)' }}>The 4 ISO 27001 Themes (Annex A)</h3>
      <Table
        headers={['Theme', 'Focus area', 'Key controls for VeritasIQ']}
        rows={[
          ['<strong>A — Organisational</strong>', 'Policies, roles, responsibilities', 'Information Security Policy, Roles & responsibilities, Supplier relationships'],
          ['<strong>B — People</strong>', 'HR security, awareness, training', 'Background checks, security training, disciplinary process'],
          ['<strong>C — Physical</strong>', 'Physical access, equipment', 'Home office security, screen lock policy, secure disposal'],
          ['<strong>D — Technological</strong>', 'Technical controls', 'MFA (done ✓), encryption, logging, vulnerability management, access control'],
        ]}
      />
      <Callout icon="✅" title="Where VeritasIQ already is">
        MFA is enforced across GitHub, Supabase, Vercel, Resend, and Anthropic (R-001 closed). Cloudflare security worker deployed (R-015 closed). Supplier DPAs sent to Vercel, Supabase, Anthropic, and Resend. Stage 1 audit booking emails drafted for NQA, BSI, and LRQA.
      </Callout>
      <NextSteps steps={[
        { n: 'Identify and contact 3 ISO 27001 certifying bodies', d: 'Contact BSI (bsigroup.com), Bureau Veritas, and NQA for quotes. Ask for: Stage 1 + Stage 2 audit cost, timeline, what documentation they need up front.' },
        { n: 'Draft the Information Security Policy (VIQ-POL-001)', d: 'This is the top-level document — one page, signed by Douglas. Start with a template and adapt it. It must reference our commitment to ISO 27001.' },
        { n: 'Brief Richard on the technical controls needed', d: 'Share the ISO 27001 Theme D (Technological) control list with Richard. Ask him to map current state: "Done / In Progress / Not Started".' },
      ]} />
      <Footer />
    </div>
  )

  if (lessonId === 4) return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--pios-text)', lineHeight: 1.8, marginBottom: 16 }}>
        The word "audit" makes many people anxious. It shouldn't. An audit is simply <strong style={{ color: 'var(--pios-text)' }}>a systematic, independent review of whether your organisation is doing what it says it does.</strong> It is not a trap. It is a quality check — and if you have done the work, it should feel straightforward.
      </p>
      <Callout icon="📌" title="The three types of audit VeritasIQ will experience">
        <strong>First-party (internal audit):</strong> Siphathisiwe audits our own compliance — checking policies are being followed. This happens before the external audit and is essential preparation.<br/><br/>
        <strong>Second-party audit:</strong> A client (like Qiddiya City) audits us as part of their supplier qualification process. They want to know their data is safe with us.<br/><br/>
        <strong>Third-party audit:</strong> An independent certifying body (like BSI) audits us for ISO certification. This is the most formal — and results in certification.
      </Callout>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 24, color: 'var(--pios-text)' }}>What happens during an ISO audit?</h3>
      <Table
        headers={['Phase', 'What the auditor does', 'What you need ready']}
        rows={[
          ['<strong>Document review</strong>', 'Reviews policies, procedures, risk register, SoA, training records', 'Master Policy Register · All approved policies · Training completion records'],
          ['<strong>Interviews</strong>', 'Talks to team members to test if they understand their responsibilities', 'Brief all team members · Ensure everyone knows their role in the ISMS'],
          ['<strong>Evidence inspection</strong>', 'Checks logs, access records, incident reports, change records', 'Vercel logs · Supabase audit logs · MFA records · Penetration test report'],
          ['<strong>Findings</strong>', 'Issues Major NCs, Minor NCs, or Observations', 'A Minor NC can be fixed — respond within agreed timescale. A Major NC delays certification.'],
        ]}
      />
      <NextSteps steps={[
        { n: 'Schedule internal audit for October 2026', d: 'Add it to Google Calendar. Title: "VIQ Internal ISMS Audit — Siphathisiwe leads". Duration: full day. All team to be available for interview.' },
        { n: 'Create an audit evidence folder', d: 'In Google Drive: VIQ-ISMS-Evidence. Sub-folders: Policies, Training Records, Technical Evidence, Risk Register, Supplier Agreements.' },
        { n: 'Brief the team on what to expect', d: 'A 15-minute call with all four team members explaining what an audit interview looks like — what questions to expect, how to answer honestly and confidently.' },
      ]} />
      <Footer />
    </div>
  )

  if (lessonId === 5) return (
    <div>
      <PersonaBar>
        <strong>{p.name}</strong>, this lesson brings everything together in the specific context of <strong>VeritasIQ Technologies Ltd</strong>. Every policy, every owner, every deadline — applied to our actual situation.
      </PersonaBar>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--pios-text)' }}>Policy Development Schedule — VeritasIQ 2026</h3>
      <Table
        headers={['Policy', 'Ref', 'Author', 'Approver', 'Deadline', 'ISO Link']}
        rows={[
          ['<strong>Information Security Policy</strong>', 'VIQ-POL-001', 'Siphathisiwe', 'Douglas', '<span style="color:var(--dng);font-weight:600">May 2026</span>', 'ISO 27001 §5.2'],
          ['<strong>Data Protection & Privacy Policy</strong>', 'VIQ-POL-002', 'Siphathisiwe', 'Douglas', '<span style="color:var(--dng);font-weight:600">May 2026</span>', 'GDPR / ISO 27001'],
          ['<strong>Acceptable Use Policy</strong>', 'VIQ-POL-003', 'Siphathisiwe', 'Douglas', '<span style="color:var(--dng);font-weight:600">May 2026</span>', 'ISO 27001 A.8.1'],
          ['<strong>Code of Conduct</strong>', 'VIQ-POL-004', 'Siphathisiwe', 'Douglas', '<span style="color:var(--dng);font-weight:600">May 2026</span>', 'ISO 27001 A.6.2'],
          ['<strong>Access Control Policy</strong>', 'VIQ-POL-005', 'Richard', 'Douglas', '<span style="color:var(--saas);font-weight:600">Jun 2026</span>', 'ISO 27001 A.8.2'],
          ['<strong>Incident Response Policy</strong>', 'VIQ-POL-006', 'Richard', 'Douglas', '<span style="color:var(--saas);font-weight:600">Jun 2026</span>', 'ISO 27001 A.5.24'],
          ['<strong>Business Continuity Policy</strong>', 'VIQ-POL-007', 'Siphathisiwe', 'Douglas', '<span style="color:var(--fm);font-weight:600">Jul 2026</span>', 'ISO 22301'],
          ['<strong>Quality Management Policy</strong>', 'VIQ-POL-008', 'Siphathisiwe', 'Douglas', '<span style="color:var(--fm);font-weight:600">Jul 2026</span>', 'ISO 9001 §5.2'],
          ['<strong>Supplier Security Policy</strong>', 'VIQ-POL-009', 'Siphathisiwe', 'Douglas', '<span style="color:var(--fm);font-weight:600">Jul 2026</span>', 'ISO 27001 A.5.19'],
          ['<strong>HR Security Policy</strong>', 'VIQ-POL-010', 'Siphathisiwe', 'Douglas', '<span style="color:var(--fm);font-weight:600">Aug 2026</span>', 'ISO 27001 A.6.1'],
        ]}
      />
      <Callout icon="✅" title="What is already done">
        VeritasIQ has already completed: MFA enforcement across all platforms, Cloudflare security worker deployment, supplier DPA requests sent to Vercel/Supabase/Anthropic/Resend, Stage 1 audit booking emails drafted. These are your evidence artefacts for the ISMS.
      </Callout>
      <NextSteps steps={[
        { n: 'Copy this table into your Master Policy Register', d: 'This is your drafted policy schedule. Add it to your Google Sheets register with columns for Status and File Link.' },
        { n: 'Start with VIQ-POL-001 this week', d: 'Information Security Policy is the master document — everything else references it. Write it first, get Douglas to sign it, then use it as the template for the rest.' },
        { n: 'Set up a monthly policy review calendar event', d: 'Recurring calendar event on the last Friday of each month: "VIQ Policy Register Review — 30 min". Update statuses, check for overdue items.' },
      ]} />
      <Footer />
    </div>
  )

  if (lessonId === 6) return (
    <div>
      <PersonaBar>
        <strong>{p.name}</strong>, you have completed the Policy Intelligence Coaching Module. Here is your personalised action plan for your role as <strong>{p.roleName}</strong>.
      </PersonaBar>
      <div style={{ padding: '20px', borderRadius: 12, background: 'var(--ai-subtle)', border: '1px solid rgba(155,135,245,0.25)', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ai)', marginBottom: 16 }}>🎓 Module Complete — Your 30-day action plan</div>
        {[
          { week: 'This week', color: 'var(--dng)', items: [
            'Create VIQ-Policies folder in Google Drive',
            'Build Master Policy Register spreadsheet (20 rows)',
            'Draft VIQ-POL-001 Information Security Policy',
            'Brief Douglas on your plan at next stand-up',
          ]},
          { week: 'Weeks 2–3', color: 'var(--saas)', items: [
            'Draft VIQ-POL-002 Data Protection & Privacy Policy',
            'Draft VIQ-POL-003 Acceptable Use Policy',
            'Contact BSI, NQA, and Bureau Veritas for Stage 1 quotes',
            'Brief Richard on ISO 27001 Theme D technical controls',
          ]},
          { week: 'Month 2', color: 'var(--fm)', items: [
            'Complete all 5 high-priority policies (POL-001 to POL-005)',
            'Conduct first internal policy awareness session with team',
            'Book Stage 1 audit with chosen certifying body',
            'Create VIQ-ISMS-Evidence folder structure in Google Drive',
          ]},
        ].map(group => (
          <div key={group.week} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: group.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{group.week}</div>
            {group.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ color: group.color, fontSize: 12, marginTop: 2, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.75 }}>
        <strong style={{ color: 'var(--fm)' }}>🎯 Your north star:</strong> ISO 27001 Stage 1 audit booked, 20 policies in register, 5 policies approved and signed — all before the Qiddiya City RFP submission in October 2026. The policies are not bureaucracy. They are the commercial unlock.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid var(--pios-border)', marginTop: 24 }}>
        <span style={{ fontSize: 13, color: 'var(--fm)', fontWeight: 600 }}>🎓 Module complete — well done, {name}!</span>
      </div>
    </div>
  )

  return <div style={{ color: 'var(--pios-muted)', padding: 40 }}>Lesson not found</div>
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PolicyCoachPage() {
  const [phase, setPhase] = useState<'profile' | 'coaching'>('profile')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [level, setLevel] = useState('')
  const [currentLesson, setCurrentLesson] = useState(0)
  const [completed, setCompleted] = useState<number[]>([])

  function startCoaching() {
    if (!role) return
    if (!level) return
    setPhase('coaching')
  }

  function completeLesson(idx: number) {
    if (!completed.includes(idx)) setCompleted(prev => [...prev, idx])
    if (idx + 1 < 7) setTimeout(() => setCurrentLesson(idx + 1), 400)
  }

  const progress = Math.round((completed.length / 7) * 100)

  if (phase === 'profile') return (
    <div className="fade-in" style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ padding: '32px 36px', borderRadius: 14, background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -20, bottom: -30, fontSize: 120, fontWeight: 700, color: 'rgba(155,135,245,0.04)', pointerEvents: 'none', lineHeight: 1 }}>PIOS™</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>PIOS™ Adaptive Learning · Policy Intelligence Module</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--pios-text)', marginBottom: 10, lineHeight: 1.2 }}>Welcome to your Policy & Governance Coaching Journey</h1>
        <p style={{ fontSize: 14, color: 'var(--pios-sub)', lineHeight: 1.75, maxWidth: 520 }}>
          This module will guide you through everything VeritasIQ Technologies Ltd needs to know about policies, procedures, ISO certification, and governance — starting from where you are, not where a textbook begins.
        </p>
      </div>

      {/* Profile form */}
      <div className="pios-card">
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Tell us about yourself</h2>
        <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid var(--pios-border)' }}>
          PIOS™ uses your profile to personalise every lesson — your language, your examples, your pace.
        </p>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 7 }}>Your name</label>
          <input className="pios-input" placeholder="e.g. Siphathisiwe" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>Your role at VeritasIQ Technologies Ltd</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {ROLES.map(r => (
              <button key={r.key} onClick={() => setRole(r.key)}
                style={{ padding: '14px 16px', borderRadius: 8, border: `2px solid ${role === r.key ? 'var(--ai)' : 'var(--pios-border2)'}`, background: role === r.key ? 'var(--ai-subtle)' : 'var(--pios-surface2)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 18, marginBottom: 5 }}>{r.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pios-text)', marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 7 }}>How familiar are you with policies and procedures?</label>
          <select className="pios-input" value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">Select your starting point…</option>
            <option value="new">🌱 Completely new — I've never worked with formal policies before</option>
            <option value="some">🌿 Some experience — I've seen policies but never owned them</option>
            <option value="solid">🌳 Solid foundation — I understand the basics, need depth on ISO/audit</option>
            <option value="experienced">🏔 Experienced — I've been through ISO audits and compliance programmes</option>
          </select>
        </div>

        <button className="pios-btn pios-btn-primary" onClick={startCoaching} disabled={!role || !level} style={{ fontSize: 13 }}>
          Begin My Coaching Journey →
        </button>
      </div>
    </div>
  )

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>

      {/* Sidebar */}
      <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: 20, position: 'sticky', top: 20 }}>
        {/* Profile */}
        <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--pios-border)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--ai), var(--academic))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            {(name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pios-text)' }}>{name || 'Team Member'}</div>
          <div style={{ fontSize: 11, color: 'var(--ai)', fontWeight: 600, marginTop: 2 }}>{ROLES.find(r => r.key === role)?.name ?? role}</div>
          <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 3 }}>Policy Intelligence Module</div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--pios-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--pios-muted)', fontWeight: 600 }}>Progress</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai)' }}>{progress}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--pios-surface3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, width: `${progress}%`, background: 'var(--ai)', transition: 'width 0.4s' }} />
          </div>
        </div>

        {/* Lesson nav */}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Learning Path</div>
        {LESSONS.map((lesson, i) => {
          const isActive = currentLesson === i
          const isDone = completed.includes(i)
          const isLocked = i > 0 && !completed.includes(i - 1) && currentLesson !== i
          return (
            <button key={i}
              onClick={() => !isLocked && setCurrentLesson(i)}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, marginBottom: 2, border: 'none', cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.4 : 1, background: isActive ? 'rgba(155,135,245,0.15)' : 'transparent', transition: 'all 0.15s' }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{isDone ? '✓' : lesson.icon}</span>
              <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 400, color: isDone ? 'var(--fm)' : isActive ? 'var(--ai)' : 'var(--pios-muted)', flex: 1, lineHeight: 1.3 }}>{lesson.title}</span>
              <span style={{ fontSize: 9, color: 'var(--pios-dim)', flexShrink: 0 }}>{lesson.mins}m</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div>
        {/* Lesson header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${TAG_COLOR[LESSONS[currentLesson].tag]}20`, color: TAG_COLOR[LESSONS[currentLesson].tag] }}>
              {LESSONS[currentLesson].tag} · Lesson {currentLesson + 1} of 7
            </span>
            <span style={{ fontSize: 11, color: 'var(--pios-dim)' }}>⏱ {LESSONS[currentLesson].mins} min</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--pios-text)', marginBottom: 4 }}>{LESSONS[currentLesson].title}</h1>
        </div>

        {/* Lesson body */}
        <div className="pios-card" style={{ borderColor: `${TAG_COLOR[LESSONS[currentLesson].tag]}30` }}>
          <LessonContent
            key={currentLesson}
            lessonId={currentLesson}
            role={role}
            name={name || 'Team Member'}
            completed={completed.includes(currentLesson)}
            onComplete={() => completeLesson(currentLesson)}
          />
        </div>
      </div>
    </div>
  )
}
