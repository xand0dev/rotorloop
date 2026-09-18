export function createHudModel(events) {
  const state = {
    score: 0,
    lastSignal: "SYSTEM READY",
  };
  const onScore = (event) => {
    state.score = event.detail.score;
    state.lastSignal = `SCORE +${event.detail.delta}`;
  };
  const onHit = (event) => {
    state.lastSignal = event.detail.destroyed ? "TARGET DOWN" : "HIT CONFIRMED";
  };
  const onState = (event) => {
    state.lastSignal = event.detail.label;
  };
  events.addEventListener("scorechange", onScore);
  events.addEventListener("hit", onHit);
  events.addEventListener("statechange", onState);
  return {
    snapshot() {
      return { ...state };
    },
    destroy() {
      events.removeEventListener("scorechange", onScore);
      events.removeEventListener("hit", onHit);
      events.removeEventListener("statechange", onState);
    },
  };
}
