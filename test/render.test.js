import assert from "node:assert/strict";
import { test } from "node:test";
import { interpolateShip } from "../src/render/draw.js";
import { createShip } from "../src/sim/ship.js";

test("renderer interpolates frozen snapshots across the short angular seam", () => {
  const previous = Object.freeze({
    ...createShip(10, 20),
    angle: (179 * Math.PI) / 180,
  });
  const current = Object.freeze({
    ...createShip(30, 60),
    angle: (-179 * Math.PI) / 180,
  });
  const visual = interpolateShip(previous, current, 0.5);
  assert.equal(visual.x, 20);
  assert.equal(visual.y, 40);
  assert.ok(Math.abs(Math.abs(visual.angle) - Math.PI) < 1e-12);
  assert.equal(previous.x, 10);
  assert.equal(current.x, 30);
});
