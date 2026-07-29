// Spark identity system as raw values - tailwind.config.js is the source
// of truth for className-driven styling; this exists only for the few
// native APIs that can't consume a NativeWind className directly (icon
// `color` props, ActivityIndicator). Keep in sync with tailwind.config.js
// by hand (same trade-off already made for extension/ vs. web/).
export const colors = {
  bone: '#F4F1EA',
  ink: '#16150F',
  vermilion: '#F0432B',
  cobalt: '#2540E8',
  cobaltLight: '#7887E9',
  lime: '#C9F24B',
  surface: '#FFFFFF'
} as const
