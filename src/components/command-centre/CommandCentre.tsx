'use client'

import type { CSSProperties } from 'react'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CCTheme } from '@/lib/themes'
import { THEMES } from '@/lib/themes'
import { MeridianCC } from './MeridianCC'
import { OnyxCC } from './OnyxCC'
import { SignalCC } from './SignalCC'
import styles from './cc.module.css'

export interface CCProfile {
  id: string
  name: string
  fullName: string
  persona: string
  theme: CCTheme
  plan: string
  jobTitle: string
  organisation: string
  activePersonas?: string[]
  activeModuleCodes?: string[]
}

interface Props {
  profile: CCProfile
}

export function CommandCentre({ profile }: Props) {
  const [theme, setTheme] = useState<CCTheme>(profile.theme)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [, startTransition] = useTransition()
  const supabase = createClient()

  async function changeTheme(newTheme: CCTheme) {
    setTheme(newTheme)
    setShowThemePicker(false)

    if (!supabase) {
      return
    }

    startTransition(() => {
      void supabase
        .from('user_profiles')
        .update({ command_centre_theme: newTheme })
        .eq('id', profile.id)
    })
  }

  const currentProfile = { ...profile, theme }

  return (
    <div className={styles.root}>
      {showThemePicker && (
        <div className={styles.overlay} onClick={() => setShowThemePicker(false)}>
          <div className={`${styles.themePickerPanel} ${styles[theme]}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.tpHeader}>
              <span className={styles.tpTitle}>Command centre style</span>
              <button className={styles.tpClose} onClick={() => setShowThemePicker(false)}>✕</button>
            </div>
            <p className={styles.tpSub}>Your choice is saved automatically. Switch any time.</p>
            <div className={styles.tpCards}>
              {THEMES.map((themeOption) => (
                <button
                  key={themeOption.id}
                  className={`${styles.tpCard} ${theme === themeOption.id ? styles.tpCardActive : ''}`}
                  onClick={() => changeTheme(themeOption.id)}
                  style={{ '--tp-accent': themeOption.preview.accent, '--tp-bg': themeOption.preview.bg } as CSSProperties}
                >
                  <div className={styles.tpSwatch} style={{ background: themeOption.preview.bg, border: `1px solid ${themeOption.preview.accent}33` }}>
                    <div style={{ width: '100%', height: '6px', marginBottom: '4px', background: themeOption.preview.accent, opacity: 0.7, borderRadius: '1px' }}></div>
                    <div style={{ width: '70%', height: '3px', background: themeOption.preview.text, opacity: 0.3, borderRadius: '1px' }}></div>
                  </div>
                  <div className={styles.tpCardInfo}>
                    <span className={styles.tpCardName} style={{ color: theme === themeOption.id ? themeOption.preview.accent : 'inherit' }}>
                      {themeOption.name}
                    </span>
                    <span className={styles.tpCardTagline}>{themeOption.tagline}</span>
                  </div>
                  {theme === themeOption.id && (
                    <span className={styles.tpActiveIndicator} style={{ color: themeOption.preview.accent }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {theme === 'onyx' && <OnyxCC profile={currentProfile} onOpenThemePicker={() => setShowThemePicker(true)} />}
      {theme === 'meridian' && <MeridianCC profile={currentProfile} onOpenThemePicker={() => setShowThemePicker(true)} />}
      {theme === 'signal' && <SignalCC profile={currentProfile} onOpenThemePicker={() => setShowThemePicker(true)} />}
    </div>
  )
}
