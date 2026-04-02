/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ops-bg': '#0a0a0f',
        'ops-panel': 'rgba(20, 20, 30, 0.4)',
        'ops-accent': '#00ffcc',
        'ops-threat': '#ff3366',
      },
      fontFamily: {
        mono: ['"Fira Code"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
