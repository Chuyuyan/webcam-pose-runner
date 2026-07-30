# Pose Runner

A 3-lane endless runner you play with your body: step sideways to switch lanes, jump in place, crouch to slide. Pose detection (MediaPipe Pose) runs 100% locally in the browser — no server, no video upload.

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

Keyboard mode: ← → switch lanes, ↑ jump, ↓ slide. In camera mode press C to recalibrate.

## Hearts and speed

You start with 3 hearts. Hitting something costs one heart, knocks that obstacle out of the way, and grants 1.4 s of invulnerability so a single train cannot drain the whole bar. 10 s of clean running restores one heart — the next heart to come back fills from the bottom in the HUD as you earn it. The run ends at zero hearts.

Press `P` or `Esc` to pause (`Space` or a jump also resumes). The run also pauses itself when the window loses focus, and in camera mode when you have been out of frame for 2 s — stepping back into frame picks it up again.

Speed ramps from 14 to 36 over the first ~1700 m (about a minute), then keeps creeping toward 48 for as long as you stay alive, so surviving is always what makes it harder. A `SPEED UP` toast fires each time you cross a tier.

Tuning constants live at the top of the script: `MAX_HEARTS`, `REGEN_SECONDS`, `IFRAME_SECONDS`, and the `g.speed` formula in `update()`.

## How the pose control works

- A 2-second calibration records your baseline hip position and torso length (shoulder–hip distance)
- Every threshold is scaled by torso length, so it is invariant to how far you stand from the camera. They live in `poseTh()`:
  - **Jump** — hips rise `0.18 × torso` above baseline **and** are moving up faster than `0.55` torso lengths/second. Height alone is not enough; that is what stops slow drift from faking a jump. It must fall back near the baseline before it can fire again.
  - **Crouch** — the *larger* of the shoulder drop and the hip drop exceeds `0.19 × torso`. Watching hips alone missed bending forward at the waist, which is how a lot of people duck.
  - **Lane switch** — *relative*, not absolute: a sideways move of `0.26 × torso` (~14 cm on a 50 cm torso) shifts you **one** lane, wherever you happen to be standing. Mapping absolute position onto a lane made the zones only ~13 cm wide, so a single long stride crossed two boundaries at once and skipped a lane. After a step fires, the detector waits until you have actually stopped moving before treating your new position as neutral — re-centring immediately would let the back half of the same stride trigger a second change. Stepping out and settling back counts as one change, so you never have to hold a position.
- Landmark x is normalised by frame **width** and y by frame **height**, so on a 4:3 feed a sideways move reads 33% smaller than the same distance vertically. Lateral offsets are multiplied by the aspect ratio before being compared against torso-scaled thresholds — without that correction the lane threshold was silently 33% harder than intended.
- The body centre weights shoulders `0.62` over hips `0.38`, because leaning — the quick, natural way to change lanes — swings the shoulders while the hips barely move.
- **Only the shoulders are required.** Hip landmarks lose confidence whenever the lower-body silhouette is hidden — a long skirt or dress is the everyday case — and demanding them meant the whole frame was thrown away, leaving those players with a game that did nothing at all. When hips are unreliable the detector drops to an upper-body-only mode: the vertical reference becomes the shoulder line, the body centre is taken from the shoulders alone, and the scale reference falls back to shoulder width (`× 1.15`), which clothing never hides.
- Signals are lightly smoothed (EMA, α = 0.6) so a single noisy frame cannot fire an action.
- The baseline **adapts**: while you are settled it drifts toward where you actually are, which absorbs the apparent hip rise you get from simply standing further back. Sideways adaptation is bounded, and only runs while you are centred, so it can never follow you into another lane and strand you there.

## Audio

Everything is synthesised at runtime with WebAudio — there are no audio files. The background track is a four-bar Am–F–C–G loop (warm pad, soft bass, delayed pentatonic pluck, quiet pulse) scheduled a little ahead of the audio clock by its own `setInterval`, deliberately not by the render loop, since `requestAnimationFrame` freezes in a background tab and would kill the music.

The soundtrack belongs to the run: it starts when the run does and stops when you wipe out, so the menu and the game-over screen are silent. Pausing only ducks it, since the run has not actually ended. Every run opens on bar one.

Click the speaker in the bottom-right or press `M` to mute; the choice is remembered in `localStorage`. Browsers only allow audio to start from a user gesture, so the context is woken on the first click or keypress and resumed if it comes back suspended (Safari always does this).

## Debugging

The pose detector can be driven with synthetic landmarks, which is how the thresholds above were tuned without a camera in the loop — `__dbg.handlePose(result, timestampMs)` takes the same shape MediaPipe returns, so you can replay a scripted hop, a slow step backwards, or a sway and count what fires. `__dbg.startCalibration()`, `__dbg.poseTh()` and `__dbg.poseBase()` cover the rest.

The console also exposes `window.__dbg`: `__dbg.step(n)` advances the game loop deterministically frame by frame, and `__dbg.freeze()` halts the live loop so a single frame can be inspected (set `__dbg.phase = 'playing'` to resume). `__dbg.startPlay()` / `doJump()` / `doDuck()` / `setLane(l)` inject inputs directly.
