# Audio Asset Guide

Cafe Chaos now supports real audio files for both music and sound effects.

## Where To Put Files

- Music files go in `assets/audio/music/`
- Sound effects go in `assets/audio/sfx/`

Supported formats:

- `.mp3`
- `.ogg`
- `.wav`
- `.m4a`

## Music

Drop any number of music tracks into `assets/audio/music/`.

Recommended:

- 2 to 5 songs to start
- 60 to 150 seconds each
- seamless or gentle endings work best
- cafe / cozy / upbeat / arcade / lo-fi / jazzy instrumentals fit well

How it works:

- tracks are loaded automatically
- they play in alphabetical order
- when one ends, the game moves to the next song
- if there are multiple songs, the `NEXT SONG` button appears in the UI

Suggested filenames:

- `cafe-loop-01.mp3`
- `cafe-loop-02.mp3`
- `rush-hour-01.mp3`

## Sound Effects

Put these exact filenames in `assets/audio/sfx/` if you want them to override the built-in generated sounds.

The game will use the file when it exists and fall back to the current synth sound when it does not.

### Required filenames and recommendations

- `pickup.mp3`
  - for picking up cups or items
  - 0.10 to 0.30 seconds
  - light pop / grab / click

- `putdown.mp3`
  - for placing cups on counters
  - 0.12 to 0.35 seconds
  - soft set-down / ceramic tap

- `add.mp3`
  - for instant ingredients like milk, foam, ice, caramel, matcha, berry
  - 0.10 to 0.35 seconds
  - quick pour / squeeze / plop

- `process.mp3`
  - for starting a timed station action
  - 0.20 to 0.80 seconds
  - machine start / steam start / brew trigger

- `done.mp3`
  - for when a timed station finishes
  - 0.25 to 1.00 seconds
  - bell / chime / machine-ready sound

- `serve.mp3`
  - for serving a correct drink
  - 0.30 to 1.20 seconds
  - rewarding success sting

- `combo.mp3`
  - for combo serves
  - 0.50 to 1.80 seconds
  - bigger celebratory sting

- `fail.mp3`
  - for wrong drink / no order / bad action
  - 0.20 to 0.80 seconds
  - soft error / cartoon fail / not too harsh

- `trash.mp3`
  - for trashing a drink
  - 0.15 to 0.60 seconds
  - dump / crumple / toss

- `step.mp3`
  - for footsteps while moving
  - 0.05 to 0.18 seconds
  - tiny soft step, not heavy

- `warn.mp3`
  - for order urgency / mistakes
  - 0.25 to 0.90 seconds
  - short alert tone

- `tick.mp3`
  - for final countdown ticking
  - 0.05 to 0.20 seconds
  - crisp clock tick

- `neworder.mp3`
  - for incoming customer orders
  - 0.30 to 1.20 seconds
  - receipt bell / order-up chime

## Nice Real-World SFX Ideas

If you want themed sounds, these are good targets:

- `process.mp3`
  - espresso machine start
  - steam wand burst
  - tea steep start

- `done.mp3`
  - espresso machine finish beep
  - cafe bell ding

- `add.mp3`
  - milk pour
  - syrup squeeze
  - ice drop

- `serve.mp3`
  - satisfying register ding
  - happy cafe success sting

- `pickup.mp3` / `putdown.mp3`
  - ceramic cup taps

## Audio Style Tips

- keep SFX dry and punchy
- avoid long tails on frequent sounds
- normalize volumes so one file is not way louder than the others
- keep music instrumental if possible so the UI and action remain clear

## Toggles In Game

The game now has:

- music on/off toggle
- sfx on/off toggle
- next song button when multiple music tracks exist
