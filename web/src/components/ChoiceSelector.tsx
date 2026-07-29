import type { KeyboardEvent } from 'react'
import { useRef } from 'react'
import type { Choice } from '@shared/types'

interface ChoiceSelectorProps {
  choices: Choice[]
  selectedId: string | null
  onSelect: (id: string) => void
  legend: string
}

/**
 * role="radiogroup" of role="radio" buttons with a roving tabindex: arrow
 * keys move focus AND selection together (standard radio-group behavior),
 * Enter/Space also selects the focused option, Home/End jump to the ends.
 * Only one button is ever in the tab order at a time.
 */
export default function ChoiceSelector({ choices, selectedId, onSelect, legend }: ChoiceSelectorProps) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  function focusAndSelect(index: number): void {
    const choice = choices[index]
    if (!choice) return
    onSelect(choice.id)
    buttonRefs.current[choice.id]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        focusAndSelect((index + 1) % choices.length)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        focusAndSelect((index - 1 + choices.length) % choices.length)
        break
      case 'Home':
        event.preventDefault()
        focusAndSelect(0)
        break
      case 'End':
        event.preventDefault()
        focusAndSelect(choices.length - 1)
        break
      case ' ':
      case 'Enter':
        event.preventDefault()
        onSelect(choices[index].id)
        break
      default:
        break
    }
  }

  return (
    <div role="radiogroup" aria-label={legend} className="grid gap-2.5 sm:grid-cols-2">
      {choices.map((choice, index) => {
        const isSelected = choice.id === selectedId
        const isTabbable = selectedId === null ? index === 0 : isSelected

        return (
          <button
            key={choice.id}
            ref={(el) => {
              buttonRefs.current[choice.id] = el
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isTabbable ? 0 : -1}
            onClick={() => onSelect(choice.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone ${
              isSelected ? 'border-vermilion bg-vermilion/8 shadow-soft' : 'border-ink/12 bg-surface hover:border-vermilion/40'
            }`}
          >
            <p className="font-display text-sm font-semibold text-ink">{choice.label}</p>
            {choice.description ? <p className="mt-1 text-xs leading-relaxed text-ink/60">{choice.description}</p> : null}
          </button>
        )
      })}
    </div>
  )
}
