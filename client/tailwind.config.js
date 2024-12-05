// FILE Konfigurasi framework tailwindcss

/** @type {import('tailwindcss').Config} */

const colors = require('tailwindcss/colors');
export default {
   // set darkMode ke class, agar fitur switch theme bisa berjalan normal
  darkMode : "class",
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [
  ],
};
