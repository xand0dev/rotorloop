# Reproduce the measurements

These files are evidence tooling. They are not imported by the game, served by its index page, or bundled into production. A graphical Chrome installation, Node 24+ and npm are required. The automated browser driver uses native Node WebSocket and Chrome DevTools Protocol; no Playwright dependency is installed.

## Setup

From the repository root, install dependencies and create three detached worktrees at the same measured physics/scheduler revision:

```sh
npm ci
git worktree add --detach /tmp/rotorloop-block 18d6167
git worktree add --detach /tmp/rotorloop-interval 18d6167
git worktree add --detach /tmp/rotorloop-variable 18d6167
```

Use unused directories if those already exist; never replace someone else's work. For each worktree:

1. Link its `node_modules` to the root installation, or run `npm ci` there.
2. Copy `lab.html` to its root and `lab.js` to `src/lab.js`.
3. Copy the matching `block-loop.txt`, `interval-loop.txt` or `variable-loop.txt` over that worktree's `src/loop.js`.
4. For the block worktree, use the Canvas/HUD files from `1cb1f03` to match the final measured renderer. The physics and scheduler remain `18d6167`.
5. Run Vite in separate terminals on ports 5174 (block/fixed), 5175 (interval) and 5176 (variable): `npm run dev -- --port 5174 --strictPort`, changing the port for each.

On macOS, start a dedicated Chrome profile (do not use a personal logged-in profile):

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9223 \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir=/tmp/rotorloop-chrome-lab01 \
  --no-first-run --no-default-browser-check --window-size=1100,800 about:blank
```

Use the official Chrome executable path on another OS. Keep this local debugging port private. Close other game/measurement tabs and avoid unrelated CPU workloads. The test creates/closes its own temporary targets.

## Run sequentially

The commands below replace the corresponding JSON files in `docs/evidence`; save an existing result set elsewhere if you need to preserve it.

```sh
node docs/evidence/reproduce/run.mjs blocking
node docs/evidence/reproduce/run.mjs interval
node docs/evidence/reproduce/run.mjs trajectory
node docs/evidence/reproduce/run.mjs exact
node docs/evidence/reproduce/run.mjs slowdown
```

`blocking` compares 10 s rAF runs with and without 100 ms synchronous work every 60 renders. `interval` records a 10 s timer run and actual visible→hidden (~5 s)→visible transitions for both schedulers. `trajectory` measures five-second wall-time thrust at CPU 1×/6×. `exact` ends at five simulated seconds. `slowdown` is a separate, labeled 35 ms workload at CPU 1×.

The fixture's alpha-independent drawing is deliberately not a visual smoothness test: it plots current simulation state for measurements. Game interpolation is tested separately on the real application. The fixture retains unwrapped simulation coordinates, while drawing wraps them into the viewport. Constant thrust is injected at the simulation boundary rather than timed human key release.

`smoke.mjs` runs against the otherwise unchanged main app in the block worktree, with the following test-only observer appended to that worktree's `src/main.js`:

```js
window.__qa = {
  state: () => ({ ...current }),
  stats: loop.getStats,
  size: surface.getSize,
};
```

Use `src/main.js`, `src/render/canvas.js` and `src/render/draw.js` from `1cb1f03` for the smoke, then append the observer. The production branch does not expose this global. The driver checks keyboard state, reset, wrap bounds, hidden cleanup, DPR backing transforms, responsive screenshots and uncaught exceptions. On failure it throws; close its leftover test targets before another measurement.

No failed result is silently changed into a pass. The initial DPR-only smoke failed; it prompted the committed `syncDpr` fallback. The saved browser-smoke JSON is the subsequent successful run.

## Interpretation

Read [RESULTS.md](../RESULTS.md) for units, percentile definitions and limits. Repeated runs need not reproduce exact callback intervals; deterministic physics is evaluated at identical input and tick count. Do not rewrite reports to match an expected hypothesis. Hardware refresh is not emulated by the scheduler unit tests.
