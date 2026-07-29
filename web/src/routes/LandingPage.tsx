import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, EyeOff, GraduationCap, Receipt, Scale, ShieldCheck, Trophy, Wallet } from 'lucide-react'
import { getBasicsState, isBasicsComplete } from '../lib/basicsStore'

const MODULES = [
  {
    to: '/scenarios',
    icon: BookOpen,
    badgeClass: 'bg-vermilion/12 text-vermilion',
    title: 'Decision Replay',
    description:
      "Step into anonymised moments from real Indian-market history. Information arrives the way it actually did - decide, then see how your reasoning measured up.",
    cta: 'Play a scenario'
  },
  {
    to: '/simulator',
    icon: Wallet,
    badgeClass: 'bg-cobalt/12 text-cobalt',
    title: 'Simulator',
    description:
      'Trade a virtual portfolio against real live prices, or replay the 2020 crash day by day. Every trade is scored on position sizing, diversification, and your stated reasoning.',
    cta: 'Open the simulator'
  },
  {
    to: '/tax',
    icon: Receipt,
    badgeClass: 'bg-lime text-carbon',
    title: 'Trade cost & tax',
    description:
      'See what a trade actually costs after brokerage, STT, exchange charges, and tax - never tax shown alone. A financial-year planner covers exemption headroom and loss set-off.',
    cta: 'Check a trade'
  },
  {
    to: '/progress',
    icon: Trophy,
    badgeClass: 'bg-ink/8 text-ink/70',
    title: 'Progress',
    description: 'Every scenario you have completed on this device, with your average score and track record over time.',
    cta: 'View your record'
  }
]

const PRINCIPLES = [
  {
    icon: Scale,
    badgeClass: 'bg-vermilion/10 text-vermilion',
    title: 'Graded on the decision, never the outcome',
    body: 'A sound call that lost money still scores well - a reckless one that happened to work out does not score better for it.'
  },
  {
    icon: EyeOff,
    badgeClass: 'bg-cobalt/10 text-cobalt',
    title: 'Identities stay masked until after you decide',
    body: "Decision Replay withholds the company name and dates until your answer is in, so it's a test of judgement, not memory."
  },
  {
    icon: ShieldCheck,
    badgeClass: 'bg-lime text-carbon',
    title: 'Virtual money, real math, never advice',
    body: 'Every number here is an indicative estimate you can inspect line by line - nothing here tells you what to buy or sell.'
  }
]

export default function LandingPage() {
  const basicsDone = isBasicsComplete(getBasicsState())

  return (
    <div className="animate-fade-in space-y-10">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3 sm:max-w-md">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Practice the decision, not the outcome.
          </h1>
          <p className="text-sm leading-relaxed text-ink/60 sm:text-base">
            Three practice tools for the Indian market: replay real historical moments, trade a virtual portfolio, and see what a trade actually costs after
            tax. No real money, no accounts, no advice - just your reasoning, scored honestly.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to="/scenarios"
              className="rounded-full bg-vermilion px-5 py-2.5 text-sm font-semibold text-chalk transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
            >
              Start a scenario
            </Link>
            <Link
              to="/simulator"
              className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
            >
              Try the simulator
            </Link>
          </div>
        </div>

        <div className="relative hidden h-36 w-36 shrink-0 sm:block" aria-hidden="true">
          <div className="absolute left-0 top-2 flex h-20 w-20 -rotate-6 items-center justify-center rounded-3xl bg-vermilion shadow-soft">
            <BookOpen size={30} className="text-chalk" />
          </div>
          <div className="absolute right-0 top-0 flex h-20 w-20 rotate-6 items-center justify-center rounded-3xl bg-cobalt shadow-soft">
            <Wallet size={30} className="text-chalk" />
          </div>
          <div className="absolute bottom-0 left-8 flex h-20 w-20 rotate-3 items-center justify-center rounded-3xl bg-lime shadow-soft">
            <Receipt size={30} className="text-carbon" />
          </div>
        </div>
      </div>

      {!basicsDone ? (
        <Link
          to="/learn"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-cobalt/25 bg-cobalt/8 p-4 transition-colors hover:border-cobalt/40 focus-visible:ring-2 focus-visible:ring-vermilion"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cobalt/15 text-cobalt">
              <GraduationCap size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">New here? Start with the basics.</p>
              <p className="text-sm leading-relaxed text-ink/60">A short primer on what a share is, why prices move, and how to think about risk - before anything else.</p>
            </div>
          </div>
          <ArrowRight size={16} className="hidden shrink-0 text-cobalt transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
        </Link>
      ) : null}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/45">What's here</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULES.map((module) => (
            <Link
              key={module.to}
              to={module.to}
              className="group flex flex-col rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm transition-colors hover:border-vermilion/40 focus-visible:ring-2 focus-visible:ring-vermilion"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${module.badgeClass}`}>
                <module.icon size={20} aria-hidden="true" />
              </span>
              <p className="mt-3 font-display text-base font-semibold text-ink">{module.title}</p>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink/60">{module.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-vermilion">
                {module.cta}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/45">How it's built to be honest</h2>
        <ul className="space-y-2.5">
          {PRINCIPLES.map((principle) => (
            <li key={principle.title} className="flex gap-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${principle.badgeClass}`}>
                <principle.icon size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{principle.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink/60">{principle.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
