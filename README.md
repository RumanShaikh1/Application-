# MarketPane

A beginner trading-education platform for the Indian market, plus the Chrome/Edge extension it grew out of. The extension injects the "Jargon Buster" sidebar directly into pages you browse; **Decision Replay** (`web/`) puts you through anonymised historical market scenarios graded on the quality of your decision, never the outcome; **the Simulator** (`web/`, `/simulator`) is a virtual portfolio traded against real live market data, graded on process - position sizing, diversification, and your stated reasoning - never on profit or loss; **Tax Understanding** (`web/`, `/tax`, `/tax/fy-overview`) is a standalone, self-contained calculator showing what a trade actually costs after tax and transaction charges, with no market data feed, login, or portfolio state of its own. All are backed by one local server, which holds the Gemini API key and proxies market data so it never ships inside client code.

> **⚠️ Tax Understanding is not reviewed by a qualified CA.** Every rate, threshold, and charge in `server/data/tax-rates/*.json` is a best-effort figure assembled from public sources, not verified by a tax professional - **do not rely on it for real filing, and do not launch it publicly before a CA reviews the rate data.** It also does not yet handle bonus issues, stock splits, buybacks, or rights issues (cost-of-acquisition adjustments for all four are unmodelled), and does not model the income-tax surcharge (only cess). See "Tax Understanding" below for full scope.

```
server/     local Express app - Gemini + market data provider, scenario fixtures + rubric scoring, tax rate data + engine, holds GEMINI_API_KEY
extension/  Manifest V3 extension - content script (Jargon Buster sidebar UI), background worker
web/        standalone React app - Decision Replay (scenario list, player, results, progress)
mobile/     Expo/React Native app - Decision Replay, same core loop, native iOS/Android
shared/     TypeScript types used by all client workspaces
launcher/   standalone MarketPane.exe-style desktop app (WinForms/PowerShell) that links a browser and starts the server
            double-click launcher/MarketPane.bat to run it - see "Getting started (Windows)" below
            launcher/MarketPane.Desktop/ is a single-window alternative (build it yourself, see below) -
            no separate browser, but the Jargon Buster extension can't run inside it
            launcher/mac/ is the macOS equivalent (a MarketPane.app bundle) - see "Running on macOS" below
```

## Getting started (Windows)

**Install Node.js first** (one-time, unavoidable): https://nodejs.org, the LTS version. That's the only real prerequisite - everything else below is one double-click.

**Then just double-click `launcher\MarketPane.bat`.** No PowerShell command, no shortcut to set up first, no terminal - `.bat` files run directly on double-click in Windows, unlike `.ps1` files (which Windows opens in Notepad instead of running, for security reasons). `MarketPane.bat` is a two-line wrapper that finds its own folder automatically and hands off to `MarketPane.ps1` - it works from wherever you extracted the project, with nothing to configure first.

The first time you double-click it:
- **Windows may show a blue "Windows protected your PC" SmartScreen banner**, since the file isn't code-signed - click **"More info"** → **"Run anyway"**. This is a one-time click; Windows remembers your choice for this file afterward.
- It asks which browser to link (detected automatically - Chrome, Edge, Firefox, Brave, Opera, Vivaldi, or Arc, wherever they're installed).
- It **installs everything it needs automatically** - `server/`'s and `web/`'s dependencies, and builds the browser extension - showing a status message while that happens (can take a minute or two the first time, depending on your connection). No commands to type.
- It then opens `chrome://extensions` with a one-time reminder to click **"Load unpacked"** yourself - the one step that has to stay manual, since browsers deliberately require a real click there for security. Everything else is already installed and running by this point.

Every time after that, double-clicking `MarketPane.bat` just opens straight to the app - a few seconds, not a few minutes.

**Optional - a Desktop icon:** right-click `launcher\MarketPane.bat` in File Explorer → **Send to** → **Desktop (create shortcut)**. That's a normal Windows feature, not a project script - no terminal needed. (`launcher\create-shortcut.ps1` also still exists and makes a nicer-looking icon using the real app icon instead of the generic `.bat` icon, if you'd rather run that once from PowerShell - see "Manual run" below for how.)

