# CLAUDE.md — Engineering Rules (VS Code)

General rules for building software in this workspace — frontend, backend, CLIs, libraries, any language. Language-specific sections activate only when relevant; the universal rules always apply.

## Always Do First
- **Detect the stack before writing code.** Read the manifest and lockfile to learn the language, package manager, and conventions: `package.json`, `requirements.txt` / `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml` / `build.gradle`, `Gemfile`, `composer.json`, `*.csproj`. Match what's already there — do not introduce a new framework, package manager, or style without asking.
- **Read neighboring files before adding code.** Match existing naming, structure, error handling, and formatting. New code should look like it was written by the same person.
- **For any frontend/UI work, invoke the `frontend-design` skill** before writing frontend code, every session, no exceptions.
- Use the project's own tooling: its linter, formatter, and test runner — not your own preference. Run them before considering a task done.

## Core Principle — The Verification Loop
**Never assume code works. Run it, capture the actual output, and compare against what's expected.** This is the spine of everything below. Two concrete instances:
- **Frontend → the screenshot loop:** render it, screenshot it, compare against the reference.
- **Backend / CLI / libraries → the run-and-check loop:** execute it, capture the real response/output/state, compare against the expected contract.

The shape is identical in both cases:
> make a change → run it → capture real output → compare to expected, **specifically** → fix the mismatch → run again.

Do at least **2 rounds**. Stop only when actual output matches expected, or the user says so. Being specific matters: "returns 200 but should be 201", not "looks off".

## `/microedit` — Skip the Loop
For trivial, **zero-behavior** changes, the verification loops are overkill. When the user prefixes a request with **`/microedit`** (or says "microedit:"), skip the screenshot loop and the backend run-and-check loop and just make the edit.

- **Qualifies:** fixing a typo, editing a comment or docstring, changing copy/label/string text, renaming a local variable, formatting/whitespace, reordering imports, tweaking a log message — anything that **cannot change runtime behavior or output**.
- **Does NOT qualify — run the full loop regardless of the flag:** logic or control-flow changes, API/response contracts, new or changed endpoints, DB/schema/migrations, dependency or config changes, and any UI change to layout, spacing, color, state, or an interactive element. A public API rename or an exported symbol rename is not a microedit.
- **Always still do:** run the fast formatter/linter, and re-read the final diff to confirm it's actually trivial.
- **Self-correct:** if a claimed microedit turns out to touch behavior, abandon the shortcut, run the appropriate loop, and tell the user why.
- **Scope:** one `/microedit` covers one edit. Don't carry the exemption forward to later changes.

## Environment & Tooling (VS Code)
- Use the **integrated terminal** for commands. Long-running processes (servers, watchers) go in the background; don't start a second instance if one is already running.
- Prefer cross-platform commands. Any absolute paths in this file (e.g. Puppeteer/Chrome cache below) are **machine-specific examples** — adjust them to the current environment.
- Respect the workspace: create files inside the project, follow its folder conventions, and don't touch files outside it unless asked.
- If the repo has a `.vscode/tasks.json`, `Makefile`, or `scripts` in the manifest, use those entry points instead of inventing commands.

## Universal Rules (any language)
- **Small, focused changes.** One concern per change. Don't refactor unrelated code while fixing a bug.
- **Handle errors explicitly.** No silent failures, no swallowed exceptions. Fail loudly with a useful message.
- **No secrets in code.** Read config from environment variables or a secrets store. Never hardcode keys, tokens, or passwords, and never log them.
- **Meaningful names**, no dead code, no commented-out blocks left behind.
- **Write tests** for non-trivial logic: happy path, error path, and edge cases (empty, null, invalid, boundary, unauthorized).
- Match the project's existing style for imports, module layout, and error types.

## Backend Rules
- **API design:** consistent resource naming, correct HTTP status codes (201 for create, 204 for empty success, 4xx for client errors, 5xx for server), and a consistent JSON error shape across all endpoints.
- **Validate every input** at the boundary. Reject malformed requests with a clear 4xx and a message naming the bad field — never trust the caller.
- **Errors are structured**, not raw stack traces leaked to the client. Log the detail server-side, return a safe message to the caller.
- **Idempotency & safety:** make retries safe where it matters; guard destructive operations.
- **Data layer:** use migrations for schema changes (never hand-edit prod schema), parameterized queries only (no string-built SQL), and transactions around multi-step writes.
- **Observability:** log meaningful events with context (request id, not secrets). Make failures diagnosable from the logs alone.
- **Config from env**, with sane local defaults documented.

### Backend Verification Loop (the analogue to the screenshot loop)
- **Run the service locally** in the background before testing. If it's already running, don't start a second instance.
- **Exercise the real code path with real input** — `curl`, an HTTP client, a REPL call, or an automated test. Don't reason about correctness; trigger it.
- **Capture the actual result:**
  - status code, response body, and relevant headers,
  - the server logs for that request,
  - and, for anything that writes, the **resulting state** (query the row/record after the write).
