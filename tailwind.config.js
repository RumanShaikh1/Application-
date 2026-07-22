/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Spark identity system - five flat colors, no scales, no gradients.
        // Usage ratios per brand guideline: bone ~55%, ink ~25%, vermilion ~12%,
        // cobalt ~6%, lime ~2% (highlight only - always as an ink-on-lime chip,
        // never as text directly on bone; the two are near-isoluminant).
        bone: '#F4F1EA', // ground
        ink: '#16150F', // type + dark surfaces
        vermilion: '#F0432B', // the spark - primary action/accent
        cobalt: '#2540E8', // links, depth
        lime: '#C9F24B' // highlight only, always as a filled chip
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']
      },
      borderWidth: {
        hairline: '1.25px'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' }
        },
        'loading-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        'loading-bar': 'loading-bar 1.1s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