**Prefer one single app window instead of a separate browser?** `launcher/MarketPane.Desktop/` is a compiled WinForms + WebView2 app that embeds the whole web app in one real window - no browser tab, no address bar, and genuinely one `.exe` (`dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true` from inside that folder produces a single ~150MB file that needs nothing but Node.js pre-installed - not even the .NET runtime). It has the same auto-install behavior as `MarketPane.bat` above. The trade-off: the Jargon Buster browser extension can't be loaded into an embedded WebView2 window the way it can into a real Chrome/Edge tab, so this option is Decision Replay/Simulator/Tax Understanding only, not the extension. Requires the .NET 8 SDK to build (`dotnet build -c Release`, or the publish command above for the single-file version) - it isn't pre-built and committed here, since a build depends on your exact machine/architecture and the self-contained version is ~150MB, over GitHub's 100MB push limit.

Add a real key to `server/.env` whenever you want the AI-powered explain/translate features - a placeholder ships by default so the rest of the app runs fine without one.

Both the API server and the `web/` dev server keep running in the background after you close the app/browser, so relaunching later is instant. To stop them, end the `node`/`tsx` (API) and `node`/`vite` (`web/`) processes in Task Manager.

## Manual run (skipping the launcher)

Skipping the launcher means skipping its auto-install too, so run `cd server && npm install` and `cd web && npm install` yourself first if you haven't already (Node.js is the only prerequisite - see "Getting started" above). Then `cd server && npm run dev` in one terminal (verify with `curl http://localhost:8787/health`), `cd web && npm run dev` in another, and open Chrome/Edge yourself.

This is also where `launcher\create-shortcut.ps1` lives, if you'd rather have a proper-looking icon (the real app icon, not the generic `.bat` one) instead of the "Send to > Desktop" shortcut mentioned above: open PowerShell in `launcher\` (Shift+right-click in that folder → "Open PowerShell window here") and run `.\create-shortcut.ps1` (or, from anywhere, `powershell -ExecutionPolicy Bypass -File launcher\create-shortcut.ps1`). Purely cosmetic - `MarketPane.bat` and the shortcut this produces do exactly the same thing.

To get the extension loaded manually (the launcher does this for you, but a manual run doesn't):

```
cd extension
npm install
npm run build
```

This produces `extension/dist/` (manifest, background.js, content.js, content.css, icons). Then, once per browser: go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode** (top right), click **Load unpacked**, and select `extension/dist`. It stays loaded across browser restarts as long as developer mode stays on - you only need to redo this after rebuilding the extension, and it works regardless of how the browser itself was opened.

**During development:** `npm run watch` inside `extension/` rebuilds on file changes - reload the extension at `chrome://extensions` (the circular arrow icon on the card) to pick up changes, then refresh the page you're testing on.

## Running on macOS

`server/`, `web/`, `mobile/`, and `extension/` are all plain Node/Vite/Expo workspaces with nothing Windows-specific in them - they run on macOS exactly as described above (`npm install`, `npm run dev`/`npm run build`, load the extension unpacked at `chrome://extensions`). `launcher/MarketPane.ps1` and `launcher/MarketPane.Desktop/` do not - both depend on Windows-only APIs (WinForms, the registry, WebView2).

`launcher/mac/MarketPane.app` is a from-scratch macOS port of `MarketPane.ps1`, function-for-function, including the Windows launcher's auto-install behavior: first run prompts you to link a browser (Chrome, Edge, Firefox, Brave, Opera, Vivaldi, or Arc - detected via Spotlight's `mdfind` rather than the Windows registry, so it finds a browser regardless of where it's installed), **installs `server/`'s and `web/`'s dependencies and builds the browser extension automatically** if they aren't already in place, and copies `server/.env.example` to `server/.env` if no `.env` exists yet. Every run after that starts `server/` and `web/` if they aren't already running and opens the linked browser to the Simulator in app mode (`--app=<url>` for Chromium browsers; a normal window for Firefox, which has no app-mode flag). The first time it finishes setting everything up, it opens `chrome://extensions` (or Firefox's `about:debugging`) in a normal window with a one-time dialog explaining the one step that has to stay manual - clicking **Load unpacked** yourself, since Chrome deliberately requires that gesture for security and no script can do it for you. Config lives in `~/Library/Application Support/MarketPane/`, and install/build/server/web logs land alongside whichever workspace produced them (`npm-install.log`, `npm-install.err.log`, etc. in `server/`, `web/`, or `extension/`; `server.log`/`web.log` in `~/Library/Application Support/MarketPane/logs/`).

