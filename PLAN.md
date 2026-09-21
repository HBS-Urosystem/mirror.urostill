# Mirror PWA — implementation plan

Read `CLAUDE.md` first. Its hard rules override anything in this plan.

## Goal

A lighted mirror on the user's own phone: front camera, mirrored, pinch to zoom, drag to position, screen kept awake, and a white frame around the picture that works as a light source. No capture, no storage, no network.

- **MVP:** phases 0–5.
- **Post-MVP:** phase 6 (anchor lock) and phase 7 (stabilisation). When the user positions the picture with one finger, that centre locks and stays centred while zooming (phase 6) and when the phone or the scene moves (phase 7).

---

## 1. Design direction

### Brief

- **Subject:** a lighted mirror for seeing parts of the body you can't see directly.
- **Audience:** adults, many of them older, some with reduced dexterity or eyesight. They use it at home, usually in a bathroom, alone, in a private moment, and once it is running both hands are often busy.
- **Primary job:** a clear, bright, magnified picture that stays put. Everything else is secondary.
- **Style:** glass, as briefed.

### Tokens

| Name      | Value                  | Role                                                              |
| --------- | ---------------------- | ----------------------------------------------------------------- |
| Halo      | `#FFFFFF`              | The light frame. Always pure white; never tinted, never drawn on. |
| Porcelain | `#EEF2F4`              | Intro and error screen background.                                |
| Ink       | `#1E2B36`              | Text on Porcelain (≈12.8:1).                                      |
| Smoke     | `rgb(22 33 43 / 0.66)` | Glass tint over live video. Text on Smoke is white.               |
| Lagoon    | `#1F6F6B`              | Primary button (white text ≈5.9:1), focus ring on light surfaces. |
| Alert     | `#B42318`              | Error icon only.                                                  |

**Why Smoke is that dark:** the worst case is the control pill floating over a pure-white patch of video. At 0.66 alpha the composite is about `#656C73`, which gives white text ≈5.7:1. At 0.62 it drops to ≈4.6:1. Don't go below 0.62 without re-measuring.

Define these as a daisyUI 5 theme (`@plugin "daisyui/theme" { name: "halo"; default: true; … }`) so `btn` and focus styles pick them up.

### Type

**Atkinson Hyperlegible Next**, designed by the Braille Institute for readers with low vision — chosen because this app exists to help people see. Self-host it (SIL OFL): use the Fontsource package if one exists for "Next", otherwise put the woff2 files in `static/fonts/`. If "Next" isn't obtainable, use the original Atkinson Hyperlegible (`@fontsource/atkinson-hyperlegible`). Never load fonts from a CDN. Fallback stack: `system-ui, sans-serif`.

| Use               | Size / line height  | Weight |
| ----------------- | ------------------- | ------ |
| Title             | 32 / 36             | 700    |
| Steps, error text | 19 / 28             | 400    |
| Primary button    | 19                  | 600    |
| Privacy line      | 16 / 24             | 400    |
| Zoom readout      | 18, tabular figures | 600    |
| Chips             | 16                  | 500    |

Sentence case everywhere. No all-caps, no eyebrow labels above headings, no arrows appended to buttons. Text column on the intro: max 34ch, left-aligned.

### Layout

Intro (portrait):

```
┌──────────────────────────┐
│                          │
│  Mirror                  │  title, left-aligned
│                          │
│  1  Turn your screen     │  a real sequence,
│     brightness all the   │  so it is numbered
│     way up.              │
│  2  Stand the phone      │
│     30–40 cm away,       │
│     screen facing you.   │
│  3  Tap Start mirror.    │
│     Pinch to zoom, drag  │
│     to move the picture. │
│                          │
│  The picture stays on    │  privacy line
│  this screen. Nothing is │
│  recorded, saved or sent.│
│                          │
│ ┌──────────────────────┐ │
│ │     Start mirror     │ │  full width, in the thumb zone
│ └──────────────────────┘ │
└──────────────────────────┘
```

Mirror:

```
┌──────────────────────────┐
│██████████ halo ██████████│  pure white; width = light level
│███┌──────────────────┐███│
│███│                  │███│
│███│   live mirror    │███│
│███│                  │███│
│███│        ⊕         │███│  anchor reticle (phase 6)
│███│                  │███│
│███│  ╭────────────╮  │███│
│███│  │ ☀  2.5×  ✕ │  │███│  smoked-glass pill, auto-hides
│███│  ╰────────────╯  │███│
│███└──────────────────┘███│
│██████████████████████████│
└──────────────────────────┘
```

