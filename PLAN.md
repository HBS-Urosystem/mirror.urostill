# Mirror PWA — implementation plan

Read `CLAUDE.md` first. Its hard rules override anything in this plan.

## Revisions

- **r4 — what the crosshair means.** It marks the picture area the mirror will follow when the camera or the person moves, not a zoom centre. Zoom stays anchored to the pinch or pointer position, unchanged since phase 2. This reverses one r3 decision: phase 4b no longer pulls a zoom rule forward from phase 6. Phase 6 is rewritten as "Centre anchor": the anchor is derived from the view after every interaction rather than locked as a mode, and it drives the view only when geometry changes without a gesture. Phase 7 follows from that, with a new `TRACK_MIN_ZOOM` and a reworded `paused` string.
- **r3 — desktop and the crosshair.** The app must also run on laptops and any computer with a webcam, and a crosshair marks the centre of the picture (see r4 for what it means). Changes: desktop intro layout and copy variants (section 1, i18n); the Gestures section becomes Input and gains wheel, trackpad and keyboard control (section 2); crosshair specification (section 1); new config values; **new phase 4b, which is largely retroactive against phases 1–3**; computers added to the phase 5 device set.
- **r2 — resolution.** Measured source px per screen px at 1080p: 0.92 / 0.46 / 0.31 / 0.23 / 0.18 at 1×–5×. The 1080p limit may be our own `ideal` constraint rather than the sensor. Changes: capability-based resolution upgrade with an fps guard (section 2 Camera, phase 1); capabilities in the debug overlay (phase 1); a resolution chart instead of guesswork in the device tests (phase 5); native zoom promoted from the backlog to a spike (new phase 5b); WebGL upscaling added to the backlog; `readPixels` added to the privacy check; new config values; phase 7 measures worker time at the upgraded resolution.

## Goal

A lighted mirror on the user's own device: front camera, mirrored, zoom, drag to position, screen kept awake, and a white frame around the picture that works as a light source. It runs on phones, tablets, laptops and any computer with a webcam. No capture, no storage, no network.

