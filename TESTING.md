# Device test pass

Claude Code prepared this; people run it. The point is to decide five things that
cannot be decided from a desktop: the resolution policy, `ZOOM_MAX`, whether the
native zoom spike is worth doing, whether the screen alone gives enough light, and
whether a camera picker is needed. See the **Outcome** section of phase 5 in
`PLAN.md`.

Fill one row per device **per mode**. Resolution-dependent rows are measured twice:
once at 1080p and once at whatever the upgrade settles on.

## Before you start

1. **Get the card to true size.** Print `docs/testcard.svg` at 100 %, with "fit
   to page" and "shrink to fit" off. Then hold a real ruler against the printed
   one: 0 to 50 must be 50 mm. If it isn't, nothing else on the card means
   anything.

   The card works on a screen too, which saves printing — but a browser's CSS
   millimetre is not a millimetre, so it must be measured the same way. Hold a
   real ruler to the screen and read the card's ruler. If it comes out short,
   regenerate the card compensated and measure again:

   ```bash
   node scripts/make-testcard.mjs --scale 1.163   # 50 ÷ what you measured
   ```

   That writes `docs/testcard-scaled.svg` and leaves the true-size card alone.

   A laptop cannot photograph its own screen, so for a laptop row the card has
   to be somewhere else: on paper, on a phone or tablet, or on a second monitor.

2. Stand the card upright, flat and evenly lit. No glare across it.
3. Measure distances **from the card to the camera**, not to the screen.
4. You need a real HTTPS address. A phone will not trust the certificate
   `npm run dev:https` generates, and an installed app cannot be launched at all
   from one. Use a Netlify deploy preview.

## The two modes

| Mode     | URL                   | What it is                                     |
| -------- | --------------------- | ---------------------------------------------- |
| Upgraded | `…/?debug=1`          | Whatever the camera settles on after the probe |
| 1080p    | `…/?debug=1&res=1080` | The starting resolution, upgrade skipped       |

The debug overlay's `mode` row says which one you are in: `upgraded`, `fellback`,
`unavailable` or `skipped`.

## Reading the debug overlay

| Row                  | Means                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `viewport`, `stage`  | The window, and the picture area inside the halo                                                         |
| `safe t/r/b/l`       | Notch and home-indicator insets                                                                          |
| `camera max`         | What the camera says it can do, at most                                                                  |
| `native zoom`        | The sensor zoom range, or `no zoom`. **This decides phase 5b.**                                          |
| `mode`               | Resolution in use, and how the probe ended                                                               |
| `fps`                | Counted frames, next to the rate the browser claims                                                      |
| `src px / device px` | Camera pixels per physical screen pixel. Below 1 the picture is being enlarged past the sensor's detail. |
| `pointer`            | `coarse` or `fine`                                                                                       |
| `frame`              | Frame time; 16.7 ms is 60 Hz                                                                             |

## Protocol

1. Open the app at the URL for the mode you are testing. Note device, OS, browser
   and version, and whether you are in a browser tab or an installed app.
2. Start the mirror. Write down `camera max`, `native zoom`, `mode` and `fps`.
3. **Focus.** Card at 30, 35 and 45 cm. Sharp at each? Many front cameras are
   fixed-focus, so expect a range rather than a point.
4. **Bar groups.** Card at 35 cm, zoom to 5×. Find the finest group where you can
   still see three separate bars, horizontal and vertical. Record it in mm.
5. **Text.** Card at 35 cm, at 1× and at 3×. The smallest line you can read
   without guessing, by its cap height in mm.
6. `src px / device px` at 4×.
7. **Light.** In a dim bathroom, card at 35 cm, halo at bright. Rate 1–5 with the
   room light off, then on.
8. **Wake lock.** Leave it untouched for 10 minutes. Does the screen stay on, and
   does the overlay still say `held`?
9. **Battery and warmth** after those 10 minutes, at the upgraded mode, which is
   the worst case. Percentage dropped, and whether the phone feels warm.
10. **Pill.** Move the picture around with the controls up. Does it stay smooth?
11. **iOS installed app only.** Close it and launch it again. Does it ask for the
    camera every time?

## Results

| Device, OS, browser, version | Tab or installed | Mode     | Camera max | Native zoom | Mode in use, measured fps | Sharp at 30 / 35 / 45 cm | Finest bar group at 5× (mm, h / v) | Smallest text at 1× / 3× (mm) | src px / device px at 4× | Halo light, room light off / on (1–5) | Wake lock 10 min | Battery drop / warmth | Pill smooth | iOS re-prompt |
| ---------------------------- | ---------------- | -------- | ---------- | ----------- | ------------------------- | ------------------------ | ---------------------------------- | ----------------------------- | ------------------------ | ------------------------------------- | ---------------- | --------------------- | ----------- | ------------- |
|                              |                  | upgraded |            |             |                           |                          |                                    |                               |                          |                                       |                  |                       |             |               |
|                              |                  | 1080p    |            |             |                           |                          |                                    |                               |                          |                                       |                  |                       |             |               |

## Devices to cover

- A recent iPhone
- An older iPhone, iOS 16.4–17
- A mid-range Samsung
- A low-cost Android
- At least one laptop with a built-in webcam
- If there is one to hand, a machine with an external USB webcam
- Optional: Firefox on Android

Built-in webcams are often capped at 720p, so the resolution and bar-group rows
matter on laptops too. On a computer, also note whether the machine offers more
than one camera and whether the built-in one is the one that gets picked — that is
what decides whether a camera picker is needed.

**Android needs a protocol of its own and is deferred.** Chrome exposes
capabilities Safari does not, and the cheap devices are where the fps guard and
the heat budget will actually bite. Do not fold it into this one.

## Already recorded

iPhone 14 Pro, iOS 26, Safari tab, from the phase 1–2 passes:

- `camera max` 4032×3024 @ 60; the upgrade held at 30 fps with no flicker and no
  noticeable heat.
- `src px / device px` 1.94 at 1× and 0.65 at 3×, against 0.92 and 0.31 at 1080p.
- `native zoom` 1–10. `getCapabilities()` returns no `step` field at all.
- 4× was already usable at 1080p.
