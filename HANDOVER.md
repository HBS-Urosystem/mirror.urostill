# Mirror — handover for the device test pass

**https://testmirror.netlify.app/** · 28 September 2026

The MVP is built and deployed. Everything that can be decided at a desk has been;
what is left needs real phones, a printed card and a dim bathroom.

The app shows the front camera live and mirrored, lets you zoom and move the
picture, keeps the screen awake, and turns the edge of the screen into a white
light frame. It runs on phones, tablets and any computer with a webcam, and
installs to the home screen. Nothing is recorded, saved or sent: there is no
storage, no analytics, and the only network requests it can make are for its own
files. The deployed site carries `noindex`, a robots file that disallows
everything, and no third-party script of any kind.

**What is not finished is the deciding, not the building.** Five questions were
deliberately left to measurement rather than judgement, and this pass answers
them. A sixth — whether the picture needs stabilising at all — has been deferred
and is listed here because the tests will tell you more about it than any amount
of further work would.

Please read `TESTING.md` for the protocol and the table to fill in. This letter
is the short version: what to run, what you should see, and what each outcome
means.

One thing to know before you start: **the numbers matter more than the
impressions.** Turn on the debug overlay with `?debug=1` and write down what it
says. Several of the decisions below turn on a single figure.

---

## 1. Installing and running offline

| Test                                           | What you should see                                   |
| ---------------------------------------------- | ----------------------------------------------------- |
| Add to Home Screen on iOS, install on Android  | An icon: a white ring on a dark green square          |
| Launch it from the home screen                 | Full screen, no browser bar. The install hint is gone |
| Turn on airplane mode, launch again            | The intro loads. The camera works                     |
| **Landscape, launched from the home screen**   | **Does the picture reach both side edges?**           |
| Close and relaunch on iOS, three or four times | Does it ask for the camera every single time?         |

The landscape one is an open question, not a check. In a Safari **tab** the
picture stops about 59 pt short of each edge, because Safari gives the page the
safe area rather than the screen and nothing inside the page can paint into the
rest. Whether an installed app gets the whole screen is exactly what nobody has
been able to test until now.

## 2. The resolution upgrade

The app starts at 1080p and then asks the camera for everything it has, keeping
the result only if the frames keep arriving. Open `?debug=1` and read four rows.

| Row                  | What it means                                                                         |
| -------------------- | ------------------------------------------------------------------------------------- |
| `camera max`         | What the camera says it can do                                                        |
| `mode`               | What it settled on, and how: `upgraded`, `fellback`, `unavailable`                    |
| `fps`                | Frames counted, beside the rate the browser claims                                    |
| `src px / device px` | Camera pixels per screen pixel. Below 1 the picture is being enlarged past the sensor |

On an iPhone 14 Pro this gave 4032×3024, upgraded, 30 fps, and **2.1× more real
detail** than 1080p. A 2014 laptop webcam gave 1280×720 and `unavailable`, which
is correct — there was nothing to upgrade to.

Watch for a flicker one to three seconds after starting. There was none on the
iPhone. If a phone flickers, say so.

## 3. The printed card

Print `docs/testcard.svg` at 100 %, with "fit to page" off, then **hold a real
ruler against the printed one**. Nought to fifty must be fifty millimetres. If it
is not, nothing else on the card means anything — this is not a formality, the
first attempt at it came out 14 % small.

Card on a stand, evenly lit, measured from the card to the camera.

| Test                                            | Why                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| Sharp at 30, 35 and 45 cm?                      | Many front cameras are fixed-focus; expect a range, not a point    |
| Finest bar group still showing three bars at 5× | What the camera actually resolves, in mm, with your eyes out of it |
| Smallest readable text at 1× and at 3×          | What a person can actually read                                    |
| `src px / device px` at 4×                      | The same thing as a number                                         |

Do these **twice**: once normally, and once at `?debug=1&res=1080`, which holds
the camera at 1080p. The comparison is the point, not either figure alone.

## 4. Light, heat and endurance

| Test                                         | What to record                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Dim bathroom, card at 35 cm, light at bright | Is there enough light to see by? 1–5, with the room light off, then on |
| Leave it untouched for ten minutes           | Does the screen stay on? Does the overlay still say `wake lock held`?  |
| After those ten minutes                      | Battery percentage dropped, and whether the phone is warm              |
| Move the picture with the controls up        | Does the glass pill stay smooth over live video?                       |

