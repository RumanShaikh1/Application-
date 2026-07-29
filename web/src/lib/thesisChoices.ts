import type { Choice } from '@shared/types'

/**
 * The preset "why this buy?" reasons - one tap, no free text. Reuses
 * ChoiceSelector's existing Choice[] shape/accessible radiogroup rather than
 * a bespoke component; `choice.id` is a ThesisTag string at the call site.
 */
export const THESIS_CHOICES: Choice[] = [
  { id: 'fits_mission_goal', label: 'It fits my goal', description: "Matches what I'm trying to do with this portfolio." },
  { id: 'looks_cheap', label: 'It looks cheap on the numbers', description: 'Something in the fundamentals stood out.' },
  { id: 'trending_up', label: "It's been going up", description: 'The recent price move caught my eye.' },
  { id: 'heard_about_it', label: 'I heard about it', description: 'A tip, headline, or something I read.' },
  { id: 'other', label: 'Other', description: 'Some other reason.' }
]