- **MVP:** phases 0–5, with phase 4b for desktop input and the centre crosshair.
- **Spike after the MVP:** phase 5b (native camera zoom), only if phase 5 finds devices that expose it.
- **Post-MVP:** phase 6 (centre anchor) and phase 7 (stabilisation). The area at the centre of the screen, marked by the crosshair, is remembered (phase 6) and then held in the centre when the camera or the person moves (phase 7).

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
│███│        ⊕         │███│  centre crosshair (r3) / anchor reticle (phase 6)
│███│                  │███│
│███│  ╭────────────╮  │███│
│███│  │ ☀  2.5×  ✕ │  │███│  smoked-glass pill, auto-hides
│███│  ╰────────────╯  │███│
│███└──────────────────┘███│
│██████████████████████████│
└──────────────────────────┘
```

Landscape uses the same structure; the pill stays bottom-centre of the stage.

**Desktop and laptop (r3).** The app also runs on any computer with a webcam, so the intro must not look like a stretched phone screen: the text column and the button sit in a centred container of at most 420 px, vertically centred, with the same type scale. The mirror screen needs no structural change — the halo and the pill work at any size — but the copy and the input do (see section 2, Input).

```
┌───────────────────────────────────────────────┐
│                                               │
│              Mirror                           │
│                                               │
│              1  Turn your screen…             │  ≤ 420 px column,
│              2  Sit about 40–60 cm…           │  centred in the viewport
│              3  Click Start mirror…           │
│                                               │
│              The picture stays on…            │
│                                               │
│              ┌─────────────────┐              │
│              │  Start mirror   │              │
│              └─────────────────┘              │
│                                               │
└───────────────────────────────────────────────┘
```

### Centre crosshair (r4, corrects r3)

While the user moves or zooms the picture, a crosshair appears pinned to the centre of the stage. It marks **the part of the picture the mirror will follow** when the camera or the person moves — the area phase 7 keeps in the middle of the screen. It says nothing about zooming.

**Zoom still works about the pinch or pointer position**, exactly as before. That does not conflict with the crosshair: the tracked area is simply whatever is at the centre when the user stops interacting, so a pinch that shifts the picture also chooses a new area to follow. Nothing needs to be pulled forward from phase 6.

- 28 px, 2 px white stroke with a 1 px dark outline so it reads over any background, a 6 px gap in the middle so it never hides the point itself, no fill.
- Appears on the first movement of a pan (pointer, wheel, trackpad or keyboard) and during any zoom change. Stays for `CROSSHAIR_HOLD_MS` after the interaction ends, then fades over `CROSSHAIR_FADE_MS`. With `prefers-reduced-motion` it simply disappears after the hold.
- `aria-hidden="true"`: it is feedback, not content.
- Until phase 7 exists it shows where the centre is and nothing follows anything, which is harmless. From phase 7 it stops fading while tracking is active.

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
| step2Desktop (r3)                  | Point the camera at what you want to see, about 40–60 cm away.                                     | Irányítsa a kamerát arra, amit látni szeretne, nagyjából 40–60 cm-ről.                                                                    |
| step3Desktop (r3)                  | Click Start mirror. Scroll to zoom, drag to move the picture.                                      | Kattintson a Tükör indítása gombra. Görgetéssel nagyíthat, húzással mozgathatja a képet.                                                  |
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
| dismiss                            | Dismiss                                                                                            | Bezárás                                                                                                                                   |
| lightOff / lightSoft / lightBright | Light: off / soft / bright                                                                         | Fény: ki / halvány / erős                                                                                                                 |
| zoomReset                          | Zoom {n}×, tap to reset                                                                            | Nagyítás {n}×, koppintson a visszaállításhoz                                                                                              |
| paused (phase 7)                   | Tracking paused. Move the picture to start again.                                                  | A követés szünetel. Mozgassa a képet az újrainduláshoz.                                                                                   |

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

**Resolution upgrade (r2).** 1080p is only the safe starting point. Front sensors are usually 8–12 MP, and a higher stream resolution directly improves zoomed detail: at 2160p every source-per-screen figure doubles, so 5× looks like 1080p at 2.5×.

1. Start with the 1080p constraints above, so the picture appears quickly.
2. Read `track.getCapabilities?.()`. The method may be missing; then stay at 1080p.
3. If `width.max × height.max` exceeds 1920 × 1080, call `track.applyConstraints()` with `ideal` width and height at the capability maximum, capped so the long side is at most `RES_MAX_LONG_SIDE`, keeping `frameRate: { ideal: 30 }`. Accept whatever aspect ratio the browser returns (a 4:3 mode shows more of the sensor, and the stage geometry recomputes on the video `resize` event anyway).
4. **fps guard:** count frames for `RES_PROBE_MS` with `requestVideoFrameCallback` where available (otherwise trust `track.getSettings().frameRate`). If below `RES_FPS_FLOOR`, re-apply the 1080p constraints.
5. Remember the chosen mode in memory for the session, so resuming after `suspended` doesn't probe again. Never persist it (hard rule 2).

The upgrade happens once per start, during the halo opening. Any brief stream interruption during `applyConstraints` is acceptable there.

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
- **Normalised picture coordinates** (used for anchors so they survive resizes and rotation): `u = c.x / Vw + 0.5`, `v = c.y / Vh + 0.5`, in mirrored picture space. If phase 5b ships native zoom, these must refer to the full sensor frame, not the delivered crop; phase 5b defines the mapping.
- **Camera → content displacement** (phase 7): a shift `(dx, dy)` in raw camera pixels is `(−k·dx, k·dy)` in content space. x is negated because the picture is mirrored.

### Input (`gestures.svelte.ts`)

The app runs on phones, tablets, laptops and any computer with a webcam, so every action has a touch, a pointer and a keyboard route. Detect the input style with `matchMedia('(pointer: coarse)')` for copy and hints only — never gate behaviour on it, because hybrid laptops have both.

**Touch and pointer.** Pointer Events on the stage, `setPointerCapture`, `touch-action: none`.

- **Tap / click:** one pointer, moved < 8 px, lifted within 250 ms → toggle the control pill.
- **Double tap / double click:** second one within 300 ms and 30 px → reset zoom to 1× (and, from phase 6, clear the anchor). Show the pill.
- **Pan:** one pointer moved ≥ 8 px. On a mouse this is a press-and-drag; the stage shows `cursor: grab`, and `grabbing` while dragging.
- **Pinch:** two pointers. Baseline distance, midpoint, `s` and `t` at pinch start; update from the ratio of distances.
- **Handover:** when one finger lifts during a pinch, continue as a pan with the remaining pointer from a fresh baseline, with no jump.
- iOS Safari: `preventDefault()` on `gesturestart` and `gesturechange` on the stage.
- Do **not** set `user-scalable=no` in the viewport meta. The intro must stay zoomable for accessibility; the stage is protected by `touch-action`.

**Wheel and trackpad (r3).** Register `wheel` on the stage as a non-passive listener and always `preventDefault()`.

- `event.ctrlKey === true` means a trackpad pinch (macOS and Windows both report it this way). Use the finer factor `WHEEL_PINCH_FACTOR`.
- Otherwise it is a wheel or two-finger scroll. Zoom with `WHEEL_ZOOM_STEP` per notch; the page has nothing to scroll anyway.
- `deltaMode` may be lines or pages rather than pixels; normalise before applying.
- Zoom about the pointer position, exactly as pinch does, before and after a pan alike (r4 reversed the r3 rule that fixed the view centre after a pan).

**Keyboard (r3).** The stage is focusable (`tabindex="0"`) with a visible focus ring. Keys are listed in `step3Desktop` only at the level a user needs; the full set:

| Key        | Action                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Arrow keys | Pan by `KEY_PAN_STEP_PX`, ×4 with Shift                                                                             |
| `+` / `-`  | Zoom by `KEY_ZOOM_STEP`                                                                                             |
| `0`        | Reset zoom, and clear the anchor from phase 6                                                                       |
| `Escape`   | Exit the mirror — but if `document.fullscreenElement` is set, do nothing and let the browser leave fullscreen first |

Keyboard panning and zooming show the centre crosshair just like pointer input.

**Pill visibility on desktop (r3).** Any `pointermove` from a fine pointer shows the pill and restarts the `PILL_AUTOHIDE_MS` timer, so a desktop user never has to click to find the controls.

### Config (`config.ts`)

```ts
export const ZOOM_MIN = 1;
// Above ~2–2.5× at 1080p, a normally sighted viewer already sees every camera pixel:
// more zoom enlarges but doesn't sharpen. Kept at 5× because enlargement itself helps
// people with reduced vision. Revisit after the phase 5 device tests.
export const ZOOM_MAX = 5;
export const ZOOM_START = 1; // start wide so the user can aim the phone
export const RES_MAX_LONG_SIDE = 3840; // cap for the resolution upgrade
export const RES_FPS_FLOOR = 24; // below this, fall back to 1080p
export const RES_PROBE_MS = 2000; // how long to count frames after upgrading
export const NATIVE_ZOOM_SETTLE_MS = 200; // phase 5b: apply native zoom this long after a gesture ends
export const HALO_LEVELS = { off: 0, soft: 0.08, bright: 0.16 } as const; // × short side of the screen
export const HALO_DEFAULT = 'bright';
export const HALO_OPEN_MS = 400;
export const PILL_AUTOHIDE_MS = 3000;
export const TAP_SLOP_PX = 8;
export const TAP_MAX_MS = 250;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_SLOP_PX = 30;
export const WHEEL_ZOOM_STEP = 1.15; // r3: per normalised wheel notch
export const WHEEL_PINCH_FACTOR = 0.01; // r3: per unit of deltaY when ctrlKey is set
export const KEY_PAN_STEP_PX = 24; // r3, ×4 with Shift
export const KEY_ZOOM_STEP = 1.2; // r3
export const CROSSHAIR_HOLD_MS = 1200; // r3
export const CROSSHAIR_FADE_MS = 250; // r3
export const TRACK_MIN_ZOOM = 1.1; // r4: phase 7 tracks only above this zoom
```

---

## 3. MVP phases

### Phase 0 — Scaffold and guardrails

- [ ] SvelteKit + Svelte 5 + TypeScript strict; `adapter-static`; `ssr = false`, `prerender = true`.
- [ ] Tailwind v4 via `@tailwindcss/vite`; daisyUI 5 via `@plugin "daisyui"`; theme `halo` with the tokens from section 1.
- [ ] Self-hosted font as described in section 1.
- [ ] CSP through SvelteKit (it hashes its own inline bootstrap script into a `<meta>` CSP for prerendered pages):

  ```js
  // svelte.config.js → kit.csp
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

