'use client'

import { useState } from 'react'
import type { CCProfile } from './CommandCentre'
import styles from './cc.module.css'

interface Props {
  profile: CCProfile
  onOpenThemePicker: () => void
}

export function SignalCC({ profile, onOpenThemePicker }: Props) {
  const [nemoQuery, setNemoQuery] = useState('')
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className={`${styles.ccRoot} ${styles.signal}`}>
      <header className={styles.sHeader}>
        <div className={styles.sLogo}>PIOS</div>
        <nav className={styles.sTabs}>
          {[
            { label: 'Brief', icon: '⌂' },
            { label: 'Thesis', icon: '📝' },
            { label: 'Literature', icon: '📚' },
            { label: 'Supervision', icon: '◉' },
            { label: 'Tasks', icon: '✅' },
            { label: 'NemoClaw™', icon: '💬' },
          ].map((tab, index) => (
            <button key={tab.label} className={`${styles.sTab} ${index === 0 ? styles.sTabActive : ''}`}>
              <span className={styles.sTabIcon}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </nav>
        <div className={styles.sTopRight}>
          <span className={styles.sGreeting}>Good morning, {profile.name.split(' ')[0]}</span>
          <button className={styles.sThemeBtn} onClick={onOpenThemePicker} title="Change theme">◐</button>
          <div className={styles.sAvatar}>{profile.name.split(' ').map((name) => name[0]).join('').slice(0, 2)}</div>
        </div>
      </header>

      <div className={styles.sBody}>
        <main className={styles.sMain}>
          <div className={styles.sBriefHeader}>
            <div className={styles.sBriefDate}>{today}</div>
            <h1 className={styles.sBriefGreeting}>Your day, <em>intelligently.</em></h1>
          </div>

          <div className={styles.sNemoGreeting}>
            <div className={styles.sNemoAv}>N</div>
            <p className={styles.sNemoText}>
              Good morning. Your thesis Chapter 3 is progressing well — at <strong>78%</strong> completion.
              Supervision with your supervisor is in <strong>5 days</strong>; I&apos;ve flagged 4 items to prepare.
              Your literature search returned 3 new papers matching your research keywords.
            </p>
          </div>

          <div className={styles.sThesisCard}>
            <div className={styles.sTcHeader}>
              <div className={styles.sTcTitle}>Thesis Progress</div>
              <span className={styles.sTcStatus}>On Track</span>
            </div>
            <div className={styles.sTcChapter}>Chapter 3 — Research Methodology</div>
            <p className={styles.sTcSub}>AI-enabled FM cost forecasting in GCC mixed-use developments</p>
            <div className={styles.sProgress}>
              <div className={styles.sProgressFill} style={{ width: '78%' }}></div>
            </div>
            <div className={styles.sTcPct}>
              <span>6,210 / 8,000 words</span><span>78%</span>
            </div>
          </div>

          <div className={styles.sDeadlineCard}>
            <div className={styles.sDlTitle}>Upcoming Deadlines</div>
            {[
              { date: '12 Apr', name: 'Supervision Session', type: 'Dr Ozlem Bak', badge: '5 days', badgeType: 'r' },
              { date: '14 Apr', name: 'Lit Review Draft', type: 'Chapter 2 final', badge: '7 days', badgeType: 'y' },
              { date: '30 Apr', name: 'Chapter 3 Draft', type: 'Submit to supervisors', badge: '23 days', badgeType: 'g' },
              { date: 'Dec 26', name: 'Thesis Submission', type: 'Final DBA thesis', badge: 'On track', badgeType: 'g' },
            ].map((deadline) => (
              <div key={deadline.name} className={styles.sDlItem}>
                <span className={styles.sDlDate}>{deadline.date}</span>
                <div>
                  <div className={styles.sDlName}>{deadline.name}</div>
                  <div className={styles.sDlType}>{deadline.type}</div>
                </div>
                <span className={`${styles.sDlBadge} ${styles[`badge_${deadline.badgeType}`]}`}>{deadline.badge}</span>
              </div>
            ))}
          </div>

          <div className={styles.sNemoBar}>
            <span className={styles.sNemoBarLabel}>NemoClaw™</span>
            <input
              type="text"
              className={styles.sNemoBarInput}
              placeholder="Ask about your thesis, literature, supervision prep, viva…"
              value={nemoQuery}
              onChange={(e) => setNemoQuery(e.target.value)}
            />
            <button className={styles.sNemoBarBtn}>Ask →</button>
          </div>
        </main>

        <aside className={styles.sPanel}>
          <div className={styles.sPanelTitle}>Supervision Prep — 12 Apr</div>
          <div className={styles.sSupCard}>
            <div className={styles.sSupName}>Dr Ozlem Bak</div>
            <div className={styles.sSupDate}>Saturday 12 April · 4 items</div>
            <div className={styles.sSupItems}>
              {[
                'RQ2 framing — socio-technical theory alignment',
                'Chapter 3: interpretive vs positivist decision',
                'RICS Simple Area method clarification',
                'GCC regulatory gap justification',
              ].map((item) => (
                <div key={item} className={styles.sSupItem}>{item}</div>
              ))}
            </div>
          </div>

          <div className={styles.sPanelTitle} style={{ marginTop: 20 }}>Literature Matches</div>
          {[
            { title: 'AI-enabled lifecycle cost prediction in mixed-use developments', meta: 'J. of FM · 2024 · Matches RQ2' },
            { title: 'Sensemaking in organisational decision-support systems', meta: 'Org Studies · 2023 · Ch3 theory' },
            { title: 'RICS service charge: GCC regulatory comparison', meta: 'RICS Research · 2025 · D7.1' },
          ].map((match) => (
            <div key={match.title} className={styles.sLitItem}>
              <div className={styles.sLitTitle}>{match.title}</div>
              <div className={styles.sLitMeta}>{match.meta}</div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}
