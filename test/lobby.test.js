import assert from "node:assert/strict";
import { test } from "node:test";
import { Lobby } from "../src/lobby/lobby.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

test("Lobby emits rooms and join events, validates input, and clears its interval", async () => {
  let intervalCallback;
  const cleared = [];
  const lobby = new Lobby({
    url: "/api/rooms",
    fetchRooms: async () => ({
      rooms: [{ id: "north", name: "North", arena: {} }],
    }),
    setIntervalImpl(callback) {
      intervalCallback = callback;
      return 44;
    },
    clearIntervalImpl: (id) => cleared.push(id),
  });
  const roomEvents = [];
  const joined = [];
  const validation = [];
  lobby.addEventListener("roomschange", (event) =>
    roomEvents.push(event.detail.rooms),
  );
  lobby.addEventListener("joined", (event) => joined.push(event.detail));
  lobby.addEventListener("validationerror", (event) =>
    validation.push(event.detail.field),
  );

  assert.equal(await lobby.refresh(), false);
  lobby.enter();
  await flush();
  assert.equal(lobby.visible, true);
  assert.equal(typeof intervalCallback, "function");
  assert.equal(roomEvents.length, 1);
  assert.equal(lobby.join("x", "north"), false);
  assert.equal(lobby.join("Kestrel", "missing"), false);
  assert.deepEqual(validation, ["name", "room"]);
  assert.equal(lobby.join("Kestrel", "north"), true);
  assert.equal(joined[0].playerName, "Kestrel");
  assert.equal(lobby.visible, false);
  assert.deepEqual(cleared, [44]);
});

test("Lobby refreshes only while visible and aborts in-flight work on leave", async () => {
  let calls = 0;
  let currentSignal;
  let intervalCallback;
  const lobby = new Lobby({
    url: "/api/rooms",
    fetchRooms: async (signal) => {
      calls += 1;
      currentSignal = signal;
      return await new Promise(() => {});
    },
    setIntervalImpl(callback) {
      intervalCallback = callback;
      return 1;
    },
    clearIntervalImpl() {},
  });
  assert.equal(await lobby.refresh(), false);
  assert.equal(calls, 0);
  lobby.enter();
  await flush();
  assert.equal(calls, 1);
  lobby.leave();
  assert.equal(currentSignal.aborted, true);
  intervalCallback();
  await flush();
  assert.equal(calls, 1);
});

test("Lobby reports request timeout distinctly", async () => {
  const timeout = new AbortController();
  const errors = [];
  const lobby = new Lobby({
    url: "/api/rooms",
    fetchRooms: async (signal) =>
      await new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      ),
    timeoutSignal: () => timeout.signal,
    setIntervalImpl: () => 1,
    clearIntervalImpl() {},
  });
  lobby.addEventListener("error", (event) => errors.push(event.detail));
  lobby.enter();
  timeout.abort(new DOMException("late", "TimeoutError"));
  await flush();
  assert.equal(lobby.status, "error");
  assert.equal(errors[0].timedOut, true);
  assert.equal(errors[0].error.name, "TimeoutError");
  lobby.leave();
});

test("an older room response cannot overwrite a newer refresh", async () => {
  const requests = [deferred(), deferred()];
  let call = 0;
  const lobby = new Lobby({
    url: "/api/rooms",
    fetchRooms: async () => await requests[call++].promise,
    setIntervalImpl: () => 1,
    clearIntervalImpl() {},
  });
  const snapshots = [];
  lobby.addEventListener("roomschange", (event) =>
    snapshots.push(event.detail.rooms.map((room) => room.id)),
  );
  lobby.enter();
  await flush();
  const newer = lobby.refresh();
  requests[1].resolve({ rooms: [{ id: "new" }] });
  await newer;
  requests[0].resolve({ rooms: [{ id: "old" }] });
  await flush();
  assert.deepEqual(snapshots, [["new"]]);
  assert.equal(lobby.rooms[0].id, "new");
  lobby.leave();
});
