import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pios: {
          bg:       '#0a0b0d',
          surface:  '#111318',
          surface2: '#181c24',
          surface3: '#1e2330',
          border:   'rgba(255,255,255,0.07)',
          text:     '#e8eaf0',
          muted:    '#8b90a0',
          academic: '#6c8eff',
          fm:       '#2dd4a0',
          saas:     '#f59e0b',
          ops:      '#e05a7a',
          ai:       '#a78bfa',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
export default config
