import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronDown, Lightbulb } from 'lucide-react'
import BasicsCheckQuestion from '../components/BasicsCheckQuestion'
import { BASICS_PARTS } from '../lib/basicsContent'
import { getBasicsState, markPartComplete, markPromptShown, markSkipped } from '../lib/basicsStore'
import { ACCENT_BADGE_CLASS } from '../lib/accentTheme'

function initialCompletedPartIds(): string[] {
  return getBasicsState().completedPartIds
}

function initialActiveIndex(completedPartIds: string[]): number {
  const index = BASICS_PARTS.findIndex((part) => !completedPartIds.includes(part.id))
  return index === -1 ? BASICS_PARTS.length - 1 : index
}

export default function LearnPage() {
  const [completedPartIds, setCompletedPartIds] = useState<string[]>(initialCompletedPartIds)
  const [activeIndex, setActiveIndex] = useState<number>(() => initialActiveIndex(initialCompletedPartIds()))
  const [passedQuestionIds, setPassedQuestionIds] = useState<Set<string>>(() => {
    const ids = initialCompletedPartIds()
    const passed = new Set<string>()
    for (const part of BASICS_PARTS) {
      if (ids.includes(part.id)) part.checks.forEach((check) => passed.add(check.id))
    }
    return passed
  })

  // Reaching this page at all - whether via HomeRoute's first-run redirect,
  // the nav link, or a typed URL - counts as "the prompt has been shown".
  // Without this, a user who lands here directly (never through "/") could
  // click a link back to "/" and get bounced straight back here, since
  // HomeRoute would still see promptShown as false.
  useEffect(() => {
    markPromptShown()
  }, [])

  // Promotes a part to "complete" in the store the moment every one of its
  // checks has been passed in this session - a useEffect rather than doing
  // this inline inside setPassedQuestionIds's updater, so the localStorage
  // write and the derived completedPartIds update stay outside React's
  // state-updater (which should stay pure).
  useEffect(() => {
    for (const part of BASICS_PARTS) {
      const allPassed = part.checks.every((check) => passedQuestionIds.has(check.id))
      if (allPassed && !completedPartIds.includes(part.id)) {
        markPartComplete(part.id)
        setCompletedPartIds((ids) => (ids.includes(part.id) ? ids : [...ids, part.id]))
      }
    }
  }, [passedQuestionIds, completedPartIds])

  const activePart = BASICS_PARTS[activeIndex]
  const isActivePartComplete = completedPartIds.includes(activePart.id)
  const isLastPart = activeIndex === BASICS_PARTS.length - 1

  function handleSkip(): void {
    markSkipped()
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${ACCENT_BADGE_CLASS[activePart.accent]}`}>
            <activePart.icon size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
              Part {activeIndex + 1} of {BASICS_PARTS.length}
            </p>
            <h1 className="font-display text-2xl font-semibold text-ink">{activePart.title}</h1>
          </div>
        </div>
        <Link
          to="/"
          onClick={handleSkip}
          className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-ink/50 transition-colors hover:text-ink/70 focus-visible:ring-2 focus-visible:ring-vermilion"
        >
          Skip for now
        </Link>
      </div>

      <div className="flex items-center gap-1.5" role="group" aria-label="Curriculum progress">
        {BASICS_PARTS.map((part, index) => {
          const isCompleted = completedPartIds.includes(part.id)
          const isReachable = isCompleted || index === 0 || completedPartIds.includes(BASICS_PARTS[index - 1].id)
          const isActive = index === activeIndex
          return (
            <button
              key={part.id}
              type="button"
              disabled={!isReachable}
              onClick={() => setActiveIndex(index)}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Part ${index + 1}: ${part.title}${isCompleted ? ' (completed)' : ''}`}
              className={`h-1.5 flex-1 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-vermilion disabled:cursor-not-allowed ${
                isActive ? 'bg-vermilion' : isCompleted ? 'bg-lime' : isReachable ? 'bg-ink/25 hover:bg-ink/40' : 'bg-ink/10'
              }`}
            />
          )
        })}
      </div>

      <p className="text-sm leading-relaxed text-ink/65">{activePart.lead}</p>

      <div className="space-y-2.5">
        {activePart.terms.map((term, termIndex) => (
          <details
            key={term.term}
            open={termIndex === 0}
            className="group rounded-2xl border border-ink/10 bg-surface shadow-liftedSm open:shadow-soft"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 focus-visible:ring-2 focus-visible:ring-vermilion">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ACCENT_BADGE_CLASS[activePart.accent]}`}>
                <term.icon size={17} aria-hidden="true" />
              </span>
              <p className="flex-1 font-display text-base font-semibold text-ink">{term.term}</p>
              <ChevronDown size={16} className="shrink-0 text-ink/40 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="animate-fade-in px-4 pb-4 pl-[4.25rem]">
              <p className="text-sm leading-relaxed text-ink/70">{term.definition}</p>
              {term.example ? (
                <p className="mt-2 rounded-xl bg-ink/[0.03] p-3 text-sm leading-relaxed text-ink/60">
                  <span className="font-semibold text-ink/70">Example: </span>
                  {term.example}
                </p>
              ) : null}
            </div>
          </details>
        ))}
      </div>

      {activePart.takeaway ? (
        <div className="rounded-2xl bg-carbon p-4 shadow-soft">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-chalk/50">
            <Lightbulb size={13} aria-hidden="true" />
            Takeaway
          </div>
          <p className="text-sm leading-relaxed text-chalk/85">{activePart.takeaway}</p>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Quick check</h2>
        {activePart.checks.map((check) => (
          <BasicsCheckQuestion
            key={check.id}
            question={check}
            passed={passedQuestionIds.has(check.id)}
            onPass={() => setPassedQuestionIds((prev) => (prev.has(check.id) ? prev : new Set(prev).add(check.id)))}
          />
        ))}
      </section>

      {isActivePartComplete ? (
        isLastPart ? (
          <div className="rounded-2xl border border-ink/10 bg-surface p-5 text-center shadow-liftedSm">
            <CheckCircle2 size={28} className="mx-auto text-lime" aria-hidden="true" />
            <p className="mt-2 font-display text-lg font-semibold text-ink">You’ve got the basics.</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-ink/60">
              You know what a share is, why prices move, how to read a company, and how to think about risk. Everything else in this app builds on that.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                to="/scenarios"
                className="rounded-full bg-vermilion px-5 py-2.5 text-sm font-semibold text-chalk transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
              >
                Play a scenario
              </Link>
              <Link
                to="/"
                className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
              >
                Back to home
              </Link>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setActiveIndex((index) => index + 1)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-bone transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
          >
            Continue to Part {activeIndex + 2}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )
      ) : null}
    </div>
  )
}
