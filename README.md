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

Coins are worth 5 points each and sometimes arc overhead, so the run pays for jumping through it rather than around it. The winged boot grants 7 seconds of **high jump**, which peaks at 3.3 units — above the 2.7 roof of a train, so while it lasts you can **land on top of a train and ride it** until it runs out from under you. Its cooldown is measured in seconds rather than distance: a distance gate keeps shrinking in real terms as the run speeds up, which is why the pickup kept creeping back to feeling constant however far the gate was pushed out.

Coins are kept out of solid obstacles from both directions. A lane is only used if nothing solid already overlaps that stretch, and because a coin run is up to twelve units long and a train generated afterwards can still land on top of one, buried pickups are swept out again every time new obstacles appear.

The camera rises with you. It follows about half your height and lags behind, so a jump still reads as *you* going up rather than the world dropping away. Raising the camera pushes ground features down the screen by an amount that scales with their projection — the road under your feet swings out and down, distant buildings barely move, and the horizon holds still. That parallax is what sells the lift; translating the whole image would just look like a pan.

The player has real vertical physics (gravity, velocity, and whatever surface is underfoot) rather than a fixed jump arc, which is what gives a train roof something to interrupt. A roof only holds you up if you came down onto it from above — without that check, sidestepping into the lane of a train already alongside you teleported you onto its roof instead of hitting its flank, which quietly made the game close to unloseable.

Keyboard mode: ← → switch lanes, ↑ jump, ↓ slide. In camera mode press C to recalibrate.

## The world

Buildings and trees line both sides of the road, placed in blocks rather than an even sprinkle so the run passes through city and through parkland. A single body crosses the sky, sinks, and comes back up as the other one — moon, then sun, then moon — over about two minutes of running. Everything else tints off how high the sun is, so the sky, the skyline, the ground and the scenery all change together rather than a disc changing on its own.

## The wrap-up

Dying no longer drops you straight back into a run. The summary is a separate scene with its own turntable projection: the robot is built in body space and genuinely rotated about its vertical axis, painted back to front by depth. Orbiting the *game* camera instead would swing half the world behind the near plane and come apart, but the summary has only one thing in it, so it can be done properly.

Parts carry real depth as well as width — a turntable folds anything sitting at zero depth into a vertical line at side-on angles, which is what the first version did. The torso is projected as a box, the legs are staggered one foot forward, and the visor only appears while the head is actually facing you.

Input is locked for 1.4 s so the wrap-up is seen rather than skipped by a key that was already held down. The button is armed from the same clock the key handler checks: on a wall-clock timeout it went live while the animation clock was stalled in a background tab, leaving a button that looked clickable and did nothing.

## Hearts and speed

You start with 3 hearts. Hitting something costs one heart, knocks that obstacle out of the way, and grants 1.4 s of invulnerability so a single train cannot drain the whole bar. 10 s of clean running restores one heart — the next heart to come back fills from the bottom in the HUD as you earn it. The run ends at zero hearts.

## The chase

A cat is on your heels from the first stride, and comes back every so often after that. Hitting an obstacle now costs pace as well as a heart — 20% slower for 1.8 s — and the cat only gains ground while you are slowed, so running clean is always safe and every stumble is what lets it close in. One stumble takes the gap from 9 to 3.3; a second one gets you caught. Being caught costs a heart and the cat, satisfied, wanders off. It does not end the run: a single mistake shouldn't be able to cascade straight into death. Stay clean and it gives up after 15 seconds.

The gap moves at fixed rates rather than as a fraction of your speed. Tying it to speed made the chase limp early in a run and vicious later, and it left the two numbers that actually matter — how long it takes to shake it, how much a stumble costs — impossible to set directly.

The camera sits 6 units behind you, so anything trailing by more than about 2 is literally behind it and cannot be projected at all. The cat's drawn depth is compressed into the sliver that *is* visible and its real distance is carried by its size, so it grows as it closes rather than being watchable from far off. It is drawn from behind, with flat tones lit from the upper left the same way the trains get their volume — it is chasing you and the camera is further back still, so its back is genuinely what faces us. The tail up, the tabby bars across the back and the driving hind legs are what make it read as a cat without a face to help. The head is almost entirely buried behind the raised back, with only the ears and a sliver of crown clearing the shoulders — drawing a whole disc up there just rebuilds a face however carefully it is shaded, since two bumps on a circle is all anyone needs to see one. Standing on the road this close to the camera would also put its feet below the bottom edge, so it is lifted clear with its contact shadow riding along to keep it grounded.

Press `P` or `Esc` to pause (`Space` or a jump also resumes). The run also pauses itself when the window loses focus, and in camera mode when you have been out of frame for 2 s — stepping back into frame picks it up again. Losing the pose *while crouching* gets a 7 s grace period instead: on a desk-height webcam a crouch often drops you out of frame entirely, and being accused of wandering off mid-slide is just wrong.

Speed ramps from 14 to 36 over the first ~1700 m (about a minute), then keeps creeping toward 48 for as long as you stay alive, so surviving is always what makes it harder. A `SPEED UP` toast fires each time you cross a tier.

Tuning constants live at the top of the script: `MAX_HEARTS`, `REGEN_SECONDS`, `IFRAME_SECONDS`, and the `g.speed` formula in `update()`.

## How the pose control works

