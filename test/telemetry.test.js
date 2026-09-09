import assert from "node:assert/strict";
import { test } from "node:test";
import { createTelemetry, HISTORY_SIZE } from "../src/telemetry.js";

test("telemetry starts without a fictitious zero interval", () => {
  const stats = createTelemetry(1 / 60).snapshot();
  assert.deepEqual(stats.frameHistory, []);
  assert.equal(stats.totalSteps, 0);
  assert.equal(stats.discardedMs, 0);
});

test("rolling summaries, tick clock and discarded time describe measured work", () => {
  const telemetry = createTelemetry(1 / 60);
  telemetry.record(8, 0, 0);
  telemetry.record(42, 3, 0);
  telemetry.record(250, 15, 0);
  const stats = telemetry.snapshot();
  assert.equal(stats.meanFrameMs, 100);
  assert.equal(stats.p95FrameMs, 250);
  assert.equal(stats.maxFrameMs, 250);
  assert.equal(stats.stepsThisFrame, 15);
  assert.equal(stats.totalSteps, 18);
  assert.equal(stats.simulationSeconds, 0.3);
});

test("history is bounded, old spikes expire and snapshots cannot mutate storage", () => {
  const telemetry = createTelemetry(1 / 60);
  telemetry.record(1000, 15, 750);
  for (let i = 0; i < 160; i += 1) telemetry.record(8, i % 2, 0);
  const stats = telemetry.snapshot();
  assert.equal(stats.frameHistory.length, HISTORY_SIZE);
  assert.ok(stats.frameHistory.every((interval) => interval === 8));
  assert.equal(stats.meanFrameMs, 8);
  assert.equal(stats.p95FrameMs, 8);
  assert.equal(stats.maxFrameMs, 8);
  assert.equal(stats.totalSteps, 95);
  assert.equal(stats.discardedMs, 750);
  stats.frameHistory[0] = 9999;
  assert.equal(telemetry.snapshot().frameHistory[0], 8);
});