- [ ] `static/_headers` for what a `<meta>` CSP can't do:

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

- [ ] `app.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<meta name="robots" content="noindex, nofollow">`, `theme-color #FFFFFF`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style = black-translucent`, apple-touch-icon, manifest link.
- [ ] `scripts/check-privacy.mjs`: scan `src/` and fail on any of `MediaRecorder`, `takePhoto`, `grabFrame`, `toDataURL`, `toBlob`, `readPixels` (r2), `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `sendBeacon`, `XMLHttpRequest`, `WebSocket`, `EventSource`, ` download=`, `fetch(` with an absolute `http(s)://` URL, and `getImageData` outside `src/lib/motion/`. Wire it into `npm run check`.
- [ ] Vitest configured. Playwright configured with Chromium flags `--use-fake-ui-for-media-stream` and `--use-fake-device-for-media-stream`.
- [ ] `npm run dev:https` using `@vitejs/plugin-basic-ssl` (dev only), for LAN phone checks. Note: a phone on plain `http://192.168.x.x` gets no camera.
- [ ] Netlify: build `npm run build`, publish `build`. Deploy previews on; this is the main way to test on phones (real HTTPS, no certificate warnings). Turn off form detection and snippet injection in the site settings.

**Acceptance**

- Deploys to a Netlify preview URL over HTTPS.
- No CSP violations in the console.
- The network panel shows only same-origin requests.
- `npm run check` passes, including `check:privacy`.

