# Mirror PWA — project rules

## What this is

A front-camera **lighted mirror** that runs in the browser and installs as a PWA. It shows the camera live and mirrored, lets the user zoom and drag to position the picture, keeps the screen awake, and turns the edge of the screen into a white light frame (the "halo"). That is the whole product.

It runs on phones, tablets, laptops and any computer with a webcam. Every action has a touch, a pointer and a keyboard route; never gate behaviour on the device type.

Working title: **Mirror**. The name, branding and final copy are not decided.

## Hard rules

These exist because the regulatory route for this app is still open, and breaking any of them can decide that route by accident. If a task seems to require breaking one, stop and ask.

1. **No capture.** No shutter, photo, video recording, screenshot, export, share or download feature of any kind. Never use `MediaRecorder`, `ImageCapture` (`takePhoto`, `grabFrame`), `canvas.toBlob`, `canvas.toDataURL`, or `<a download>`.
2. **No persistence.** No `localStorage`, `sessionStorage`, IndexedDB or cookies. The service worker caches the app's own build files and nothing else.
3. **No outbound network.** Only the app's own static files. No analytics, telemetry, error reporting, CDNs, remote fonts or third-party scripts. The CSP (`connect-src 'self'`) enforces this; never loosen it.
4. **No interpretation.** Never add anything that detects or recognises body parts, suggests where to place anything, measures, scores, or tells the user what to do while the mirror is running. Zoom, pan and stabilisation anchors are always chosen by the user's own gesture.
5. **Neutral copy.** No product or company names (UroDapter, UroStill, UroSystem), no medical or treatment claims, no clinical vocabulary. The app is a general-purpose lighted mirror. UI copy is British English and Hungarian.
6. **Not public.** Keep the `noindex` meta tag and the `X-Robots-Tag` header. Never publish to app stores or add store metadata.

**One scoped exception (post-MVP stabilisation only):** code under `src/lib/motion/` may read downscaled greyscale pixels (at most 200×150) from the live video to estimate camera motion. These buffers live in memory, are overwritten every frame, and are never persisted or transmitted. Nothing outside `src/lib/motion/` may read pixels.

`npm run check:privacy` enforces rules 1–3 by scanning `src/`. It must pass before every commit.

## Stack

- SvelteKit + Svelte 5, **runes only** (`$state`, `$derived`, `$effect`, `$props`). No legacy stores, no `export let`, no `$:`.
- TypeScript, strict mode.
- Tailwind CSS v4 (`@tailwindcss/vite`) + daisyUI 5.
- `@sveltejs/adapter-static`, deployed to Netlify.
- Vitest for unit tests, Playwright (Chromium with a fake camera) for smoke tests.
- No other runtime dependencies without asking. In particular: no OpenCV.js, no gesture libraries, no icon fonts.

## Conventions

- Client-only app: `export const ssr = false; export const prerender = true;` in `src/routes/+layout.ts`.
- Reactive state lives in `*.svelte.ts` modules under `src/lib/`.
- Geometry and motion maths are plain `.ts` with no DOM access, and every exported function has unit tests.
- Pointer input is Pointer Events only — never touch or mouse events. Zoom also comes from `wheel` (mouse and trackpad), and every action has a keyboard route. The mirror stage has `touch-action: none` and is focusable.
- Every user-facing string lives in `src/lib/i18n.ts` (keys `en`, `hu`). Hungarian uses the formal address (magázás).
- Every tunable (zoom limits, halo widths, timeouts, thresholds) lives in `src/lib/config.ts`.
- Icons are small inline SVG components in `src/lib/icons/`.
- If the Svelte MCP server is available, run `svelte-autofixer` on every component you create or change, and use its documentation tool rather than guessing Svelte 5 APIs.

## Commands

| Command                             | Purpose                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                       | Local dev on localhost (the camera works on localhost without HTTPS)    |
| `npm run dev:https`                 | Dev over the LAN with a self-signed certificate, for quick phone checks |
| `npm run build` / `npm run preview` | Production build and local preview                                      |
| `npm run check`                     | svelte-check + TypeScript + `check:privacy`                             |
| `npm run test`                      | Vitest                                                                  |
| `npm run test:e2e`                  | Playwright smoke tests                                                  |
| `npm run check:privacy`             | Scans `src/` for forbidden APIs                                         |

## Working style

- Work through `PLAN.md` one phase at a time. At the end of each phase, stop, summarise what changed, and wait for review.
- Tick the checkboxes in `PLAN.md` as items are completed.
- Camera, wake lock, touch gestures and performance can only be verified on real devices. A desktop run proves the desktop path only — list exactly what needs checking on a phone and what to look for.
- Prefer the simplest thing that meets the acceptance criteria. This app should stay small.
