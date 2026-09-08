export const STEP = 1 / 60;
export const MAX_FRAME_DELTA = 0.25;

// Scheduling belongs here; physics receives only whole, fixed steps in seconds.
export function createLoop({ step = STEP, simulate, render }) {
  if (!Number.isFinite(step) || step <= 0) {
    throw new RangeError("step must be a positive finite number");
  }
  let running = false;
  let requestId = null;
  let last = null;
  let accumulator = 0;
  let sampleStart = null;
  let sampleSteps = 0;
  let sampleFrames = 0;
  let stats = { stepsPerSecond: 0, framesPerSecond: 0, frameMs: 0 };

  function frame(now) {
    requestId = null;
    if (!running) return;
    if (last === null) {
      last = now;
      sampleStart = now;
    } else {
      stats.frameMs = Math.max(0, now - last);
      last = now;
      accumulator += Math.min(stats.frameMs / 1000, MAX_FRAME_DELTA);
      // A tiny tolerance avoids losing a tick to floating-point subtraction.
      while (running && accumulator + 1e-12 >= step) {
        simulate(step);
        accumulator = Math.max(0, accumulator - step);
        sampleSteps += 1;
      }
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
    if (running) requestId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = null;
    accumulator = 0;
    sampleStart = null;
    sampleSteps = 0;
    sampleFrames = 0;
    stats = { stepsPerSecond: 0, framesPerSecond: 0, frameMs: 0 };
    requestId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (requestId !== null) cancelAnimationFrame(requestId);
    requestId = null;
  }

  return { start, stop, getStats: () => ({ ...stats }) };
}
