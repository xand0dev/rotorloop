import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoop, STEP } from "../src/loop.js";

function scheduler(t) {
  const pending = new Map();
  let id = 0;
  t.mock.method(globalThis, "requestAnimationFrame", (callback) => {
    pending.set(++id, callback);
    return id;
  });
  t.mock.method(globalThis, "cancelAnimationFrame", (key) =>
    pending.delete(key),
  );
  return {
    pending,
    frame(now) {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(now);
    },
  };
}

// Node has no browser scheduler; test-only stubs are replaced and restored by mocks.
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

test("60 and 120 Hz rendering produce exactly 300 identical fixed steps", (t) => {
  const clock = scheduler(t);
  for (const hz of [60, 120]) {
    let ticks = 0;
    let frames = 0;
    const loop = createLoop({
      simulate: (dt) => {
        assert.equal(dt, STEP);
        ticks += 1;
      },
      render: (alpha) => {
        assert.ok(alpha >= 0 && alpha < 1);
        frames += 1;
      },
    });
    loop.start();
    for (let i = 0; i <= hz * 5; i += 1) clock.frame((i * 1000) / hz);
    assert.equal(ticks, 300);
    assert.equal(frames, hz * 5 + 1);
    assert.ok(Math.abs(loop.getStats().stepsPerSecond - 60) < 1);
    assert.ok(Math.abs(loop.getStats().framesPerSecond - hz) < 1);
    loop.stop();
  }
});

test("first frame, zero-step frame, catch-up, clamp and raw interval", (t) => {
  const clock = scheduler(t);
  let ticks = 0;
  const alphas = [];
  const loop = createLoop({
    simulate: () => ticks++,
    render: (a) => alphas.push(a),
  });
  loop.start();
  clock.frame(70000);
  assert.equal(ticks, 0);
  assert.deepEqual(loop.getStats().frameHistory, []);
  clock.frame(70008);
  assert.equal(ticks, 0);
  clock.frame(70058);
  assert.equal(ticks, 3);
  clock.frame(80058);
  assert.equal(ticks, 18);
  assert.equal(loop.getStats().frameMs, 10000);
  assert.equal(loop.getStats().stepsThisFrame, 15);
  assert.equal(loop.getStats().totalSteps, 18);
  assert.equal(loop.getStats().discardedMs, 9750);
  assert.deepEqual(loop.getStats().frameHistory, [8, 50, 10000]);
  assert.equal(loop.getStats().maxFrameMs, 10000);
  assert.ok(alphas.every((a) => a >= 0 && a < 1));
  loop.stop();
});

test("start/stop are idempotent and restart drops old elapsed time", (t) => {
  const clock = scheduler(t);
  let ticks = 0;
  const loop = createLoop({ simulate: () => ticks++, render: () => {} });
  loop.start();
  loop.start();
  assert.equal(clock.pending.size, 1);
  clock.frame(0);
  clock.frame(8);
  loop.stop();
  loop.stop();
  assert.equal(clock.pending.size, 0);
  loop.start();
  clock.frame(50000);
  assert.deepEqual(loop.getStats().frameHistory, []);
  assert.equal(loop.getStats().totalSteps, 0);
  assert.equal(loop.getStats().discardedMs, 0);
  clock.frame(50010);
  assert.equal(ticks, 0);
  loop.stop();
});

test("stop from render does not enqueue another frame", (t) => {
  const clock = scheduler(t);
  const loop = createLoop({ simulate: () => {}, render: () => loop.stop() });
  loop.start();
  clock.frame(0);
  assert.equal(clock.pending.size, 0);
});

test("restart inside render or simulate leaves exactly one new run", (t) => {
  const clock = scheduler(t);
  for (const phase of ["simulate", "render"]) {
    let restarted = false;
    const restart = () => {
      if (restarted) return;
      restarted = true;
      loop.stop();
      loop.start();
    };
    const loop = createLoop({
      simulate: phase === "simulate" ? restart : () => {},
      render: phase === "render" ? restart : () => {},
    });
    loop.start();
    clock.frame(0);
    clock.frame(20);
    assert.equal(clock.pending.size, 1);
    loop.stop();
    assert.equal(clock.pending.size, 0);
  }
});
