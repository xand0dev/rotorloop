import { createTelemetry } from "./telemetry.js";

export const STEP = 1 / 60;
export const MAX_FRAME_DELTA = 0.25;

// Scheduling belongs here; physics receives only whole, fixed steps in seconds.
export function createLoop({ step = STEP, simulate, render }) {
  if (!Number.isFinite(step) || step <= 0) {
    throw new RangeError("step must be a positive finite number");
  }
  let running = false;
  let generation = 0;
  let requestId = null;
  let last = null;
  let accumulator = 0;
  let sampleStart = null;
  let sampleSteps = 0;
  let sampleFrames = 0;
  let stats = { stepsPerSecond: 0, framesPerSecond: 0, frameMs: 0 };
  let telemetry = createTelemetry(step);

  function frame(now, run) {
    if (run !== generation) return;
    requestId = null;
    if (!running) return;
    if (last === null) {
      last = now;
      sampleStart = now;
    } else {
      stats.frameMs = Math.max(0, now - last);
      last = now;
      const elapsed = Math.min(stats.frameMs / 1000, MAX_FRAME_DELTA);
      accumulator += elapsed;
      let stepsThisFrame = 0;
      // A tiny tolerance avoids losing a tick to floating-point subtraction.
      while (running && accumulator + 1e-12 >= step) {
        simulate(step);
        if (run !== generation) return;
        accumulator = Math.max(0, accumulator - step);
        sampleSteps += 1;
        stepsThisFrame += 1;
      }
      telemetry.record(
        stats.frameMs,
        stepsThisFrame,
        Math.max(0, stats.frameMs - MAX_FRAME_DELTA * 1000),
      );
      sampleFrames += 1;
      const seconds = (now - sampleStart) / 1000;
      if (seconds >= 1) {
        stats.stepsPerSecond = sampleSteps / seconds;
        stats.framesPerSecond = sampleFrames / seconds;
        sampleStart = now;
        sampleSteps = 0;
        sampleFrames = 0;
      }
    }
    if (!running) return;
    render(accumulator / step);
    if (running && run === generation) {
      requestId = requestAnimationFrame((time) => frame(time, run));
    }
  }

  function start() {
    if (running) return;
    running = true;
    const run = ++generation;
    last = null;
    accumulator = 0;
    sampleStart = null;
    sampleSteps = 0;
    sampleFrames = 0;
    stats = { stepsPerSecond: 0, framesPerSecond: 0, frameMs: 0 };
    telemetry = createTelemetry(step);
    requestId = requestAnimationFrame((time) => frame(time, run));
  }

  function stop() {
    running = false;
    generation += 1;
    if (requestId !== null) cancelAnimationFrame(requestId);
    requestId = null;
  }

  return {
    start,
    stop,
    getStats: () => ({ ...stats, ...telemetry.snapshot() }),
  };
}
