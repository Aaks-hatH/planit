/** @type {import('tailwindcss').Config} */
// PlanIt neo-brutalist light theme. Tokens mirror src/styles/planit-theme.css
// (--ac, --hl, --ink, --lav, --pk, --mn, --ok, --er, --mu, --ln, --acs).
// Every stock Tailwind hue is re-mapped onto the brand palette so legacy
// utility classes (neutral-*, indigo-*, emerald-* ...) land on the new look.
const INK = '#0d0e1c';

const inkScale = {
  50: '#f7f8fd', 100: '#eceeff', 200: '#d9dbe8', 300: '#9a9db3', 400: '#6d7086',
  500: '#5a5d70', 600: '#4a4d60', 700: '#34364a', 800: '#1d1e33', 900: INK, 950: '#080913',
};
const blueScale = {
  50: '#eceeff', 100: '#dde0ff', 200: '#c2c8ff', 300: '#9aa3ff', 400: '#6674ff',
  500: '#2236ff', 600: '#2236ff', 700: '#1a2ad1', 800: '#141fa3', 900: '#0f1778', 950: '#0a0f50',
};
const yellowScale = {
  50: '#fffbe0', 100: '#fff6c2', 200: '#ffee8f', 300: '#ffe14d', 400: '#ffe14d',
  500: '#f5c900', 600: '#8a6a00', 700: '#6e5400', 800: '#574200', 900: '#3d2e00', 950: '#261c00',
};
const greenScale = {
  50: '#d6f7e8', 100: '#c3f3de', 200: '#9be6c4', 300: '#6ff0c0', 400: '#3fd9a0',
  500: '#0c8a5b', 600: '#0c8a5b', 700: '#0a7149', 800: '#075a3a', 900: '#054229', 950: '#032b1a',
};
const redScale = {
  50: '#ffe9e7', 100: '#ffe1de', 200: '#f0b4b0', 300: '#e8827d', 400: '#de5a56',
  500: '#d12f2f', 600: '#d12f2f', 700: '#a82020', 800: '#861b1b', 900: '#6b1616', 950: '#450d0d',
};
const pinkScale = {
  50: '#ffeaf6', 100: '#ffd6ee', 200: '#ffb8e0', 300: '#ff9ad2', 400: '#ff7ac6',
  500: '#ff5cb8', 600: '#d63a96', 700: '#a82a74', 800: '#7d1f56', 900: '#521439', 950: '#330b24',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#ffffff',
      black: INK,
      ink: INK,
      ac: '#2236ff',
      hl: '#ffe14d',
      lav: '#eceeff',
      pk: '#ff7ac6',
      mn: '#6ff0c0',
      ok: '#0c8a5b',
      er: '#d12f2f',
      mu: '#5a5d70',
      ln: '#d9dbe8',
      acs: '#fff6c2',
      neutral: inkScale, gray: inkScale, slate: inkScale, zinc: inkScale, stone: inkScale,
      blue: blueScale, indigo: blueScale, violet: blueScale, purple: blueScale,
      sky: blueScale, cyan: blueScale, fuchsia: pinkScale,
      amber: yellowScale, yellow: yellowScale, orange: yellowScale, lime: greenScale,
      emerald: greenScale, green: greenScale, teal: greenScale,
      red: redScale, rose: redScale, pink: pinkScale,
    },
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        display: ['Unbounded', '"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.4' }],
        sm: ['0.8125rem', { lineHeight: '1.5' }],
        base: ['0.9375rem', { lineHeight: '1.6' }],
        lg: ['1.0625rem', { lineHeight: '1.5' }],
        xl: ['1.1875rem', { lineHeight: '1.4' }],
        '2xl': ['1.375rem', { lineHeight: '1.3' }],
        '3xl': ['1.75rem', { lineHeight: '1.25' }],
        '4xl': ['2.125rem', { lineHeight: '1.2' }],
        '5xl': ['2.75rem', { lineHeight: '1.15' }],
      },
      // 8px on controls, 12px on cards, 14px on modals. `full` stays for dots/avatars.
      borderRadius: {
        DEFAULT: '6px', sm: '4px', md: '8px', lg: '8px', xl: '12px', '2xl': '12px', '3xl': '14px',
      },
      // Hard offset shadows only. No blur anywhere.
      boxShadow: {
        sm: `2px 2px 0 ${INK}`,
        DEFAULT: `3px 3px 0 ${INK}`,
        md: `4px 4px 0 ${INK}`,
        lg: `6px 6px 0 ${INK}`,
        xl: `8px 8px 0 ${INK}`,
        '2xl': `10px 10px 0 ${INK}`,
        inner: 'none',
        none: 'none',
        hard: `4px 4px 0 ${INK}`,
        'hard-sm': `3px 3px 0 ${INK}`,
        'hard-lg': `6px 6px 0 ${INK}`,
        'hard-xl': `10px 10px 0 ${INK}`,
        'hard-ac': '4px 4px 0 #2236ff',
        'hard-hl': `4px 4px 0 #ffe14d`,
      },
      dropShadow: {
        sm: `1px 1px 0 ${INK}`, DEFAULT: `2px 2px 0 ${INK}`, md: `2px 2px 0 ${INK}`,
        lg: `3px 3px 0 ${INK}`, xl: `4px 4px 0 ${INK}`, '2xl': `4px 4px 0 ${INK}`, none: 'none',
      },
      // Glass / blur panels are gone: every backdrop blur resolves to none.
      backdropBlur: {
        none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0',
      },
      ringColor: { DEFAULT: '#2236ff' },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
