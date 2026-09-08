# Independent review — Lab 01

Two independent reviewer agents examined the code and requirement coverage. The engineering reviewer did not implement the game. The rubric reviewer prepared defense material earlier, but did not implement or measure the application. Both independently recomputed JSON interval statistics rather than trusting the report tables.

## Findings and resolutions

| Priority | Finding | Resolution / evidence |
| --- | --- | --- |
| P2 | Calling stop/start inside render created two pending rAF callbacks; the old callback could update a new run's state | Commit `18d6167`: generation token checked after callbacks; regression tests for restart inside render and simulate |
| P3 | Angle tests covered the helper but not the renderer | Commit `1cb1f03`: direct interpolateShip test with frozen ±179° snapshots and position midpoint |
| P2, browser QA | A DPR-only emulation change could leave a 900px backing width where 1800px was required | Commit `1cb1f03`: cheap syncDpr fallback; no ordinary-frame layout reads; regression test and successful repeated Chrome DPR 1/2 smoke |
| P2, rubric | Blocking results omitted the final HUD window | Added measured SIM/DISPLAY/FRAME readings to both reports and RESULTS, distinguished from whole-run averages |
| P2, documentation | RESULTS linked a reproduction guide not yet present | Added reproduce/README.md with worktree revision, fixture placement, ports, isolated Chrome setup, actual commands and test-only observer |
| P3, evidence wording | wallMs included final render work, not only callback-entry intervals | Corrected definition to first callback entry → completion; raw samples unchanged |

No P0/P1 issues remained in either review. The follow-up engineering review confirmed the lifecycle fix, DPR fallback and renderer test. All measured summaries recomputed by the reviewers matched the raw JSON. The real CPU 6× test and deliberate 35 ms supplemental workload are kept distinct.

## Requirement audit

| Requirement group | Status | Evidence |
| --- | --- | --- |
| Vite vanilla, ESM, named exports, Biome, Node baseline | Pass | package/configuration, Node 24.20.0 validation |
| rAF, accumulator, 1/60 step, clamp, safe lifecycle | Pass | loop module, controlled 60/120 Hz and restart tests |
| Actual SIM/DISPLAY/FRAME and alpha | Pass | browser screenshots, loop counters, blocked final HUD readings |
| Closure input, isDown/justPressed, repeat/focus handling | Pass | input tests, real key events and hidden-tab smoke |
| Pure rotation/thrust/drag/speed-clamped simulation | Pass | frozen-state, speed and 300-tick tests |
| Arena wrap, previous/current and angle interpolation | Pass | wrap tests, ±179° renderer test, browser crossing |
| Responsive CSS-pixel/DPR Canvas | Pass | browser DPR1/2, repeated dimensions/transform records |
| Three experiments with actual numbers and event-loop explanations | Pass | blocking/interval/trajectory/exact JSON and bilingual reports |
| Reflection answers and demo script | Pass | defense.md (all eight), README 90-second review |
| Reproducible evidence and independent review | Pass | preserved fixture/drivers, this report |
| Final validation, Git tag and public repository | Release gate | Verify check/test/build, clean tree and tag target before publishing |

## Limits retained in the report

- The callback counter does not measure physical presentation independently.
- The 60/120 Hz unit tests use synthetic timestamps; browser measurements are separately recorded.
- CPU 6× produced small trajectory divergence. It was not exaggerated to fit an expectation.
- Keyboard latency during the 100 ms busy-wait was not independently timed.
- Responsive mobile layout has no optional touch controls.
- Automated keyboard validation is not described as extensive human playtesting.
- Fixed stepping supports repeatability under controlled inputs and math, not universal cross-platform lockstep.