Landscape uses the same structure; the pill stays bottom-centre of the stage.

### Principles

1. **The light is the design.** The halo is both the signature element and the light source. It is plain white and exactly as wide as the chosen level. Nothing is placed on it.
2. **Glass only floats over the picture.** Glass appears only where there is live video behind it to blur: the control pill, chips and the reticle. The intro and error screens have nothing behind them, so they are solid Porcelain — glass there would just be a grey box.
3. **Nothing looks like a camera.** No round shutter-like button, no viewfinder corners, no camera icon anywhere in the UI.
4. **Still while in use.** Setting up happens before. While the mirror runs, controls hide after 3 s, nothing moves except in response to the user's own gestures, and no action with consequences can be triggered by accident.
5. **One moment of motion.** When the mirror starts, the halo opens from the screen edge to its width over about 400 ms. It shows the light arriving, and it is the only choreographed motion in the app. With `prefers-reduced-motion`, it appears instantly.
6. **Legibility over elegance.** Large type, 48 px minimum touch targets, contrast ≥ 4.5:1 in the worst case.

Radii follow hierarchy: pill and chips fully rounded, primary button 14 px, nothing else rounded.

### Glass specification

Implement `glass-smoke` as one self-contained Tailwind `@utility`, modelled on daisyUI 5's `.glass` (a diagonal highlight gradient plus an inset hairline) but **not layered on top of it**. daisyUI's `.glass` uses a 40 px blur and a transparent base: too expensive over live video on low-end phones, and too low-contrast over bright skin. Stacking our class over it would also invite specificity fights.

```css
@utility glass-smoke {
	color: #fff;
	background-color: rgb(22 33 43 / 0.66);
	background-image: linear-gradient(135deg, rgb(255 255 255 / 0.1) 0%, rgb(255 255 255 / 0) 60%);
	-webkit-backdrop-filter: blur(16px) saturate(130%);
	backdrop-filter: blur(16px) saturate(130%);
	box-shadow:
		inset 0 0 0 1px rgb(255 255 255 / 0.18),
		0 8px 24px rgb(0 0 0 / 0.25);

	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		background-color: rgb(22 33 43 / 0.88);
	}
}
```

Check the built CSS: `-webkit-backdrop-filter` must survive the build, because Safari before 18 needs it and the app supports iOS 16.4 and later.

daisyUI's job in this project is the theme tokens and `btn` for the primary button. Nothing else from daisyUI is needed.

### Copy

All strings live in `src/lib/i18n.ts`. British English and Hungarian (formal address). Plain verbs, sentence case, no apologies, and every error says what happened and what to do.

| Key                                | en                                                                                                 | hu                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| title                              | Mirror                                                                                             | Tükör                                                                                                                                     |
| step1                              | Turn your screen brightness all the way up.                                                        | Állítsa a képernyő fényerejét maximumra.                                                                                                  |
| step2                              | Stand the phone 30–40 cm away, screen facing you.                                                  | Tegye a telefont állványra, 30–40 cm-re, képernyővel maga felé.                                                                           |
| step3                              | Tap Start mirror. Pinch to zoom, drag to move the picture.                                         | Koppintson a Tükör indítása gombra. Két ujjal nagyíthat, egy ujjal mozgathatja a képet.                                                   |
| privacy                            | The picture stays on this screen. Nothing is recorded, saved or sent.                              | A kép ezen a képernyőn marad. Semmit nem rögzít, nem ment és nem küld el.                                                                 |
| start                              | Start mirror                                                                                       | Tükör indítása                                                                                                                            |
| retry                              | Try again                                                                                          | Újra                                                                                                                                      |
| exit                               | Exit                                                                                               | Kilépés                                                                                                                                   |
| errDenied                          | Camera access is off. Allow the camera for this site in your browser settings, then tap Try again. | A kamera-hozzáférés ki van kapcsolva. Engedélyezze a kamerát ennek az oldalnak a böngésző beállításaiban, majd koppintson az Újra gombra. |
| errNoCamera                        | No front camera found on this device.                                                              | Ezen az eszközön nem található előlapi kamera.                                                                                            |
| errInUse                           | Another app is using the camera. Close it, then tap Try again.                                     | Egy másik alkalmazás használja a kamerát. Zárja be, majd koppintson az Újra gombra.                                                       |
| errInsecure                        | The camera needs a secure (https) connection.                                                      | A kamerához biztonságos (https) kapcsolat kell.                                                                                           |
| errUnsupported                     | This browser can't show the camera. Open the page in Safari or Chrome.                             | Ez a böngésző nem tudja megjeleníteni a kamerát. Nyissa meg az oldalt Safariban vagy Chrome-ban.                                          |
| installHint                        | For a full-screen mirror, add this page to your Home Screen.                                       | Teljes képernyős tükörhöz tegye ki az oldalt a kezdőképernyőre.                                                                           |
| lightOff / lightSoft / lightBright | Light: off / soft / bright                                                                         | Fény: ki / halvány / erős                                                                                                                 |
| zoomReset                          | Zoom {n}×, tap to reset                                                                            | Nagyítás {n}×, koppintson a visszaállításhoz                                                                                              |
| locked (phase 6)                   | Centre locked                                                                                      | Középpont rögzítve                                                                                                                        |
| paused (phase 7)                   | Tracking paused. Drag to set the centre again.                                                     | A követés szünetel. Húzza a képet az új középpont beállításához.                                                                          |