- **Compare against the expected contract, specifically:** "returns 200 but should be 201", "response is missing `createdAt`", "error body isn't valid JSON", "row wasn't persisted", "N+1 query on this endpoint".
- **Fix the mismatch, then run it again.** Minimum **2 rounds**. Stop when actual output matches the contract or the user says so.
- **Cover the unhappy paths in the same loop:** invalid input, missing auth, not-found, and duplicate/conflict. A backend endpoint isn't done until its error responses are verified too.
- Add or update a test that locks in the verified behavior so the loop is repeatable, not one-off.

## Frontend Rules (when building UI)

### Project Setup
- UI is a multi-file project. Scaffold a real structure (`components/`, `pages`/`routes/`, `hooks`/`lib/`, `data/` for fixtures, `types/`).
- Use the framework's dev server (`npm run dev`) during development, and install Tailwind/CSS tooling properly rather than via CDN for a real build.
- Put design tokens (colors, spacing, radii, shadows, fonts) in config and reference them everywhere — no magic values in markup.

### Architecture
- Component-driven: if markup repeats, extract a component. No copy-pasted blocks.
- Keep components small and single-purpose (a file over ~200 lines is a smell). Separate presentational from logic components where it clarifies things.
- Lift state only as high as needed. Prefer local state; use context/store only for genuinely shared state.

### Data & Application States
- Build against mock fixtures shaped exactly like the real API response first.
- Every data-driven view handles four states explicitly: **loading, empty, error, populated.** Never assume the happy path.
  - Loading: skeletons/spinners with reserved space — no layout jump on arrival.
  - Empty: a real empty state with guidance, not a blank void.
  - Error: a recoverable message with retry, not a silent failure or raw stack trace.
- Use optimistic updates where it improves feel, and roll back on failure.

### Forms & Input
- Validate on blur and submit. Show errors inline, tied with `aria-describedby`; never rely on color alone.
- Disable submit while submitting, show a loading state, prevent double-submits.
- Preserve user input on error. Every input has an associated `<label>` — placeholders are not labels.

### Interactivity & Accessibility (non-negotiable)
- Everything interactive works with the keyboard: logical Tab order, Enter/Space activate, Esc closes.
- Modals trap focus and restore it to the trigger on close. Menus/dropdowns support arrow keys and close on outside-click/Esc.
- Semantic HTML first; ARIA only when semantics fall short. Visible `focus-visible` on everything focusable — never remove a focus outline without replacing it.
- Contrast meets WCAG AA (4.5:1 text, 3:1 large text/UI). Respect `prefers-reduced-motion`.
- Give feedback for every action (toasts/inline). Destructive actions require confirmation.

### Routing
- Multi-view apps use a router; each view has its own URL. Reflect meaningful state (filters, tabs, selected item) in the URL. Show the active nav item and handle unknown routes with a real 404 view.

### Reference Images
- If a reference is provided: match layout, spacing, typography, and color exactly for the screens shown. Swap in placeholder content. Do not improve or add.
- References usually show only some screens — you still owe the loading/empty/error states, designed in the same visual language.
- If no reference: design from scratch with high craft (see guardrails below).

### Screenshot Loop
- **Always serve on localhost** — never screenshot a `file:///` URL. Start the dev server in the background first; don't start a second instance.
- Puppeteer example path: `C:/Users/Admin/AppData/Local/Temp/puppeteer-test/`; Chrome cache: `C:/Users/Admin/.cache/puppeteer/` (adjust per machine).
- Screenshot: `node screenshot.mjs http://localhost:<port> [label]` → saves to `./temporary screenshots/screenshot-N[-label].png` (auto-incremented, never overwritten). `screenshot.mjs` lives in the project root — use it as-is.
- After screenshotting, read the PNG with the Read tool and analyze it directly.
- **Screenshot every meaningful state, not just one screen:** each route; loading/empty/error/populated for data views; interactive states (modal open, menu open, form with errors); and mobile/tablet/desktop widths. Label each.
- Compare specifically: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px". Do at least **2 rounds per screen**. Stop when no visible differences remain or the user says so.
- Check: spacing/padding, font size/weight/line-height, exact hex colors, alignment, radius, shadows, image sizing — and that **every state renders correctly**.

