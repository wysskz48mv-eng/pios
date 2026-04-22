'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { CCProfile } from './CommandCentre'
import styles from './cc.module.css'

interface Props {
  profile: CCProfile
  onOpenThemePicker: () => void
}

export function OnyxCC({ profile, onOpenThemePicker }: Props) {
  const [nemoQuery, setNemoQuery] = useState('')
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetch('/api/command-centre').then((r) => r.json()).then(setStats).catch(() => {})
  }, [])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const activeModules = Array.isArray(profile.activeModuleCodes) ? profile.activeModuleCodes : []
  const moduleCards = [
    { icon: '⚖', name: 'Decisions', stat: `${stats?.decisions?.pending ?? 0} awaiting review`, href: '/platform/decisions' },
    { icon: '✉', name: 'Email Triage', stat: `${stats?.email?.unread ?? 0} classified · ${stats?.email?.urgent ?? 0} urgent`, href: '/platform/email' },
    { icon: '▣', name: 'Board Pack', stat: 'Preparation active', href: '/platform/board' },
    { icon: '◈', name: 'Consulting Hub', stat: 'Frameworks active', href: '/platform/consulting', module: 'CONSULTING_HUB' },
    { icon: '◌', name: 'Academic', stat: 'Research workflows active', href: '/platform/research', module: 'ACADEMIC' },
    { icon: '⊞', name: 'CPD', stat: 'Professional development', href: '/platform/cpd', module: 'CPD' },
    { icon: '◉', name: 'Stakeholders', stat: `${stats?.stakeholders?.overdue ?? 0} overdue`, href: '/platform/stakeholders' },
  ].filter((card) => !card.module || activeModules.length === 0 || activeModules.includes(card.module))

  return (
    <div className={`${styles.ccRoot} ${styles.onyx}`}>
      <main className={styles.onyxMain} style={{ marginLeft: 0 }}>
        <div className={styles.onyxCenter}>
          <div className={styles.onyxCenterHeader}>
            <div>
              <div className={styles.onyxDate}>{today}</div>
              <h1 className={styles.onyxGreeting}>Good morning, {profile.name.split(' ')[0]}.</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className={styles.onyxPersonaBadge} onClick={onOpenThemePicker}>Theme</button>
              <span className={styles.onyxPersonaBadge}>
                {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)} · {profile.jobTitle || 'Executive'}
              </span>
            </div>
          </div>

          <div className={styles.onyxCard}>
            <div className={styles.onyxCardTitle}>AI Morning Brief — NemoClaw™</div>
            <div className={styles.onyxBriefList}>
              <div className={styles.onyxBriefItem}>
                <span className={styles.onyxBriefNum}>1</span>
                <div className={styles.onyxBriefBody}>
                  <p className={styles.onyxBriefText}>
                    {stats?.decisions?.pending ?? 0} decisions pending. {stats?.stakeholders?.overdue ?? 0} stakeholder follow-ups overdue. {stats?.tasks?.overdue ?? 0} overdue tasks.
                  </p>
                  <span className={`${styles.onyxBriefTag} ${styles.tagUrgent}`}>Decision</span>
                </div>
              </div>
              <div className={styles.onyxBriefItem}>
                <span className={styles.onyxBriefNum}>2</span>
                <div className={styles.onyxBriefBody}>
                  <p className={styles.onyxBriefText}>
                    {stats?.email?.unread ?? 0} emails in triage. {stats?.email?.urgent ?? 0} marked urgent.{(stats?.email?.urgent ?? 0) > 0 ? ' NemoClaw™ has drafted responses — review before sending.' : ''}
                  </p>
                  <span className={`${styles.onyxBriefTag} ${styles.tagReview}`}>Review</span>
                </div>
              </div>
              <div className={styles.onyxBriefItem}>
                <span className={styles.onyxBriefNum}>3</span>
                <div className={styles.onyxBriefBody}>
                  <p className={styles.onyxBriefText}>
                    OKR progress: {stats?.okrs?.on_track ?? 0} of {stats?.okrs?.total ?? 0} objectives on track ({stats?.okrs?.avg_progress ?? 0}% average).
                  </p>
                  <span className={`${styles.onyxBriefTag} ${styles.tagInfo}`}>Progress</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.onyxModuleGrid}>
            {moduleCards.map((module) => (
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
            { title: 'Vendor contract renewal', sub: 'Review pending.' },
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
        </aside>
      </main>
    </div>
  )
}
