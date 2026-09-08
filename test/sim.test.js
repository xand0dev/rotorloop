import assert from "node:assert/strict";
import test from "node:test";
import { shortestAngleDelta, wrapShip, wrapState } from "../src/sim/arena.js";
import { createShip, DRAG, integrate, MAX_SPEED } from "../src/sim/ship.js";

test("integration leaves frozen state and input intact and thrusts upward", () => {
  const ship = Object.freeze(createShip(100, 100));
  const input = Object.freeze({ turn: 0, thrust: true });
  const next = integrate(ship, input, 1 / 60);
  assert.notEqual(next, ship);
  assert.equal(ship.y, 100);
  assert.ok(next.y < ship.y);
  assert.ok(Math.abs(next.x - ship.x) < 1e-12);
});

test("drag decays velocity exponentially and sustained thrust respects cap", () => {
  const coast = integrate({ ...createShip(), vx: 100 }, {}, 0.5);
  assert.ok(Math.abs(coast.vx - 100 * Math.exp(-DRAG * 0.5)) < 1e-12);
  let ship = createShip();
  for (let i = 0; i < 1200; i += 1) {
    ship = integrate(ship, { turn: 0, thrust: true }, 1 / 60);
    assert.ok(Math.hypot(ship.vx, ship.vy) <= MAX_SPEED + 1e-10);
  }
  assert.ok(Math.hypot(ship.vx, ship.vy) > MAX_SPEED - 1e-8);
});

test("same 300 tick input sequence reproduces exactly", () => {
  function replay() {
    let ship = createShip(100, 100);
    for (let tick = 0; tick < 300; tick += 1) {
      ship = integrate(ship, { turn: tick < 60 ? 1 : 0, thrust: true }, 1 / 60);
    }
    return ship;
  }
  assert.deepEqual(replay(), replay());
});

test("wrap handles negative and multiple-arena crossings without mutation", () => {
  const ship = Object.freeze({ ...createShip(), x: -201, y: 306 });
  const wrapped = wrapShip(ship, 100, 100);
  assert.equal(wrapped.x, 99);
  assert.equal(wrapped.y, 6);
  assert.equal(ship.x, -201);
  assert.equal(wrapShip({ ...ship, x: 100 }, 100, 100).x, 0);
});

test("wrap synchronizes crossed axes while preserving motion on other axes", () => {
  const previous = Object.freeze({ ...createShip(), x: 99, y: 20 });
  const next = Object.freeze({ ...previous, x: 102, y: 23 });
  const state = wrapState(previous, next, 100, 100);
  assert.equal(state.current.x, 2);
  assert.equal(state.previous.x, 2);
  assert.equal(state.previous.y, 20);
  assert.equal(state.current.y, 23);
});

test("heading interpolation crosses the angular seam through shortest path", () => {
  const delta = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
  assert.ok(Math.abs(delta - 0.2) < 1e-12);
  assert.ok(
    Math.abs(shortestAngleDelta(-Math.PI + 0.1, Math.PI - 0.1) + 0.2) < 1e-12,
  );
});
