# RotorLoop — FPV Drone Arena

Fly a quadcopter. See the difference between a simulation tick and a rendered frame.

**Lab 01 · JavaScript · Canvas 2D · fixed 60 Hz simulation**

[Український звіт](docs/report.uk.md) · [Підготовка до захисту](docs/defense.md) · [Raw measurements](docs/evidence/RESULTS.md) · [Research & requirement matrix](docs/research.md)

![RotorLoop running in Chrome](docs/evidence/production.png)

## Start here: a 90-second review

1. **0–25 s:** fly with W and A/D; cross an edge. Watch SIM and DISPLAY count different work.
2. **25–40 s:** hold R, then add W while still holding R. Reset happens once; flight continues. Lose focus and return: no stuck thrust.
3. **40–55 s:** point at the live α strip. It is the accumulator remainder, used to blend previous/current snapshots.
4. **55–70 s:** open [loop.js](src/loop.js). Find the clamp, fixed-step while loop and alpha. The entire production scheduler fits in one small module.
5. **70–90 s:** compare the measurements below. Explain why p95 misses the busy-wait and why genuine CPU 6× barely changed this scene's FPS.

## Run

Use Node 24 (`.nvmrc`; validated on 24.20.0).

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open the local URL printed by Vite. Without nvm, use any existing Node 24 installation. `npm run build` creates `dist/`; `npm run preview` serves that build. No backend or account is needed to play.

| Key | Action |
| --- | --- |
| W / ↑ | Arcade forward thrust |
| A / ←, D / → | Yaw left / right |
| R | Reset once per press |

Click the arena to focus. Keyboard controls require a keyboard; the layout resizes to narrow viewports but does not implement the optional touch/gamepad stretch tasks.

## What is deliberately small

The drone is a Canvas X-frame with four motors, an orange nose camera and a rear thrust wash. The landing ring and grid make motion legible. This is a 2D arcade model, not a six-degree-of-freedom FPV simulator: actual multicopter throttle is not forward translation. No fake battery or radio statistics are shown.

There are no runtime libraries, generated image assets, frameworks or physics engines. Vite and Biome are pinned development dependencies. Lab 02–08 features are intentionally absent.

## Two clocks, one simulation

```text
keyboard events → private input Sets
                         ↓
rAF timestamp → accumulator → simulate(1/60), zero or more times
                         ↓
                  previous / current
                         ↓ alpha
               interpolated Canvas frame
```

| Boundary | Responsibility |
| --- | --- |
| [main.js](src/main.js) | Connect input, snapshots, reset, arena and rendering; clean up hot reload |
| [loop.js](src/loop.js) | rAF ownership, start/stop, clamp, accumulator and measured statistics |
| [input.js](src/input.js) | Closure state; held vs consuming press edges; repeat/focus cleanup |
| [sim](src/sim) | Immutable plain-data ship integration and arena math, without DOM or Canvas |
| [render](src/render) | Canvas transforms, CSS-pixel/DPR boundary, interpolation and drawing |

`createLoop({ step = 1/60, simulate, render })` returns `start`, `stop`, `getStats`. `integrate(ship, { turn, thrust }, dt)` returns a new `{ x, y, vx, vy, angle, thrust }`. Rendering never advances physics.

SIM and DISPLAY divide actual counts by elapsed time; FRAME is the latest callback interval, **not drawing CPU time**. DISPLAY counts render callbacks, not independently verified physical presentations. The alpha strip shows the actual accumulator fraction and is omitted on narrow layouts.

The incoming frame delta is capped at 0.25 s. Whole fixed steps consume the accumulator; the fractional remainder becomes alpha. Near 60 steps/s is the normal-load target. Hidden tabs and discarded time cannot be promised 60 steps per wall second. Interpolation adds approximately one simulation tick of presentation delay.

## Decisions worth asking about

| Problem | Chosen solution | Tradeoff / proof |
| --- | --- | --- |
| Repeated start or restart inside a callback | Idempotent lifecycle plus run generation token | A reviewer reproduced two pending rAF callbacks before the fix; regression tests cover render and simulate restart |
| +179° to −179° | Shortest signed angular difference | Midpoint follows the 2° path; frozen-snapshot renderer test |
| Right edge → left edge | Synchronize the crossed previous coordinate | Avoids a cross-arena streak; sacrifices interpolation for one tick on that axis |
| Retina / monitor changes | CSS world, DPR backing store, absolute setTransform | Resize and DPR-only browser checks; density fallback performs no layout read on ordinary frames |
| Lost keyup after focus change | Clear private input Sets on blur/hidden | Browser and unit checks; R consumes one edge, not keyboard repeat |
| “Same position after five seconds” | Record both clocks, then compare exactly 300 fixed ticks | Separates scheduler endpoints from integration sensitivity |

## Physics tuning

Update order: yaw → acceleration along heading → exponential drag → speed clamp → position using the updated velocity (semi-implicit Euler).

| Constant | Final value | Reason |
| --- | ---: | --- |
| TURN_RATE | 3 rad/s | A full yaw turn takes about 2.09 s; easy to steer with short taps |
| THRUST_ACCELERATION | 480 CSS px/s² | Builds visible speed without teleporting on input |
| DRAG | 1.2 s⁻¹ | Velocity halves in about 0.58 s when coasting; drift remains visible |
| MAX_SPEED | 340 CSS px/s | At 60 Hz, movement stays below 5.67 px per tick |

The planned constants were retained after the actual keyboard smoke: thrust, yaw, coast, reset and wrapping behaved coherently. No unsupported claim of extensive human playtesting is made. Exponential damping is time-based; the complete acceleration/position integrator still has numerical timestep error.

