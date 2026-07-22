/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        primaryColor: "var(--primary)", // renamed to avoid naming conflicts
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        hairline: "var(--hairline)",
        mutedColor: "var(--muted)", // renamed to avoid naming conflicts
        
        stable: {
          text: "var(--stable-text)",
          fill: "var(--stable-fill)",
        },
        monitoring: {
          text: "var(--monitoring-text)",
          fill: "var(--monitoring-fill)",
        },
        caution: {
          text: "var(--caution-text)",
          fill: "var(--caution-fill)",
        },
        deviation: {
          text: "var(--deviation-text)",
          fill: "var(--deviation-fill)",
        },
        alert: {
          text: "var(--alert-text)",
          fill: "var(--alert-fill)",
        },
        model: {
          text: "var(--model-text)",
          fill: "var(--model-fill)",
        },
        inactive: {
          text: "var(--inactive-text)",
          fill: "var(--inactive-fill)",
        },
        
        cat1: "var(--cat1)",
        cat2: "var(--cat2)",
        cat3: "var(--cat3)",
        cat4: "var(--cat4)",
        cat5: "var(--cat5)",
        cat6: "var(--cat6)",
      },
      fontFamily: {
        serif: ["Fraunces", "serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
      },
      borderRadius: {
        btn: "10px",
        input: "10px",
        card: "16px",
        dialog: "16px",
      },
    },
  },
  plugins: [],
}
