// A portable stand-in for node:crypto's randomUUID - used only to give
// trade/scenario records a unique id for client-side list rendering and
// keying, never as a security or auth token, so Math.random()-based
// generation is adequate. Kept dependency-free (no node:crypto) because
// this file is shared with the Android app's JS bridge (see
// server/src/mobileDispatch.ts), which has no Node built-ins available.
export function randomId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16)
  const section = (length: number) => Array.from({ length }, hex).join('')
  return `${section(8)}-${section(4)}-4${section(3)}-${((8 + Math.floor(Math.random() * 4)) % 16).toString(16)}${section(3)}-${section(12)}`
}
