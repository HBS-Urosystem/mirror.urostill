# Mirror — checks that only need doing once

**https://uromirror.netlify.app/**

These do not change from phone to phone, so one pass is enough. The part that
wants as many phones as you can get — the card, the light, the heat, the drift —
is the guided test at **https://uromirror.netlify.app/test**, and
`HANDOVER.md` explains it.

## Already answered

| Question                                                                           | Answer  | What it means                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installed on the home screen, does the picture reach both side edges in landscape? | **Yes** | The white strips down each side are only there in a Safari tab, where the browser hands the page less than the screen. Installed, it fills the display. Nothing to fix             |
| Does iOS ask for the camera on every launch?                                       | **Yes** | This is iOS, not the app — an installed web app does not keep camera permission between launches. Worth knowing, because it is one extra tap every single time someone picks it up |

The second one is the more interesting of the two. It is not a bug and there is
no way around it from inside the app, but if it turns out to be irritating in
daily use, that is an argument that belongs in the conversation about what this
eventually becomes.

---

## 1. Print the test card

Print `testcard.pdf` at **100 %**, with "fit to page" and "shrink to fit" turned
off. Then hold a ruler against the one printed on the card: **0 to 50 must be
exactly 50 mm.**

Everything measured with the card depends on this, so it is worth the ten
seconds. Once it is right, the same printed card serves everyone.

## 2. Android

One Android phone is enough to answer these.

- Does it offer to install? Does the icon appear — a white ring on dark green?
- Launched from the home screen, does it fill the screen with no browser bar?
- Turn on airplane mode and launch it again. Does it open? Does the camera work?

## 3. A laptop

Mirror runs on any computer with a webcam, and the whole thing is meant to work
without touching a screen. This part is not in the guided test, because the
guided test is about what the camera can resolve and a laptop webcam is not what
the app will be used on. Open the app itself at
**https://uromirror.netlify.app/** and try:

| Try                                     | What should happen                                                     |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Pinch on the trackpad                   | Spreading the fingers magnifies, smoothly                              |
| Two-finger swipe **up** the trackpad    | Magnifies. With a mouse wheel, that is rolling it towards you          |
| Press and drag                          | The picture follows the pointer; the cursor turns into a grabbing hand |
| Press Tab until the picture is selected | A white outline appears around it                                      |
| Arrow keys, then `+`, `-`, `0`          | Move the picture, zoom in, zoom out, back to the start                 |
| `Escape`                                | Leaves full screen. Press it again and it leaves the mirror            |

## 4. Which camera does it pick?

Still on the laptop: does the machine have more than one camera — a built-in one
and something plugged in?

If it does, which one does Mirror choose? It asks for a front-facing camera and
takes what it is given.

If it picks the wrong one, a camera chooser gets added to the controls. If there
is only ever one camera, or the right one is always chosen, it stays out: the
control bar has three buttons on it, and a fourth that most people never need
makes the other three harder to find.

## 5. Large text

In the system settings, turn the text size up to its maximum and open the app.

Mirror deliberately follows that setting rather than ignoring it, because it
exists to help people see. Nothing on the opening screen should overlap, get cut
off, or push the button out of reach.

---

## What these decide

| If                                              | Then                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| The ruler on the printed card measures 50 mm    | Everything else measured with it is trustworthy                                     |
| The laptop picks the wrong camera               | A camera chooser gets added to the control bar                                      |
| One camera, or always the right one             | It stays out                                                                        |
| Large text breaks the opening screen            | Worth fixing — it is the one screen with enough text to break                       |
| Android installs and runs offline like iOS does | Nothing further needed                                                              |
| Android behaves unlike iOS in some way          | Take a note of exactly how. A protocol written for Android beats one bent to fit it |