### Phase 1 — Camera and mirror

- [ ] Intro screen with copy from `i18n.ts`; language from `navigator.language` (`hu*` → Hungarian, otherwise English).
- [ ] `camera.svelte.ts` with the constraints and error mapping above; `ErrorView` with Try again and Exit.
- [ ] Resolution upgrade with the fps guard (section 2, Camera). The chosen mode lives in memory for the session only.
- [ ] Stage with explicit cover sizing (section 2), mirrored video, `autoplay muted playsinline`.
- [ ] Resize, rotation and stream-size handling.
- [ ] Suspend and resume on visibility change and `pagehide`.
- [ ] `wakelock.svelte.ts`: `navigator.wakeLock.request('screen')` when live; re-acquire on `visibilitychange` → visible; release on exit and suspend. If unsupported, the mirror still works; debug shows the status.
- [ ] On Start, call `requestFullscreen()` where it exists (Android Chrome); ignore failures.
- [ ] `DebugOverlay` behind `?debug=1`, showing:
  - **capabilities** from `track.getCapabilities()`: max width × height, max frame rate, and the `zoom` range and step if present (or "no zoom");
  - the mode in use from `track.getSettings()` and whether the upgrade succeeded, fell back, or wasn't attempted;
  - **measured** fps (frame counter), next to the reported one;
  - facing mode, current zoom, **source pixels per screen pixel at the current zoom**, wake lock status, frame time.
- [ ] Playwright smoke test: intro renders → Start → video is playing (`readyState ≥ 2`) → Exit returns to the intro.

**Acceptance — to be checked on real phones**

- Live mirrored picture on an iPhone (iOS 16.4+) and on Android Chrome.
- The screen stays on for 10 minutes untouched.
- Switching to another app turns the camera indicator off; coming back restarts the mirror.
- Every error state can be reached and reads clearly.
- The debug overlay shows each test phone's maximum resolution and zoom capability, and whether the upgrade held at ≥ `RES_FPS_FLOOR`.

