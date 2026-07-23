/** @type {import('tailwindcss').Config} */
module.exports = {
  // Class-based (not media-query) so the in-panel toggle controls it,
  // independent of the host page's or OS's own color scheme. The `dark`
  // class is applied to the shadow root's own container div (see
  // useTheme.ts) - never to the host page - so it can't affect anything
  // outside the panel.
  darkMode: 'class',
  // Preflight and every utility here only ever gets injected inside our own
  // shadow root (see src/content/main.tsx), so these selectors - including
  // the `*` reset and `html`/`body` in Tailwind's base layer - are scoped by
  // the browser to that shadow tree and can never leak onto the host page.
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Spark identity system - five flat colors, no scales, no gradients.
        bone: '#F4F1EA', // ground
        ink: '#16150F', // type + dark surfaces
        vermilion: '#F0432B', // the spark - primary action/accent
        cobalt: '#2540E8', // links, depth
        // Cobalt lightened (same hue/saturation, higher lightness) for dark
        // mode only - raw cobalt on ink is ~2.6:1 contrast, under the 4.5:1
        // AA minimum for link text. This is a derived tint of the same
        // brand color, not a new hue.
        'cobalt-light': '#7887E9',
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
      boxShadow: {
        // Soft, layered, ink-tinted lift - not a flat default shadow-md -
        // used to make cards feel like they're resting lightly on the page
        // rather than boxed in by a hard border, per the "airier, less
        // intimidating for new traders" pass.
        soft: '0 1px 2px rgba(22, 21, 15, 0.04), 0 6px 16px -4px rgba(22, 21, 15, 0.08)',
        liftedSm: '0 1px 2px rgba(22, 21, 15, 0.05)',
        // An ink-tinted shadow is invisible on an ink background - dark
        // mode gets its own black-tinted equivalents instead.
        softDark: '0 1px 2px rgba(0, 0, 0, 0.3), 0 6px 18px -4px rgba(0, 0, 0, 0.45)',
        liftedSmDark: '0 1px 2px rgba(0, 0, 0, 0.35)'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
