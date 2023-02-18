const defaultTheme = require('tailwindcss/defaultTheme');
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    fontSize: { ...defaultTheme.fontSize, mb: '15px' },
    extend: {
      animation: {
        text: 'text 5s ease infinite'
      },
      keyframes: {
        text: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        }
      }
    }
  },
  darkMode: 'class',
  plugins: [require('@tailwindcss/typography'), require('@tailwindcss/forms')]
};
