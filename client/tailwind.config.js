/** @type {import('tailwindcss').Config} */

const colors = require('tailwindcss/colors');
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors : {
      'color1' : '#B76DFD',
      'red' : colors.red,
      'green' : colors.green,
      'gray' : colors.gray
    },
    extend: {},
  },
  plugins: [
  ],
};
