import type { PublicSelectOption } from '@shared/types'

interface FactorSelectProps {
  options: PublicSelectOption[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  legend: string
  error?: string
}

/**
 * A distractor-aware multi-select checklist - native checkboxes, so Tab/
 * Space work for free without the roving-tabindex machinery a radiogroup
 * needs (see ChoiceSelector). Genuine drivers and distractors are never
 * visually distinguished here - the server already stripped which is which
 * before this ever renders (see PublicSelectOption).
 */
export default function FactorSelect({ options, selectedIds, onChange, legend, error }: FactorSelectProps) {
  function toggle(id: string): void {
    onChange(selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id])
  }

  return (
    <div role="group" aria-label={legend}>
      <div className="space-y-2" aria-describedby={error ? 'factor-select-error' : undefined}>
        {options.map((option) => {
          const checked = selectedIds.includes(option.id)
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors focus-within:ring-2 focus-within:ring-vermilion focus-within:ring-offset-2 focus-within:ring-offset-bone ${
                checked ? 'border-vermilion bg-vermilion/8' : 'border-ink/12 bg-surface hover:border-vermilion/40'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-vermilion"
              />
              <span className="text-sm leading-relaxed text-ink">{option.label}</span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p id="factor-select-error" className="mt-1.5 text-xs text-vermilion" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
