# MarketPane (Android)

A single `react-native-webview` loads the exact same `web/` build used on desktop and macOS - Decision Replay, the Simulator, Tax Understanding, the Sandbox, and Learn, full feature parity, not a subset. There is no embedded Node.js runtime on Android (unlike the Windows/Mac desktop builds) - see "Why not nodejs-mobile-react-native" below for why, and "Architecture" for what replaces it.

The Jargon Buster browser extension is not part of this app - it remains a separate, Node.js-requiring path (see the repo root README's "Manual run" section).

## Architecture

```
WebView (loads http://localhost:8787/, the same web/dist build as desktop)
   |
MarketPaneHttpServer.kt (NanoHTTPD, a small pure-Java HTTP server)
   |-- static files (web-dist/**, bundled as Android assets) -> served directly
   `-- /api/* and /health                                     -> forwarded to JS
                                                                     |
                                                    dispatchBridge.ts (React Native)
                                                                     |
                                                    server/src/mobileDispatch.ts
                                                          (the exact same TS
                                                     functions Express calls
                                                     on desktop - scoreDecision,
                                                     computeTax, gradePortfolio,
                                                     etc. - reused unchanged)
```

`web/src/lib/api.ts` always does `fetch('http://localhost:8787/api/...')` - it has no idea it's talking to a native HTTP server backed by JS instead of a real Express process. Nothing in `web/` changes for Android.

The native<->JS round trip in `MarketPaneHttpServer.kt` blocks the (background, never the UI) NanoHTTPD request thread on a `CountDownLatch` while emitting a `MarketPaneApiRequest` event; `dispatchBridge.ts` calls `dispatch()` and then `MarketPaneBridge.respond(requestId, status, body)`, which releases the latch. Standard pattern for a synchronous-feeling native<->JS call in the classic (non-Fabric) RN bridge - see `newArchEnabled=false` in `android/gradle.properties`.

### Data fixtures

The sandbox/scenarios/tax-rates/placement/case-studies loaders in `server/src/` read JSON via `server/src/dataFs.ts`'s `DataFileSystem` abstraction, not directly via `node:fs` - Metro (this app's bundler) cannot resolve `node:fs` at all, and would fail the whole build if any file reachable from `mobileDispatch.ts` imported it. Desktop/Mac install the real `node:fs`-backed adapter (`server/src/nodeDataFs.ts`, imported first thing in `server/src/index.ts`); Android installs `src/bridge/androidDataFs.ts`, which reads from `src/bridge/generatedDataManifest.ts` - a **generated file**, produced by `server/scripts/generate-mobile-data-manifest.mjs` from every `server/data/**/*.json` fixture.

**Re-run that script whenever a data fixture is added, removed, or renamed:**
```
cd server && node scripts/generate-mobile-data-manifest.mjs
```
then commit the regenerated `mobile/src/bridge/generatedDataManifest.ts`.

### Why not nodejs-mobile-react-native

The obvious way to run a real embedded Node.js server on a phone (as the Windows/Mac builds do) is `nodejs-mobile-react-native`. It turned out to be unmaintained - last release years ago, no confidence it works with this project's React Native/Expo SDK version - and would have meant NDK-level native module compilation with no active maintainer to fall back on if something broke. The NanoHTTPD + JS-bridge approach above needs more of its own glue code, but every piece involved (NanoHTTPD, React Native's classic bridge, Metro's JSON-import support) is mature and actively maintained.

## Building

**One-time setup, every time after a fresh checkout:**
```
cd mobile && npm install
cd ../web && npm run build          # produces web/dist, copied into Android assets at build time
```

**Debug build + install on a connected device (USB debugging enabled):**
```
cd mobile/android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Requires the Android SDK (`ANDROID_HOME`) and a JDK (17) - no Android Studio GUI needed, no emulator needed if you have a physical device.

## Hand-maintained native project (important)

`expo prebuild` generated `android/` initially, but it now has hand-written native code (`MarketPaneHttpServer.kt`, `MarketPaneBridgeModule.kt`, `MarketPaneReactPackage.kt`) that no Expo config plugin exists for yet. **If `expo prebuild --clean` is ever run again, these need to be manually re-added:**

1. `android/app/build.gradle`: the `org.nanohttpd:nanohttpd:2.3.1` dependency, and the `copyWebDist` Gradle task (both marked with comments in that file).
2. `MainApplication.kt`: `packages.add(MarketPaneReactPackage())` inside `getPackages()`.

Otherwise, treat `android/` as a normal, permanently-maintained native project from here on - not something to regenerate casually.

## Verification status

Built and typechecked on the same Windows machine as the rest of this repo's launchers. `server/src/mobileDispatch.ts` was smoke-tested directly under Node (not React Native) before wiring it into the native bridge, confirming the shared business-logic reuse works correctly against the real grading/tax/sandbox engines. See this repo's commit history around this file's introduction for whether the native NanoHTTPD<->JS round trip and the WebView have since been confirmed end-to-end on a real physical device - if that verification hasn't landed yet, treat this app as built-and-typechecked but not yet run.
