import assert from "node:assert/strict";
import { test } from "node:test";
import { createCanvas } from "../src/render/canvas.js";

test("DPR-only changes recover without events and never compound transforms", () => {
  const oldWindow = globalThis.window;
  const oldObserver = globalThis.ResizeObserver;
  const target = new EventTarget();
  target.devicePixelRatio = 1;
  target.matchMedia = () => new EventTarget();
  globalThis.window = target;
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  const transforms = [];
  let reads = 0;
  const canvas = {
    getContext: () => ({
      setTransform: (...matrix) => transforms.push(matrix),
    }),
    getBoundingClientRect: () => {
      reads += 1;
      return { width: 900, height: 600 };
    },
  };
  try {
    const surface = createCanvas(canvas);
    assert.equal(canvas.width, 900);
    surface.syncDpr();
    assert.equal(reads, 1);
    target.devicePixelRatio = 2;
    surface.syncDpr();
    assert.equal(canvas.width, 1800);
    assert.equal(canvas.height, 1200);
    assert.equal(surface.getSize().width, 900);
    assert.deepEqual(transforms.at(-1), [2, 0, 0, 2, 0, 0]);
    target.dispatchEvent(new Event("resize"));
    assert.equal(transforms.length, 2);
    surface.destroy();
    target.devicePixelRatio = 3;
    surface.syncDpr();
    assert.equal(canvas.width, 1800);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldObserver === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = oldObserver;
  }
});
