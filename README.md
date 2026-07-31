# Pose Runner

**[▶ Play it in your browser](https://chuyuyan.github.io/webcam-pose-runner/)** — desktop and a webcam recommended; there is a keyboard fallback if you would rather not turn the camera on.

A 3-lane endless runner you play with your body: step sideways to switch lanes, jump in place, crouch to slide. Pose detection (MediaPipe Pose) runs 100% locally in the browser — **camera frames never leave your device**, and by default the game makes no requests to any server of mine at all.

Accounts are optional and **off by default** (see [Accounts](#accounts-optional)). Even when turned on, the only thing sent is your score — never camera data.

## Run

Single static HTML file; any static host works (the MediaPipe model loads from a CDN, so an internet connection is required):

```sh
python3 serve.py 5175
# open http://localhost:5175
```

Use `serve.py` rather than `python3 -m http.server` while developing: the stdlib server only sends `Last-Modified`, so browsers cache `index.html` heuristically and keep serving a stale build after an edit. `serve.py` is the same server with `Cache-Control: no-store`.

Note: `getUserMedia` requires HTTPS or localhost, so deploy behind HTTPS.

## How to play

| Obstacle | Move |
|---|---|
| Red/white hurdle | Jump over |
| Yellow gate | Crouch and slide under |
| Train | Switch lanes around it |

Coins are worth 5 points each and sometimes arc overhead, so the run pays for jumping through it rather than around it. The teal double-chevron tile grants 7 seconds of **high jump**, which peaks at 3.3 units — above the 2.7 roof of a train, so while it lasts you can **land on top of a train and ride it** until it runs out from under you. Neither pickup ever spawns inside a train: a lane is only used if nothing solid overlaps that stretch.

The player has real vertical physics (gravity, velocity, and whatever surface is underfoot) rather than a fixed jump arc, which is what gives a train roof something to interrupt. A roof only holds you up if you came down onto it from above — without that check, sidestepping into the lane of a train already alongside you teleported you onto its roof instead of hitting its flank, which quietly made the game close to unloseable.

Keyboard mode: ← → switch lanes, ↑ jump, ↓ slide. In camera mode press C to recalibrate.

## Hearts and speed

You start with 3 hearts. Hitting something costs one heart, knocks that obstacle out of the way, and grants 1.4 s of invulnerability so a single train cannot drain the whole bar. 10 s of clean running restores one heart — the next heart to come back fills from the bottom in the HUD as you earn it. The run ends at zero hearts.

Press `P` or `Esc` to pause (`Space` or a jump also resumes). The run also pauses itself when the window loses focus, and in camera mode when you have been out of frame for 2 s — stepping back into frame picks it up again. Losing the pose *while crouching* gets a 7 s grace period instead: on a desk-height webcam a crouch often drops you out of frame entirely, and being accused of wandering off mid-slide is just wrong.

Speed ramps from 14 to 36 over the first ~1700 m (about a minute), then keeps creeping toward 48 for as long as you stay alive, so surviving is always what makes it harder. A `SPEED UP` toast fires each time you cross a tier.

Tuning constants live at the top of the script: `MAX_HEARTS`, `REGEN_SECONDS`, `IFRAME_SECONDS`, and the `g.speed` formula in `update()`.

## How the pose control works

- Calibration asks you to stand inside a target box in the camera preview and holds for 2 seconds of *continuously* good framing — drift out and the count restarts, because a baseline measured while moving is worse than none. Thresholds are torso-scaled so distance never changes what a gesture *means*, but framing still decides how precisely it can be read: too far and the body covers too few pixels, so landmark noise grows relative to torso length; too close and limbs leave the frame and get guessed at; off to one side and there is no symmetric room left to step into.
- It runs the `full` pose model rather than `lite`. A few MB more to download for noticeably steadier landmarks — the lite model's jitter was a real part of why the controls felt imprecise.
- Every threshold is scaled by torso length, so it is invariant to how far you stand from the camera. They live in `poseTh()`:
  - **Jump** — two paths in. The *height* path needs a rise of `0.18 × torso` plus upward motion above `0.55` torso/sec; height alone is not enough, and that is what stops slow drift from faking a jump. But waiting for height is unavoidably late — you have to physically rise ~9 cm first, and a jump *starts* with a dip, so at the actual push-off the rise is still negative. So there is also a *take-off* path that fires on upward speed above `1.8` torso/sec with no height requirement at all. Running on the spot bobs at up to ~0.8 torso/sec while a real take-off reaches 3–4, so the gap is wide enough to trigger on speed alone. Measured latency from the push-off frame: 33 ms for a big hop, 66 ms for a normal one, 99 ms for a gentle one that falls back to the height path. Either way it must fall back near the baseline before it can fire again.
  - **Crouch** — the *larger* of the shoulder drop and the hip drop exceeds `0.19 × torso`. Watching hips alone missed bending forward at the waist, which is how a lot of people duck.
  - **Lane switch** — *relative*, not absolute: a sideways move of `0.26 × torso` (~14 cm on a 50 cm torso) shifts you **one** lane, wherever you happen to be standing. Mapping absolute position onto a lane made the zones only ~13 cm wide, so a single long stride crossed two boundaries at once and skipped a lane. After a step fires, the detector waits until you have actually stopped moving before treating your new position as neutral — re-centring immediately would let the back half of the same stride trigger a second change. Stepping out and settling back counts as one change, so you never have to hold a position.
- Landmark x is normalised by frame **width** and y by frame **height**, so on a 4:3 feed a sideways move reads 33% smaller than the same distance vertically. Lateral offsets are multiplied by the aspect ratio before being compared against torso-scaled thresholds — without that correction the lane threshold was silently 33% harder than intended.
- The body centre weights shoulders `0.62` over hips `0.38`, because leaning — the quick, natural way to change lanes — swings the shoulders while the hips barely move.
- **Only the shoulders are required.** Hip landmarks lose confidence whenever the lower-body silhouette is hidden — a long skirt or dress is the everyday case — and demanding them meant the whole frame was thrown away, leaving those players with a game that did nothing at all. When hips are unreliable the detector drops to an upper-body-only mode: the vertical reference becomes the shoulder line, the body centre is taken from the shoulders alone, and the scale reference falls back to shoulder width (`× 1.15`), which clothing never hides.
- Signals are lightly smoothed (EMA, α = 0.6) so a single noisy frame cannot fire an action.
- The baseline **adapts** toward wherever you are standing once you have held still for 400 ms, which absorbs the apparent hip rise you get from simply standing further back. Note that the trigger is *stillness*, not proximity to the previous baseline: gating on proximity meant that once you settled more than a hair below it — relaxing out of the upright pose you calibrated in — it could never catch up, so jumps needed nearly double the height and a large enough sink left you stuck in a permanent slide, because being stuck also blocked the adaptation that would have fixed it. A crouch adapts at a tenth of the rate so a real slide is not quietly absorbed, unless it has been held past 2.5 s — nobody slides that long, so at that point it is a bad baseline rather than a real crouch and it corrects at full speed.
- Sideways re-centring is owned by the step detector alone; a second source drifting it would fight the one-step-one-lane rule.

## Audio

Everything is synthesised at runtime with WebAudio — there are no audio files. The background track is a four-bar Am–F–C–G loop (warm pad, soft bass, delayed pentatonic pluck, quiet pulse) scheduled a little ahead of the audio clock by its own `setInterval`, deliberately not by the render loop, since `requestAnimationFrame` freezes in a background tab and would kill the music.

The soundtrack belongs to the run: it starts when the run does and stops when you wipe out, so the menu and the game-over screen are silent. Pausing only ducks it, since the run has not actually ended. Every run opens on bar one.

Click the speaker in the bottom-right or press `M` to mute; the choice is remembered in `localStorage`. Browsers only allow audio to start from a user gesture, so the context is woken on the first click or keypress and resumed if it comes back suspended (Safari always does this).

## Accounts (optional)

Out of the box the game is entirely local: your best score lives in
`localStorage` and nothing is sent anywhere.

To add cloud best scores and a global leaderboard, point the game at a
[playkit](https://github.com/Chuyuyan/playkit) server by filling in the meta tag
in `index.html`:

```html
<meta name="playkit-url" content="https://your-playkit-host">
```

With it set, players can optionally sign in; their best score syncs across
devices and the game-over screen shows the top runs. Signed-out players get
exactly the original local-only behaviour.

Only the score is ever transmitted. Pose detection stays on-device regardless.

## Debugging

The pose detector can be driven with synthetic landmarks, which is how the thresholds above were tuned without a camera in the loop — `__dbg.handlePose(result, timestampMs)` takes the same shape MediaPipe returns, so you can replay a scripted hop, a slow step backwards, or a sway and count what fires. `__dbg.startCalibration()`, `__dbg.poseTh()` and `__dbg.poseBase()` cover the rest.

The console also exposes `window.__dbg`: `__dbg.step(n)` advances the game loop deterministically frame by frame, and `__dbg.freeze()` halts the live loop so a single frame can be inspected (set `__dbg.phase = 'playing'` to resume). `__dbg.startPlay()` / `doJump()` / `doDuck()` / `setLane(l)` inject inputs directly.