---

## 2. Architecture

### File layout

```
src/
  app.html                 viewport-fit=cover, noindex, theme-color, apple meta, manifest link
  app.css                  Tailwind + daisyUI theme "halo", @font-face, glass-smoke utility
  service-worker.ts        precache build + static files only
  routes/
    +layout.ts             ssr = false, prerender = true
    +layout.svelte
    +page.svelte           state machine (below)
  lib/
    config.ts              every tunable
    i18n.ts                en, hu
    camera.svelte.ts       getUserMedia, stop, settings, error mapping
    wakelock.svelte.ts     request, re-acquire on visible, status
    gestures.svelte.ts     pointer state machine → pan / pinch / tap / double-tap events
    viewport.ts            pure geometry (no DOM), fully unit-tested
    components/
      Intro.svelte
      ErrorView.svelte
      Mirror.svelte        halo + stage + video + pill
      ControlPill.svelte
      DebugOverlay.svelte  only with ?debug=1
    icons/                 Sun.svelte, Close.svelte, Crosshair.svelte (inline SVG)
    motion/                phase 7 only — the one place allowed to read pixels
static/
  manifest.webmanifest
  icons/                   192, 512, maskable 512, apple-touch 180
  fonts/                   only if not using Fontsource
  _headers                 Netlify headers
scripts/
  check-privacy.mjs
tests/
  unit/                    vitest
  e2e/                     playwright
```

### Screen state machine (`+page.svelte`)

```
intro ──Start──▶ starting ──ok──▶ live ──Exit──▶ intro
                    │                │
                    └──fail──▶ error │ page hidden
                                ▲    ▼
                  Try again ────┘  suspended ──page visible──▶ live
```

- `getUserMedia` is called inside the Start click handler (a user gesture helps iOS).
- `suspended`: on `visibilitychange` (hidden) or `pagehide`, stop every track and release the wake lock, so the camera indicator goes off. On visible, restart the camera and re-acquire the wake lock.
- Exit stops the camera and returns to the intro.

### Camera

```ts
navigator.mediaDevices.getUserMedia({
	audio: false,
	video: {
		facingMode: { ideal: 'user' }, // ideal, so desktop webcams work in dev
		width: { ideal: 1920 },
		height: { ideal: 1080 },
		frameRate: { ideal: 30 }
	}
});
```

The `<video>` element: `autoplay muted playsinline`, `srcObject = stream`, then `await video.play()` and handle rejection.

| Condition                                | Error key                                         |
| ---------------------------------------- | ------------------------------------------------- |
| `!window.isSecureContext`                | `errInsecure`                                     |
| `!navigator.mediaDevices?.getUserMedia`  | `errUnsupported`                                  |
| `NotAllowedError` / `SecurityError`      | `errDenied`                                       |
| `NotFoundError` / `OverconstrainedError` | `errNoCamera`                                     |
| `NotReadableError` / `AbortError`        | `errInUse`                                        |
| anything else                            | `errUnsupported`, log the name in debug mode only |

