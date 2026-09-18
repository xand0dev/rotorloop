export class AudioEngine {
  #context = null;
  #buffers = new Map();
  #events = null;
  #listeners = [];

  constructor({ createContext } = {}) {
    this.createContext =
      createContext ??
      (() => new (globalThis.AudioContext ?? globalThis.webkitAudioContext)());
    this.unlocked = false;
  }

  prepareContext() {
    this.#context ??= this.createContext();
    return this.#context;
  }

  get context() {
    return this.prepareContext();
  }

  async unlock() {
    const context = this.prepareContext();
    if (context.state === "suspended") await context.resume();
    this.unlocked = context.state === "running";
    return this.unlocked;
  }

  attach(events, buffers) {
    this.detach();
    this.#events = events;
    this.#buffers = new Map(buffers);
    const sounds = {
      fired: "shoot",
      hit: "hit",
      exploded: "explosion",
    };
    for (const [eventName, soundId] of Object.entries(sounds)) {
      const listener = () => this.play(soundId);
      events.addEventListener(eventName, listener);
      this.#listeners.push([eventName, listener]);
    }
  }

  play(id, { gain = 1, playbackRate = 1 } = {}) {
    const buffer = this.#buffers.get(id);
    if (!this.unlocked || !buffer || !this.#context) return false;
    const source = this.#context.createBufferSource();
    const gainNode = this.#context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gainNode.gain.value = gain;
    source.connect(gainNode);
    gainNode.connect(this.#context.destination);
    source.start();
    return true;
  }

  detach() {
    if (this.#events) {
      for (const [name, listener] of this.#listeners) {
        this.#events.removeEventListener(name, listener);
      }
    }
    this.#events = null;
    this.#listeners = [];
  }
}