### Anti-Generic Guardrails
- **Colors:** never the default Tailwind palette (indigo-500, blue-600). Pick a custom brand color and derive a scale from it.
- **Shadows:** never flat `shadow-md`; use layered, color-tinted shadows with low opacity.
- **Typography:** different fonts for headings and body; tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** layer multiple radial gradients; add grain/texture via SVG noise for depth.
- **Animations:** only animate `transform` and `opacity`, never `transition-all`; spring-style easing.
- **Interactive states:** every clickable element has hover, focus-visible, and active states.
- **Images:** gradient overlay + a `mix-blend-multiply` color-treatment layer.
- **Depth:** a layering system (base → elevated → floating), not everything on one z-plane.

## Brand Assets
- Always check the `brand_assets/` folder before designing. If logos, color guides, or images exist there, use them — do not use placeholders where real assets are available, and do not invent brand colors when a palette is defined.

## Product Invariants
Cross-cutting product rules that must survive across sessions - violating these is a regression even if the code "works."

- **Tax Understanding module: no tax numbers in code.** Every rate, threshold, exemption, cess percentage, holding-period cutoff, and transaction charge lives in `server/data/tax-rates/<effective-date>.json`. The engine selects a rate set from the transaction date. A rate change is a JSON edit, never a code edit.
- **Tax Understanding module: estimates, not advice.** Show what each option costs; never tell the user what to do. Every output is labelled an indicative estimate. The existing no-recommendations rule from `server/src/gemini.ts` applies to every generated explanation.
- **Tax Understanding module: never show tax in isolation.** Every tax figure is shown alongside transaction costs (brokerage/STT/exchange charges/etc.) in the same view.
- **Tax Understanding module: every number is explainable.** Each result carries a line-by-line breakdown and a plain-English explanation of which rule produced it.

### Placement & Case Studies
- **No API, ever, in the grading path.** All scoring (placement, case-study tiers, the existing-scenario factor cleanup) is deterministic, local, and instant, via the one shared grader in `server/src/grading/grader.ts`. Gemini is never called to place or grade a user — it may still power the separate jargon explainer elsewhere, never here.
- **Never grade on outcome.** A sound decision that lost money is still correct. Holds for every tier, including the risk read.
- **Grade judgment, not vocabulary.** Placement and tiers must never sort or score a user on whether they know a term's definition — that's the thing the product teaches. Sort on reasoning, via structured single-select/multi-select/band inputs, not free-text keyword-spotting.
- **Bias placement and re-leveling downward.** On a borderline score, choose the lower level. Under-placement self-corrects as the user clears easy material; over-placement makes people quit.
- **No hard content wall.** The scenario/case-study library is never fully locked behind the placement test. Guidance and a recommended path — never invisible, inaccessible content.
- **Identity stays masked until after grading.** Case studies built on real Nifty/Sensex-name episodes withhold the company name and real dates from every payload sent before the user answers — revealed only in the post-answer debrief, alongside what actually happened. Revealing them earlier turns a risk read into a memory test.

### Sandbox
- **No API, ever, in the trading, grading, or analysis path.** Fixtures (`server/data/sandbox/*.json`) and deterministic engine code only — no Gemini, no live market data feed, no runtime LLM call of any kind. Stock analysis and statistics are authored content, generated offline once and shipped as static fixtures, never regenerated live.
- **Stock analysis is descriptive, never advisory.** Strengths, weaknesses, and every statistic are presented so the user can form their own view — never a target price, a "should," or any framing that nudges toward a specific action. Same rule as Tax Understanding's "estimates, not advice."
- **Every statistic is shown, never cherry-picked.** A stock's fundamentals (P/E, P/B, ROE, debt/equity, dividend yield, market cap, beta, 52-week range) are always presented in full alongside the qualitative analysis — never a subset chosen to support a narrative.
- **The portfolio grader judges decisions, never outcomes — including good-looking ones.** A concentrated, oversized, or unhedged bet that happened to profit is not a better decision than an identical bet that didn't; both are the same decision and must grade identically. The grader never reads realized or unrealized P&L, and never reads any price after the day being evaluated. Make this explicit to the user in the product itself, not just in code comments — the temptation to equate "it worked" with "it was a good call" is exactly the mistake this mode exists to correct.

## Hard Rules
- **Verify by running, never by assuming** — no task is done until its output has been captured and compared to expected, at least 2 rounds. The only exception is a declared `/microedit`, and only if it stays genuinely zero-behavior.
- Do not leak secrets into code or logs; read config from env.
- Do not build string-concatenated SQL or skip input validation at the boundary.
- Do not ship a backend endpoint without verifying its error responses and persisted state.
- Do not ship a data view without its loading, empty, and error states.
- Do not build interactivity that only works with a mouse, or remove a focus outline without replacing it.
- Do not copy-paste markup or logic — extract a component/function.
- Do not use the Tailwind CDN for a real app build, default Tailwind blue/indigo as primary, or `transition-all`.
- Do not stop after one screenshot / one test pass.
- Do not add features, screens, endpoints, or content not requested — match the spec/reference.