### Stage geometry

Let the stage (the area inside the halo) be W × H CSS px and the stream vw × vh px (`video.videoWidth/Height`).

- Cover scale: `k = max(W / vw, H / vh)`.
- Size the `<video>` explicitly to `Vw = k·vw`, `Vh = k·vh`, centred in the stage, stage `overflow: hidden`.
- **Do not use `object-fit: cover`.** It crops inside the element's own box, which makes the cropped edges of the camera frame unreachable by panning.
- Recompute on stage resize (`ResizeObserver`), on orientation change and on `loadedmetadata` / `resize` events of the video (the stream swaps width and height when the phone rotates).

**Content space:** CSS px on the unzoomed, mirrored picture, origin at the stage centre. The picture spans `x ∈ [−Vw/2, Vw/2]`, `y ∈ [−Vh/2, Vh/2]`.

**Transform:** a wrapper around the video gets `translate3d(tx, ty, 0) scale(s)` with `transform-origin: 50% 50%` and `will-change: transform`. The `<video>` itself only gets `scaleX(-1)`. A content point `c` appears on screen, relative to the stage centre, at `p = s·c + t`.

All of the following live in `viewport.ts` as pure functions:

- **Clamp** (no empty edges): `|tx| ≤ (s·Vw − W)/2`, `|ty| ≤ (s·Vh − H)/2`.
- **Pan:** `t ← clamp(t + Δpointer)`.
- **Pinch** around midpoint `m` (keeps the content point under the fingers fixed): `t' = clamp(m − (s'/s)·(m − t))`, with `s'` clamped to `[ZOOM_MIN, ZOOM_MAX]`.
- **Centre point:** `c₀ = −t / s`.
- **Normalised picture coordinates** (used for anchors so they survive resizes and rotation): `u = c.x / Vw + 0.5`, `v = c.y / Vh + 0.5`, in mirrored picture space.
- **Camera → content displacement** (phase 7): a shift `(dx, dy)` in raw camera pixels is `(−k·dx, k·dy)` in content space. x is negated because the picture is mirrored.

### Gestures (`gestures.svelte.ts`)

Pointer Events on the stage, `setPointerCapture`, `touch-action: none`.

- **Tap:** one pointer, moved < 8 px, lifted within 250 ms → toggle the control pill.
- **Double tap:** second tap within 300 ms and 30 px → reset zoom to 1× (and, from phase 6, clear the anchor). Show the pill.
- **Pan:** one pointer moved ≥ 8 px.
- **Pinch:** two pointers. Baseline distance, midpoint, `s` and `t` at pinch start; update from the ratio of distances.
- **Handover:** when one finger lifts during a pinch, continue as a pan with the remaining pointer from a fresh baseline, with no jump.
- iOS Safari: `preventDefault()` on `gesturestart` and `gesturechange` on the stage.
- Do **not** set `user-scalable=no` in the viewport meta. The intro must stay zoomable for accessibility; the stage is protected by `touch-action`.

### Config (`config.ts`)

```ts
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5; // revisit after the phase 5 device tests
export const ZOOM_START = 1; // start wide so the user can aim the phone
export const HALO_LEVELS = { off: 0, soft: 0.08, bright: 0.16 } as const; // × short side of the screen
export const HALO_DEFAULT = 'bright';
export const HALO_OPEN_MS = 400;
export const PILL_AUTOHIDE_MS = 3000;
export const TAP_SLOP_PX = 8;
export const TAP_MAX_MS = 250;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_SLOP_PX = 30;
```

---

## 3. MVP phases

### Phase 0 — Scaffold and guardrails

- [x] SvelteKit + Svelte 5 + TypeScript strict; `adapter-static`; `ssr = false`, `prerender = true`.
- [x] Tailwind v4 via `@tailwindcss/vite`; daisyUI 5 via `@plugin "daisyui"`; theme `halo` with the tokens from section 1.
- [x] Self-hosted font as described in section 1.
- [x] CSP through SvelteKit (it hashes its own inline bootstrap script into a `<meta>` CSP for prerendered pages). Since SvelteKit 2.62 the kit config is passed straight to the Vite plugin and there is no `svelte.config.js`:

  ```js
  // vite.config.ts → sveltekit({ ... })
  csp: {
    mode: 'hash',
    directives: {
      'default-src': ['self'],
      'script-src': ['self'],
      'style-src': ['self', 'unsafe-inline'],
      'img-src': ['self', 'data:', 'blob:'],
      'font-src': ['self'],
      'media-src': ['self', 'blob:'],
      'connect-src': ['self'],
      'worker-src': ['self', 'blob:'],
      'manifest-src': ['self'],
      'object-src': ['none'],
      'base-uri': ['self'],
      'form-action': ['none']
    }
  }
  ```

