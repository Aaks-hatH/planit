/**
 * PlanIt Tailwind configuration.
 *
 * The palette, type, radii and shadows here mirror src/styles/tokens.css.
 * Hex values are used (not var()) so Tailwind opacity modifiers such as
 * `bg-neutral-900/60` keep working everywhere in the app.
 *
 * Remapping `neutral`, `blue` and `indigo` re-skins every existing page in one
 * move: warm paper on the light end, blue-tinted charcoal on the dark end, and
 * a single electric-blue accent in place of the old mix of blue/indigo.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        neutral: {
          50:  '#f7f6f2',
          100: '#efede7',
          200: '#e3e0d9',
          300: '#c8c6c0',
          400: '#9a9aa6',
          500: '#6a6a76',
          600: '#3b3b47',
          700: '#24242d',
          800: '#18181f',
          900: '#0f0f14',
          950: '#07070b',
        },
        // Electric blue, the one brand accent. `indigo` is aliased to it so the
        // many existing indigo-* classes land on the same hue.
        blue: {
          50:  '#eff3ff',
          100: '#dfe7ff',
          200: '#bccdff',
          300: '#90abff',
          400: '#5f84ff',
          500: '#2f5bff',
          600: '#1f43e6',
          700: '#1a35b8',
          800: '#182e8f',
          900: '#16286e',
          950: '#0e1946',
        },
        indigo: {
          50:  '#eff3ff',
          100: '#dfe7ff',
          200: '#bccdff',
          300: '#90abff',
          400: '#5f84ff',
          500: '#2f5bff',
          600: '#1f43e6',
          700: '#1a35b8',
          800: '#182e8f',
          900: '#16286e',
          950: '#0e1946',
        },
        ink:   { DEFAULT: '#0f0f14', 950: '#07070b', 900: '#0f0f14', 800: '#18181f', 700: '#24242d' },
        paper: { DEFAULT: '#f7f6f2', 100: '#efede7', 200: '#e3e0d9' },
        accent: { DEFAULT: '#2f5bff', hover: '#1f43e6', soft: '#eff3ff', ink: '#1a35b8' },
        signal: {
          live:   '#16a34a',
          wait:   '#d97706',
          alert:  '#dc2626',
          seated: '#2f5bff',
          venue:  '#ff6a1f',
        },
      },
      fontFamily: {
        sans:    ['"DM Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono:    ['"DM Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
        display: ['"Space Grotesk"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        label:  ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.12em' }],
        xs:     ['0.75rem',   { lineHeight: '1.4' }],
        sm:     ['0.8125rem', { lineHeight: '1.5' }],
        base:   ['0.9375rem', { lineHeight: '1.6' }],
        lg:     ['1.0625rem', { lineHeight: '1.5' }],
        xl:     ['1.1875rem', { lineHeight: '1.4' }],
        '2xl':  ['1.375rem',  { lineHeight: '1.3' }],
        '3xl':  ['1.75rem',   { lineHeight: '1.22', letterSpacing: '-0.02em' }],
        '4xl':  ['2.125rem',  { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        '5xl':  ['2.75rem',   { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        'stat': ['clamp(1.75rem, 1.3rem + 1.8vw, 2.75rem)', { lineHeight: '1', letterSpacing: '-0.03em' }],
        'h1':   ['clamp(2rem, 1.3rem + 3vw, 3.75rem)',      { lineHeight: '1.04', letterSpacing: '-0.035em' }],
        'h2':   ['clamp(1.625rem, 1.2rem + 1.6vw, 2.5rem)', { lineHeight: '1.1',  letterSpacing: '-0.03em' }],
        'display': ['clamp(2.5rem, 1rem + 6.4vw, 6.25rem)', { lineHeight: '0.98', letterSpacing: '-0.045em' }],
      },
      spacing: {
        gutter: 'var(--gutter)',
        nav: 'var(--nav-h)',
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        touch: '44px',
      },
      minHeight: { touch: '44px', control: '2.5rem', 'control-xl': '3.25rem' },
      minWidth:  { touch: '44px' },
      maxWidth:  { content: '80rem', prose: '42rem' },
      borderRadius: {
        none: '0',
        sm:   '5px',
        DEFAULT: '6px',
        md:   '6px',
        lg:   '8px',
        xl:   '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        sm:  '0 1px 0 rgb(15 15 20 / 0.04), 0 1px 2px rgb(15 15 20 / 0.05)',
        DEFAULT: '0 1px 0 rgb(15 15 20 / 0.04), 0 1px 2px rgb(15 15 20 / 0.05)',
        md:  '0 1px 0 rgb(15 15 20 / 0.03), 0 4px 12px -2px rgb(15 15 20 / 0.08)',
        lg:  '0 2px 4px rgb(15 15 20 / 0.04), 0 12px 28px -6px rgb(15 15 20 / 0.14)',
        xl:  '0 4px 8px rgb(15 15 20 / 0.06), 0 28px 56px -12px rgb(15 15 20 / 0.28)',
        '2xl': '0 4px 8px rgb(15 15 20 / 0.08), 0 36px 72px -16px rgb(15 15 20 / 0.34)',
        focus: '0 0 0 3px rgb(47 91 255 / 0.28)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out-soft': 'cubic-bezier(0.65, 0, 0.35, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: { fast: '150ms', base: '220ms', slow: '420ms' },
      zIndex: { sticky: '30', nav: '50', dropdown: '60', overlay: '70', modal: '80', toast: '100' },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'pop-in': 'popIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
        skeleton: 'skeleton 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        skeleton: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
    },
  },
  plugins: [],
}
