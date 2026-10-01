# Mirror — device tests

**https://testmirror.netlify.app/test**

Mirror turns a phone into a lighted mirror. It shows the camera live and
mirrored, lets you zoom and move the picture with your fingers, keeps the screen
awake, and turns the edge of the screen into a white light frame. It installs to
the home screen and works without a network.

The app is built. What is left is finding out how it behaves on real phones, at a
real distance, in a real room — and a few of those answers decide what gets built
next.

**Please run this on as many phones as you can.** The differences between devices
are the point: a new iPhone passes almost everything, and whatever gets settled on
has to work on the cheapest phone in the set, not the best one.

## How to do it

Open **https://testmirror.netlify.app/test** on the phone and work through it.

The page asks one thing at a time, and sets the mirror up for each question
itself — it puts the picture at the right magnification, switches the camera
between its two quality settings, turns the light up for the light question, and
runs the ten-minute clock. There are no settings to find and no links to
remember.

It also records everything it can read off the camera by itself: what the camera
is capable of, what it settled on, the frame rate it counted, and how much camera
detail there is behind each screen pixel. None of that has to be copied down.

What you answer is what the app cannot see: whether the picture flickered,
whether you could read the card, whether there was enough light, whether it
stayed still.

At the very end it shows you everything it is about to send, and sends it in one
go when you press the button.

### Two things to know before you start

**It takes about twenty minutes**, most of it the ten-minute wait, and you need
to be able to darken the room for one of the questions.

**Do not reload the page.** Nothing is stored anywhere — not on the phone, not in
the browser — so a reload loses every answer and you start again from the top.
That is deliberate: the app keeps nothing.

### What you need

- The printed test card. **Do not photocopy or rescale it** — the sizes printed
  on it are what the measurements mean. Printing it is covered in
  `ONE-OFF-CHECKS.md`, and one correctly printed card serves everyone.
- Something to stand the card up, and something to stand the phone on.
- A room you can darken.

## What it asks

So you know what is coming, in order:

1. **Which phone this is.**
2. **Starting the camera.** A second or two in, the app asks the camera for a
   better quality setting. On the phones tried so far that is invisible. Whether
   you see a flicker is the question.
3. **Can it focus?** The card at 30, 35 and 45 cm. Many front cameras cannot
   focus at all, so some distances being soft is an ordinary result.
4. **The card, four times over.** Bars and text, each at the better camera
   setting and again at the lower one. The app switches between them; the card
   stays at 35 cm. Four answers, same card, four conditions.
5. **Light.** The white frame at its widest, in the dark and then with the room
   light on.
6. **Ten minutes.** Note the battery percentage, put the phone down, leave it
   alone. The point is whether it keeps itself awake, what it costs in battery,
   and how warm it gets.
7. **Does the picture stay still?** The phone on a stand, left alone, then
   nudged, then with a hand in front of it.
8. **Anything else.** Free text, in any language. Anything that surprised you is
   worth more here than a blank box.

## Which phones

A recent iPhone · an older iPhone · a mid-range Samsung · a cheap Android.

If there is only time for two, make one of them the cheapest phone available.

**Android may behave differently enough to need a round of its own.** Chrome
gives the app camera controls that Safari does not, and cheap Android phones are
where the frame rate and the heat will show first. If Android comes out unlike
the iPhones, that is worth a note rather than a workaround — a protocol written
for Android is a better answer than one bent to fit it.

## What these answers decide

Three questions are genuinely open. Nobody has decided them yet, and these runs
are what will.

**Is the picture good enough to be useful?**
If the card reads the same at both camera settings, the better one is doing
nothing and gets switched off — it costs battery and warmth for no visible gain.
If the picture is too blurred at the highest magnification, the magnification
gets reduced to wherever it stays readable.

**Is the screen enough light on its own?**
If it is, the app is the whole product. If it is not, even at its brightest, then
no amount of programming fixes it and the answer becomes something physical with
its own light. That is a different kind of decision, and it is better made from
your answers than from a guess.

**Does the picture need holding still?**
Software that holds the picture steady by itself can be written, but it would run
the whole time the mirror is on, shorten the battery and warm the phone. That is
only a fair trade if the picture moves enough to actually bother someone. If it
sits still on a stand, it does not get written.

Alongside those: if a phone gets hot, or the quality upgrade gives up, or the
picture flickers when it switches — each of those changes something concrete, and
the app records enough detail to say what.

## Still being decided

These are open too, and your experience with the app counts towards them as much
as anyone's:

- The name and the branding.
- The maximum magnification, pending the card results.
- Whether the Hungarian text stays in the formal register. It currently does.