- Calibration asks you to stand inside a target box in the camera preview and holds for 2 seconds of *continuously* good framing — drift out and the count restarts, because a baseline measured while moving is worse than none. Thresholds are scale-normalised so distance never changes what a gesture *means*, but framing still decides how precisely it can be read: too far and the body covers too few pixels, so landmark noise grows relative to body size; too close and limbs leave the frame and get guessed at; off to one side and there is no symmetric room left to step into.
- It runs the `full` pose model rather than `lite`. A few MB more to download for noticeably steadier landmarks — the lite model's jitter was a real part of why the controls felt imprecise.
- Thresholds are plain constants in shoulder-widths, because the signals are already divided by apparent body size. They live in `poseTh()`:
  - **Jump** — two paths in. The *height* path needs a rise of `0.21` shoulder-widths plus upward motion above `0.62` shoulder-widths/sec; height alone is not enough, and that is what stops slow drift from faking a jump. But waiting for height is unavoidably late — you have to physically rise ~9 cm first, and a jump *starts* with a dip, so at the actual push-off the rise is still negative. So there is also a *take-off* path that fires on upward speed above `2.0` shoulder-widths/sec with no height requirement at all. Running on the spot bobs at up to ~0.9 shoulder-widths/sec while a real take-off reaches 3–5, so the gap is wide enough to trigger on speed alone. Measured latency from the push-off frame: 33 ms for a big hop, 66 ms for a normal one, 99 ms for a gentle one that falls back to the height path. Either way it must fall back near the baseline before it can fire again.
  - **Crouch** — the *larger* of the shoulder drop and the hip drop exceeds `0.24` shoulder-widths **and holds for 120 ms**, and it is abandoned outright if upward speed appears. Watching hips alone missed bending forward at the waist, which is how a lot of people duck. The hold matters because a jump *begins* by sinking to load the legs, and that dip is as deep as a shallow crouch: committing on the first frame over the line read every jump as a crouch, and then poisoned the no-jump-after-crouch guard so the jump the dip was preparing got blocked as well. A crouch is a posture you hold; a loading dip lasts a tenth of a second and turns straight into upward speed. Costs about 200 ms of latency to enter, releases in one frame.
  - **Lane switch** — *relative*, not absolute: a sideways move of `0.34` shoulder-widths shifts you **one** lane, wherever you happen to be standing. Mapping absolute position onto a lane made the zones only ~13 cm wide, so a single long stride crossed two boundaries at once and skipped a lane. After a step fires, the neutral point moves to the crossing itself so the back half of that stride cannot take a second lane, and re-arms on the *deceleration* between steps rather than on standing still — two brisk steps in a row have no still moment in them, and demanding one swallowed the second step entirely. It re-arms against the instantaneous position, not the smoothed one, because the filter is still converging at that moment and the rest of that convergence looks exactly like a fresh step. Your position maps to your lane: step back the other way to return, stand still to stay put. Strides beyond about two shoulder-widths do move two lanes, which at roughly 80 cm is a leap rather than a step.
- **Everything is measured from the optical axis and divided by apparent shoulder width.** A webcam is a perspective projection: step away from it and your shoulders, which sit above the axis, slide *down* the frame while your hips slide up — which is exactly what crouching looks like to a detector watching raw positions. Under this normalisation the offset and the scale shrink by the same factor when you move and cancel out, while a real crouch lowers the body without narrowing the shoulders. Measured with a waist-height camera, backing off by 35% used to produce a shoulder drop 1.8× over the crouch threshold; it now produces nothing, and the lane trigger sits at an identical 0.27 shoulder-widths whether you stand near, mid or far.
- Shoulder width is the scale reference rather than shoulder-to-hip, because crouching shortens the torso in frame — a torso-based scale moves for the very posture it is meant to measure. It is smoothed as lightly as the offsets, since a slow filter would lag behind a quick step backwards and reintroduce the same desync.
- Landmark x is normalised by frame **width** and y by frame **height**, so on a 4:3 feed a sideways move reads 33% smaller than the same distance vertically. Lateral offsets are multiplied by the aspect ratio before use — without that correction the lane threshold was silently 33% harder than intended.
- The body centre weights shoulders `0.62` over hips `0.38`, because leaning — the quick, natural way to change lanes — swings the shoulders while the hips barely move.
- **Only the shoulders are required.** Hip landmarks lose confidence whenever the lower-body silhouette is hidden — a long skirt or dress is the everyday case — and demanding them meant the whole frame was thrown away, leaving those players with a game that did nothing at all. When hips are unreliable the detector drops to an upper-body-only mode: the vertical reference becomes the shoulder line, the body centre is taken from the shoulders alone, and the scale reference falls back to shoulder width (`× 1.15`), which clothing never hides.
- Signals are lightly smoothed (EMA, α = 0.6) so a single noisy frame cannot fire an action, and a trigger must hold for two frames before it counts.
- **Velocities are differentiated from the raw positions and only then divided by the scale.** Differentiating the normalised ratio instead drags in a d(scale)/dt term whose size grows with how far you sit from the optical axis — with a low camera a 1% wobble in apparent shoulder width was manufacturing a take-off out of nothing.
- The scale itself is a **median** of the last five samples rather than an average. Every signal is divided by it, so one bad frame lands on all of them at once; a median discards spikes outright, where an average folds them in and then lags behind real movement as the price.
- Thresholds sit between the measured signal and the measured noise, not on top of either: a vigorous run-in-place bob peaks at about 0.21 shoulder-widths and 2.1 shoulder-widths/sec, and a real hop clears 0.6 and 4.2, so the gates are at 0.32 and 2.9. Putting the height gate on 0.21 is what made jogging on the spot fire a jump every few seconds.
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