> **⚠️ Built and syntax-checked (`bash -n`) on a non-Mac machine - not run end to end on real macOS.** The pure logic (health checks, config save/load, browser-list parsing, message formatting, `.env` creation, and `npm install`/build against a real trivial package - including the missing-npm and genuinely-failing-install error paths) was tested directly; the macOS-specific pieces (`mdfind`, `osascript` dialogs, `open`, `PlistBuddy`, LaunchServices actually double-clicking the `.app`) could not be. If something in `launcher/mac/MarketPane.app/Contents/MacOS/MarketPane` does not work as described, that is expected until someone runs it on a real Mac and reports back - the manual run path above always works as a fallback regardless.

**Prerequisite: Node.js.** Install it from https://nodejs.org (the LTS version) if it isn't already on this Mac - that's the one thing the launcher genuinely can't do for itself. If it's missing, the launcher tells you so directly (with that link) instead of failing silently.

**One-time setup:**

```
chmod +x launcher/mac/MarketPane.app/Contents/MacOS/MarketPane launcher/mac/create-shortcut.sh
launcher/mac/create-shortcut.sh
```

This symlinks `MarketPane.app` onto the Desktop (re-run only if you move the repo - editing the launcher script itself needs no re-run, since the symlink always points at the live file). From there, double-click the Desktop icon - see the Windows "Everyday use" section above for what happens on first launch (dependency install, extension build, and the one-time Load-unpacked prompt).

## Decision Replay (`web/`)

```
cd web
npm install
npm run dev
```

Opens on `http://localhost:5173` (the server must already be running - see above). Play a scenario end to end: read what's revealed at each stage, click **Reveal next** to progress, choose an action and explain your reasoning on the final stage, and submit to see your rubric-based score, feedback, and the anonymised outcome. Progress is tracked per-browser in `localStorage` (no accounts yet) - see the **Progress** tab.

`npm run build` produces a static `web/dist/` you can serve from anywhere; `npm run typecheck` runs `tsc --noEmit`.

**Scoring calls no LLM at all - zero Gemini cost per answer.** The score is 70% which action you picked (`soundChoiceIds`/`acceptableChoiceIds` - always deterministic) and 30% whether your typed rationale matches the scenario's rubric criteria, graded locally by `server/src/scenarios/matchRationale.ts` against hand-authored `matchConcepts` on each criterion (see the `*.json` files in `server/data/scenarios/`) - clusters of alternative words/phrases (including partial word stems, so "concentrat" catches concentration/concentrated/concentrating for free) that all point at the same underlying idea. A criterion matches once enough of its clusters show up in what you wrote. This is deliberately more literal than an LLM judge - it can reward an anticipated phrasing and miss a genuinely novel one nobody wrote a cluster for - traded off against being instant and free to run as many times as you like. `matchRationale.test.ts` runs the matcher against a realistic well-reasoned rationale and a shallow one for every shipped scenario, asserting the former matches everything and the latter matches nothing.

Scenario content lives in `server/data/scenarios/*.json`, one file per scenario, validated against the `Scenario` type in `shared/types.ts` at server startup. Add a new scenario by dropping in another fixture file with a unique `id` - no code changes needed.

## Simulator (`web/`, `/simulator`)

A virtual portfolio (₹1,00,000 starting cash, clearly labelled as virtual - no real money, no order routing, no broker API anywhere) traded against the same live `MarketDataProvider` the extension's stock stats use. Look up any real NSE/BSE symbol, buy or sell, write a short rationale, and submit - the response is a **process score**, not a profit/loss score:

