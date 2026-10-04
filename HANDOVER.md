# Mirror — device tests

The app: **https://uromirror.netlify.app/**
The guided test: **https://uromirror.netlify.app/test**

Neither is public: share the links only with the people who test.

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
it has been tried on. The following has to be checked on as many phones as
possible, of different makes, models and ages:

- **How sharp the picture can be.** Front cameras differ a great deal. How
  small a text can be made sharp, at what distance, and how far the picture has
  to be magnified to show a 10 cm area, can only be seen on each phone.
- **Whether the screen gives enough light.** That depends on the screen and the
  room.
- **What it costs to run.** Battery use and heat over ten minutes, and whether
  the phone really stays awake.
- **Whether the picture stays still** when nothing touches the phone, and how
  hard it is to put back after a nudge.

What the results decide:

- whether the app goes on raising the camera resolution, or stays at 1920×1080;
- the maximum magnification, now five times;
- whether the screen's own light is enough, or a separate light is needed;
- whether software that holds the picture steady gets written;
- whether battery use and heat allow everyday use.

All of these differ from phone to phone, and whatever is decided has to work on
the cheapest phone in the set, not the best one.

## How to run the test

Open **https://uromirror.netlify.app/test** on the phone. It takes about
fifteen minutes, ten of them waiting.

You need:

- the test card, printed at 100% with "fit to page" off. It can be downloaded
  from the test's first step;
- something to stand the card on, and something to stand the phone on;
- a tape measure. Lay it on the table from the phone towards the card and
  leave it there: the card step asks how far the card is;
- a room you can darken.

**Do not reload the page.** Nothing is stored, so a reload loses every answer.

The page asks one thing at a time, sets the mirror up for each step itself, and
records whatever it can measure without asking you. Once you zoom the picture,
the magnification is yours: it stays as you set it on every step. At the end it
shows everything it will send, and sends it in one go. The answers come back by
themselves, so there is nothing to collect.

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

3. **Card.** At the best resolution the app uses on that phone, magnified five
   times unless you have zoomed already: the card is moved nearer and further
   until the text is sharpest, and the distance read off the tape measure. Then the picture is
   zoomed until the 10 cm square on the card is as wide as the screen, and the
   smallest line of text that is sharp is picked, from the 1 to 4 mm lines on
   the card, or none of them. The app records the magnification that took. The
   card then stays where it is.

   **What for:** how much detail the phone shows when a 10 cm area fills the
   screen, at what distance, and how far it had to be magnified for that. This
   is what the maximum magnification, now five times, is set by.

4. **Light.** With the light frame at its brightest, and the card where the
   last step left it: is there enough light on the card in a dark room, and then
   with the room light on.

   **What for:** deciding whether the screen is enough light on its own. If it is not,
   even at its brightest, no change to the app can fix that, and a separate
   light is the answer.

5. **Ten minutes.** The phone stays on its stand, facing the card, magnified as
   you left it. You enter the battery percentage, and the countdown starts. Afterwards: whether the picture
   has moved, the battery percentage again, how hard it is to drag the picture
   back to the middle after a nudge to the stand, what a hand moved in front of
   the card a few times does to it, how warm the phone is, whether moving and
   zooming stays smooth, and anything else you noticed. The app records whether
   the screen stayed on.

   **What for:** battery, heat and staying awake, which decide whether the app works in
   everyday use; and whether software to hold the picture steady is worth
   writing. That software would run the whole time and cost battery, so it is
   only written if the picture moves enough to be a nuisance. And in use a hand
   is in the picture most of the time: if the camera blurs or dims the rest
   whenever one comes in, that shows here.

Then press **Send the results**.

## Which phones

A recent iPhone · an older iPhone · a mid-range Samsung · a cheap Android.

If there is only time for two, make one of them the cheapest phone available.

**Android may behave differently enough to need a round of its own.** Chrome
gives the app camera controls that Safari does not, and cheap Android phones are
where the frame rate and the heat will show first. If Android comes out unlike
the iPhones, that is worth a note rather than a workaround: a protocol written
for Android is a better answer than one bent to fit it.
