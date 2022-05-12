const defaultTheme = require('tailwindcss/defaultTheme');
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  plugins: [require('@tailwindcss/typography')]
};
