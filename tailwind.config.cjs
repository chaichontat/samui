const defaultTheme = require('tailwindcss/defaultTheme');
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    fontSize: { ...defaultTheme.fontSize, mb: '15px' }
  },
  darkMode: 'class',
  plugins: [require('@tailwindcss/typography')]
};
