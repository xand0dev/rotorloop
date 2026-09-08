# Measured results — 2026-09-08

Chrome 152.0.7977.77 / V8 15.2.124.19 on macOS. These are actual browser callback measurements, not simulated refresh-rate values or promises about physical presentation. Timing runs used the default 1100 × 713 CSS-pixel viewport at DPR 2; verify each run's environment in its JSON. The separate responsive smoke also uses emulated DPR 1 and 2. One measurement page was active at a time; other test/game rendering was stopped or hidden.

Physics and scheduler baseline: `18d6167`. The block worktree's Canvas/HUD also contains the subsequently tested DPR/alpha changes from `1cb1f03`; these do not alter the integrator or scheduler. Each fixture imports its worktree's real loop and ship modules. Loop variants are preserved as text in [reproduce](reproduce/README.md).

## Blocking

| Run | Callbacks/s | Mean ms | SD ms | p95 ms | p99 ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rAF baseline | 120.01 | 8.333 | 0.355 | 9.10 | 9.30 | 10.30 |
| 100 ms block / 60 renders | 101.79 | 9.825 | 11.797 | 9.30 | 100.30 | 100.50 |

![Raw frame intervals](frame-times.svg)

The callback interval spikes confirm the main-thread stalls. p95 largely misses an event occurring once per 60 renders; p99 and maximum expose it. The frozen game and delayed input callbacks follow from run-to-completion. Keyboard input latency was not independently timed during the busy-wait. A compositor-only animation elsewhere is not guaranteed to freeze.

Final measured HUD window: baseline SIM **59.506 steps/s**, DISPLAY **120.004 callback/s**, FRAME **8.3 ms**; blocked SIM **60 steps/s**, DISPLAY **98 callback/s**, FRAME **99.9 ms**. These are the raw final `stats` values rounded for reading, not full-run averages. The fixed accumulator catches up after each 100 ms stall.

## Timer and visibility

| Run | Callbacks/s | Mean ms | SD ms | p95 ms | p99 ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rAF foreground | 120.01 | 8.333 | 0.355 | 9.10 | 9.30 | 10.30 |
| setInterval(16) foreground | 62.50 | 16.000 | 0.664 | 17.10 | 17.30 | 17.50 |

The requested 16 ms timer produced 62.50 callbacks/s, not 60 or the observed rAF cadence. Timer intervals had higher standard deviation here.

| Scheduler | Hidden duration (s) | Largest callback interval (ms) | Simulation steps over entire ~7 s run |
| --- | ---: | ---: | ---: |
| rAF | 5.026 | 5032.9 | 136 |
| setInterval | 5.027 | 1000.3 | 202 |

Both visibility transitions were recorded from the actual document. rAF paused for the hidden period; this Chrome throttled the timer toward one-second intervals. The production clamp intentionally discarded most of the large elapsed intervals. Background timer behavior is browser policy, not a portable guarantee.

## Five-second thrust: literal wall-time runs

| Run | Final x | Final y | Steps | Simulated s | Wall s |
| --- | ---: | ---: | ---: | ---: | ---: |
| variable wall-time CPU 1x | 1614.301372 | 300.000000 | 601 | 5.009200 | 5.007300 |
| variable wall-time CPU 6x | 1613.789824 | 300.000000 | 597 | 5.007600 | 5.001300 |
| fixed wall-time CPU 1x | 1610.784130 | 300.000000 | 300 | 5.000000 | 5.004100 |
| fixed wall-time CPU 6x | 1610.784130 | 300.000000 | 300 | 5.000000 | 5.004000 |

Initial state: x=100, y=300, vx=vy=0, angle=0; constant forward thrust. The fixture retains unwrapped state for comparison and wraps only the displayed drone, so arena seams cannot conceal displacement. CPU throttling was applied using Chrome's accepted `Emulation.setCPUThrottlingRate` with rates 1 and 6, not simulated by sleeping.

Variable normal/throttled distance: **0.511548 px**. Fixed distance: **0.000000 px**. The variable wall-time runs also ended at slightly different simulated times: a scheduled endpoint is not a clean proof of numerical sensitivity. Both fixed runs happened to complete 300 steps; that is an observation, not a general guarantee under stalls.

## Same simulated duration: isolate the integration effect

| Run | Final x | Final y | Steps | Simulated s | Wall s |
| --- | ---: | ---: | ---: | ---: | ---: |
| variable exact simulation time CPU 1x | 1611.173389 | 300.000000 | 601 | 5.000000 | 5.008800 |
| variable exact simulation time CPU 6x | 1611.217935 | 300.000000 | 595 | 5.000000 | 4.996000 |
| fixed exact simulation time CPU 1x | 1610.784130 | 300.000000 | 300 | 5.000000 | 4.999900 |
| fixed exact simulation time CPU 6x | 1610.784130 | 300.000000 | 300 | 5.000000 | 4.996100 |

Fixed runs stop after exactly 300 steps. Variable runs shorten the final step so the total is exactly 5 simulated seconds. Floating-point sums can print 4.999999999999988 for 300 × 1/60. Wall duration runs from the first render callback entry to completion, including final rendering/work, using performance.now. rAF timestamps refer to the browser's frame timeline, so sub-frame offsets between those clock readings are expected.

Variable normal/throttled distance: **0.044546 px**. Fixed distance: **0.000000 px**. Real CPU 6× kept this small scene near 120 callbacks/s, so divergence was small. Fixed dt establishes repeatability here; it is not a claim of an exact continuous solution.

## Supplementary controlled slowdown (not the DevTools experiment)

Add 35 ms synchronous render work on every frame; keep five simulated seconds:

| Run | Final x | Final y | Steps | Simulated s | Wall s |
| --- | ---: | ---: | ---: | ---: | ---: |
| variable supplemental 35ms render work | 1609.748862 | 300.000000 | 143 | 5.000000 | 5.062200 |
| fixed supplemental 35ms render work | 1610.784130 | 300.000000 | 300 | 5.000000 | 5.061400 |

Cadence fell to 28.45 / 28.45 callbacks/s. Compared with the normal exact-time run, variable displacement changed by **1.424528 px**; fixed changed by **0.000000 px**. This is an explicitly introduced workload, not another measurement of the 6× setting.

## Evidence and methodology

- [blocking.json](blocking.json), [interval.json](interval.json), [trajectory.json](trajectory.json), [exact.json](exact.json), [slowdown.json](slowdown.json): raw callback intervals, states, counts, timings, visibility, browser and CPU settings.
- [browser-smoke.json](browser-smoke.json): actual keyboard/reset/wrap/focus/DPR assertions and zero uncaught JavaScript exceptions.
- [arena.png](arena.png), [thrust.png](thrust.png), [mobile.png](mobile.png): real browser captures. Mobile is a resize/focus smoke, not touch control support; its HUD window includes the preceding background/resize work.
- [reproduce/README.md](reproduce/README.md): fixture and driver, setup and limitations.

Callbacks/s = 1000 / mean(raw callback intervals). SD uses the population formula. Percentiles use nearest rank, ceil(p × N) − 1 in sorted samples. First callback initializes timing and is excluded from interval statistics. No warm-up samples were deleted; CPU-throttle startup hitches remain. The ~10 s and ~5 s windows stop at the first render satisfying the duration. Single runs characterize this session, not a universal browser benchmark.