### Phase 2 — Zoom and pan

- [ ] `viewport.ts` with unit tests: clamp, pan, pinch about a midpoint, reset, re-derivation after resize and rotation, zoom limits.
- [ ] `gestures.svelte.ts` with tap, double tap, pan, pinch and pinch-to-pan handover.
- [ ] iOS `gesturestart` / `gesturechange` prevention on the stage.
- [ ] Zoom range and start value from `config.ts`.

**Acceptance**

- The page never scrolls or zooms while touching the stage.
- The picture never shows an empty edge at any zoom or pan.
- Pinching feels pinned under the fingers.
- Smooth on a mid-range Android phone (frame time in the debug overlay).
- Unit tests pass.

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

- [ ] `static/manifest.webmanifest`:

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

- [ ] Icons: a white ring on Lagoon, echoing the halo. No letters, no brand, nothing camera-like.
- [ ] `src/service-worker.ts` using `$service-worker` (`build`, `files`, `version`): precache everything in a versioned cache, delete old caches on activate, cache-first for same-origin GET, navigation requests fall back to the cached `/`. Cache nothing else.
- [ ] Install hint on the intro, iOS only, only when not running standalone. Dismissible for the current session (a component flag, not storage).

**Acceptance — on real phones**

- Installs on Android and iOS.
- Launches in airplane mode and the camera works.
- iOS standalone camera-permission behaviour (whether it asks again on each launch) is recorded in `TESTING.md`.

### Phase 4b — Desktop input and the centre crosshair (r3)

Phases 0–4 were built for touch. This phase makes the app usable on a laptop or any computer with a webcam, and adds the crosshair. **Most of it is retroactive**: it edits work that is already done, so read the list below before starting, and re-run the phase 1–4 acceptance checks afterwards.

#### Retroactive edits, by the phase they belong to

- **Phase 1 — `Intro.svelte` and `i18n.ts`.** Add `step2Desktop` and `step3Desktop` and pick between them with `matchMedia('(pointer: coarse)')`. Constrain the intro to a centred column of at most 420 px so it doesn't stretch across a desktop screen (section 1). The `DebugOverlay` gains the detected pointer type.
- **Phase 2 — `gestures.svelte.ts` and `viewport.ts`.** This is the bulk of the work: wheel and trackpad zoom, keyboard pan, zoom, reset and exit, `grab` / `grabbing` cursors, and the focusable stage. Extend the unit tests: wheel normalisation across `deltaMode` values and keyboard steps.
- **Phase 3 — `ControlPill.svelte`.** Show the pill on `pointermove` from a fine pointer and restart the auto-hide timer. Check the focus ring is visible on the pill buttons and on the stage when tabbing.
- **Phase 4 — nothing.** The manifest and the service worker already work on desktop; `display: standalone` installs as a desktop window.

#### New work

- [x] `Crosshair.svelte` per the specification in section 1, pinned to the stage centre, `aria-hidden`.
- [x] Show it on pan and on zoom from any input, hold `CROSSHAIR_HOLD_MS`, fade `CROSSHAIR_FADE_MS`, honour `prefers-reduced-motion`.
- [x] Leave zoom behaviour alone: it stays anchored to the pinch or pointer position (r4).
- [x] Playwright: a desktop-viewport run of the existing smoke test, plus wheel zoom and arrow-key pan.

**Acceptance**

- On a laptop with a built-in webcam: the mirror runs, the wheel and a trackpad pinch both zoom, press-and-drag pans, arrow keys pan, `+` `-` `0` work, and the pill appears on mouse movement.
- Tabbing to the stage shows a focus ring; `Escape` exits the mirror but only leaves fullscreen when in fullscreen.
- The crosshair appears on the first movement of a pan and after every zoom change, and marks the centre of the picture.
- Zoom is still anchored to the pinch or pointer position, unchanged from phase 2.
- Nothing regressed on a phone: the phase 2 and phase 3 acceptance checks still pass.

