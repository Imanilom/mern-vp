// FILE Konfigurasi framework tailwindcss — HTM "Clinical Calm" Design System

/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // ── Font Families ──────────────────────────────────────────────────────
      fontFamily: {
        fraunces:  ['Fraunces', 'Georgia', 'serif'],
        plex:      ['IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'plex-mono': ['IBM Plex Mono', 'Courier New', 'monospace'],
      },

      // ── HTM Design Token Colors ────────────────────────────────────────────
      colors: {
        // Warm canvas surfaces
        htm: {
          canvas:   '#f7f5f0',
          surface:  '#ffffff',
          raised:   '#f2efe9',
          ink:      '#1c1a17',
          sub:      '#5a5650',
          muted:    '#9a9590',
          hairline: '#e3dfd8',
          divider:  '#ccc8c0',
          primary:  '#2d5a4e',
          stable:   '#2e6b4a',
          caution:  '#b45309',
          alert:    '#b91c1c',
          info:     '#1e4e8c',
          neutral:  '#6b6560',
        },
        // Keep legacy brand colors (used in old pages)
        brand: {
          dark: '#0a0d14',
          card: '#121723',
          cardLight: '#1b2333',
          border: '#202a3d',
          text: '#f3f4f6',
          muted: '#9ca3af',
        },
        sys: {
          blue:   '#3b82f6',
          green:  '#10b981',
          yellow: '#fbbf24',
          orange: '#f97316',
          red:    '#ef4444',
          purple: '#8b5cf6',
          gray:   '#6b7280',
        }
      },

      // ── Spacing Scale ──────────────────────────────────────────────────────
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '48px',
      },

      // ── Border Radius ──────────────────────────────────────────────────────
      borderRadius: {
        'htm-sm':   '10px',
        'htm-md':   '14px',
        'htm-lg':   '20px',
        'htm-pill': '999px',
      },

      // ── Box Shadow — no heavy shadows, only hairline outlines ──────────────
      boxShadow: {
        'htm-card':   '0 0 0 1px var(--htm-hairline)',
        'htm-focus':  '0 0 0 3px rgba(45, 90, 78, 0.18)',
        'none':        'none',
      },

      // ── Animations ─────────────────────────────────────────────────────────
      animation: {
        'pulse-slow':    'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow':   'bounce 2s infinite',
        'htm-page-in':   'htm-page-in 0.22s ease-out forwards',
        'htm-shimmer':   'htm-shimmer 1.4s ease infinite',
        'htm-heartbeat': 'htm-heartbeat-pulse 1.8s ease-in-out infinite',
      },
      keyframes: {
        'htm-page-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'htm-shimmer': {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'htm-heartbeat-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
