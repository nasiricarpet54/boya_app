import type { Config } from 'tailwindcss';

/**
 * Every colour here is a token from `design_system/boya_design_system.md`.
 * They are declared as RGB channels in `globals.css` so the `.dark` block can
 * remap them without a second set of utility classes.
 *
 * Semantic colors keep their light values in dark mode on purpose: the design
 * system reserves them for real state (success / warning / error / info) and
 * recolouring them would change their meaning.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
        },
        brand: {
          copper: 'rgb(var(--color-brand-copper) / <alpha-value>)',
          'copper-hover': 'rgb(var(--color-brand-copper-hover) / <alpha-value>)',
          'copper-pressed': 'rgb(var(--color-brand-copper-pressed) / <alpha-value>)',
          subtle: 'rgb(var(--color-brand-subtle) / <alpha-value>)',
          rose: 'rgb(var(--color-brand-rose) / <alpha-value>)',
          sage: 'rgb(var(--color-brand-sage) / <alpha-value>)',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
      fontFamily: {
        vazirmatn: ['var(--font-vazirmatn)', 'Vazirmatn', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
      },
      boxShadow: {
        // Shadows are tinted with the brand ink, never pure grey.
        1: '0 1px 3px rgba(26, 26, 46, 0.08)',
        2: '0 4px 12px rgba(26, 26, 46, 0.12)',
        3: '0 8px 24px rgba(26, 26, 46, 0.16)',
      },
    },
  },
  plugins: [],
};

export default config;
