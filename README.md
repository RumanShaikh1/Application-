# MarketPane

A Chrome/Edge extension + local server, replacing the old Electron app. The extension injects the "Jargon Buster" sidebar directly into pages you browse in your real browser; the local server holds the Gemini API key and proxies Yahoo Finance so neither ever ships inside extension code.

```
server/     local Express app - Gemini + Yahoo Finance, holds GEMINI_API_KEY
extension/  Manifest V3 extension - content script (sidebar UI), background worker
shared/     TypeScript types used by both
launcher/   standalone MarketPane.exe-style desktop app (WinForms) that links a browser and starts the server
```

## Everyday use (after one-time setup below)

Double-click the **MarketPane** icon on the Desktop. It's a real app window (not a background script) - the icon is the actual brand spark mark.

- **First run:** prompts you to link a browser (auto-detects Chrome/Edge/Firefox/Brave, or browse for another). This is saved in `%APPDATA%\MarketPane\config.json`.
- **Every run:** starts the local server if it isn't already running, shows status ("Server: running on localhost:8787"), and opens your linked browser. The window stays open with an **Open in Browser** button (to reopen without relaunching the app) and **Change Linked Browser...**.
- Any failure (missing dependencies, server not responding, browser not found) shows a real error dialog - nothing fails silently.

The server keeps running in the background after you close the app/browser, so relaunching later is instant. To stop it, end the `node`/`tsx` process in Task Manager.

## One-time setup

**1. Install server dependencies:**

```
cd server
npm install
```

Add your Gemini key to `server/.env` (copy `server/.env.example` first) if it isn't already there.

**2. Build the extension:**

```
cd extension
npm install
npm run build
```

This produces `extension/dist/` (manifest, background.js, content.js, content.css, icons).

**3. Load it in Chrome/Edge, once:**

- Go to `chrome://extensions` (or `edge://extensions`)
- Enable **Developer mode** (top right)
- Click **Load unpacked** → select `extension/dist`

This stays loaded across browser restarts as long as developer mode stays on - you don't need to redo this each time, only after rebuilding the extension.

**4. Create the desktop shortcut:**

```
powershell -ExecutionPolicy Bypass -File launcher\create-shortcut.ps1
```

This is already done on this machine - a `MarketPane` icon should be on your Desktop. **Re-run this any time you edit `launcher/MarketPane.ps1`, move the project folder, or regenerate the icon** - the shortcut bakes in absolute paths at creation time and won't pick up changes on its own.

From here on, just double-click the Desktop icon (see "Everyday use" above).

## Manual run (skipping the shortcut)

`cd server && npm run dev` in one terminal (verify with `curl http://localhost:8787/health`), then open Chrome/Edge yourself - the extension loaded in step 3 above works regardless of how the browser was opened.

**During development:** `npm run watch` inside `extension/` rebuilds on file changes - reload the extension at `chrome://extensions` (the circular arrow icon on the card) to pick up changes, then refresh the page you're testing on.

## Verifying changes

`extension/scripts/verify-extension.mjs <label> [url]` launches a real Chrome with the built extension loaded, navigates to a page, and screenshots it to `temporary screenshots/`. `extension/scripts/interact.mjs <label> <open|highlight|stock-detail> [url]` drives the same flows a user would (opening the sidebar, highlighting real page text, clicking a stock). The server must be running for `highlight`/`stock-detail` to return real data.

## Notes

- The server binds to `localhost:8787` only (`PORT` in `server/.env` to change it) - it's not reachable from outside your machine.
- `extension/scripts/generate-icons.mjs` regenerates the toolbar icons if you ever want to tweak the mark; `launcher/assets/build-icon.mjs` rebuilds the desktop app's `.ico` from those same PNGs (run `create-shortcut.ps1` again afterward).
- Nothing here is published to the Chrome Web Store - it's loaded unpacked, same as any local dev extension.
- The desktop app doesn't shut the server down when you close it - it's designed to just sit running in the background like any other local dev server. Kill it via Task Manager (`node.exe`) if you want it fully stopped.
- `launcher/scripts/capture-window.ps1`, `click-button.ps1`, and `capture-desktop.ps1` are dev tools for testing the WinForms app headlessly (screenshot a window by title, synthetically click a button by name) - the native-app equivalent of the extension's Puppeteer scripts. Both filter by owning process name (default `powershell`), not just window title - a Windows Terminal tab or other app can coincidentally share this app's exact window title.
- `MarketPane.ps1` explicitly opts into per-monitor DPI awareness (`SetProcessDpiAwarenessContext`) since plain `powershell.exe` declares none - without it, Windows silently renders the whole window at 96dpi and stretches the bitmap to fit a scaled display, which looks blurry. All control positions cascade from the actual measured bottom of the control above them (`$label.Bottom + gap`) rather than hardcoded pixel offsets - a fixed offset that looks fine at 100% scaling can genuinely overlap at 150%+ once a bold/larger font renders taller than expected.