- [x] `static/_headers` for what a `<meta>` CSP can't do:

  ```
  /*
    Content-Security-Policy: frame-ancestors 'none'
    Permissions-Policy: camera=(self), screen-wake-lock=(self), microphone=(), geolocation=(), gyroscope=(), accelerometer=(), magnetometer=(), payment=(), usb=()
    Referrer-Policy: no-referrer
    X-Content-Type-Options: nosniff
    X-Robots-Tag: noindex, nofollow

  /service-worker.js
    Cache-Control: no-cache
  ```

- [x] `app.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<meta name="robots" content="noindex, nofollow">`, `theme-color #FFFFFF`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style = black-translucent`, apple-touch-icon, manifest link.
- [x] `scripts/check-privacy.mjs`: scan `src/` and fail on any of `MediaRecorder`, `takePhoto`, `grabFrame`, `toDataURL`, `toBlob`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `sendBeacon`, `XMLHttpRequest`, `WebSocket`, `EventSource`, ` download=`, `fetch(` with an absolute `http(s)://` URL, and `getImageData` outside `src/lib/motion/`. Wire it into `npm run check`.
- [x] Vitest configured. Playwright configured with Chromium flags `--use-fake-ui-for-media-stream` and `--use-fake-device-for-media-stream`.
- [x] `npm run dev:https` using `@vitejs/plugin-basic-ssl` (dev only), for LAN phone checks. Note: a phone on plain `http://192.168.x.x` gets no camera.
- [ ] Netlify (needs a person with the account): `netlify.toml` is in the repo with build `npm run build`, publish `build`. Deploy previews on; this is the main way to test on phones (real HTTPS, no certificate warnings). Turn off form detection and snippet injection in the site settings.

**Acceptance**

- Deploys to a Netlify preview URL over HTTPS.
- No CSP violations in the console.
- The network panel shows only same-origin requests.
- `npm run check` passes, including `check:privacy`.

### Phase 1 — Camera and mirror

- [x] Intro screen with copy from `i18n.ts`; language from `navigator.language` (`hu*` → Hungarian, otherwise English).
- [x] `camera.svelte.ts` with the constraints and error mapping above; `ErrorView` with Try again and Exit.
- [x] Stage with explicit cover sizing (section 2), mirrored video, `autoplay muted playsinline`.
- [x] Resize, rotation and stream-size handling.
- [x] Suspend and resume on visibility change and `pagehide`.
- [x] `wakelock.svelte.ts`: `navigator.wakeLock.request('screen')` when live; re-acquire on `visibilitychange` → visible; release on exit and suspend. If unsupported, the mirror still works; debug shows the status.
- [x] On Start, call `requestFullscreen()` where it exists (Android Chrome); ignore failures.
- [x] `DebugOverlay` behind `?debug=1`: stream size and frame rate from `track.getSettings()`, facing mode, current zoom, **source pixels per screen pixel at the current zoom** (the quality indicator for phase 5), wake lock status, frame time.
- [x] Playwright smoke test: intro renders → Start → video is playing (`readyState ≥ 2`) → Exit returns to the intro.

**Acceptance — to be checked on real phones**

- Live mirrored picture on an iPhone (iOS 16.4+) and on Android Chrome.
- The screen stays on for 10 minutes untouched.
- Switching to another app turns the camera indicator off; coming back restarts the mirror.
- Every error state can be reached and reads clearly.

**Device findings so far** (iPhone 393×852, iOS 26, Safari tab, dev server)

- Live mirrored picture, wake lock and app switching all behave. Error states not yet exercised.
- 1080p30 from the front camera; frame time 16.x ms.
- **Source pixels per device pixel is 0.92 at 1×**, so it is 0.23 at 4× and 0.18 at 5×. CSS zoom is
  already interpolating at 1×. This is the strongest input yet for the phase 5 `ZOOM_MAX` decision,
  and an argument for pulling the native camera zoom out of the backlog.
- **In a Safari tab in landscape the layout viewport is the safe area, not the screen**: 734×333 out
  of 852×393, with `safe-area-inset-left/right` both reporting 0, in spite of `viewport-fit=cover`.
  The stage measures exactly the same 734×333, so the app fills everything it is given — nothing
  inside the page can paint into the missing 2×59pt. Open question: whether an installed
  (home-screen) app gets the whole screen. Until that is answered the document background is black
  while the mirror runs, so the strip Safari paints outside the viewport is dark rather than a
  bright bar beside the picture. From phase 3 that strip will be halo white, which is what the
  design wants there anyway.
- Do **not** make the stage `position: fixed` with an opaque background: Safari 26 fails to paint
  fully opaque fixed layers across the screen.

### Phase 2 — Zoom and pan

- [x] `viewport.ts` with unit tests: clamp, pan, pinch about a midpoint, reset, re-derivation after resize and rotation, zoom limits.
- [x] `gestures.svelte.ts` with tap, double tap, pan, pinch and pinch-to-pan handover.
- [x] iOS `gesturestart` / `gesturechange` prevention on the stage.
- [x] Zoom range and start value from `config.ts`.

**Acceptance**

- The page never scrolls or zooms while touching the stage.
- The picture never shows an empty edge at any zoom or pan.
- Pinching feels pinned under the fingers.
- Smooth on a mid-range Android phone (frame time in the debug overlay).
- Unit tests pass.

**Device findings** (same iPhone, Safari tab)

- Framing, no page scroll or page zoom, pinch pinned under the fingers and the one-finger handover
  all confirmed. The centring fix is visible: the crop now comes from the middle of the frame.
- The picture itself never shows an empty edge. The only strips left in landscape are Safari's own
  letterbox outside the layout viewport, now black.
- **4× is still usable**, which on this device is about 0.23 source pixels per device pixel. One
  device is not the `ZOOM_MAX` decision, but it is the first real bound on it.
- Phase 4 will need real HTTPS to test on a phone: iOS cannot be made to trust the self-signed
  certificate `dev:https` generates, so a page served that way cannot be launched from the Home
  Screen at all. This also blocks the open question about the landscape letterbox in a standalone app.

### Phase 3 — Halo and glass UI

- [ ] Halo levels off / soft / bright from `config.ts`, default bright. The halo is the page background (`#FFF`), and the stage is inset by the halo width on all sides. Safe-area regions are white too.
- [ ] Halo opening motion on start (section 1, principle 5), instant with reduced motion.
- [ ] `ControlPill`: Light (cycles off → soft → bright), zoom readout (tap resets to 1×), Exit. Bottom-centre of the stage, above `env(safe-area-inset-bottom)`. Hides after 3 s without interaction; a tap on the stage shows or hides it. 150 ms fade, none with reduced motion.
- [ ] `glass-smoke` utility with its fallback; check the `-webkit-` prefix in the built CSS.
- [ ] Accessibility: `aria-label` on each pill button that includes the current state, visible focus rings, 48 px minimum targets.

**Acceptance**

- White text on the pill measures ≥ 4.5:1 with a white sheet of paper filling the camera view.
- The halo computes to pure `#FFFFFF`.
- No layout shift when the pill appears or hides.
- Reduced motion is respected.

### Phase 4 — PWA

- [x] `static/manifest.webmanifest` (written in phase 0, so the shell has no 404s):

  ```json
  {
  	"name": "Mirror",
  	"short_name": "Mirror",
  	"start_url": "/",
  	"scope": "/",
  	"display": "standalone",
  	"display_override": ["fullscreen"],
  	"orientation": "any",
  	"background_color": "#EEF2F4",
  	"theme_color": "#FFFFFF",
  	"icons": [
  		{ "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
  		{ "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
  		{
  			"src": "/icons/maskable-512.png",
  			"sizes": "512x512",
  			"type": "image/png",
  			"purpose": "maskable"
  		}
  	]
  }
  ```

- [x] Icons: a white ring on Lagoon, echoing the halo. No letters, no brand, nothing camera-like. Generated by `node scripts/make-icons.mjs` (zero dependencies), plus `favicon.svg`.
- [ ] `src/service-worker.ts` using `$service-worker` (`build`, `files`, `version`): precache everything in a versioned cache, delete old caches on activate, cache-first for same-origin GET, navigation requests fall back to the cached `/`. Cache nothing else.
- [ ] Install hint on the intro, iOS only, only when not running standalone. Dismissible for the current session (a component flag, not storage).

**Acceptance — on real phones**

- Installs on Android and iOS.
- Launches in airplane mode and the camera works.
- iOS standalone camera-permission behaviour (whether it asks again on each launch) is recorded in `TESTING.md`.

### Phase 5 — Device test pass

Claude Code prepares; people run the tests.

- [ ] `docs/testcard.svg`: printable card with text lines from 1 mm to 4 mm cap height and a 5 mm grid. It lives in `docs/`, not `static/`, so it is not part of the app.
- [ ] `TESTING.md` with the protocol and an empty results table:

| Column                                | How                                                      |
| ------------------------------------- | -------------------------------------------------------- |
| Device, OS, browser, version          | —                                                        |
| Tab or installed                      | —                                                        |
| Stream size and fps                   | debug overlay                                            |
| Sharp at 30 / 35 / 45 cm?             | test card on a stand; many front cameras are fixed-focus |
| Smallest readable line at 1×, 3×, 4×  | test card at 35 cm                                       |
| Source px per screen px at 4×         | debug overlay                                            |
| Halo light in a dim bathroom at 35 cm | 1–5, with and without the room light                     |
| Wake lock holds 10 min                | yes / no                                                 |
| Battery drop and warmth after 10 min  | % and subjective                                         |
| Pill smooth over live video           | yes / no                                                 |
| iOS standalone permission re-prompt   | yes / no                                                 |

Minimum device set: a recent iPhone, an older iPhone on iOS 16.4–17, a mid-range Samsung, a low-cost Android. Optional: Firefox on Android.

**Outcome:** decide `ZOOM_MAX`, whether 1080p is enough or `ideal` should go higher, and whether screen light alone is adequate or the lit cradle is needed sooner.

---

## 4. Post-MVP

The feature: when the user positions the picture with one finger, that point locks as the centre. It then stays centred while zooming (phase 6) and when the phone or the scene moves (phase 7).

Phase 6 is pure geometry and cheap. Phase 7 is real image processing and carries the risk, so it starts with a spike.

### Phase 6 — Anchor lock

**Behaviour**

- A one-finger drag pans as in the MVP. When that pan ends (moved ≥ `TAP_SLOP_PX`), the content point at the stage centre becomes the anchor.
- The anchor is stored in **normalised picture coordinates** `(u, v)`, not pixels, so it survives resizes, rotation and stream-size changes.
- While locked, any change of zoom keeps the anchor centred. The pinch midpoint is ignored. Before the first lock, pinch works around the midpoint as in the MVP.
- A new drag re-locks at the new centre. Double tap, or tapping the zoom readout, resets to 1× and clears the anchor.
- Feedback: a crosshair reticle (28 px, white stroke with a Smoke outline) is drawn at the anchor's screen position. It is fully visible for 1.5 s after locking, then fades to 40 %. A `glass-smoke` chip shows "Centre locked" for 1.5 s.

**Geometry** (in `viewport.ts`, unit-tested)

```
anchor content point:  c_A = ((u − 0.5)·Vw, (v − 0.5)·Vh)
translation:           t   = clamp(−s · c_A)
reticle position:      p_A = s · c_A + t
```

`p_A` is the stage centre whenever clamping doesn't bite. Near the edge of the camera frame, clamping wins and the reticle shows where the anchor really is. That is honest and needs no extra message.

**Acceptance**

- After locking a point, zooming 1× → 5× → 1.5× keeps it within 1 screen px of the centre, except where clamped, where the reticle marks it correctly.
- The anchor survives rotating the phone.
- Unit tests cover lock, zoom-while-locked, clamping and rotation.

### Phase 7 — Stabilisation

**What it does:** keeps the locked anchor centred when the phone is nudged or the body shifts, by measuring how the whole scene moved and moving the crop with it.

**The central design point:** the user's hand and whatever they are holding will move right through the middle of the picture. A naive tracker that follows the patch around the anchor will latch onto the hand and drag the view away. So this is not object tracking. It estimates the **global** shift of the scene from blocks spread across the frame, **excludes a disc around the anchor**, and takes the **median**, so a hand moving through the frame is outvoted.

Stabilisation runs only while an anchor is locked. The anchor is always the user's choice (hard rule 4); nothing is detected or recognised.

**Pipeline**

1. **Sampling** (`src/lib/motion/sampler.ts`): `requestVideoFrameCallback` where supported, else `requestAnimationFrame`. Analyse at most 30 Hz and skip a frame while the worker is busy. Preferred: `createImageBitmap(video, { resizeWidth, resizeHeight })` transferred to the worker. Fallback: draw into a small canvas on the main thread and transfer `getImageData().data.buffer`. Feature-detect, measure both, keep the faster. Analysis width 192 px, greyscale.
2. **Estimator** (`src/lib/motion/estimate.ts`, pure, in a worker):
   - Reference frame = the frame at lock time.
   - A grid of 16 × 16 blocks. Skip blocks inside an exclusion disc around the anchor's position in camera space (radius ≈ 0.22 × the short side). Skip low-texture blocks (variance below a threshold).
   - For each block, search ±12 px around the previous estimate (a prediction, so motion can accumulate beyond the window). Cost: zero-mean SAD, so exposure changes and halo-level changes don't matter.
   - Two-level pyramid (96 px → 192 px) for larger jumps. Optional parabolic sub-pixel refinement.
   - Result: component-wise median vector `d`; inliers = blocks within 1.5 px of `d`; `confidence = inliers / valid blocks`.
   - Always compare against the reference frame, not the previous frame, so error doesn't accumulate as drift.
3. **Integration** (main thread):
   - Accept when `confidence ≥ 0.5` and there are at least 8 valid blocks. Otherwise hold the last accepted value.
   - Held for more than 1.5 s → chip "Tracking paused. Drag to set the centre again."
   - Smooth with a One Euro filter (start: min cutoff 1.0 Hz, beta 0.02, derivative cutoff 1.0 Hz; tune on devices). Dead band 0.3 analysis px.
   - Convert: analysis px → camera px (× vw / 192) → content space `D = (−k·dx, k·dy)`. Then `c_A' = c_A + D`, `t = clamp(−s · c_A')`.
   - All thresholds go in `config.ts`.

**Known limits, stated rather than solved:** translation only (no rotation or scale). If the scene moves so far that the anchor leaves the camera frame, clamping holds the view at the edge.

#### Phase 7a — Spike (no UI)

- [ ] `estimate.ts` as pure TypeScript.
- [ ] Vitest with synthetic frames: a textured image shifted by known sub-pixel offsets from 0 to 30 px, with added noise, a global brightness change, and an occluding disc moving through the centre.
- [ ] Report accuracy and timing.

**Pass criteria:** error ≤ 0.5 analysis px in at least 90 % of cases while the occluder covers up to 40 % of the valid blocks; the occluder never drags the estimate.

#### Phase 7b — Integration

- [ ] Worker, sampler, filter and wiring into phase 6.
- [ ] Debug overlay additions: `d`, confidence, valid blocks, worker time per frame.

**Acceptance — on real phones, with the test card on a stand at 35 cm and 3× zoom**

- Nudging the stand by up to about 3 cm, or tilting it by up to about 5°, brings the anchor back within 10 screen px of the centre in under 300 ms.
- A hand moving through the middle of the picture does not drag the view.
- No drift beyond 5 screen px over 2 minutes with a still scene.
- Worker time ≤ 4 ms per analysed frame on a mid-range Android phone. Record battery and warmth impact in `TESTING.md`.
- `check:privacy` passes: `getImageData` appears only under `src/lib/motion/`.

---

## 5. Backlog (not now)

- **Native camera zoom** via the `zoom` track constraint where the camera exposes it (mostly Chrome on Android). It crops at sensor resolution, so it is sharper than CSS zoom. Worth a spike only if phase 5 shows zoom quality is the bottleneck.
- **Exposure point or compensation** via track constraints (Chrome on Android only).
- **Lit phone cradle:** hardware, not app work.
- **Remembering settings** (halo level, language): not allowed under hard rule 2. Revisit only if that rule changes.

## 6. Open questions (for Lukács and Mark, not for Claude Code)

- Final name, branding, and whether any company name appears. This waits for the regulatory decision.
- Hungarian form of address: the plan uses the formal register (magázás).
- `ZOOM_MAX`: 5× for now, to be revisited after phase 5.
