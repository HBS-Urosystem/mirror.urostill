# Mirror — device tests

The app: **https://uromirror.netlify.app/**
The guided test: **https://uromirror.netlify.app/test**

## What the app does

Mirror is a lighted mirror that runs in the browser. This first version does
the following, and nothing more:

- **Live mirror.** The front camera, live and mirrored, filling the screen.
- **Magnify and move.** Up to 5× magnification: pinch with two fingers, use a
  trackpad or mouse wheel, or press `+` and `-`. Drag with a finger or the
  mouse, or use the arrow keys, to move the magnified picture. A double tap, or
  `0`, goes back to 1×.
- **Light.** The edge of the screen becomes a white light frame, with three
  settings: off, soft and bright. It starts at bright.
- **Controls.** A small bar at the bottom: the light setting, the
  magnification (tapping it goes back to 1×), and Exit. It hides itself after
  three seconds; a tap brings it back.
- **Stays awake.** The screen does not dim or lock while the mirror is on.
- **The best picture the camera can keep up with.** The camera starts at
  1920×1080. The app then raises the resolution, and goes back to 1920×1080 if
  fewer than 24 frames a second arrive at the higher one.
- **Installs and works offline.** It can be added to the home screen, and once
  it has been opened it works without a network.
- **Any device.** Phones, tablets and computers with a webcam; touch, mouse and
  keyboard all work.
- **Nothing is kept or sent.** It cannot take a photo or a recording, stores
  nothing between visits, and sends nothing anywhere. The guided test is the one
  exception: at the end it sends its answers and measurements, so that the
  phones tested can be compared.

## Why it needs testing on real phones

All of the above works on the computer it was built on, and on the one iPhone
it has been tried on. What that cannot show:

- **How good the picture is.** Front cameras differ a great deal. How much
  detail the higher resolution adds over 1920×1080, and how far the picture can
  be magnified before it stops being useful, can only be seen on each phone.
- **Whether the screen gives enough light.** That depends on the screen and the
  room.
- **What it costs to run.** Battery use and heat over ten minutes, and whether
  the phone really stays awake.
- **Whether the picture stays still** when nothing touches the phone, and how
  far a nudge throws it off.

What the results decide:

- whether the app goes on raising the camera resolution, or stays at 1920×1080;
- the maximum magnification, now five times;
- whether the screen's own light is enough, or a separate light is needed;
- whether software that holds the picture steady gets written;
- whether battery use and heat allow everyday use.

All of these differ from phone to phone, and whatever is decided has to work on
the cheapest phone in the set, not the best one. **Please run the test on as
many phones as you can.**

## How to run the test

Open **https://uromirror.netlify.app/test** on the phone. It takes about
fifteen minutes, ten of them waiting.

You need:

- the printed test card. The test's first step has it as a PDF: print it at
  100 %, with "fit to page" off, and check that its ruler measures 50 mm. A
  photocopy or a rescaled print will not do: the sizes printed on it are what
  the answers mean;
- something to stand the card on, and something to stand the phone on;
- a tape measure;
- a room you can darken.

**Do not reload the page.** Nothing is stored, so a reload loses every answer.

The page asks one thing at a time, sets the mirror up for each step itself, and
records whatever it can measure without asking you. At the end it shows
everything it will send, and sends it in one go.

On some Android phones the bar at the bottom also shows how far the camera is
focused while you place the card. Use it to find the distance, and check it
against the tape measure.

## The steps, and what each is for

1. **Which phone this is.** Pressing Next starts the camera.

   **What for:** comparing the results between phones.

2. **Starting the camera.** The panel stays out of the way, so the whole
   picture is in view. Watch it for the first few seconds, while the app changes
   the camera's resolution: did it flicker, jump, go black or freeze? Then tap
   the bar at the bottom to answer. The app records each change and how long
   the picture paused; your answer says whether a person notices it.

   **What for:** deciding whether raising the resolution is unnoticeable enough to
   keep. If people notice it, it has to happen differently, or not at all.

3. **Card, high resolution.** At 35 cm, magnified five times: the finest group
   of bars and the smallest line of text you can make out. Then whether the text
   stays as sharp with the card at 30 cm and at 45 cm.

   **What for:** how much detail the camera gives, and over what distance it
   stays sharp; and the maximum magnification, now five times, which comes down
   if the text cannot be read at it.

4. **Card, 1920×1080.** The same card again, at the lower resolution. If the
   camera did not keep the higher resolution in step 2, there is nothing to
   compare, so this step is left out: the step counter goes from step 3 to
   step 5 and adds "(1 skipped)".

   **What for:** deciding whether the higher resolution is worth keeping. If the
   card reads the same at both, the higher one does nothing on that phone except
   use battery and warm it up, and it gets switched off.

5. **Light.** With the light frame at its brightest: is there enough light on
   the card in a dark room, and then with the room light on.

   **What for:** deciding whether the screen is enough light on its own. If it is not,
   even at its brightest, no change to the app can fix that, and a separate
   light is the answer.

6. **Ten minutes.** The phone stays on its stand, facing the card. You enter the
   battery percentage, and the countdown starts. Afterwards: whether the picture
   has moved, the battery percentage again, what a nudge to the stand does,
   whether a hand in the picture changes anything, how warm the phone is,
   whether moving and zooming stays smooth, and anything else you noticed. The
   app records whether the screen stayed on.

   **What for:** battery, heat and staying awake, which decide whether the app works in
   everyday use; and whether software to hold the picture steady is worth
   writing. That software would run the whole time and cost battery, so it is
   only written if the picture moves enough to be a nuisance.

Then press **Send the results**.

## Which phones

A recent iPhone · an older iPhone · a mid-range Samsung · a cheap Android.

If there is only time for two, make one of them the cheapest phone available.

**Android may behave differently enough to need a round of its own.** Chrome
gives the app camera controls that Safari does not, and cheap Android phones are
where the frame rate and the heat will show first. If Android comes out unlike
the iPhones, that is worth a note rather than a workaround: a protocol written
for Android is a better answer than one bent to fit it.