### Phase 5 — Device test pass

Claude Code prepares; people run the tests.

- [ ] `docs/testcard.svg`, printable at 100 % scale. It lives in `docs/`, not `static/`, so it is not part of the app. Contents:
  - **Resolution chart:** groups of three black bars separated by equal white gaps, at line widths 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75 and 1.0 mm, each group in a horizontal and a vertical version, labelled with its width.
  - Text lines from 1 mm to 4 mm cap height.
  - A 50 mm ruler, to confirm the print scale with a real ruler.
- [ ] Debug-only switch `?debug=1&res=1080` that skips the resolution upgrade, so both modes can be compared on the same phone.
- [ ] `TESTING.md` with the protocol and an empty results table. Every resolution-dependent row is filled in twice: at 1080p and at the upgraded mode.

| Column                                   | How                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Device, OS, browser, version             | —                                                                                                                                         |
| Tab or installed                         | —                                                                                                                                         |
| Capabilities: max resolution, zoom range | debug overlay                                                                                                                             |
| Mode in use, measured fps                | debug overlay, both modes                                                                                                                 |
| Sharp at 30 / 35 / 45 cm?                | test card on a stand; many front cameras are fixed-focus                                                                                  |
| **Finest resolvable bar group at 5×**    | test card at 35 cm, both modes. At 5× the eye is not the limit, so this measures what the camera actually resolves on the subject, in mm. |
| Smallest readable text line at 1× and 3× | test card at 35 cm                                                                                                                        |
| Source px per screen px at 4×            | debug overlay, both modes                                                                                                                 |
| Halo light in a dim bathroom at 35 cm    | 1–5, with and without the room light                                                                                                      |
| Wake lock holds 10 min                   | yes / no                                                                                                                                  |
| Battery drop and warmth after 10 min     | % and subjective, at the upgraded mode (worst case)                                                                                       |
| Pill smooth over live video              | yes / no                                                                                                                                  |
| iOS standalone permission re-prompt      | yes / no                                                                                                                                  |

Minimum device set: a recent iPhone, an older iPhone on iOS 16.4–17, a mid-range Samsung, a low-cost Android. Optional: Firefox on Android.

**Computers (r3):** at least one laptop with a built-in webcam and, if there is one to hand, a machine with an external USB webcam. Record the same rows where they apply. Built-in webcams are often capped at 720p, so the resolution and bar-group rows matter here too. Note whether the machine offers more than one camera and whether the built-in one is picked.

**Outcome:** decide

- the resolution policy: keep the upgrade, change `RES_MAX_LONG_SIDE`, or drop it if heat or fps make it not worth it;
- `ZOOM_MAX`;
- whether phase 5b is worth doing: only if some target phones expose `zoom` **and** the bar-group result at 5× is still too coarse after the upgrade;
- whether screen light alone is adequate or the lit cradle is needed sooner;
- whether a camera picker is needed (r3): only if a test machine has more than one camera and `facingMode: { ideal: 'user' }` picks the wrong one. If so, add a switch control to the pill, listing `enumerateDevices()` video inputs; otherwise leave it out.

### Phase 5b — Native zoom spike (r2, conditional)

Run only if phase 5 says so. Where the camera exposes a `zoom` capability, `applyConstraints({ advanced: [{ zoom }] })` crops on the sensor at full resolution before the stream is scaled down, so zoomed detail is real rather than interpolated. It only helps where the sensor is larger than the stream.

**Zoom split.** The total zoom the user sees, and the readout shows, is `Z = z_n · s`: native zoom times CSS zoom.

**Constraint: the native crop is centred and cannot pan.** Front cameras practically never expose pan. So native zoom is only usable up to the point where the visible region still lies inside the centred crop. In normalised full-frame units, with the view centre offset `(du, dv)` from the frame centre and visible half-extents `(hx, hy)`:

```
z_n ≤ 0.5 / (|du| + hx)   and   z_n ≤ 0.5 / (|dv| + hy)
z_n = min(caps.zoom.max, Z, both bounds), snapped down to caps.zoom.step
s   = Z / z_n
```

