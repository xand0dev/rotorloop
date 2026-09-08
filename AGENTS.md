# RotorLoop — FPV Drone Arena

Lab 01 — Event Loop / Game Loop. Keep the code explainable in a five-minute defense.

## Contract

1. Vanilla JavaScript, Vite, ESM and named exports. Prefer const; use let only for reassignment; never var in source code.
2. Simulation must not import DOM or Canvas APIs. State is plain data; integrate returns a new state.
3. Fixed simulation step is 1 / 60 seconds. Rendering frequency is independent.
4. Production uses requestAnimationFrame and an accumulator; clamp elapsed time to 0.25 seconds after stalls/resume.
5. Keep previous/current snapshots; rendering never mutates simulation. Interpolate angles by the shortest path.
6. On arena wrap synchronize the affected previous coordinate to current; never interpolate across the whole screen.
7. World dimensions are CSS pixels. DPR only affects backing resolution. Resize must explicitly set the context transform, never accumulate scaling.
8. Input uses private closure Sets, edge-triggered justPressed, repeat suppression, blur/visibility cleanup and removable listeners.
9. No fabricated benchmark values, screenshots or validation. README claims must match recorded measurements.
10. Experiments live in isolated worktrees. Never merge broken implementations or runtime experiment switches into production.
11. Prefer explicit simple code and minimal dependencies. No frameworks, engines, TypeScript, workers, networking or future-lab features.
12. Research synthesis must precede implementation. Maintain requirement traceability in docs/research.md.
13. English README/code/commits; Ukrainian report and defense notes. Measurements share the same evidence.
14. Delegate independent research and final engineering/rubric reviews. Browser measurements must run sequentially without competing agent workloads.
15. Never overwrite unrelated work or force-push. Tag lab-01 only on the final validated commit.

## Required validation

Run `npm run check`, `npm test`, `npm run build`. After changes, run the relevant tests and final browser smoke. Check controls, reset, wrap, interpolation, HUD, DPR/resize, focus loss, background/resume and console errors. Search production source for var, timer-driven loops and DOM/Canvas imports in sim. Review git diff/status. Fix all P0/P1 findings before release.
