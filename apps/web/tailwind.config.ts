import type { Config } from 'tailwindcss';

// RTL rule (docs/04-architecture/06-i18n-rtl.md): use ONLY logical utilities —
// ms-*, me-*, ps-*, pe-*, start-*, end-*, text-start — never ml/mr/pl/pr/left/right.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          500: '#0f766e',
          600: '#0d5f59',
          700: '#0b4f4a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
