'use client'

import { useState } from 'react'
import type { CCProfile } from './CommandCentre'
import styles from './cc.module.css'

interface Props {
  profile: CCProfile
  onOpenThemePicker: () => void
}

export function MeridianCC({ profile, onOpenThemePicker }: Props) {
  const [nemoQuery, setNemoQuery] = useState('')
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className={`${styles.ccRoot} ${styles.meridian}`}>
      <header className={styles.mTopNav}>
        <div className={styles.mLogo}>PIOS <span>Pro</span></div>
        <nav className={styles.mTabs}>
          {['Brief', 'Email', 'Engagements', 'Frameworks', 'Finance', 'Academic'].map((tab, index) => (
            <button key={tab} className={`${styles.mTab} ${index === 0 ? styles.mTabActive : ''}`}>{tab}</button>
          ))}
        </nav>
        <div className={styles.mTopRight}>
          <button className={styles.mThemeBtn} onClick={onOpenThemePicker} title="Change theme">◐</button>
          <div className={styles.mAvatar}>{profile.name.split(' ').map((name) => name[0]).join('').slice(0, 2)}</div>
        </div>
      </header>

      <div className={styles.mBody}>
        <aside className={styles.mSidebar}>
          {[
            { label: 'Morning Brief', icon: '⌂', active: true },
            { label: 'Email Triage', icon: '✉', badge: 7 },
            { label: 'Tasks', icon: '✓' },
            { label: 'Calendar', icon: '◻', section: 'Professional' },
            { label: 'Engagements', icon: '◈', badge: 3 },
            { label: 'Frameworks', icon: '⚙' },
            { label: 'Financials', icon: '£', section: 'Academic' },
            { label: 'Thesis', icon: '🎓' },
            { label: 'Literature', icon: '📚' },
            { label: 'NemoClaw™', icon: '◉' },
          ].map((item, index) => (
            <div key={index}>
              {item.section && <div className={styles.mSectionLabel}>{item.section}</div>}
              <div className={`${styles.mNavItem} ${item.active ? styles.mNavActive : ''}`}>
                <span className={styles.mNavIcon}>{item.icon}</span>
                <span className={styles.mNavText}>{item.label}</span>
                {item.badge && <span className={styles.mNavBadge}>{item.badge}</span>}
              </div>
            </div>
          ))}
        </aside>

        <main className={styles.mCenter}>
          <h2 className={styles.mSectionTitle}>Morning Brief</h2>
          <p className={styles.mSectionSub}>{today} · 5 items require attention</p>

          <div className={styles.mCard}>
            <div className={styles.mCardTitle}>Today's intelligence</div>
            {[
              { text: 'Two urgent items in your email triage require a response today. NemoClaw™ has drafted replies — review before sending.', chip: 'urgent' },
              { text: 'Stakeholder follow-ups are overdue for 4 contacts. Chief of Staff weekly review pending.', chip: 'action' },
              { text: 'OKR progress on track for 3 of 4 objectives. Q2 board pack preparation begins in 4 days.', chip: 'good' },
            ].map((item, index) => (
              <div key={index} className={styles.mBriefItem}>
                <span className={styles.mBriefNum}>{index + 1}</span>
                <div>
                  <p className={styles.mBriefText}>{item.text}</p>
                  <span className={`${styles.mChip} ${styles[`chip_${item.chip}`]}`}>{item.chip}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.mCard}>
            <div className={styles.mCardTitle}>Active engagements</div>
            {[
              { name: 'FM Audit — KSP-001', status: 'P1 RFIs pending · Budget SAR 229.6M', color: '#DC2626' },
              { name: 'Platform — PIOS Launch', status: 'Build READY · UAT pending', color: '#D97706' },
              { name: 'DBA Research', status: 'Deliverable 7 Rev 2 complete', color: '#2563EB' },
            ].map((engagement) => (
              <div key={engagement.name} className={styles.mEngItem}>
                <div className={styles.mEngDot} style={{ background: engagement.color }}></div>
                <div>
                  <div className={styles.mEngName}>{engagement.name}</div>
                  <div className={styles.mEngStatus}>{engagement.status}</div>
                </div>
                <span className={styles.mEngArrow}>›</span>
              </div>
            ))}
          </div>

          <div className={styles.mNemoBar}>
            <span className={styles.mNemoLabel}>NemoClaw™ <span>Pro</span></span>
            <input
              type="text"
              className={styles.mNemoInput}
              placeholder="Briefing, strategy, email drafts, framework analysis…"
              value={nemoQuery}
              onChange={(e) => setNemoQuery(e.target.value)}
            />
          </div>
        </main>

        <aside className={styles.mRight}>
          <div className={styles.mRightTitle}>Email Triage</div>
          {[
            { type: 'U', from: 'Client PM', subject: 'Invoice Q1 — overdue', bg: '#FEE2E2', color: '#DC2626' },
            { type: 'A', from: 'Dr Ozlem Bak', subject: 'Chapter 3 feedback', bg: '#FEF3C7', color: '#D97706' },
            { type: 'I', from: 'Stripe', subject: 'Live keys ready', bg: '#DCFCE7', color: '#16A34A' },
          ].map((email, index) => (
            <div key={index} className={styles.mEmailItem}>
              <div className={styles.mEmailIcon} style={{ background: email.bg, color: email.color }}>{email.type}</div>
              <div>
                <div className={styles.mEmailFrom}>{email.from}</div>
                <div className={styles.mEmailSubject}>{email.subject}</div>
              </div>
            </div>
          ))}

          <div className={styles.mRightTitle} style={{ marginTop: 20 }}>Frameworks</div>
          {[
            { code: 'SDL', name: 'Strategic Decision Layer', tag: 'Executive' },
            { code: 'POM', name: 'Portfolio Operating Model', tag: 'Consulting' },
            { code: 'CVDM', name: 'Client Value Delivery Map', tag: 'Consulting' },
          ].map((framework) => (
            <div key={framework.code} className={styles.mFwItem}>
              <span className={styles.mFwCode}>{framework.code}</span>
              <div>
                <div className={styles.mFwName}>{framework.name}</div>
                <div className={styles.mFwTag}>{framework.tag}</div>
              </div>
            </div>
          ))}

          <div className={styles.mRightTitle} style={{ marginTop: 20 }}>Financials</div>
          <div className={styles.mFinGrid}>
            <div className={styles.mFinCard}><div className={styles.mFinLabel}>Revenue</div><div className={styles.mFinValue}>TBC</div></div>
            <div className={styles.mFinCard}><div className={styles.mFinLabel}>Subscribers</div><div className={styles.mFinValue}>0</div></div>
          </div>
        </aside>
      </div>
    </div>
  )
}
