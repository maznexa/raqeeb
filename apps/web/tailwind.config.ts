import type { Config } from 'tailwindcss';

// RTL rule (docs/04-architecture/06-i18n-rtl.md): use ONLY logical utilities —
// ms-*, me-*, ps-*, pe-*, start-*, end-*, text-start — never ml/mr/pl/pr/left/right.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // System stack only — the build environment is network-restricted (no webfonts).
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'Noto Kufi Arabic',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#0f766e',
          600: '#0d5f59',
          700: '#0b4f4a',
          800: '#093f3b',
          900: '#072f2c',
        },
        // Dark ink-violet scale for the app shell sidebar (ClickUp-style).
        sidebar: {
          950: '#101018',
          900: '#16161f',
          800: '#1c1c28',
          700: '#262635',
          600: '#313144',
          500: '#4a4a63',
          400: '#8c8ca6',
          300: '#adadc2',
          200: '#cfcfdd',
          100: '#ececf3',
        },
        // Semantic colors keyed by canonical status group.
        status: {
          todo: '#8b94a3',
          active: '#3b82f6',
          done: '#16a34a',
          cancelled: '#f43f5e',
        },
        priority: {
          urgent: '#ef4444',
          high: '#f59e0b',
          normal: '#3b82f6',
          low: '#94a3b8',
        },
      },
      boxShadow: {
        drawer: '0 0 0 1px rgb(0 0 0 / 0.04), 0 12px 40px -8px rgb(0 0 0 / 0.25)',
        card: '0 1px 2px 0 rgb(16 16 24 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
