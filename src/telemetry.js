export const HISTORY_SIZE = 120;

// A sample window, not a one-second window. No DOM, timers or simulation writes.
export function createTelemetry(step) {
  const intervals = [];
  let summaryAgeMs = 0;
  let stepsThisFrame = 0;
  let totalSteps = 0;
  let discardedMs = 0;
  let summary = { meanFrameMs: 0, p95FrameMs: 0, maxFrameMs: 0 };

  return {
    record(frameMs, steps, lostMs) {
      intervals.push(frameMs);
      if (intervals.length > HISTORY_SIZE) intervals.shift();
      stepsThisFrame = steps;
      totalSteps += steps;
      discardedMs += lostMs;
      summaryAgeMs += frameMs;
      // Sort only on summary updates; the graph still receives every interval.
      if (intervals.length === 1 || summaryAgeMs >= 250) {
        const sorted = [...intervals].sort((a, b) => a - b);
        summary = {
          meanFrameMs:
            intervals.reduce((sum, value) => sum + value, 0) / intervals.length,
          p95FrameMs: sorted[Math.ceil(sorted.length * 0.95) - 1],
          maxFrameMs: sorted.at(-1),
        };
        summaryAgeMs = 0;
      }
    },
    snapshot() {
      return {
        ...summary,
        stepsThisFrame,
        totalSteps,
        simulationSeconds: totalSteps * step,
        discardedMs,
        frameHistory: [...intervals],
      };
    },
  };
}