## Experiment 1 — block the main thread

| Run | Callbacks/s | Mean ms | SD ms | p95 ms | p99 ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rAF baseline | 120.01 | 8.333 | 0.355 | 9.10 | 9.30 | 10.30 |
| 100 ms block / 60 renders | 101.79 | 9.825 | 11.797 | 9.30 | 100.30 | 100.50 |

![Measured frame intervals](docs/evidence/frame-times.svg)

A once-per-60-frame busy-wait barely moves p95; it dramatically moves p99 and maximum. Main-thread callbacks run to completion: promises, timers and more rAF requests cannot preempt this work. Input callback delay is expected from that mechanism; it was not separately latency-timed. Production contains no busy-wait.

The final HUD sampling window also reacted: baseline **SIM 59.506, DISPLAY 120.004, FRAME 8.3 ms**; blocked **SIM 60, DISPLAY 98, FRAME 99.9 ms**. These short-window readings differ from the full-run averages above. Catch-up preserved the normal simulation cadence while rendering stalled.

## Experiment 2 — setInterval versus rAF

| Run | Callbacks/s | Mean ms | SD ms | p95 ms | p99 ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rAF foreground | 120.01 | 8.333 | 0.355 | 9.10 | 9.30 | 10.30 |
| setInterval(16) foreground | 62.50 | 16.000 | 0.664 | 17.10 | 17.30 | 17.50 |

During real ~5-second hidden-tab runs, rAF's largest interval was **5032.9 ms**; the timer's was **1000.3 ms**. This Chrome paused rAF and throttled timers. A timer is not aligned to rendering opportunities; 16 ms requests 62.5 callbacks/s, not exactly 60. rAF adapts to the observed display cadence.

## Experiment 3 — variable versus fixed timestep

Real Chrome DevTools CPU throttling, reproducible thrust, five-second wall-time runs:

| Run | Final x | Final y | Steps | Simulated s | Wall s |
| --- | ---: | ---: | ---: | ---: | ---: |
| variable wall-time CPU 1x | 1614.301372 | 300.000000 | 601 | 5.009200 | 5.007300 |
| variable wall-time CPU 6x | 1613.789824 | 300.000000 | 597 | 5.007600 | 5.001300 |
| fixed wall-time CPU 1x | 1610.784130 | 300.000000 | 300 | 5.000000 | 5.004100 |
| fixed wall-time CPU 6x | 1610.784130 | 300.000000 | 300 | 5.000000 | 5.004000 |

Variable normal/throttled distance: **0.511548 px**; fixed: **0.000000 px**. The wall-time endpoints differ slightly, so this alone is not a clean numerical comparison.

At **exactly five simulated seconds**, variable normal/throttled x was **1611.173389 / 1611.217935**, a **0.044546 px** difference. Fixed x was **1610.784130** in both runs after **300 ticks**. All y values were 300.

CPU 6× kept this lightweight scene near 120 callbacks/s. That is why its measured divergence was small. A separately labeled **35 ms render-work probe** reduced cadence to about 28.45 callbacks/s: variable x changed by **1.424528 px** relative to the normal exact-time run; fixed changed by **0.000000 px**. The probe is not presented as a DevTools result.

[Full tables, environment, raw samples and repeat procedure](docs/evidence/RESULTS.md). Experiments use isolated worktrees; only evidence and documentation enter production.

## JavaScript concepts demonstrated

- Tasks and microtasks: synchronous logs, Promise reactions and timers produce `1, 4, 3, 2`; a microtask chain can starve rendering.
- rAF participates in browser rendering updates before repaint; it is neither a timer task nor a microtask.
- ESM provides explicit dependencies, module scope, strict mode, live bindings and deferred module scripts; top-level `this` is undefined.
- Closures retain access to the private input Sets. `const` protects the binding, not the Set's contents; `let` is used only for reassignment.
- Canvas draws locally with save/translate/rotate/restore. Physics is in CSS pixels; DPR is a backing-resolution concern.
- Repeatability requires the same state, per-tick inputs, math and tick count. Fixed dt does not alone guarantee universal cross-platform lockstep.

The [Ukrainian defense notes](docs/defense.md) answer all eight Reflection questions with code-specific examples. [Research notes](docs/research.md) link the primary sources and full requirement matrix.

## Validation and review

```sh
npm run check
npm test
npm run build
```

Validated on Node 24.20.0: **16 tests passed**, Biome clean, production build passed. Browser checks covered thrust/yaw, held R, wrapping, focus loss, repeat resize, DPR 1/2 and console errors. Actual smoke HUD: 60 steps/s and 120 render callbacks/s. Synthetic 60/120 Hz scheduler tests are labeled tests, not hardware evidence.

[Independent review and fixes](docs/review.md) · [Browser evidence](docs/evidence/browser-smoke.json)

## Lab checklist

- [x] Vite vanilla, type=module, pinned Biome, .nvmrc
- [x] rAF, clamped fixed-step accumulator, measured HUD
- [x] Closure input with isDown / justPressed
- [x] Pure ship integration, rotation, thrust, drag, speed clamp and wrap
- [x] Previous/current interpolation, short angle path, DPR and resizing
- [x] Three measured experiments and event-loop explanations
- [x] English README, Ukrainian report and all Reflection answers
- [x] Unit tests, browser evidence and independent review

Release verification: `git show lab-01 --stat` and `git rev-parse lab-01^{commit} HEAD` must identify the final validated release. See the GitHub repository's `lab-01` tag for the submission snapshot.
