import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Languages, Sparkles, ThumbsUp, Wand2 } from 'lucide-react'
import Panel from './Panel'
import StatusState, { type ViewState } from './StatusState'
import type { HighlightPayload } from '@shared/ipc-channels'

interface TranslatorProps {
  highlight: HighlightPayload | null
}

type Feedback = 'none' | 'positive'

interface FetchTrigger {
  nonce: number
  simplify: boolean
}

/** Renders Gemini's occasional **bold** markdown instead of showing literal asterisks. */
function renderFormattedText(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((segment, index) => {
    const boldMatch = segment.match(/^\*\*(.+)\*\*$/)
    if (boldMatch) {
      return (
        <strong key={index} className="font-semibold text-ink">
          {boldMatch[1]}
        </strong>
      )
    }
    return <span key={index}>{segment}</span>
  })
}

export default function Translator({ highlight }: TranslatorProps) {
  const [viewState, setViewState] = useState<ViewState>('empty')
  const [translation, setTranslation] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [feedback, setFeedback] = useState<Feedback>('none')
  const [trigger, setTrigger] = useState<FetchTrigger>({ nonce: 0, simplify: false })
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!highlight) {
      setViewState('empty')
      return
    }

    const requestId = ++requestIdRef.current
    setViewState('loading')
    setFeedback('none')

    window.api
      .translateTerm({ text: highlight.text, sourceUrl: highlight.url, simplifyFurther: trigger.simplify })
      .then((explanation) => {
        if (requestIdRef.current !== requestId) return
        setTranslation(explanation)
        setViewState('populated')
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) return
        setErrorMessage(error instanceof Error ? error.message : 'Translation failed.')
        setViewState('error')
      })
    // Re-run whenever a fresh selection arrives, or Retry/Simplify is pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight?.timestamp, trigger])

  function retry(): void {
    setTrigger((current) => ({ nonce: current.nonce + 1, simplify: false }))
  }

  function requestSimpler(): void {
    setTrigger((current) => ({ nonce: current.nonce + 1, simplify: true }))
  }

  return (
    <Panel
      icon={Languages}
      title="Jargon Buster"
      subtitle="Highlight text in the browser pane"
      action={
        viewState === 'loading' ? (
          <span className="flex items-center gap-1.5 bg-vermilion/10 px-2.5 py-1 text-[10px] font-medium text-vermilion">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-vermilion" aria-hidden="true" />
            Translating
          </span>
        ) : undefined
      }
    >
      <div className="min-h-[168px] border border-hairline border-ink/12 bg-ink/[0.03] p-4">
        <StatusState
          state={viewState}
          loadingLabel="Translating..."
          emptyIcon={Sparkles}
          emptyTitle="Nothing highlighted yet"
          emptyBody="Highlight text on the left to begin."
          errorMessage={errorMessage}
          onRetry={retry}
        >
          <div className="animate-fade-in space-y-3">
            <blockquote className="border-l-2 border-ink/25 pl-3 text-xs italic leading-relaxed text-ink/60">
              "{highlight?.text ?? ''}"
            </blockquote>
            <p className="whitespace-pre-line text-base leading-relaxed text-ink">
              {renderFormattedText(translation)}
            </p>

            <div className="flex items-center justify-between gap-2 border-t border-hairline border-ink/15 pt-3">
              <span className="text-[11px] text-ink/55">
                {feedback === 'positive' ? 'Glad that helped!' : 'Was that clear?'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFeedback('positive')}
                  disabled={feedback === 'positive'}
                  aria-label="This explanation was clear"
                  className={`p-1.5 transition-colors disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-vermilion ${
                    feedback === 'positive' ? 'bg-lime text-ink' : 'text-ink/55 hover:bg-ink/8 hover:text-ink'
                  }`}
                >
                  <ThumbsUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={requestSimpler}
                  aria-label="Simplify this explanation further"
                  className="flex items-center gap-1 rounded-full border border-hairline border-ink/20 px-2.5 py-1.5 text-[11px] font-medium text-ink/70 transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
                >
                  <Wand2 size={13} aria-hidden="true" />
                  Simplify
                </button>
              </div>
            </div>
          </div>
        </StatusState>
      </div>
    </Panel>
  )
}
