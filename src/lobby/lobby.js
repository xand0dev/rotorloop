import { fetchJson } from "../assets/loader.js";
import { createDetailEvent } from "../events.js";

function combineSignals(signals) {
  if (AbortSignal.any) return AbortSignal.any(signals);
  const controller = new AbortController();
  const abort = (event) => controller.abort(event.target.reason);
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

export class Lobby extends EventTarget {
  #visible = false;
  #interval = null;
  #request = null;
  #requestVersion = 0;

  constructor({
    url,
    fetchRooms = (signal) => fetchJson(url, { signal }),
    intervalMs = 6000,
    timeoutMs = 3500,
    setIntervalImpl = (callback, ms) => globalThis.setInterval(callback, ms),
    clearIntervalImpl = (id) => globalThis.clearInterval(id),
    timeoutSignal = (ms) => AbortSignal.timeout(ms),
  }) {
    super();
    this.fetchRooms = fetchRooms;
    this.intervalMs = intervalMs;
    this.timeoutMs = timeoutMs;
    this.setIntervalImpl = setIntervalImpl;
    this.clearIntervalImpl = clearIntervalImpl;
    this.timeoutSignal = timeoutSignal;
    this.rooms = [];
    this.status = "idle";
  }

  get visible() {
    return this.#visible;
  }

  enter() {
    if (this.#visible) return;
    this.#visible = true;
    this.status = "loading";
    this.#emit("statechange", { visible: true, status: this.status });
    void this.refresh();
    this.#interval = this.setIntervalImpl(
      () => void this.refresh(),
      this.intervalMs,
    );
  }

  leave() {
    if (!this.#visible && !this.#request && !this.#interval) return;
    this.#visible = false;
    this.#requestVersion += 1;
    this.#request?.abort(new DOMException("Lobby left", "AbortError"));
    this.#request = null;
    if (this.#interval !== null) this.clearIntervalImpl(this.#interval);
    this.#interval = null;
    this.status = "idle";
    this.#emit("statechange", { visible: false, status: this.status });
  }

  async refresh() {
    if (!this.#visible) return false;
    this.#request?.abort(new DOMException("Superseded", "AbortError"));
    const controller = new AbortController();
    this.#request = controller;
    const version = ++this.#requestVersion;
    const timeout = this.timeoutSignal(this.timeoutMs);
    const signal = combineSignals([controller.signal, timeout]);
    this.status = "loading";
    this.#emit("statechange", { visible: true, status: this.status });
    try {
      const payload = await this.fetchRooms(signal);
      if (!this.#visible || version !== this.#requestVersion) return false;
      if (!Array.isArray(payload.rooms)) {
        throw new TypeError("Room response must contain a rooms array");
      }
      this.rooms = payload.rooms;
      this.status = "ready";
      this.#emit("roomschange", { rooms: this.rooms, receivedAt: Date.now() });
      this.#emit("statechange", { visible: true, status: this.status });
      return true;
    } catch (error) {
      if (!this.#visible || version !== this.#requestVersion) return false;
      const timedOut = timeout.aborted;
      if (controller.signal.aborted && !timedOut) return false;
      this.status = "error";
      this.#emit("error", { error, timedOut });
      this.#emit("statechange", { visible: true, status: this.status });
      return false;
    } finally {
      if (version === this.#requestVersion) this.#request = null;
    }
  }

  join(name, roomId) {
    if (!this.#visible) return false;
    const playerName = name.trim();
    const room = this.rooms.find((candidate) => candidate.id === roomId);
    if (playerName.length < 2) {
      this.#emit("validationerror", {
        field: "name",
        message: "Call sign needs at least two characters.",
      });
      return false;
    }
    if (!room) {
      this.#emit("validationerror", {
        field: "room",
        message: "Choose an available flight room.",
      });
      return false;
    }
    this.#emit("joined", { playerName, room });
    this.leave();
    return true;
  }

  #emit(name, detail) {
    this.dispatchEvent(createDetailEvent(name, detail));
  }
}
