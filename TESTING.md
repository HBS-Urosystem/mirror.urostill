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

## Motion bench (phase 7b)

`/bench` measures the stabilisation estimator on whatever device opens it. It makes up its own
frames, so it needs **no camera** — and therefore no secure context. That is the one part of this
protocol a phone can run over plain HTTP on the local network, with no certificate to trust:

```bash
npm run dev -- --host
```

Then open `http://<the Mac's LAN address>:5173/bench` on the phone and press Measure. It takes a
few seconds on a laptop and longer on a phone. Copy the whole table in.

Read it as: can this device afford the estimator at all, and if so at which setting. The budget is
4 ms a frame. `Worst` is the largest error among the estimates that would have been accepted, and
must stay at or under 0.5 px — a setting that is fast and wrong is not a saving.

| Device | Size | Step | Refine | ms  | Worst | Answered |
| ------ | ---- | ---- | ------ | --- | ----- | -------- |
|        |      |      |        |     |       |          |

### Already recorded

MacBook Pro 15" 2014 is not the machine below — this is the 2019 development laptop, 4 cores:

| Size    | Step ±Refine | ms   | Worst       |
| ------- | ------------ | ---- | ----------- |
| 128×96  | 1 ±2         | 1.31 | **2.05 px** |
| 128×96  | 1 ±3         | 1.77 | 0.01 px     |
| 128×96  | 2 ±2         | 0.91 | **2.63 px** |
| 128×96  | 2 ±3         | 1.08 | 0.03 px     |
| 192×144 | 2 ±2         | 2.26 | 0.02 px     |
| 192×144 | 2 ±3         | 3.46 | 0.02 px     |
| 192×144 | 1 ±3         | 4.32 | 0.01 px     |
| 256×192 | 2 ±3         | 5.83 | 0.02 px     |
| 256×192 | 1 ±3         | 9.22 | 0.01 px     |

Two things fall out of it:

- **The fine search cannot be narrowed to ±2 at 128×96.** It is the cheapest setting in the table
  and it is wrong by two pixels. At that size the coarsest pyramid level is 32×24, which is too
  little to hand the fine level something a ±2 window can recover. At 192 and above ±2 is fine.
  There is a unit test holding this down.
- **192×144 at step 2, ±3 costs 3.46 ms** on this laptop with no accuracy lost. A phone is several
  times slower, so the phone numbers decide whether the analysis frame has to come down to 128×96
  — which is affordable, but each analysis pixel then covers more camera pixels, so the
  stabilisation gets coarser in real terms.

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

MacBook Pro 15" 2014, built-in FaceTime HD, Chrome on localhost:

- `camera max` **1280×720 @ 30**, so the upgrade has nothing to upgrade to and
  correctly reports `unavailable`. Built-in webcams capping at 720p is what the
  plan expected, and it is now measured.
- `native zoom` **none**. First desktop data point: the `zoom` capability seen on
  the iPhone is not a given, and a laptop-only test set would have missed phase 5b
  entirely.
- **`fps` 9.6 measured against 30 reported.** Not yet explained — see below.

### Open: 9.6 fps on the 2014 laptop

The camera claims 30 and delivers under 10. Three candidates, each with a cheap test:

1. **The camera is starved of light.** Webcams routinely halve or quarter their
   frame rate to lengthen exposure. Read `fps` again in a bright room.
2. **`backdrop-filter` on the pill.** A 16 px blur over live video is expensive on
   a 2014 Intel GPU. Read `fps` with the pill up, then again after it hides.
3. **The machine cannot render the page at all.** Read the `frame` row: near
   16.7 ms means the page is fine and only the video is slow; near 100 ms means
   everything is.

This matters beyond one old laptop. `RES_FPS_FLOOR` assumes a low frame rate means
the resolution is too high. If a dim room can push a camera under 24 fps on its
own — and a dim bathroom is the actual use case — the guard would give up
resolution to fix something resolution did not cause, and the frame rate would
stay low anyway. If that is what this turns out to be, the guard should compare
the frame rate before and after the upgrade rather than against a fixed floor.
