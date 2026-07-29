import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink/6 text-ink/45">
        <Compass size={22} aria-hidden="true" />
      </span>
      <p className="font-display text-lg font-semibold text-ink">Page not found</p>
      <p className="max-w-[320px] text-sm leading-relaxed text-ink/55">The page you're looking for doesn't exist or may have moved.</p>
      <Link
        to="/"
        className="mt-2 rounded-full bg-vermilion px-5 py-2 text-sm font-semibold text-chalk transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
      >
        Back home
      </Link>
    </div>
  )
}
