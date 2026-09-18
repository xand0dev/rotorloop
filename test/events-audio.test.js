import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { AudioEngine } from "../src/audio.js";
import { GameEvents } from "../src/events.js";
import { drawSpriteFrame } from "../src/render/draw.js";
import { Asteroid, Bullet } from "../src/sim/entities.js";
import { Ship } from "../src/sim/ship.js";
import { Vector2 } from "../src/sim/vector.js";
import { World } from "../src/sim/world.js";

test("world event payloads decouple fired, hit, explosion, score, and state changes", () => {
  const events = new GameEvents();
  const received = [];
  for (const type of [
    "fired",
    "hit",
    "exploded",
    "scorechange",
    "statechange",
  ]) {
    events.addEventListener(type, (event) =>
      received.push([type, event.detail]),
    );
  }
  const world = new World({ width: 400, height: 300, events });
  const ship = world.spawn(new Ship(30, 30));
  ship.fireCooldown = 0;
  const fired = world.firePlayerWeapon();
  assert.equal(
    received.find(([type]) => type === "fired")[1].entityId,
    fired.id,
  );

  const bullet = world.spawn(
    new Bullet({ pos: new Vector2(160, 120), vel: new Vector2() }),
  );
  const asteroid = world.spawn(
    new Asteroid({ pos: new Vector2(160, 120), vel: new Vector2() }),
  );
  world.step(0);
  const hit = received.find(
    ([type, detail]) => type === "hit" && detail.targetId === asteroid.id,
  )[1];
  assert.deepEqual(hit, {
    target: "asteroid",
    targetId: asteroid.id,
    damage: bullet.damage,
    destroyed: true,
  });
  assert.ok(received.some(([type]) => type === "exploded"));
  assert.ok(
    received.some(
      ([type, detail]) => type === "scorechange" && detail.score === 100,
    ),
  );
});

test("simulation source imports no audio, HUD, or DOM module", async () => {
  const source = await readFile(
    new URL("../src/sim/world.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /audio|hud|document|window/i);
});

test("AudioEngine unlocks on demand and uses a fresh source for overlapping sounds", async () => {
  const sources = [];
  const context = {
    state: "suspended",
    destination: {},
    async resume() {
      this.state = "running";
    },
    createBufferSource() {
      const source = {
        playbackRate: { value: 1 },
        connect() {},
        startCalls: 0,
        start() {
          this.startCalls += 1;
        },
      };
      sources.push(source);
      return source;
    },
    createGain() {
      return { gain: { value: 1 }, connect() {} };
    },
  };
  const events = new GameEvents();
  const audio = new AudioEngine({ createContext: () => context });
  audio.attach(events, new Map([["shoot", { id: "buffer" }]]));
  events.emit("fired", {});
  assert.equal(sources.length, 0);
  await audio.unlock();
  events.emit("fired", {});
  events.emit("fired", {});
  assert.equal(sources.length, 2);
  assert.notEqual(sources[0], sources[1]);
  assert.ok(sources.every((source) => source.startCalls === 1));
});

test("sprite rendering uses the manifest source rectangle explicitly", () => {
  const calls = [];
  const context = { drawImage: (...args) => calls.push(args) };
  const image = {};
  drawSpriteFrame(context, image, [128, 0, 128, 128], 25);
  assert.deepEqual(calls, [[image, 128, 0, 128, 128, -12.5, -12.5, 25, 25]]);
});
