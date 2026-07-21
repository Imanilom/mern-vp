// FILE Konfigurasi framework tailwindcss

/** @type {import('tailwindcss').Config} */

export default {
  // set darkMode ke class, agar fitur switch theme bisa berjalan normal
  darkMode : "class",
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0a0d14',
          card: '#121723',
          cardLight: '#1b2333',
          border: '#202a3d',
          text: '#f3f4f6',
          muted: '#9ca3af',
        },
        sys: {
          blue: '#3b82f6',     // Data, Preprocessing, Ingestion
          green: '#10b981',    // Stable, Healthy, Active, Normal
          yellow: '#fbbf24',   // Attention, Analysis, Recovering
          orange: '#f97316',   // Deviation (medium)
          red: '#ef4444',      // Anomaly, Alert (critical), Failure
          purple: '#8b5cf6',   // Model, Matrix, Database
          gray: '#6b7280',     // Inactive, No data
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
};
