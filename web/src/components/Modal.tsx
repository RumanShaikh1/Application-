import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  titleId: string
  title: string
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * A minimal, from-scratch dialog primitive - this codebase has no existing
 * one to reuse. Traps focus inside while open, restores it to whatever
 * triggered the modal on close, and closes on Escape or a backdrop click -
 * the non-negotiable modal behaviors from CLAUDE.md's accessibility rules.
 */
export default function Modal({ titleId, title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    triggerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const closeButton = dialogRef.current?.querySelector<HTMLElement>('[data-modal-close]')
    closeButton?.focus()

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-8 backdrop-blur-sm sm:pt-16">
      <button type="button" aria-label="Close" className="fixed inset-0 cursor-default" onClick={onClose} tabIndex={-1} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-xl animate-fade-in rounded-2xl bg-surface p-5 shadow-soft"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-ink/50 transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-vermilion"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
