import type { BasicsAccent } from './basicsContent'

// Every color here is one of the app's existing brand tokens (see
// tailwind.config.js) - lime is always paired with text-carbon rather than a
// tinted background, matching the existing bg-lime pill-badge convention
// elsewhere (ScenarioListPage's "Beginner" tag, ScoreBreakdown's "Sound
// decision" tag) - lime-on-tint would be low-contrast, lime-solid isn't.
export const ACCENT_BADGE_CLASS: Record<BasicsAccent, string> = {
  cobalt: 'bg-cobalt/12 text-cobalt',
  vermilion: 'bg-vermilion/12 text-vermilion',
  lime: 'bg-lime text-carbon'
}
