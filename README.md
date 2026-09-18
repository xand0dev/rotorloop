# RotorLoop — Entity Arena

Fly a quadcopter through a live Canvas arena, launch rate-limited homing rounds, collect field modules, break asteroids, and survive the two-second recovery cycle.

**Lab 02 · JavaScript objects and classes · Canvas 2D · fixed 60 Hz simulation**

[Play the latest build](https://xand0dev.github.io/rotorloop/) · [Frozen Lab 01](https://xand0dev.github.io/rotorloop/lab-01/) · [Frozen Lab 02](https://xand0dev.github.io/rotorloop/lab-02/) · [Choose a release](https://xand0dev.github.io/rotorloop/versions/)

## Run

Use Node 24 (`.nvmrc`; validated with the version declared there).

```sh
nvm use
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates `dist/`; `npm run preview` serves that build. The game has no backend or runtime dependency.

| Key | Action |
| --- | --- |
| W / ↑ | Forward thrust |
| A / ←, D / → | Yaw left / right |
| Space | Fire; holding it uses a deliberate cooldown |
| R | Reset arena once per press |
| H | Toggle loop telemetry |

Click the arena to focus. Blur and hidden-page handlers clear held input so a lost `keyup` cannot leave the ship moving or firing.

## What Lab 02 adds

- `Vector2` with non-mutating vector operations.
- An `Entity` base class and `Ship extends Entity`; every concrete entity is only one prototype step below `Entity`.
- A `Map<number, Entity>` world with generator-based filtering and deferred removal.
- Bullets with TTL, bouncing asteroids, two data-driven pickups, particle explosions, score, private ship HP, damage feedback, and safe respawn after exactly two seconds of simulation time.
- The same homing behavior attached to bullets and an asteroid without a `HomingEntity` subclass.
- A separate circle-collision pass. Its intentionally simple O(n²) broad phase can be replaced without changing entity classes.

The visual language still comes from the Lab 01 FPV training field: dark survey grid, landing ring, pale aircraft frame, and orange camera marker. Lab 02 adds cyan modules and guided rounds, a red hunter marker, hit flashes, particles, hull/score/weapon readouts, and a central respawn status. These signals explain game state without covering the arena.

## Architecture and lifecycle

```text
keyboard state                 Canvas renderer (read-only)
      │                                  ▲
      ▼                                  │ interpolated previous/current
fixed-step loop ── controls ──► World ───┘
                              │
             Map<id, Entity> ├─ update snapshot
                              ├─ circle-pair collisions
             Set<id> pending └─ end-of-step sweep
```

| Module | Responsibility |
| --- | --- |
| [`src/sim/vector.js`](src/sim/vector.js) | Pure `Vector2`; every operation returns a new vector. |
| [`src/sim/entity.js`](src/sim/entity.js) | Unique private-static ID source and common position, velocity, angle, radius, `alive`, and `update(dt)` contract. |
| [`src/sim/ship.js`](src/sim/ship.js) | `Ship extends Entity`, private `#hp`, motion, weapon cooldown, damage, power-up, and respawn behavior. |
| [`src/sim/entities.js`](src/sim/entities.js) | Bullet, asteroid, pickup, and explosion rules. |
| [`src/sim/behaviors.js`](src/sim/behaviors.js) | Homing and pickup application as composition. |
| [`src/sim/collision.js`](src/sim/collision.js) | Pure circle overlap and unique-pair generator. |
| [`src/sim/world.js`](src/sim/world.js) | `Map` ownership, spawn/despawn, update order, collision effects, score, and respawn scheduling. |
| [`src/loop.js`](src/loop.js) | Preserved clamped accumulator, fixed 1/60 s ticks, interpolation alpha, and telemetry. |
| [`src/render`](src/render) | DPR-safe Canvas surface and rendering; it never advances simulation. |

An entity is spawned into the `Map`, copied into the current step's update snapshot, updated, collision-tested, and finally swept if its ID is in the pending-removal `Set`. Spawning an explosion during collision handling is safe: it appears immediately for rendering but does not update until the next tick. A despawned bullet remains in the collision generator's captured candidate list, so the resolver also checks `alive`; one dead bullet cannot damage two overlapping targets.

The ship follows a separate recovery transition:

```text
active ── hp reaches 0 ──► removed + explosion
  ▲                              │
  └── safe position + full HP ◄──┘ 2.0 simulated seconds
```

Safe-position candidates are rejected when an asteroid is within the combined radii plus an 80 px margin. Random selection is injected, so tests stay deterministic.

## Prototype delegation, not copied methods

For `const ship = new Ship()`, the relevant lookup chain is:

```text
ship ──► Ship.prototype ──► Entity.prototype ──► Object.prototype ──► null
           fire(), hp          update(), x/y
```

`fire` and `update` are not own properties copied into each instance. `ship.fire` first checks `ship`, then finds one shared function on `Ship.prototype`. `Object.hasOwn(ship, "update")` is false, while `ship instanceof Entity` is true. Private `#hp` is internal class state; public code can only read `ship.hp` and change it through `damage`, `heal`, or `prepareRespawn`.

All entity subclasses point directly to `Entity.prototype`. There is no `MovingEntity`, `DamageableEntity`, or deeper chain.

## The detached `this` failure

Methods are functions, and `this` is chosen by the call site. This deliberately failing test captures the bug:

```js
const ship = new Ship();
const detached = ship.fire;
detached(); // TypeError: `this` is undefined in an ES module
```

Production uses a wrapper arrow created once in `main.js`:

```js
const fire = () => world.firePlayerWeapon();
```

The wrapper closes over `world`, and `World#firePlayerWeapon` calls `this.player.fire()` with both receivers intact. It also lets the fixed-step loop poll held Space and apply the ship's cooldown instead of depending on keyboard-repeat timing.

Three valid fixes have different costs:

| Fix | Strength | Trade-off |
| --- | --- | --- |
| `() => ship.fire()` | Explicit receiver and easy to add arguments; selected here | Keep the wrapper reference if a listener must later be removed. |
| `ship.fire.bind(ship)` | Produces a reusable permanently bound function | Creates another function; the exact bound reference is required for listener cleanup. |
| `fire = () => { ... }` class field | Safe to pass directly and concise at the call site | Allocates one function per instance instead of sharing it on the prototype. |

The four binding rules, in precedence order, are `new`, explicit (`call`/`apply`/`bind`), implicit (`object.method()`), and default. Arrows are the exception: they capture the surrounding `this` and ignore rebinding.

## Why the world uses `Map`

IDs stay numeric instead of becoming object-property strings; `.size`, ordered iteration, and `delete` are native; and names inherited from `Object.prototype` cannot collide with entity keys. Frequent spawn/despawn is also the operation `Map` is designed to express. A `Set` represents pending removals because an ID is either scheduled once or not scheduled, and duplicate requests need no special handling.

`World` is itself iterable, while `world.ofKind(kind)` is a generator. The generator yields matches lazily rather than allocating an array every time homing searches for a target.

## Composition instead of a class maze

An inheritance-first design would need capabilities in incompatible places:

```text
Entity
├─ MovingEntity
│  ├─ HomingBullet
│  ├─ HomingAsteroid
│  └─ Ship
└─ CollectibleEntity
   ├─ ShieldPickup
   └─ RapidFirePickup
```

Moving homing logic upward would make unrelated movers target-aware; duplicating `HomingBullet` and `HomingAsteroid` would copy logic; multiple inheritance is unavailable. Making pickups subclasses of `Ship` would falsely give them HP, controls, and weapons.

RotorLoop instead gives either moving entity a small `homing: { targetKind, turnRate }` field. `applyHoming(entity, world, dt)` operates on that capability. Pickups are stationary entities with a `pickup` data object such as `{ effect: "shield", amount: 35 }`; `applyPickup` interprets it. This is deliberately lighter than an ECS: class identity still expresses the five entity types, while cross-cutting features are explicit data and functions. The same approach will serialize more cleanly when networking arrives in a later lab.

## Preserved Lab 01 timing contract

`requestAnimationFrame` owns scheduling, but simulation advances only in whole 1/60 s steps. Frame delta is capped at 0.25 s, the accumulator can run zero or multiple ticks per rendered frame, and its remainder becomes interpolation alpha. The first callback establishes the time origin. The existing restart-generation guard, bounded 120-interval telemetry, shortest-angle interpolation, resize/DPR handling, and wrap synchronization remain covered by regression tests.

Rendering reads current and previous state only. It does not mutate physics. `prefers-reduced-motion` reduces particle count and disables pickup pulsing while leaving gameplay unchanged.

## Validation

```sh
npm run check
npm test
npm run build
```

The suite covers every `Vector2` operation, zero normalization, unique IDs and prototype relationships, world iteration/generators/deferred sweep, bullet origin/velocity/TTL/rate limiting, collision pairs and dead-bullet guarding, private HP through its public API, two-second respawn, homing on two entity kinds, pickup application, the detached-method failure and wrapper fix, plus all relevant Lab 01 loop, interpolation, input, telemetry, and DPR behavior.

The [recorded Lab 02 browser smoke](docs/evidence/lab-02-browser-smoke.json) checks movement, yaw, firing, cooldown, expiry, asteroid hits, score, pickup collection, homing, damage, explosion, death/respawn, wrap, reset, resize/DPR, focus, telemetry, and console errors. The in-app browser kept `document.hidden === false` when hidden, so blur/hidden cleanup and background clamping are supported by the preserved Lab 01 browser evidence plus automated regressions rather than a fabricated new hidden-tab claim. This is functional smoke evidence, not a frame-rate benchmark.

## Lab 02 checklist

- [x] Pure `Vector2`; `Entity` with private static ID source; one-level entity inheritance
- [x] `World` over `Map`, `[Symbol.iterator]`, generator `ofKind`, deferred `Set` sweep
- [x] Bullet TTL, asteroids, pickups, particles, score, damage, explosions, safe two-second respawn
- [x] Separate swappable circle-collision system with no double damage from dead bullets
- [x] Private `#hp` exposed through a getter and public behavior
- [x] Deliberate detached-`this` regression test; wrapper, `.bind`, and class-field fixes documented
- [x] Homing on bullet and asteroid; pickups as composition/data
- [x] Lab 01 fixed step, accumulator, interpolation, resize/DPR, telemetry, and input cleanup preserved
- [x] English architecture/design notes, focused automated tests, and browser smoke procedure
- [ ] Final validated commit tagged `lab-02`

The annotated `lab-01` tag remains unchanged and identifies the validated first submission.
