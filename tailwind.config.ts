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
        // Map Tailwind tokens to CSS variables so both approaches produce the same output
        'pios-bg':       'var(--pios-bg)',
        'pios-surface':  'var(--pios-surface)',
        'pios-surface2': 'var(--pios-surface2)',
        'pios-surface3': 'var(--pios-surface3)',
        'pios-border':   'var(--pios-border)',
        'pios-border2':  'var(--pios-border2)',
        'pios-text':     'var(--pios-text)',
        'pios-sub':      'var(--pios-sub)',
        'pios-muted':    'var(--pios-muted)',
        'pios-dim':      'var(--pios-dim)',
        ai:              'var(--ai)',
        academic:        'var(--academic)',
        fm:              'var(--fm)',
        saas:            'var(--saas)',
        ops:             'var(--ops)',
        dng:             'var(--dng)',
        pro:             'var(--pro)',
        foreground:      'var(--pios-text)',
        muted:           'var(--pios-muted)',
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'DM Sans', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Instrument Serif', 'Georgia', 'serif'],
        mono:    ['var(--font-mono)', 'DM Mono', 'monospace'],
      },
      borderColor: {
        DEFAULT: 'var(--pios-border)',
      },
      backgroundColor: {
        DEFAULT: 'var(--pios-bg)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-up':    'fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'none' },
        },
      },
    },
  },
  plugins: [],
}
export default config
