import type { CriterionMatch } from './rubricScoring.js'
import type { Rubric, RubricCriterion } from '../../../shared/types.js'
import { canonicalizeWord } from './financialThesaurus.js'

/**
 * Local, deterministic replacement for Gemini-graded rationale matching - no
 * network call, no API cost. Each criterion carries hand-authored
 * `matchConcepts` (see shared/types.ts's RubricCriterion) - clusters of
 * alternative words/phrases, including partial stems, that all point at the
 * same underlying idea. A criterion is matched once enough of its clusters
 * are satisfied.
 *
 * Matching is bag-of-words, not phrase-substring: every word in a cluster
 * keyword must appear SOMEWHERE in the rationale - not necessarily adjacent
 * or in the keyword's word order. Natural writing rarely reproduces a fixed
 * phrase exactly ("revenue has been declining" / "declining revenue" /
 * "revenue growth has slowed" for a keyword written as "revenue growth") -
 * requiring exact adjacency was the single biggest source of real matching
 * gaps found while testing this engine against realistic rationale text.
 * Word comparison also runs through financialThesaurus.ts first, so a
 * rationale that says "earnings" matches a keyword written as "revenue".
 *
 * This is intentionally more literal than an LLM judge - it can't reward a
 * genuinely novel phrasing nobody anticipated, and going bag-of-words trades
 * some precision (word co-occurrence isn't proof of a coherent point) for
 * much better recall on natural phrasing. What it buys back is zero
 * marginal cost and fully offline operation.
 */

// Hyphens and slashes are word separators here, not literal characters to
// match on - "cash-strained" and "cash strained" must normalize identically,
// or a cluster phrase authored with a space would silently never match a
// rationale that happens to use a hyphen instead. Slashes are handled
// differently: deleted rather than turned into a space, so "P/E" becomes
// the one token "pe" instead of splitting into the single-character tokens
// "p" and "e" - under bag-of-words matching, single-letter keywords would
// match almost any word starting with p or e ("price", "even", "earnings"),
// a real false-positive found while testing this against live rationale.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\//g, '')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  const normalized = normalize(text)
  return normalized.length > 0 ? normalized.split(' ') : []
}

// `keyword` may be a whole word ("hype") or a deliberate partial stem
// ("concentrat" - catches concentration/concentrated/concentrating via
// startsWith). Synonym canonicalization runs before the prefix check on
// both sides, so a stem keyword still benefits from the thesaurus as long
// as the rationale token's canonical form is what the stem was written
// against (e.g. keyword "declin" matches token "falling" because
// canonicalizeWord('falling') === 'declin').
function tokenMatchesKeyword(rationaleToken: string, keyword: string): boolean {
  const canonicalToken = canonicalizeWord(rationaleToken)
  const canonicalKeyword = canonicalizeWord(keyword)
  return canonicalToken.startsWith(canonicalKeyword) || rationaleToken.startsWith(keyword)
}

function phraseMatches(rationaleTokens: string[], phrase: string): boolean {
  const keywords = normalize(phrase).split(' ').filter(Boolean)
  if (keywords.length === 0) return false
  return keywords.every((keyword) => rationaleTokens.some((token) => tokenMatchesKeyword(token, keyword)))
}

function findClusterHit(rationaleTokens: string[], cluster: string[]): string | null {
  for (const phrase of cluster) {
    if (phraseMatches(rationaleTokens, phrase)) return phrase
  }
  return null
}

export function matchCriterion(rationale: string, criterion: RubricCriterion): CriterionMatch {
  const clusters = criterion.matchConcepts ?? []
  if (clusters.length === 0) {
    // Never silently claim a match for a criterion nobody authored concepts for.
    return { id: criterion.id, matched: false, evidence: 'Not gradable locally yet - no reference concepts authored for this criterion.' }
  }

  const rationaleTokens = tokenize(rationale)
  const required = criterion.minConceptsRequired ?? clusters.length
  const hits = clusters.map((cluster) => findClusterHit(rationaleTokens, cluster)).filter((hit): hit is string => hit !== null)

  const matched = hits.length >= required
  const evidence =
    hits.length === 0
      ? "Doesn't mention this."
      : matched
        ? `Mentions "${hits.join('", "')}".`
        : `Only touches on "${hits.join('", "')}" - doesn't fully cover this point.`

  return { id: criterion.id, matched, evidence }
}

export function matchAllCriteria(rationale: string, rubric: Rubric): CriterionMatch[] {
  return rubric.criteria.map((criterion) => matchCriterion(rationale, criterion))
}

/**
 * Short (1-2 sentence) summary shown above the criteria checklist, which
 * already itemises each point with its own matched/evidence state - this
 * doesn't re-narrate every criterion, just how many landed.
 */
export function generateFeedback(rubric: Rubric, matches: CriterionMatch[]): string {
  const total = rubric.criteria.length
  const matchedCount = matches.filter((match) => match.matched).length

  if (total === 0) return 'Thanks for sharing your reasoning.'
  if (matchedCount === total) {
    return 'Your rationale covers every point a sound decision here would consider - see the checklist below for exactly what it caught.'
  }
  if (matchedCount === 0) {
    return "Your rationale doesn't clearly touch on the points that matter most here yet - the checklist below shows what a sound decision would consider."
  }
  return `Your rationale covers ${matchedCount} of ${total} points a sound decision here would consider - see the checklist below for what it caught and what's still worth addressing.`
}

export interface RationaleEvaluation {
  criteriaMatches: CriterionMatch[]
  feedback: string
}

export function evaluateRationaleLocally(rubric: Rubric, rationale: string): RationaleEvaluation {
  const criteriaMatches = matchAllCriteria(rationale, rubric)
  return { criteriaMatches, feedback: generateFeedback(rubric, criteriaMatches) }
}
