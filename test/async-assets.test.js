import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError, JsonParseError } from "../src/assets/errors.js";
import {
  fetchJson,
  loadAll,
  loadAudio,
  loadImage,
  loadJson,
  withRetry,
} from "../src/assets/loader.js";

function response({ status = 200, json = { ok: true }, url = "/data" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "Server Error",
    url,
    async json() {
      if (json instanceof Error) throw json;
      return json;
    },
    async blob() {
      return new Blob(["image"]);
    },
    async arrayBuffer() {
      return new ArrayBuffer(8);
    },
  };
}

test("fetchJson succeeds and classifies 404, 5xx, and malformed JSON", async () => {
  assert.deepEqual(
    await fetchJson("/ok", { fetchImpl: async () => response() }),
    { ok: true },
  );

  await assert.rejects(
    fetchJson("/missing", {
      fetchImpl: async () => response({ status: 404 }),
    }),
    (error) =>
      error instanceof HttpError &&
      error.status === 404 &&
      error.category === "client" &&
      error.retryable === false,
  );

  await assert.rejects(
    fetchJson("/down", {
      fetchImpl: async () => response({ status: 503 }),
    }),
    (error) =>
      error instanceof HttpError &&
      error.status === 503 &&
      error.category === "server" &&
      error.retryable === true,
  );

  await assert.rejects(
    fetchJson("/broken", {
      fetchImpl: async () => response({ json: new SyntaxError("bad") }),
    }),
    JsonParseError,
  );
});

test("withRetry uses an injected exponential schedule and deterministic jitter", async () => {
  const waits = [];
  let calls = 0;
  const value = await withRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw new TypeError("network");
      return "ready";
    },
    {
      attempts: 4,
      baseMs: 100,
      jitter: 0.25,
      rng: () => 0.5,
      delay: async (ms) => waits.push(ms),
    },
  );
  assert.equal(value, "ready");
  assert.equal(calls, 3);
  assert.deepEqual(waits, [100, 200]);
});

test("withRetry never retries 4xx and aborts a pending delay", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls += 1;
        throw new HttpError(response({ status: 404 }), "/missing");
      },
      { attempts: 5 },
    ),
    HttpError,
  );
  assert.equal(calls, 1);

  const controller = new AbortController();
  let delayStarted;
  const started = new Promise((resolve) => {
    delayStarted = resolve;
  });
  const pending = withRetry(
    async () => {
      throw new TypeError("offline");
    },
    {
      attempts: 3,
      signal: controller.signal,
      delay: async (_ms, signal) => {
        delayStarted();
        await new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      },
    },
  );
  await started;
  controller.abort(new DOMException("stop", "AbortError"));
  await assert.rejects(pending, { name: "AbortError" });
});

test("loadAll starts every item concurrently, maps results stably, and reports monotonic progress", async () => {
  const resolvers = new Map();
  const started = [];
  const loader = (item) => {
    started.push(item.id);
    return new Promise((resolve) => resolvers.set(item.id, resolve));
  };
  const progress = [];
  const pending = loadAll(
    {
      sprites: [{ id: "ship", url: "/ship" }],
      audio: [{ id: "shoot", url: "/shoot" }],
      json: [{ id: "arena", url: "/arena" }],
    },
    {
      loaders: { sprites: loader, audio: loader, json: loader },
      onProgress: (event) => progress.push(event),
    },
  );
  await Promise.resolve();
  assert.deepEqual(started, ["ship", "shoot", "arena"]);
  resolvers.get("arena")({ gravity: 0 });
  await Promise.resolve();
  resolvers.get("ship")("ship-image");
  await Promise.resolve();
  resolvers.get("shoot")("shoot-buffer");
  const result = await pending;
  assert.equal(result.sprites.get("ship"), "ship-image");
  assert.equal(result.audio.get("shoot"), "shoot-buffer");
  assert.deepEqual(result.json.get("arena"), { gravity: 0 });
  assert.deepEqual(
    progress.map(({ completed, total, ratio }) => [completed, total, ratio]),
    [
      [1, 3, 1 / 3],
      [2, 3, 2 / 3],
      [3, 3, 1],
    ],
  );
});

test("abort propagates through image, audio, and JSON loaders", async () => {
  for (const load of [
    (options) => loadImage("/ship", options),
    (options) =>
      loadAudio({ decodeAudioData: async () => "decoded" }, "/sound", options),
    (options) => loadJson("/arena", options),
  ]) {
    const controller = new AbortController();
    let receivedSignal;
    const pending = load({
      signal: controller.signal,
      fetchImpl: async (_url, { signal }) => {
        receivedSignal = signal;
        return await new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      },
    });
    controller.abort(new DOMException("leave", "AbortError"));
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(receivedSignal, controller.signal);
  }
});

test("Promise.all fails fast while already-started work can still settle", async () => {
  let finishSlow;
  const slow = new Promise((resolve) => {
    finishSlow = resolve;
  });
  const combined = Promise.all([
    slow.then(() => "slow"),
    Promise.reject(new Error("critical asset failed")),
  ]);
  await assert.rejects(combined, /critical asset failed/);
  finishSlow();
  assert.equal(await slow, undefined);
});
