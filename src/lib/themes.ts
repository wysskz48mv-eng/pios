export type CCTheme = 'onyx' | 'meridian' | 'signal'

export interface ThemeConfig {
  id: CCTheme
  name: string
  tagline: string
  persona: string
  preview: {
    bg: string
    surface: string
    accent: string
    text: string
  }
  fonts: {
    display: string
    body: string
  }
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'onyx',
    name: 'Onyx',
    tagline: 'Executive intelligence',
    persona: 'CEO · Founder · Director',
    preview: {
      bg: '#07080D',
      surface: '#0F1117',
      accent: '#C8A96E',
      text: '#E8E3DC',
    },
    fonts: {
      display: 'Cormorant Garamond',
      body: 'DM Sans',
    },
  },
  {
    id: 'meridian',
    name: 'Meridian',
    tagline: 'Professional precision',
    persona: 'Consultant · Practitioner · Director',
    preview: {
      bg: '#FAFAF8',
      surface: '#FFFFFF',
      accent: '#2563EB',
      text: '#0F172A',
    },
    fonts: {
      display: 'Cormorant Garamond',
      body: 'DM Sans',
    },
  },
  {
    id: 'signal',
    name: 'Signal',
    tagline: 'Academic clarity',
    persona: 'Researcher · Postgraduate · DBA',
    preview: {
      bg: '#0F1311',
      surface: '#161C19',
      accent: '#E8A030',
      text: '#E4E8E1',
    },
    fonts: {
      display: 'Cormorant Garamond',
      body: 'DM Sans',
    },
  },
]

export const DEFAULT_THEME: CCTheme = 'onyx'

export function getTheme(id: CCTheme | string | null | undefined): ThemeConfig {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}

export const THEME_VARS: Record<CCTheme, Record<string, string>> = {
  onyx: {
    '--cc-bg': '#07080D',
    '--cc-surf': '#0F1117',
    '--cc-surf2': '#1A1B22',
    '--cc-surf3': '#242530',
    '--cc-accent': '#C8A96E',
    '--cc-accent2': '#E8D9B5',
    '--cc-text': '#E8E3DC',
    '--cc-muted': '#6E7080',
    '--cc-dim': '#3A3B44',
    '--cc-border': 'rgba(200,169,110,0.12)',
    '--cc-rborder': 'rgba(200,169,110,0.25)',
    '--cc-danger': '#DC503C',
    '--cc-success': '#4A9B6F',
    '--cc-info': '#5B7FA6',
  },
  meridian: {
    '--cc-bg': '#FAFAF8',
    '--cc-surf': '#FFFFFF',
    '--cc-surf2': '#F4F4F1',
    '--cc-surf3': '#EEEEE9',
    '--cc-accent': '#2563EB',
    '--cc-accent2': '#1E50C8',
    '--cc-text': '#0F172A',
    '--cc-muted': '#64748B',
    '--cc-dim': '#94A3B8',
    '--cc-border': '#E2E8F0',
    '--cc-rborder': '#CBD5E1',
    '--cc-danger': '#DC2626',
    '--cc-success': '#16A34A',
    '--cc-info': '#2563EB',
  },
  signal: {
    '--cc-bg': '#0F1311',
    '--cc-surf': '#161C19',
    '--cc-surf2': '#1C2420',
    '--cc-surf3': '#222E29',
    '--cc-accent': '#E8A030',
    '--cc-accent2': '#F5C060',
    '--cc-text': '#E4E8E1',
    '--cc-muted': '#6D8070',
    '--cc-dim': '#3A4840',
    '--cc-border': 'rgba(163,201,168,0.10)',
    '--cc-rborder': 'rgba(163,201,168,0.22)',
    '--cc-danger': '#DC503C',
    '--cc-success': '#A3C9A8',
    '--cc-info': '#7BA5C8',
  },
}
