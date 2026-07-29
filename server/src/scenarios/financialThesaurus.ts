/**
 * Hand-authored synonym families for the local rationale matcher
 * (matchRationale.ts) - maps colloquial or alternate financial vocabulary
 * to one canonical word per family, so a rationale using a different-but-
 * equivalent term (e.g. "earnings" instead of "revenue") still satisfies a
 * matchConcepts keyword written with the canonical term. Grounded in the
 * vocabulary actually used across server/data/scenarios/*.json's
 * matchConcepts - extend this file, not the per-scenario clusters, when a
 * new synonym gap is found.
 *
 * Deliberately NOT a general-purpose thesaurus: entries are grouped by
 * families that are genuinely interchangeable *for grading these specific
 * criteria*, not everywhere in finance (e.g. "earnings" often means profit
 * in real usage, but every criterion here that uses "revenue" is really
 * asking "did they notice the top-line sales figure", so folding earnings/
 * income/sales/turnover into that one family is the right call for this
 * matcher even though it's a simplification of real accounting terms).
 */

function family(canonical: string, variants: string[]): [string, string][] {
  return variants.map((variant): [string, string] => [variant, canonical])
}

const SYNONYM_ENTRIES: [string, string][] = [
  ...family('revenue', ['earning', 'earnings', 'income', 'sales', 'turnover']),
  ...family('margin', ['profit', 'profits', 'profitability', 'profitable']),
  ...family('declin', [
    'drop', 'drops', 'dropped', 'dropping',
    'fall', 'falls', 'fell', 'fallen', 'falling',
    'slump', 'slumps', 'slumped', 'slumping',
    'shrink', 'shrinks', 'shrunk', 'shrinking',
    'plunge', 'plunges', 'plunged', 'plunging',
    'slide', 'slides', 'slid', 'sliding',
    'weaken', 'weakens', 'weakened', 'weakening',
    'worsen', 'worsens', 'worsened', 'worsening',
    'deteriorate', 'deteriorates', 'deteriorated', 'deteriorating'
  ]),
  ...family('growth', [
    'grow', 'grows', 'grew', 'grown', 'growing',
    'increase', 'increases', 'increased', 'increasing',
    'rise', 'rises', 'rose', 'risen', 'rising',
    'expand', 'expands', 'expanded', 'expanding', 'expansion',
    'climb', 'climbs', 'climbed', 'climbing'
  ]),
  ...family('hype', ['craze', 'mania', 'frenzy', 'excitement', 'excited']),
  ...family('leverage', ['debt', 'borrowing', 'borrowed', 'loans', 'indebted', 'geared', 'gearing']),
  ...family('expensive', ['pricey', 'costly', 'overpriced']),
  ...family('cheap', ['bargain', 'inexpensive', 'underpriced']),
  ...family('concentrat', ['overweight']),
  ...family('sentiment', ['mood', 'emotion', 'feeling']),
  ...family('guidance', ['outlook', 'forecast', 'projection']),
  ...family('material', ['significant', 'substantial', 'meaningful', 'consequential']),
  ...family('fundamental', ['structural', 'underlying']),
  ...family('valuation', ['multiple', 'multiples']),
  ...family('dividend', ['payout', 'payouts']),
  ...family('auditor', ['auditors']),
  ...family('sector', ['industry']),
  ...family('customer', ['client', 'clients', 'customers'])
]

const SYNONYM_MAP: Record<string, string> = Object.fromEntries(SYNONYM_ENTRIES)

/** Returns the canonical form for a word if it's a known synonym, otherwise the word unchanged. */
export function canonicalizeWord(word: string): string {
  return SYNONYM_MAP[word] ?? word
}
