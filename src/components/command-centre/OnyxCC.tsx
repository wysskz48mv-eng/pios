'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CCProfile } from './CommandCentre'
import styles from './cc.module.css'

interface Props {
  profile: CCProfile
  onOpenThemePicker: () => void
}

const NAV_ITEMS = [
  { icon: '⌂', label: 'Brief', href: '/platform/dashboard', active: true },
  { icon: '◎', label: 'NemoClaw™', href: '/platform/nemoclaw' },
  { icon: '✉', label: 'Email', href: '/platform/email', badge: 7 },
  { icon: '⚖', label: 'Decisions', href: '/platform/decisions', badge: 2 },
  { icon: '◈', label: 'EOSA™', href: '/platform/frameworks' },
  { icon: '◉', label: 'Stakeholders', href: '/platform/stakeholders' },
  { icon: '▣', label: 'Board Pack', href: '/platform/board' },
  { icon: '⊞', label: 'Chief of Staff', href: '/platform/cos' },
]

export function OnyxCC({ profile, onOpenThemePicker }: Props) {
  const [nemoQuery, setNemoQuery] = useState('')

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className={`${styles.ccRoot} ${styles.onyx}`}>
      <aside className={styles.onyxSidebar}>
        <div className={styles.onyxLogo}>P</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.label} href={item.href} className={`${styles.onyxNavItem} ${item.active ? styles.onyxNavActive : ''}`}>
            <span className={styles.onyxNavIcon}>{item.icon}</span>
            {item.badge && <span className={styles.onyxNavBadge}>{item.badge}</span>}
            <span className={styles.onyxTooltip}>{item.label}</span>
          </Link>
        ))}
        <div style={{ marginTop: 'auto' }}></div>
        <button className={styles.onyxNavItem} onClick={onOpenThemePicker} title="Change theme" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <span className={styles.onyxNavIcon} style={{ opacity: 0.3 }}>◐</span>
          <span className={styles.onyxTooltip}>Change theme</span>
        </button>
        <Link href="/platform/settings" className={styles.onyxNavItem}>
          <span className={styles.onyxNavIcon} style={{ opacity: 0.3 }}>⚙</span>
          <span className={styles.onyxTooltip}>Settings</span>
        </Link>
      </aside>

      <main className={styles.onyxMain}>
        <div className={styles.onyxCenter}>
          <div className={styles.onyxCenterHeader}>
            <div>
              <div className={styles.onyxDate}>{today}</div>
              <h1 className={styles.onyxGreeting}>Good morning, {profile.name.split(' ')[0]}.</h1>
            </div>
            <span className={styles.onyxPersonaBadge}>
              {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)} · {profile.jobTitle || 'Executive'}
            </span>
          </div>

          <div className={styles.onyxCard}>
            <div className={styles.onyxCardTitle}>AI Morning Brief — NemoClaw™</div>
            <div className={styles.onyxBriefList}>
              <div className={styles.onyxBriefItem}>
                <span className={styles.onyxBriefNum}>1</span>
                <div className={styles.onyxBriefBody}>
                  <p className={styles.onyxBriefText}>
                    Three strategic priorities require your attention today. Your decision queue has
                    2 open items. Stakeholder follow-ups are overdue for 4 contacts.
                  </p>
                  <span className={`${styles.onyxBriefTag} ${styles.tagUrgent}`}>Decision</span>
                </div>
              </div>
              <div className={styles.onyxBriefItem}>
                <span className={styles.onyxBriefNum}>2</span>
                <div className={styles.onyxBriefBody}>
                  <p className={styles.onyxBriefText}>
                    7 emails classified overnight. 2 marked Urgent. NemoClaw™ has drafted
                    responses to both — review before sending.
                  </p>
                  <span className={`${styles.onyxBriefTag} ${styles.tagReview}`}>Review</span>
                </div>
              </div>
              <div className={styles.onyxBriefItem}>
                <span className={styles.onyxBriefNum}>3</span>
                <div className={styles.onyxBriefBody}>
                  <p className={styles.onyxBriefText}>
                    OKR progress: 3 of 4 objectives on track. Q2 board pack preparation
                    due within 18 days. Chief of Staff weekly review pending.
                  </p>
                  <span className={`${styles.onyxBriefTag} ${styles.tagInfo}`}>Progress</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.onyxModuleGrid}>
            {[
              { icon: '⚖', name: 'Decisions', stat: '2 awaiting review', href: '/platform/decisions' },
              { icon: '✉', name: 'Email Triage', stat: '7 classified · 2 urgent', href: '/platform/email' },
              { icon: '▣', name: 'Board Pack', stat: 'Due in 18 days', href: '/platform/board' },
              { icon: '◈', name: 'EOSA™', stat: '13 frameworks active', href: '/platform/frameworks' },
              { icon: '⊞', name: 'Chief of Staff', stat: 'Weekly review due', href: '/platform/cos' },
              { icon: '◉', name: 'Stakeholders', stat: '4 overdue contact', href: '/platform/stakeholders' },
            ].map((module) => (
              <Link key={module.name} href={module.href} className={styles.onyxModCard}>
                <span className={styles.onyxModIcon}>{module.icon}</span>
                <span className={styles.onyxModName}>{module.name}</span>
                <span className={styles.onyxModStat}>{module.stat}</span>
              </Link>
            ))}
          </div>

          <div className={styles.onyxNemoBar}>
            <span className={styles.onyxNemoLabel}>NemoClaw™</span>
            <input
              type="text"
              className={styles.onyxNemoInput}
              placeholder="Ask anything — strategy, decisions, stakeholders, board prep, email drafts…"
              value={nemoQuery}
              onChange={(e) => setNemoQuery(e.target.value)}
            />
            <button className={styles.onyxNemoBtn}>↵</button>
          </div>
        </div>

        <aside className={styles.onyxRight}>
          <div className={styles.onyxPanelTitle}>Decision Queue</div>
          {[
            { title: 'Strategic initiative — defer or proceed?', sub: 'Awaiting external outcome. Budget implications significant.', urgent: true },
            { title: 'Vendor contract renewal', sub: 'Renewal date in 14 days. Legal review pending.' },
          ].map((decision, index) => (
            <div key={index} className={styles.onyxPanelCard}>
              <p className={styles.onyxPCTitle}>{decision.title}</p>
              <p className={styles.onyxPCSub}>{decision.sub}</p>
              {decision.urgent && <span className={styles.onyxPCTag}>Urgent</span>}
            </div>
          ))}

          <div className={styles.onyxPanelTitle} style={{ marginTop: 24 }}>Stakeholders</div>
          {[
            { initials: 'RB', name: 'Richard B.', role: 'Dev Lead', dot: true },
            { initials: 'SA', name: 'Samantha A.', role: 'Dev / CX' },
            { initials: 'RN', name: 'Ronald N.', role: 'Finance' },
          ].map((stakeholder) => (
            <div key={stakeholder.name} className={styles.onyxStkItem}>
              <div className={styles.onyxStkAv}>{stakeholder.initials}</div>
              <div>
                <div className={styles.onyxStkName}>{stakeholder.name}</div>
                <div className={styles.onyxStkRole}>{stakeholder.role}</div>
              </div>
              {stakeholder.dot && <div className={styles.onyxStkDot}></div>}
            </div>
          ))}

          <div className={styles.onyxPanelTitle} style={{ marginTop: 24 }}>OKRs</div>
          {[
            { name: 'Platform launch', pct: 78 },
            { name: 'Research delivery', pct: 62 },
            { name: 'Revenue target', pct: 12 },
          ].map((okr) => (
            <div key={okr.name} className={styles.onyxOkr}>
              <div className={styles.onyxOkrRow}>
                <span className={styles.onyxOkrName}>{okr.name}</span>
                <span className={styles.onyxOkrPct}>{okr.pct}%</span>
              </div>
              <div className={styles.onyxOkrTrack}>
                <div className={styles.onyxOkrFill} style={{ width: `${okr.pct}%` }}></div>
              </div>
            </div>
          ))}
        </aside>
      </main>
    </div>
  )
}
