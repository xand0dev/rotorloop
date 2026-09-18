# RotorLoop — Async Flight Room

Fly a quadcopter through a Canvas arena after a real cancellable startup pipeline and a live pre-flight lobby. Lab 03 adds concurrent asset loading, sprite sheets, decoded Web Audio, bounded retry, observable failure recovery, and `EventTarget` decoupling without changing the fixed-step simulation from Labs 01–02.

**Lab 03 · Promises and `async`/`await` · Fetch and cancellation · Web Audio · Canvas 2D**

[Play the latest build](https://xand0dev.github.io/rotorloop/) · [Lab 01](https://xand0dev.github.io/rotorloop/lab-01/) · [Lab 02](https://xand0dev.github.io/rotorloop/lab-02/) · [Lab 03](https://xand0dev.github.io/rotorloop/lab-03/) · [Choose a release](https://xand0dev.github.io/rotorloop/versions/)

## Run it

Use Node 24 or newer (`.nvmrc` records the course baseline).

```sh
nvm use
npm ci
npm run dev
```

Open the printed local URL. Startup loads five real manifest items, then the lobby fetches the static `/api/rooms` response. Enter a call sign, select a room, and choose **Join room**. The click also resumes Web Audio in the required user gesture.

| Control | Action |
| --- | --- |
| W / ↑ | Forward thrust |
| A / ←, D / → | Yaw left / right |
| Space | Fire; holding it uses the weapon cooldown |
| R | Reset the selected arena |
| H | Toggle loop telemetry |
| Leave arena | Stop the loop and return to the refreshing lobby |

Click the arena to focus it. Blur and hidden-page handlers clear held input, preventing a lost `keyup` from leaving the ship moving or firing.

## What Lab 03 adds

- A manifest-driven `Promise.all` pipeline for one sprite sheet, three generated audio files, and arena JSON.
- Structured `HttpError` and `JsonParseError` failures, bounded exponential backoff with jitter, and abortable retry delays.
- A Canvas loading screen whose rotor gauge advances only when a real item fulfills. Cancel and Retry are visible recovery states.
- Explicit sprite-sheet source rectangles for ships, bullets, asteroids, and pickups; DPR-safe drawing remains owned by the Canvas surface.
- Web Audio buffers decoded during startup and fresh buffer sources for overlapping shoot, hit, and explosion playback.
- `GameEvents extends EventTarget`; simulation publishes `fired`, `hit`, `exploded`, `scorechange`, and `statechange` without importing audio, HUD, or DOM code.
- `Lobby extends EventTarget` with a separate DOM view, per-request timeout, visible-only refresh interval, abort-on-leave, and stale-response protection.
- Three room choices that merge their arena settings over the manifest’s base configuration.

The sprite sheet and WAV files are original local assets. [`public/assets/rotorloop-sprites.svg`](public/assets/rotorloop-sprites.svg) uses the project’s existing survey-field palette. The three PCM WAV files are deterministically synthesized by [`tools/generate-audio.mjs`](tools/generate-audio.mjs); no third-party game art or audio is included.

## Startup lifecycle and async architecture

```text
page opens
   │
   ▼
fetch manifest ── transient failure ──► retry + exponential delay
   │                                      │
   │                                      └─ AbortSignal cancels fetch or delay
   ▼
Promise.all([sprite, shoot, hit, explosion, arena])
   │              each fulfillment ──► real Canvas progress
   ▼
all fulfilled
   │
   ▼
Lobby.enter() ──► timed /api/rooms fetch ──► roomschange event ──► DOM view
   │                    ▲
   │                    └─ interval exists only while visible
   ▼ Join click
audio.resume() + Lobby.leave() + abort request/interval
   │
   ▼
fixed-step World ── CustomEvent ──► AudioEngine
       │              └───────────► HUD model
       └─ no imports from audio, HUD, or DOM
```

| Module | Responsibility |
| --- | --- |
| [`src/assets/errors.js`](src/assets/errors.js) | HTTP/JSON error types plus abort/retry classification. |
| [`src/assets/loader.js`](src/assets/loader.js) | `fetchJson`, image/audio/JSON loaders, abortable delay, retry, and `loadAll`. |
| [`src/audio.js`](src/audio.js) | Owns `AudioContext`, unlock state, decoded buffers, and overlapping sources. |
| [`src/events.js`](src/events.js) | Small native `EventTarget`/`CustomEvent` bridge. |
| [`src/lobby/lobby.js`](src/lobby/lobby.js) | Room data, visibility, refresh, timeout, stale-response guard, validation, and join event. |
| [`src/lobby/view.js`](src/lobby/view.js) | DOM rendering and form interactions only. |
| [`src/sim/world.js`](src/sim/world.js) | Preserved simulation plus event publication and arena configuration. |
| [`src/render`](src/render) | DPR-safe arena, sprites, HUD, loading gauge, and lobby field. Rendering never advances simulation. |

The game loop starts only after `await loadAll(...)` and after the player joins. Leaving stops it before the lobby creates a new refresh interval.

## Promises in this project

A promise begins **pending** and settles once as either **fulfilled** with a value or **rejected** with a reason. Later attempts to settle it do nothing. Here, each asset promise remains pending across fetch, body reading, and decoding; it fulfills with the usable asset or rejects with a structured error.

`.then` always schedules a microtask, even for an already-fulfilled promise. `await` is the same mechanism with sequential syntax: the async function returns control at the `await`, and its continuation becomes a microtask when the awaited promise settles. That is why the Canvas and input remain responsive during startup.

A thrown loader or decoder error becomes a rejection. `loadAll` uses `Promise.all`, so the first critical rejection moves startup into the failure screen; it does not cancel other work automatically. Cancellation is explicit: the shared `AbortSignal` reaches every fetch and also rejects a pending backoff delay. One `try/catch` in the startup coordinator receives errors from the entire awaited chain.

The combinators map cleanly to the game:

- `Promise.all`: all critical assets must be ready, in stable manifest order.
- `Promise.allSettled`: appropriate for a future optional cosmetic pack.
- `Promise.race`: the classic timeout shape, although this project uses abort signals so the losing fetch is actually cancelled.
- `Promise.any`: appropriate for a future fastest healthy asset mirror.

## Retry and cancellation policy

`withRetry` defaults to three attempts with `baseMs × 2^(attempt-1)` and ±25% jitter.

| Failure | Automatic retry? | Reason |
| --- | --- | --- |
| Network `TypeError` | Yes | The transport may recover. |
| HTTP 5xx | Yes | The server failure may be transient. |
| Timeout | Yes | It is classified as transient. |
| HTTP 4xx | No | Repeating the same request will not fix the URL or permission. |
| Malformed JSON | No | Repeating validly delivered bad data is not recovery. |
| Explicit `AbortError` | No | Cancellation is the requested outcome. |

The loading screen still offers a manual Retry after any failure. That allows a corrected deployment or restored connection to recover while preventing wasteful automatic retries for deterministic errors.

## Lobby lifecycle

`Lobby` owns data and state but creates no DOM nodes. `mountLobby` subscribes to its events and renders the form. `enter()` performs an immediate refresh and creates one interval; `leave()` clears that interval, aborts the active request, increments the request version, and emits the hidden state.

Each refresh combines a leave/supersede controller with `AbortSignal.timeout(3500)`. A newer refresh aborts the older request. Even if a test double or intermediary ignores abort, the captured request version prevents the older response from replacing newer rooms. Automated tests prove timeout reporting, visible-only refresh, abort-on-leave, and stale-response protection.

The static [`public/api/rooms`](public/api/rooms) response deliberately stops at local room selection. There are no sockets, accounts, databases, multiplayer messages, or Lab 04 server behavior.

## Sequential versus concurrent loading experiment

The reproducible evidence command is:

```sh
npm run evidence
```

Method: a local Node HTTP server exposed the same three no-store endpoints with controlled response delays of 120 ms (sprite), 180 ms (sound), and 90 ms (arena). Each of five trials fetched them sequentially, then fetched them concurrently with `Promise.all`. Timing used `performance.now()` around the complete response waits. Environment: Node v26.4.0 on macOS arm64, loopback HTTP on `127.0.0.1`, recorded 2026-09-18.

| Trial | Sequential | Concurrent |
| ---: | ---: | ---: |
| 1 | 410.27 ms | 183.68 ms |
| 2 | 400.08 ms | 183.27 ms |
| 3 | 398.95 ms | 183.45 ms |
| 4 | 399.83 ms | 183.60 ms |
| 5 | 400.04 ms | 182.90 ms |
| **Mean** | **401.83 ms** | **183.38 ms** |

Concurrent completion was 2.19× faster in this setup (54.4% less wall time) because independent waits overlapped and total time approached the slowest response. This is a controlled event-loop/coordination experiment, not a public-network throughput benchmark: the delays are synthetic server response delays on loopback, payloads are tiny, DNS/TLS are absent, and real networks add congestion, caching, and connection limits. Raw evidence, environment, and failure logs are stored in [`docs/evidence/lab-03-async-evidence.json`](docs/evidence/lab-03-async-evidence.json).

## Five event-order puzzles

Predictions were written before running the browser harness at [`tools/event-order.html`](tools/event-order.html). Observed output matched every prediction in the Chromium-based in-app browser.

### 1. `await` yields

```js
async function arm() {
  log("arm");
  await 0;
  log("armed");
}
log("boot"); arm(); log("continue");
```

Predicted: `boot, arm, continue, armed`  
Observed: `boot, arm, continue, armed`  
`arm` runs synchronously until `await`; its continuation is a microtask.

### 2. A timer created inside a chained reaction

```js
log("dock");
Promise.resolve()
  .then(() => { log("micro-1"); setTimeout(() => log("timer-in-then"), 0); })
  .then(() => log("micro-2"));
queueMicrotask(() => log("manual-micro"));
log("clear");
```

Predicted: `dock, clear, micro-1, manual-micro, micro-2, timer-in-then`  
Observed: `dock, clear, micro-1, manual-micro, micro-2, timer-in-then`  
The first reaction queues the second reaction behind the already queued manual microtask; the new timer waits for a later task.

### 3. Animation frame and its microtask

```js
requestAnimationFrame(() => {
  log("animation-frame");
  Promise.resolve().then(() => log("frame-microtask"));
});
setTimeout(() => log("timer"), 0);
Promise.resolve().then(() => log("microtask"));
log("scheduled");
```

Predicted for this fresh Chromium task: `scheduled, microtask, timer, animation-frame, frame-microtask`  
Observed: `scheduled, microtask, timer, animation-frame, frame-microtask`  
The normal microtask drains first; Chromium ran the due timer task before the next rendering opportunity, and the promise created inside `requestAnimationFrame` ran before returning from that rendering checkpoint. Timer-versus-frame ordering is host timing dependent, so only the measured environment is claimed.

### 4. Rejection recovery

```js
Promise.resolve()
  .then(() => { throw new Error("yaw sensor"); })
  .then(() => log("skipped"))
  .catch(() => log("caught"))
  .finally(() => log("finally"))
  .then(() => log("recovered"));
log("sync");
```

Predicted: `sync, caught, finally, recovered`  
Observed: `sync, caught, finally, recovered`  
The throw rejects the next promise, skips the fulfillment handler, and the catch converts the chain back to fulfillment.

### 5. `Promise.all` fails fast but does not cancel

```js
const slow = new Promise(resolve => setTimeout(() => {
  log("slow-settled"); resolve("slow");
}, 0));
Promise.all([slow, Promise.reject(new Error("manifest"))])
  .catch(() => log("all-rejected"));
queueMicrotask(() => log("queued-microtask"));
log("sync");
```

Predicted: `sync, queued-microtask, all-rejected, slow-settled`  
Observed: `sync, queued-microtask, all-rejected, slow-settled`  
The aggregate rejection is delivered through another promise reaction; the already-started timer still completes because promises do not cancel one another.

## Failure gallery

The evidence runner used real HTTP responses and abort signals. The browser harness at `failure-gallery.html?case=404|timeout|abort|malformed` rendered each error through the same Canvas loading component, exposed **Retry recovered path**, then completed through a corrected sprite or JSON endpoint.

| Case | Observed failure | Automatic policy | Browser recovery |
| --- | --- | --- | --- |
| Missing sprite | `HttpError`, HTTP 404, 2.59 ms | No 4xx retry | Corrected sprite decoded; `Recovery verified`. |
| Network timeout | `TimeoutError`, 67.40 ms | Eligible for bounded retry | Corrected arena JSON loaded; `Recovery verified`. |
| Abort during load | `AbortError: pilot left`, 45.98 ms | Never retry explicit abort | New controller loaded arena JSON; `Recovery verified`. |
| Malformed JSON | `JsonParseError`, 2.44 ms | No parse-error retry | Corrected arena JSON loaded; `Recovery verified`. |

These are logs rather than fabricated screenshots. The exact raw records are in [`docs/evidence/lab-03-async-evidence.json`](docs/evidence/lab-03-async-evidence.json); the full browser smoke record is in [`docs/evidence/lab-03-browser-smoke.json`](docs/evidence/lab-03-browser-smoke.json).

## Preserved Labs 01–02 behavior

The 1/60 s fixed-step accumulator, clamped long frames, interpolation, resize/DPR synchronization, bounded telemetry, hidden/blur input cleanup, entity `Map`, deferred removal, collisions, homing composition, pickups, score, particles, and two-second safe respawn remain covered by their original regression tests.

Sprite rendering changes presentation, not simulation. `World` still owns no Canvas or DOM object. The event bus is injected, so tests can observe payloads without constructing audio or UI modules.

## Validation

```sh
npm run check
npm test
npm run build
npm run evidence
```

The suite contains 45 deterministic tests. Lab 03 coverage includes fetch success/404/5xx/malformed JSON, exact retry schedule with injected RNG and delay, no retry on 4xx, abort during delay, concurrent start and stable result mapping, monotonic progress, signal propagation through all loaders, promise fail-fast behavior, every lobby lifecycle rule, event payloads, forbidden simulation dependencies, overlapping audio sources, and explicit sprite source rectangles.

The real-browser smoke covers startup progress, lobby refresh and validation, room selection, the audio unlock path, sprite gameplay, firing, leaving/re-entering, all four failures and their Retry recovery, console errors, and the preserved responsive/DPR behavior. The in-app browser cannot prove an audible waveform or force `document.hidden`; overlapping source creation, hidden-input cleanup, long-frame clamping, and DPR changes therefore also have deterministic automated coverage rather than invented manual claims.

## Run all three tagged labs together

Release worktrees are detached, runnable snapshots outside the development checkout:

```sh
mkdir -p ../RotorLoop-runs
git worktree add --detach ../RotorLoop-runs/lab-01 lab-01
git worktree add --detach ../RotorLoop-runs/lab-02 lab-02
git worktree add --detach ../RotorLoop-runs/lab-03 lab-03
npm ci --prefix ../RotorLoop-runs/lab-01
npm ci --prefix ../RotorLoop-runs/lab-02
npm ci --prefix ../RotorLoop-runs/lab-03
```

In three terminals:

```sh
npm run --prefix ../RotorLoop-runs/lab-01 dev -- --port 5171
npm run --prefix ../RotorLoop-runs/lab-02 dev -- --port 5172
npm run --prefix ../RotorLoop-runs/lab-03 dev -- --port 5173
```

The Pages workflow builds current `main` with `/rotorloop/` as its Vite base and each immutable tag with `/rotorloop/<tag>/`. The manifest resolves every asset relative to its own URL, and the lobby endpoint resolves through `import.meta.env.BASE_URL`, so tagged subpaths do not fall back to the site root.

## Lab 03 checklist

- [x] Shared `fetchJson` checks `response.ok` and distinguishes 4xx, 5xx, and parse failures
- [x] Image, audio, and JSON loaders accept `AbortSignal`; audio decodes during loading
- [x] Cancellable exponential backoff with jitter; retry only network, timeout, and 5xx
- [x] `Promise.all` concurrent loading, stable mapping, and real monotonic per-item progress
- [x] Canvas loading, Cancel, failure, and Retry/recovery states
- [x] Original sprite sheet with explicit source rectangles and generated local audio
- [x] User-gesture Web Audio unlock and overlapping buffer sources
- [x] `EventTarget`/`CustomEvent` bus; simulation imports no audio, HUD, or DOM code
- [x] Separate `Lobby` data model and DOM view with timeout, visible-only refresh, abort, and stale guard
- [x] Five measured event-order puzzles
- [x] Sequential/concurrent raw samples and honest limitations
- [x] Four-case failure gallery with real logs and browser recovery
- [x] Lab 01–02 regressions preserved
- [x] Versioned Pages paths for `main`, `lab-01`, `lab-02`, and `lab-03`