With the view centred, `z_n` can go up to `Z` or the capability maximum, whichever is smaller. When the user pans towards an edge, `z_n` backs off automatically and CSS zoom takes over the rest.

**Timing.** During a gesture only CSS zoom changes. `NATIVE_ZOOM_SETTLE_MS` after the gesture ends, apply the new `z_n`, and at the same time set `s = Z / z_n` and re-derive `t` so the view stays put.

**Coordinates.** With native zoom active, the delivered frame is a crop, so anchors (phase 6) must be stored in full-sensor normalised coordinates: `u_full = 0.5 + (u_frame − 0.5) / z_n`, and likewise for `v`. Keep this mapping in a single function in `viewport.ts`. Phase 7 must also reset its reference frame whenever `z_n` changes.

- [ ] Split logic and bounds in `viewport.ts`, with unit tests.
- [ ] Settling logic and the debug display of `z_n` and `s`.
- [ ] Re-run the bar-group test at 3×, 4× and 5× with native zoom on and off.

**The risk to measure first:** native zoom takes effect a few frames after `applyConstraints` resolves, and no frame says which zoom it was captured at, so the picture may visibly jump or refocus. If that jump can't be made unnoticeable, the spike fails and the feature is not built.

**Pass criteria**

- On phones that expose `zoom`, the finest resolvable bar group at 4× improves by at least one step over CSS-only.
- No noticeable jump when native zoom settles.
- Panning to the edge of the frame still works, with `z_n` backing off smoothly.

---

## 4. Post-MVP

The feature: the picture area at the centre of the screen, marked by the crosshair, is remembered (phase 6) and then held in the centre when the camera or the person moves (phase 7). Zoom and pan behaviour does not change.

Phase 6 is pure geometry and cheap, and nothing about it is visible to the user. Phase 7 is real image processing and carries the risk, so it starts with a spike.

### Phase 6 — Centre anchor (r4, was "Anchor lock")

The anchor is not a mode the user switches on. It is simply **the content point at the stage centre**, re-derived whenever the user finishes interacting, and stored so that it survives everything that isn't a user gesture. Phase 7 then holds that point in the centre against camera and scene motion.

**Already delivered by phase 4b:** the crosshair that shows where it is.

**Behaviour**

- After every pan and every zoom, once the interaction ends, derive the anchor from the current view: `c₀ = −t / s`.
- Store it in **normalised picture coordinates** `(u, v)`, not pixels, so it survives stage resizes, rotation, stream-size changes and, if phase 5b ships, native zoom changes.
- **Zoom is untouched**: it stays anchored to the pinch or pointer position. Zooming moves the picture, which moves which content sits at the centre, which re-derives the anchor. That is the intended behaviour, not a conflict.
- When something that is _not_ a user gesture changes the geometry — a rotation, a resize, a resolution upgrade, a native zoom step — re-derive `t` so the stored anchor returns to the centre. This is the only case where the anchor drives the view rather than the other way round.
- Double tap, `0`, or tapping the zoom readout resets to 1×; the anchor re-derives from the reset view like any other change.

**Geometry** (in `viewport.ts`, unit-tested)

```
derive after an interaction:   (u, v) = normalise(−t / s)
restore after a geometry change:
    c_A = ((u − 0.5)·Vw, (v − 0.5)·Vh)
    t   = clamp(−s · c_A)
crosshair position:            p_A = s · c_A + t
```

`p_A` is the stage centre in every ordinary case. It differs only when clamping bites — which cannot happen from a user gesture, since panning is clamped as it goes, but can happen in phase 7 when tracking pushes the anchor towards the edge of the frame. Drawing the crosshair at `p_A` rather than at a hardcoded centre keeps it honest in that case at no extra cost.

**Acceptance**

- Panning and zooming feel exactly as they did in phase 2; no behaviour changes that the user can notice.
- Rotating the phone, or an upgrade of the stream resolution, keeps the same content in the centre.
- Unit tests cover derivation, restoration after a geometry change, clamping and rotation.

