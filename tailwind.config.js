/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#eff2f8',
          100: '#dde3ef',
          200: '#b8c5e0',
          300: '#8ba1c9',
          400: '#5c76a8',
          500: '#3d5588',
          600: '#2c4270',
          700: '#1e2a4a',
          800: '#182140',
          900: '#131933',
          950: '#0b0f1f',
        },
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        // Acento "etiqueta" — bronce/dorado apagado, evoca el remache de una
        // etiqueta de tela o un sello de embalaje. Se usa con moderación
        // (sello de "docena cerrada", algún detalle puntual), nunca como
        // color de fondo grande.
        accent: {
          50:  '#faf6ec',
          100: '#f2e6c9',
          300: '#e0c17e',
          500: '#c9974b',
          600: '#a97b37',
          700: '#8a632c',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'slide-in-right': 'slideInRight 0.35s ease forwards',
        'scale-in': 'scaleIn 0.3s ease forwards',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float': 'float 7s ease-in-out infinite',
        'blob': 'blob 16s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(30px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(var(--tilt, 0deg))' },
          '50%':      { transform: 'translateY(-16px) rotate(var(--tilt, 0deg))' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':      { transform: 'translate(4%, 6%) scale(1.08)' },
          '66%':      { transform: 'translate(-3%, -4%) scale(0.96)' },
        },
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
