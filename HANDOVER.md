# Mirror — device tests

**https://testmirror.netlify.app/**

Mirror turns a phone into a lighted mirror. It shows the camera live and mirrored,
lets you zoom and move the picture with your fingers, keeps the screen awake, and
turns the edge of the screen into a white light frame. It installs to the home
screen and works without a network.

The app is built. What is left is finding out how it behaves on real phones, in a
real bathroom, at a real distance — and a few of those answers decide what we
change next.

**Please run this on as many phones as you can.** The differences between devices
are the whole point: a new iPhone passes almost everything, and the settings we
end up choosing have to work on the cheapest phone in the set, not the best one.

You will need the printed test card. **Do not photocopy or rescale it** — the
sizes printed on it are what the measurements mean.

## Two links

|                                        |                                                  |
| -------------------------------------- | ------------------------------------------------ |
| Normal, with the measurements shown    | https://testmirror.netlify.app/?debug=1          |
| The same, held at the lower resolution | https://testmirror.netlify.app/?debug=1&res=1080 |

The first is how the app normally runs. The second holds the camera at a lower
resolution on purpose, so the two can be compared on the same phone.

**Write the numbers down.** Several of the decisions below turn on a single
figure, and an impression of "looked fine" cannot settle them.

---

## 1. Start it

Open the first link and tap **Start mirror**.

One thing to watch for: a second or two after the picture appears, the app asks
the camera for a better quality setting. On the phones tried so far this is
invisible. **If you see the picture flicker, jump or freeze, please say so** —
which phone, and what it looked like.

Then write down four lines from the panel in the corner:

| Line          | What it is                                                |
| ------------- | --------------------------------------------------------- |
| `camera max`  | The best the camera can do                                |
| `mode`        | What the app settled on                                   |
| `fps`         | Frames actually arriving, next to what the camera claims  |
| `native zoom` | Whether this camera can zoom by itself, or says `no zoom` |

## 2. The card: what the camera can resolve

Stand the card upright, lit evenly, no glare. **Measure from the card to the
camera, not to the screen.**

| Test                                                              | How                                                                                          |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Is it sharp at 30, 35 and 45 cm?                                  | Many front cameras cannot focus, so expect a range rather than a point                       |
| The finest bar group still showing three separate bars at 5× zoom | Card at 35 cm. Record it in mm                                                               |
| The smallest line of text you can read without guessing           | Card at 35 cm, at 1× and again at 3×. Record the mm beside the line                          |
| `src px / device px` at 4×                                        | From the panel. Below 1 means the picture is being enlarged past what the camera really sees |

**Now do the same four with the second link**, which holds the phone at the lower
resolution.

That comparison is the point of this section: it tells us whether asking the
camera for better quality actually buys visible detail on this phone. If it does
not, we can stop asking for it and give the battery back.

## 3. Light

In a dim bathroom, card at 35 cm, the mirror light at its widest setting.

|                                  | 1          | 2      | 3      |
| -------------------------------- | ---------- | ------ | ------ |
| Is there enough light to see by? | not enough | usable | plenty |

Score it twice: once with the room light off, once with it on.

## 4. Ten minutes

Start the mirror and leave the phone alone for ten minutes.

- Does the screen stay on the whole time?
- Does the panel still say `wake lock held` at the end?
- How much battery did it use?
- Is the phone warm? Warm is expected — hot is worth telling us about.

While the controls are on screen, move and zoom the picture with your fingers and
watch the little dark bar at the bottom. Does it stay smooth over the moving
picture, or does it stutter?

## 5. Does the picture stay still?

Put the phone on a stand at 35 cm and zoom to about 3×.

- **Leave it alone for a minute.** Does the picture drift on its own?
- **Nudge the stand** by a centimetre. How far off does the picture end up, and is
  that annoying or just noticeable?
- **Hold a hand in the middle of the picture.** Does anything change?

This decides whether it is worth writing image stabilisation — software that
would hold the chosen point in the middle by itself. It is a real piece of work
and it costs battery, so it is only worth doing if the picture actually moves
enough to bother someone.

---

## Where to write it down

One of these per phone. Copy the block as many times as you need.

|                                                       |     |
| ----------------------------------------------------- | --- |
| **Phone, and which iOS or Android**                   |     |
| `camera max`                                          |     |
| `mode`                                                |     |
| `fps`                                                 |     |
| `native zoom`                                         |     |
| Any flicker at the start?                             |     |
| Sharp at 30 / 35 / 45 cm                              |     |
| Finest bars at 5×, normal (mm)                        |     |
| Finest bars at 5×, lower resolution (mm)              |     |
| Smallest text at 1× / 3×, normal (mm)                 |     |
| Smallest text at 1× / 3×, lower resolution (mm)       |     |
| `src px / device px` at 4×, normal                    |     |
| `src px / device px` at 4×, lower resolution          |     |
| Light in the dark, room light off / on (1–3)          |     |
| Screen stayed on ten minutes? `wake lock` at the end? |     |
| Battery used, and was it warm?                        |     |
| Did the control bar stay smooth?                      |     |
| Drift: left alone a minute                            |     |
| Drift: after a nudge                                  |     |
| Anything else you noticed                             |     |

---

## What your answers decide

| If you find                                                                     | Then                                                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The quality upgrade holds on every phone, no flicker, no unusual heat           | Keep it as it is                                                               |
| It holds, but the phone gets noticeably hot                                     | We lower the ceiling, or stop asking for the upgrade                           |
| It gives up on several phones                                                   | We find the frame rate it gave up at — our threshold may be in the wrong place |
| The higher quality setting shows visibly finer bars or smaller text             | Worth keeping                                                                  |
| The two settings look the same on the card                                      | Drop it and save the battery                                                   |
| 4× and 5× are still readable                                                    | Leave the zoom range as it is                                                  |
| 5× is mush and 3× is the honest limit                                           | Lower the maximum zoom to 3 or 4                                               |
| A phone shows a `native zoom` range **and** the bars at 5× are still too coarse | Worth trying the camera's own zoom, which is genuinely sharper                 |
| Either of those is missing                                                      | Not worth it                                                                   |
| The screen alone lights the subject well enough at 35 cm                        | The app is enough on its own                                                   |
| It does not, even at the widest setting                                         | A lit stand moves up the list — that is hardware, not software                 |
| The picture drifts enough to be a nuisance on a stand                           | Stabilisation is worth writing                                                 |
| It sits still                                                                   | Leave it. It would cost battery to solve a problem that is not there           |

## Which phones

A recent iPhone · an older iPhone · a mid-range Samsung · a cheap Android.

If you only have time for two, make one of them the cheapest phone you can find.

**Android may behave differently enough to need its own round.** Chrome gives the
app camera controls that Safari does not, and cheap Android phones are where the
frame rate and the heat will show first. If Android looks unlike the iPhones,
tell us rather than working around it — we will write a proper protocol for it.

## Still being decided

These are open, and your experience with the app counts towards them as much as
anyone's:

- The name and the branding.
- The maximum zoom, pending the card results.
- Whether the Hungarian text stays in the formal register. It currently does.