### Phase 7 — Stabilisation

**What it does:** keeps the anchor — the content point at the stage centre, from phase 6 — in the centre when the camera is nudged or the person shifts, by measuring how the whole scene moved and moving the crop with it.

**The central design point:** the user's hand and whatever they are holding will move right through the middle of the picture. A naive tracker that follows the patch around the anchor will latch onto the hand and drag the view away. So this is not object tracking. It estimates the **global** shift of the scene from blocks spread across the frame, **excludes a disc around the anchor**, and takes the **median**, so a hand moving through the frame is outvoted.

Stabilisation runs while the mirror is live and the zoom is above `TRACK_MIN_ZOOM`; below that there is no room to compensate and nothing to gain. The anchor is always the result of the user's own gesture (hard rule 4); nothing is detected or recognised.

**Reference frame:** captured when the last user interaction ends, since that is also when the anchor is derived. Every pan, zoom or reset replaces it.

**Pipeline**

1. **Sampling** (`src/lib/motion/sampler.ts`): `requestVideoFrameCallback` where supported, else `requestAnimationFrame`. Analyse at most 30 Hz and skip a frame while the worker is busy. Preferred: `createImageBitmap(video, { resizeWidth, resizeHeight })` transferred to the worker. Fallback: draw into a small canvas on the main thread and transfer `getImageData().data.buffer`. Feature-detect, measure both, keep the faster. Analysis width 192 px, greyscale.
2. **Estimator** (`src/lib/motion/estimate.ts`, pure, in a worker):
   - Reference frame = the frame captured when the last interaction ended (above).
   - A grid of 16 × 16 blocks. Skip blocks inside an exclusion disc around the anchor's position in camera space (radius ≈ 0.22 × the short side). Skip low-texture blocks (variance below a threshold).
   - For each block, search ±12 px around the previous estimate (a prediction, so motion can accumulate beyond the window). Cost: zero-mean SAD, so exposure changes and halo-level changes don't matter.
   - Two-level pyramid (96 px → 192 px) for larger jumps. Optional parabolic sub-pixel refinement.
   - Result: component-wise median vector `d`; inliers = blocks within 1.5 px of `d`; `confidence = inliers / valid blocks`.
   - Always compare against the reference frame, not the previous frame, so error doesn't accumulate as drift.
3. **Integration** (main thread):
   - Accept when `confidence ≥ 0.5` and there are at least 8 valid blocks. Otherwise hold the last accepted value.
   - Held for more than 1.5 s → the `paused` chip. Any interaction resets the reference frame and restarts tracking.
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
- Worker time ≤ 4 ms per analysed frame on a mid-range Android phone, measured at the stream resolution actually in use after the phase 1 upgrade (a larger stream makes sampling more expensive). Record battery and warmth impact in `TESTING.md`.
- `check:privacy` passes: `getImageData` appears only under `src/lib/motion/`.

---

## 5. Backlog (not now)

- **WebGL upscaling** (r2): draw the video into a WebGL canvas with bicubic or Lanczos scaling and mild sharpening instead of CSS scaling. It gives sharper edges but no new detail, and it changes the rendering architecture (canvas instead of `<video>`). It must stay GPU-only: no `readPixels`, no readback of any kind. Consider only if phase 5 shows most target phones are stuck at 1080p and the picture feels soft at 2–3×.
- **Exposure point or compensation** via track constraints (Chrome on Android only).
- **Lit phone cradle:** hardware, not app work.
- **Remembering settings** (halo level, language): not allowed under hard rule 2. Revisit only if that rule changes.

## 6. Open questions (for Lukács and Mark, not for Claude Code)

- Final name, branding, and whether any company name appears. This waits for the regulatory decision.
- Hungarian form of address: the plan uses the formal register (magázás).
- `ZOOM_MAX`: 5× for now. At 1080p, zoom above ~2–2.5× enlarges rather than sharpens for a normally sighted viewer; it stays because enlargement helps reduced vision. Revisit after phase 5.
