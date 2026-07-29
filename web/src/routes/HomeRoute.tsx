import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import LandingPage from './LandingPage'
import { getBasicsState, markPromptShown } from '../lib/basicsStore'

/**
 * Sends a first-ever visitor to the beginner curriculum before the landing
 * page - a soft gate (CLAUDE.md: no hard content wall). `promptShown` makes
 * this fire exactly once per browser: it never blocks a direct nav or URL
 * visit to any other route, and never re-fires once /learn has been reached,
 * whether the user finished it or skipped.
 *
 * The redirect decision is a pure read seeded via useState's lazy
 * initializer; the localStorage write happens in an effect, never during
 * render - StrictMode double-invokes render in development, and writing
 * `promptShown` there would make the second pass see its own write and
 * silently fall through to the wrong branch.
 */
export default function HomeRoute() {
  const [shouldRedirectToLearn] = useState(() => !getBasicsState().promptShown)

  useEffect(() => {
    if (shouldRedirectToLearn) markPromptShown()
  }, [shouldRedirectToLearn])

  if (shouldRedirectToLearn) return <Navigate to="/learn" replace />
  return <LandingPage />
}
