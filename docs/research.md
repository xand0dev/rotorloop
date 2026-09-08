# RotorLoop Research Notes

Research synthesized before implementation from independent runtime/timing, tooling/theme and rubric lanes on 2026-09-08.

## 1. JavaScript Runtime

Evidence: a JavaScript agent executes jobs to completion. Promise reactions and queueMicrotask callbacks run at microtask checkpoints; newly queued microtasks are drained too. Timers schedule tasks; they cannot interrupt running code.

Consequence: a synchronous render busy-wait blocks input callbacks and main-thread rendering work. A promise cannot move that work off the thread.

Decision: keep production callbacks short. Explain the order `1, 4, 3, 2` for synchronous logs, a zero-delay timer and a promise. Avoid claiming all CSS/compositor work necessarily freezes, or that JavaScript has no possible parallel agents.

## 2. requestAnimationFrame

Evidence: rAF is one-shot, participates in rendering updates before repaint, usually tracks display refresh and commonly pauses in hidden documents. Timers can be delayed and throttled in the background too.

Consequence: timer callback frequency is not display presentation frequency. Neither 120 FPS nor background timer behavior can be assumed.

Decision: production rAF timestamp drives elapsed time; measure simulation steps and render callbacks over actual seconds. HUD FRAME means the latest callback interval, not CPU drawing time. First callback establishes the baseline. Start/stop are idempotent and use null for no pending request.

## 3. Fixed Timestep

Evidence: an accumulator consumes whole fixed steps and retains a remainder; excessive catch-up causes a spiral of death (Fiedler; Nystrom).

Decision: STEP = 1/60 s is the course's manageable integration cadence. Clamp incoming elapsed time to 0.25 s, bounding catch-up to approximately 15 steps. Rendering can follow zero steps on a fast display or several steps after a slow frame. Time beyond the clamp is deliberately discarded.

Fixed stepping supports repeatability for identical starting state, per-tick inputs, math and update order. It does not alone promise cross-platform lockstep. Near 60 steps per wall second is a normal-load target, not a guarantee while hidden or overloaded. This separation prepares shared client/server simulation without implementing networking now.

## 4. Interpolation

Evidence: alpha = accumulator / STEP is the remainder fraction, in [0,1). Blending previous/current states smooths displays faster than the simulation, with roughly one simulation step of presentation delay.

Decision: pure interpolation for positions and shortest signed angular difference for heading. At an arena wrap, synchronize only the wrapped previous coordinate; this avoids a cross-screen streak at the cost of up to one step of interpolation on that axis. Reset/resize synchronize both snapshots.

## 5. Canvas / DPR

Evidence: backing resolution and CSS display size are distinct. devicePixelRatio can change with zoom or monitors. setTransform overwrites the matrix; repeated scale multiplies it.

Decision: ResizeObserver plus DPR media-query changes resize the backing store; setTransform resets scale explicitly. Simulation receives CSS width/height only. Per-drone save/translate/rotate/draw/restore isolates transforms.

## 6. ES Modules

Evidence: modules have their own scope, strict mode, deferred script execution, live imported bindings, one evaluation per module identity and undefined top-level this.

Decision: .js relative imports with extensions, named exports, package type=module. Vite vanilla and Biome are the only development dependencies; Node's built-in test runner handles pure logic and controlled scheduling. Prefer Node 24 LTS; the inspected host defaults to Node 26.4.0. Vite's documented minimum is Node 20.19+ / 22.12+.

## 7. FPV Theme Mapping

Evidence: Betaflight Rate/Acro controls angular response; throttle is not directly forward translation.

Decision: A/D map to arcade yaw; W supplies forward thrust in a top-down plane. A quad X-frame, four motors and a nose camera communicate heading. Rear prop wash represents the rubric's thrust flame. There is no altitude, pitch/roll, PID controller or 6-DOF model. HUD telemetry is local runtime data, not radio RSSI or battery measurements.

## 8. Architecture Decisions

Input closure → fixed simulation → previous/current → interpolation → Canvas. main wires lifecycle; loop owns scheduling; sim owns pure ship/arena math; render owns pixels.

Initial tuning: turn 3 rad/s, thrust 480 px/s², drag 1.2 s⁻¹, max speed 340 px/s. Use semi-implicit Euler position update with exponential damping. Test real controls before recording final tuning.

Experiments use one known-good baseline and separate worktrees. Record raw deltas, environment, visibility, wall/simulation times and positions. The literal five-second browser experiment is separate from an exact 300-step determinism comparison. Variable exact-time comparison truncates its final dt to five simulated seconds. Large experimental bounds avoid hiding divergence through wrap. CPU 6× must be real or explicitly reported unavailable; controlled cadence probes are supplementary only.

## 9. Lab Requirement Matrix

| Requirement | Implementation | Validation / evidence |
| --- | --- | --- |
| Vite vanilla, ESM, Biome, Node version | package.json, index.html, .nvmrc, biome.json | install, check, build |
| rAF, fixed 60 Hz, clamped accumulator, alpha | src/loop.js | controlled 60/120 Hz timestamps, long stall, browser |
| start/stop and measured steps/s, frames/s, frame time | loop + drawHud | scheduling tests, actual browser HUD |
| Closure input, isDown, justPressed | src/input.js | repeat/blur tests and R reset demo |
| Plain state, pure rotation/thrust/drag/speed clamp | src/sim/ship.js | frozen inputs, 300 steps, speed tests |
| Arena wrap | src/sim/arena.js | both axes, negative coordinates, browser |
| Previous/current interpolation, shortest angle | sim/arena + render/draw | ±179°, wrap snapshot tests |
| Responsive DPR Canvas | src/render/canvas.js | repeated resize, DPR/transform checks |
| Flyable drone, thrust flame equivalent, visual reference | drawShip + arena grid | screenshots, controls smoke |
| Blocking experiment | isolated worktree | actual raw intervals, README numbers/explanation |
| setInterval experiment, 10 s foreground, 5 s background | isolated worktree | rate/jitter/visibility evidence |
| Variable dt, five-second thrust, 6× CPU, fixed comparison | isolated worktree | four runs, position differences, capability limitations |
| Explain event loop, scope, modules, closures | README + defense | all eight Reflection answers |
| Small tests, clean validation | test directory + scripts | check/test/build logs |
| Independent engineering/rubric reviews | docs/review.md | findings, fixes and requirement statuses |
| Public repository + lab-01 tag | Git/GitHub | verified tag target; auth limitation if blocked |

## Sources

- MDN, execution model: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model
- MDN, microtasks: https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide
- Jake Archibald, Tasks, microtasks, queues and schedules: https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/
- MDN, requestAnimationFrame: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- MDN, setInterval: https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval
- MDN, Page Visibility: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- Glenn Fiedler, Fix Your Timestep!: https://gafferongames.com/post/fix_your_timestep/
- Robert Nystrom, Game Loop: https://gameprogrammingpatterns.com/game-loop.html
- MDN, devicePixelRatio: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- MDN, setTransform: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setTransform
- MDN, modules: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- Vite guide: https://vite.dev/guide/
- Biome getting started: https://biomejs.dev/guides/getting-started/
- Node release table: https://nodejs.org/en/about/previous-releases
- Betaflight setup / modes / telemetry: https://betaflight.com/docs/wiki/getting-started/setup-guide ; https://betaflight.com/docs/wiki/guides/current/Modes ; https://betaflight.com/docs/wiki/guides/current/Telemetry
- Course lab: https://github.com/rmalkevy/Programming-Practice-Projects/blob/main/courses/javascript/lab-01-event-loop-and-game-loop.md
