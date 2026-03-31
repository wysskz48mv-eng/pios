'use client'

import s from './research.module.css'

export function PrintButton() {
  return (
    <button className={s.downloadBtn} onClick={() => window.print()}>
      Download PDF
    </button>
  )
}
