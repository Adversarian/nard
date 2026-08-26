# ADR 0003 — Tauri v2 shell, web app underneath

**Status:** accepted · 2026-08-26

## Context

The deliverable is a desktop app. But agents need to *see* the game to iterate
on it, and driving a packaged desktop binary for screenshots is slow and awkward.

## Decision

Build the UI as an ordinary Vite web app. Tauri v2 wraps it for shipping.
Nothing in `apps/ui` may depend on Tauri APIs directly; platform capabilities
(file dialogs, app data directory, spawning the gnubg sidecar) go behind a
`platform` module with a browser implementation and a Tauri implementation.

## Why

- **Iteration.** `pnpm dev` + Playwright screenshots means every visual change
  gets looked at. That loop is the reason the game will look good.
- Tauri v2 over Electron: ~3–10 MB vs ~120–200 MB bundles, ~5× less RAM, faster
  cold start, and first-class sidecar support for shipping the gnubg binary.
- The `platform` seam also gives us the browser fallback for free, which is what
  makes asynchronous play with his son (M6) cheap later.

## Target platform

**Windows.** That is the machine the game has to run on, so it is the platform
the Tauri build, the gnubg sidecar and the WebView testing are aimed at.
WebView2 rather than WebKitGTK is therefore the renderer that matters; development
happens on Linux, so anything that renders differently between the two has to be
checked on Windows before release rather than assumed.

## Consequences

- Native WebView differences (WebKitGTK vs WebView2) must be checked before
  release. Mitigated by keeping the visual language CSS-first and avoiding
  bleeding-edge features.
- Packaging the gnubg sidecar is per-platform work, scheduled at M4.
