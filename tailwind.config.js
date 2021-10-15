const colors = require('tailwindcss/colors');

module.exports = {
  purge: [
    './index.html',
    './src/**/*.js',
  ],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
      maxWidth: {
       '1/4': '25%',
       '1/2': '50%',
       '3/4': '75%',
      },
  },
  variants: {
    extend: {
      backgroundColor: ['disabled'],
      cursor: ['disabled'],
      textColor: ['disabled'],
    },
  },
  plugins: [],
}