Do the heat and battery test at the upgraded resolution, which is the worst case.

## 5. How much does the picture drift?

This one is new, and it decides whether a whole phase is worth building.

Put a phone on a stand at 35 cm, zoom to about 3×, and **leave it alone for a
minute**. Then nudge the stand by a centimetre or two and watch.

- Does the picture wander on its own while nothing is touched?
- After a nudge, how far off is it, and is that annoying or merely noticeable?
- With a hand held in the middle of the picture, does anything change?

Stabilisation — software that would hold the chosen point in the middle — was
built as far as proving it works, measured, and then deferred. It is accurate,
but it costs 13 ms a frame on a flagship phone against a 4 ms budget, and no
arrangement of its settings reaches that. Before spending more on it, it is worth
knowing whether the drift it fixes is a real problem on a stand.

## 6. On a laptop

| Test                                    | What you should see                                                |
| --------------------------------------- | ------------------------------------------------------------------ |
| Two-finger pinch on the trackpad        | Spreading the fingers magnifies, smoothly                          |
| Two-finger **swipe up** on the trackpad | Magnifies. Note: with a mouse wheel this means rolling towards you |
| Press and drag                          | The picture follows the pointer; the cursor is a grabbing hand     |
| Tab to the picture                      | A white focus ring appears around it                               |
| Arrow keys, `+`, `-`, `0`               | Move, zoom, zoom, reset                                            |
| `Escape`                                | Leaves full screen first, then leaves the mirror on a second press |
| More than one camera on the machine?    | Which one does it choose?                                          |

## 7. Large text

In the system settings, set the text size to its maximum and open the intro. The
app opts in to system text scaling deliberately, because it exists to help people
see. Nothing should overlap or run off the screen.

---

## What each outcome decides

| If the tests show                                                                        | Then                                                                                    |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The upgrade holds at 24 fps or better on every phone, with no flicker and no heat        | Keep it as it is                                                                        |
| It holds but the phone gets noticeably warm                                              | Lower `RES_MAX_LONG_SIDE` from 3840, or drop the upgrade                                |
| It falls back on several phones                                                          | Find the frame rate it fell back at; the floor may be in the wrong place                |
| 4× and 5× are still readable after the upgrade                                           | Leave `ZOOM_MAX` at 5                                                                   |
| 5× is useless mush, 3× is the limit                                                      | Lower `ZOOM_MAX` to 3 or 4                                                              |
| Some phone shows a `native zoom` range **and** the bar groups at 5× are still too coarse | Run the native zoom spike — it crops at the sensor and would be genuinely sharper       |
| Either of those is missing                                                               | Do not run it                                                                           |
| The screen alone lights the subject adequately at 35 cm                                  | The app is enough                                                                       |
| It does not, even at bright                                                              | The lit cradle moves up the list, and is hardware rather than software                  |
| A test machine has several cameras and the wrong one is picked                           | Add a camera chooser to the control pill                                                |
| Only one camera anywhere, or the right one is always chosen                              | Leave it out                                                                            |
| The picture drifts enough to be a nuisance on a stand                                    | Stabilisation is worth reconsidering, and the estimator is written and waiting          |
| It sits still on a stand                                                                 | Leave it deferred. It would cost battery and heat to solve a problem that is not there  |
| Landscape, installed, still stops short of the edges                                     | It is Safari, not the app. Worth knowing, nothing to fix                                |
| The camera asks for permission on every iOS launch                                       | Record it. It is an iOS behaviour, but it affects whether this is pleasant to use daily |

---

## Minimum devices

A recent iPhone · an older iPhone on iOS 16.4–17 · a mid-range Samsung · a
low-cost Android · at least one laptop with a webcam.

**The worst device decides the settings, not the best.** A flagship will pass
almost everything here.

Android needs a protocol of its own and has not been written: Chrome exposes
camera capabilities Safari does not, and the cheap devices are where the frame
rate guard and the heat budget will actually bite. Please do not fold it into the
iOS runs — flag it and we will write it properly.

## Still open, and not yours to solve

- The name, the branding, and whether any company name appears.
- `ZOOM_MAX`, pending the above.
- Whether Hungarian stays in the formal register. It currently does.
