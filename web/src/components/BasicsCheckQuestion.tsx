import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import ChoiceSelector from './ChoiceSelector'
import FactorSelect from './FactorSelect'
import type { BasicsCheckQuestion as BasicsCheckQuestionData } from '../lib/basicsContent'

interface BasicsCheckQuestionProps {
  question: BasicsCheckQuestionData
  passed: boolean
  onPass: () => void
}

/**
 * Unlimited, non-punitive retries by design - this gates progress through
 * the curriculum's own pages, not a graded assessment (see CLAUDE.md:
 * placement/case-study grading must never be a hard wall either). `passed`
 * seeds the initial state so a part the user already cleared (resumed via
 * the step indicator) shows its explanation immediately instead of
 * re-prompting for an answer that was never persisted.
 */
export default function BasicsCheckQuestion({ question, passed, onPass }: BasicsCheckQuestionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submittedCorrect, setSubmittedCorrect] = useState<boolean | null>(passed ? true : null)
  const [validationError, setValidationError] = useState('')

  const choices = question.options.map(({ id, label }) => ({ id, label }))
  const correctIds = new Set(question.options.filter((option) => option.correct).map((option) => option.id))

  function checkAnswer(): void {
    if (question.multiSelect) {
      if (selectedIds.length === 0) {
        setValidationError('Select at least one option.')
        return
      }
      const isCorrect = selectedIds.length === correctIds.size && selectedIds.every((id) => correctIds.has(id))
      setValidationError('')
      setSubmittedCorrect(isCorrect)
      if (isCorrect) onPass()
    } else {
      if (!selectedId) return
      const isCorrect = correctIds.has(selectedId)
      setSubmittedCorrect(isCorrect)
      if (isCorrect) onPass()
    }
  }

  function tryAgain(): void {
    setSubmittedCorrect(null)
    setSelectedId(null)
    setSelectedIds([])
    setValidationError('')
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm">
      <p className="mb-3 text-sm font-semibold text-ink">{question.prompt}</p>

      {submittedCorrect !== true ? (
        <>
          {question.multiSelect ? (
            <FactorSelect
              options={choices}
              selectedIds={selectedIds}
              onChange={(ids) => {
                setSelectedIds(ids)
                if (ids.length > 0) setValidationError('')
              }}
              legend={question.prompt}
              error={validationError}
            />
          ) : (
            <ChoiceSelector choices={choices} selectedId={selectedId} onSelect={setSelectedId} legend={question.prompt} />
          )}

          {submittedCorrect === null ? (
            <button
              type="button"
              onClick={checkAnswer}
              disabled={question.multiSelect ? false : !selectedId}
              className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bone transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check answer
            </button>
          ) : (
            <div className="mt-3 rounded-xl bg-ink/[0.03] p-3.5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-vermilion">
                <XCircle size={16} aria-hidden="true" />
                Not quite
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{question.explanation}</p>
              <button
                type="button"
                onClick={tryAgain}
                className="mt-2 rounded-full text-sm font-semibold text-vermilion hover:opacity-80 focus-visible:ring-2 focus-visible:ring-vermilion"
              >
                Try again
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl bg-ink/[0.03] p-3.5">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <CheckCircle2 size={16} className="text-lime" aria-hidden="true" />
            Correct
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{question.explanation}</p>
        </div>
      )}
    </div>
  )
}
