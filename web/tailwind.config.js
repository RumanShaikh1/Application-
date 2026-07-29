/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Spark identity system - kept in sync by hand with
        // extension/tailwind.config.js (no shared build tooling between the
        // two workspaces yet - see the implementation plan for that trade-off).
        // bone/ink/surface/cobalt resolve through CSS variables (defined in
        // index.css, light values in :root, dark values under .dark) so
        // every existing bg-bone/text-ink/bg-surface usage across the app
        // repaints for free when the `dark` class toggles - see lib/theme.ts.
        bone: 'rgb(var(--color-bone) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        cobalt: 'rgb(var(--color-cobalt) / <alpha-value>)',
        'cobalt-light': '#7887E9',
        vermilion: '#F0432B',
        lime: '#C9F24B',
        // Fixed, theme-independent tones - never flip with the `dark` class.
        // Used only by the price-chart "terminal" panels (ScenarioChart and
        // its host cards): the lime/vermilion trend lines are calibrated
        // against a dark backdrop and would wash out on a light one, so
        // those panels stay dark in both themes. Also used to pin text that
        // sits on a fixed-brightness accent chip (e.g. bg-lime) so it never
        // loses contrast when the *page* theme flips underneath it.
        carbon: '#16150F',
        chalk: '#F4F1EA'
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
        soft: '0 1px 2px rgba(22, 21, 15, 0.04), 0 6px 16px -4px rgba(22, 21, 15, 0.08)',
        liftedSm: '0 1px 2px rgba(22, 21, 15, 0.05)'
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