- **Position sizing** and **diversification** are checked deterministically from the resulting portfolio (25% single-position / 40% single-sector guidelines) - never sent to Gemini, and never blocking the trade itself. The simulator is honest about consequences, not a risk-control system.
- **Rationale quality** (is it grounded in something checkable, does it show cost awareness) is the only part Gemini classifies, via the same constrained-JSON-schema pattern Decision Replay uses - the score itself always comes from deterministic code.
- Every trade shows its real brokerage/STT/exchange-fee/slippage breakdown (`calculateTradeCost` in `server/src/scenarios/costModel.ts`, sharing its rate constants with Decision Replay's round-trip cost model).
- Portfolio and trade history persist in `localStorage` (`web/src/lib/portfolioStore.ts`), same no-accounts-yet pattern as Decision Replay's progress tracking - the portfolio itself travels to the server and back on every trade request rather than living server-side.

No separate setup - it's part of the same `web/` app (`npm run dev`, see above). `web/scripts/interact-simulator.mjs` drives the full loop (fresh portfolio, quote lookup, buy, sell, full position close, insufficient-cash error, mobile width) for screenshot verification.

## Tax Understanding (`web/`, `/tax`, `/tax/fy-overview`)

> **⚠️ Not reviewed by a qualified CA - see the warning at the top of this file before relying on any figure it produces, and before any public launch.**

Answers "what does this trade actually cost you?", not just "what's the tax rate?" - brokerage, STT, exchange charges, and the difference between capital gains and business income are shown alongside every tax figure, never in isolation, because for short holding periods those charges routinely exceed the tax difference.

- **`/tax`** - enter a trade (buy/sell price, quantity, dates, trade type) and get a full itemised breakdown: gross gain, exemption consumed, tax, cess, every transaction charge, and net proceeds, each with a plain-English explanation of the rule that produced it. Intraday and F&O trades are detected from the trade type and correctly classified as business income (Schedule BP, taxed at your income slab rate) rather than presented as STCG/LTCG - a day trader at a 30% slab pays worse than the 20% STCG rate they may assume applies.
- **The days-to-long-term counter** - for a still-short-term equity delivery position, shows days remaining until the 12-month cutoff and the rupee difference between selling today and waiting. It never ships without **the counterweight**: the adverse price move that would erase the entire tax saving from waiting, computed by `server/src/tax/breakeven.ts` via bisection against the deterministic engine (not a separate formula, so it can never drift from the numbers it's comparing against).
- **`/tax/fy-overview`** - manual entry of gains already realised this financial year shows remaining ₹1.25L LTCG exemption headroom; adding open positions sitting on an unrealised loss shows which losses the set-off rules would let you book against which gains before 31 March, respecting the asymmetric rules (short-term losses can offset both short- and long-term gains; long-term losses only offset long-term gains) and warning loudly that carry-forward of unabsorbed losses requires filing by the due date. Presented as "here is what the rules permit," never as an instruction to sell. Nothing is sent anywhere until you use the checker - state lives in this browser's `localStorage` only (`web/src/lib/taxStore.ts`), same no-accounts pattern as Decision Replay/Simulator.
- **Explain in plain English** (on request, per result) calls Gemini through `server/src/tax/explainTaxResult.ts` to narrate an *already-computed* result - the model is explicitly forbidden from computing, estimating, or asserting any figure, or from introducing any rule/section not present in the data it's handed (a real gap caught during verification: an early prompt let the model assert an unrelated Section 87A claim on an intraday result where no such warning existed - the prompt now explicitly forbids introducing anything not in the given breakdown/warnings).

No tax rate, threshold, exemption, cess percentage, holding-period cutoff, or transaction charge is hardcoded in application code - all of it lives in `server/data/tax-rates/<effective-date>.json`, one file per date a rule set took effect (not one per financial year - the July 2024 Budget changed rates *inside* FY2024-25, which a one-file-per-FY scheme can't represent). The engine (`server/src/tax/`) picks the correct file from the transaction date and is otherwise pure and dependency-free - `cd server && npm test` covers golden worked examples (including a grandfathered pre-2018 holding, the Section 87A-does-not-apply case, a loss set-off case, and selling one day before vs. after the 12-month cutoff), a property test that net proceeds always reconciles exactly to gross proceeds minus every itemised line, a test that a rate-set JSON edit alone changes output with zero code changes, and a test that intraday/F&O input can never yield an STCG/LTCG classification. `web/scripts/interact-tax.mjs` drives both routes end to end for screenshot verification (the centrepiece counter+counterweight, validation errors, the expandable breakdown, the live Gemini explanation, and the FY overview's headroom/loss-harvesting flow, each at desktop and mobile width).

**Out of scope for v1:** broker statement import, live prices, user accounts, ITR generation/filing, and any non-equity asset class (property, gold, debt funds, NRI cases). See the CA-review warning above for the two known gaps in the equity math itself.

## Decision Replay Mobile (`mobile/`)

A native port of the same Decision Replay loop (Expo + React Native + NativeWind + React Navigation), for a phone instead of a browser tab. Same server, same API, same rubric scoring, same non-negotiable framing - a different client, not a different product.

```
cd mobile
npm install
```

Then, when you're ready to actually run it:

- **Android emulator:** set `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8787` (the emulator's alias for the host machine's `localhost` - plain `localhost` from inside the emulator means the emulator itself, not your PC) before `npm run android`.
- **iOS simulator:** `localhost` works as-is (the simulator shares the host's network stack) - no env var needed.
- **A physical phone:** set `EXPO_PUBLIC_API_BASE_URL` to your dev machine's LAN IP (e.g. `http://192.168.1.42:8787`) and make sure the phone is on the same network - a real device can't reach `localhost` on your PC.

`npm run typecheck` runs `tsc --noEmit`. `shared/types.ts` is imported directly via relative paths (not the `@shared/*` alias `web/`/`extension/` use) since aliasing it through Metro needs an extra Babel plugin that couldn't be verified without actually running the bundler - see `mobile/metro.config.js`'s comment for the (separate, required either way) `watchFolders` fix that lets Metro see outside its project root at all.

## Verifying changes

**Extension:** `extension/scripts/verify-extension.mjs <label> [url]` launches a real Chrome with the built extension loaded, navigates to a page, and screenshots it to `temporary screenshots/`. `extension/scripts/interact.mjs <label> <open|highlight|stock-detail> [url]` drives the same flows a user would (opening the sidebar, highlighting real page text, clicking a stock). The server must be running for `highlight`/`stock-detail` to return real data.

**Decision Replay:** `web/scripts/screenshot.mjs <label> [path] [width] [height]` screenshots a single route (both the web and API servers must already be running). `web/scripts/interact.mjs` drives the full loop - list, staged reveal, keyboard-only choice selection and submission, results, progress, and the 404/error states - screenshotting each one.

**Simulator:** `web/scripts/interact-simulator.mjs` drives a fresh portfolio through a quote lookup, a buy (including a validation-error and an insufficient-cash pass), and the resulting score screen, then checks the dashboard at mobile width.

**Tax Understanding:** `web/scripts/interact-tax.mjs` drives the comparator (short-term counter + counterweight, validation errors, intraday breakdown, live Gemini explanation) and the FY overview (headroom tracker, loss-harvesting checker) at desktop and mobile width. Server-side, `cd server && npm test` covers the engine (see "Tax Understanding" above).

**Server logic:** `cd server && npm test` runs the Vitest unit suite (`src/**/*.test.ts`) covering the TTL cache, stage-gating (asserts a stage response can never leak a later stage or the rubric/outcome), rubric scoring, the local rationale matcher (`matchRationale.test.ts` - a realistic well-reasoned rationale matches every criterion and a shallow one matches none, for every shipped scenario), the cost model (both Decision Replay's round-trip version and the simulator's single-leg version - and that composing two single legs reproduces the round-trip figures exactly), the simulator's portfolio engine (buy/sell math, average-cost recomputation, position-size and diversification thresholds), and the Tax Understanding engine (golden worked examples, reconciliation, rate-set-swap, and classification-safety properties - see "Tax Understanding" above).

**Mobile:** `cd mobile && npm run typecheck` (no simulator/emulator run yet in this environment - `mobile/` has been built and typechecked, not launched).

## Notes

- The server binds to `localhost:8787` only (`PORT` in `server/.env` to change it) - it's not reachable from outside your machine. CORS allows only `chrome-extension://` origins and the web app's dev origin (`WEB_ORIGIN` in `server/.env`, defaults to `http://localhost:5173`) - not arbitrary websites. CORS doesn't need to (and doesn't) cover `mobile/`: it's a browser-enforced mechanism, and React Native's networking stack isn't a browser.
- `mobile/package.json` pins `react` and `react-native` via an `"overrides"` field. Without it, `nativewind`'s own (non-peer) dependency on a newer `react-native` gets nested privately by npm, which silently breaks TypeScript's `className` prop augmentation (it lands on the wrong, nested copy) - and would be a real runtime hazard regardless of TypeScript, since React and React Native both require being a true singleton in one app.
- Decision Replay never grades on outcome, always anonymises scenarios (no real tickers/company names/dates - the x-axis is "Day 0, Day 1, ..."), never gives investment advice, and never shows a frictionless return figure (see `server/src/scenarios/costModel.ts`). Rationale grading is entirely local (`server/src/scenarios/matchRationale.ts`, see "Decision Replay" above) - no Gemini call, no per-answer API cost.
- The Simulator trades real, current symbols by design (unlike Decision Replay, anonymisation doesn't apply - this is forward-looking practice, not a historical lesson to avoid answering from memory). It still never gives investment advice (the Gemini prompt in `server/src/simulator/evaluateTradeRationale.ts` is explicit that it grades reasoning quality, never the security itself), never grades on price movement, and never presents anything but virtual currency. `server/src/scoring.ts`'s `weightedCriteriaScore` is the one shared scoring primitive both Decision Replay and the Simulator build their (different) score formulas on top of.
- Tax Understanding's cross-cutting rules (no hardcoded tax numbers, estimates never advice, tax never shown without transaction charges, every number explainable) are written down as `## Product Invariants` in `CLAUDE.md` specifically so they survive future sessions - violating one is a regression even if the code still runs and the tests still pass.
- `extension/scripts/generate-icons.mjs` regenerates the toolbar icons if you ever want to tweak the mark; `launcher/assets/build-icon.mjs` rebuilds the desktop app's `.ico` from those same PNGs (run `create-shortcut.ps1` again afterward).
- Nothing here is published to the Chrome Web Store - it's loaded unpacked, same as any local dev extension.
- The desktop app doesn't shut the server down when you close it - it's designed to just sit running in the background like any other local dev server. Kill it via Task Manager (`node.exe`) if you want it fully stopped.
- `launcher/scripts/capture-window.ps1`, `click-button.ps1`, and `capture-desktop.ps1` are dev tools for testing the WinForms app headlessly (screenshot a window by title, synthetically click a button by name) - the native-app equivalent of the extension's Puppeteer scripts. Both filter by owning process name (default `powershell`), not just window title - a Windows Terminal tab or other app can coincidentally share this app's exact window title.
- `MarketPane.ps1` explicitly opts into per-monitor DPI awareness (`SetProcessDpiAwarenessContext`) since plain `powershell.exe` declares none - without it, Windows silently renders the whole window at 96dpi and stretches the bitmap to fit a scaled display, which looks blurry. All control positions cascade from the actual measured bottom of the control above them (`$label.Bottom + gap`) rather than hardcoded pixel offsets - a fixed offset that looks fine at 100% scaling can genuinely overlap at 150%+ once a bold/larger font renders taller than expected.
- **`launcher/MarketPane.Desktop/`'s Smart App Control finding turned out to be machine/time-specific, not a permanent blocker.** An earlier version of this note said Windows 11's Smart App Control blocked any freshly-compiled, unsigned `.exe` from running at all on the machine this was built on, confirmed via Code Integrity event logs at the time. Rebuilding and actually launching it again later (same machine, Smart App Control still enforced per `HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy`'s `VerifiedAndReputablePolicyState`) produced a real, working, screenshotted window instead - whatever changed, the blanket claim didn't hold up under a fresh test. See "Getting started (Windows)" above for how to build and run it; if Smart App Control (or SmartScreen) does block it on a given machine, code-signing the executable or evaluating the specific Code Integrity event at that point is the way through - not disabling Smart App Control, which is a one-way door on Windows 11 (only reversible via a full OS reset).
