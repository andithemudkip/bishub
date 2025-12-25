/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./display.html",
    "./remote.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
