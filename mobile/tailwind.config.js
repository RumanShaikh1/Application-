/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Spark identity system - kept in sync by hand with
        // extension/tailwind.config.js and web/tailwind.config.js (no
        // shared build tooling between the three client workspaces yet).
        bone: '#F4F1EA',
        ink: '#16150F',
        vermilion: '#F0432B',
        cobalt: '#2540E8',
        'cobalt-light': '#7887E9',
        lime: '#C9F24B',
        surface: '#FFFFFF'
      }
    }
  },
  plugins: []
}
