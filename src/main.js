import { createInput } from "./input.js";
import { createLoop } from "./loop.js";
import { createCanvas } from "./render/canvas.js";
import {
  drawArena,
  drawHud,
  drawShip,
  interpolateShip,
} from "./render/draw.js";
import { wrapShip, wrapState } from "./sim/arena.js";
import { createShip, integrate } from "./sim/ship.js";
import "./style.css";

const canvas = document.querySelector("#arena");
const input = createInput(window);
let current = createShip();
let previous = current;
const surface = createCanvas(canvas, ({ width, height }) => {
  current = wrapShip(current, width, height);
  previous = current;
});
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function reset() {
  const { width, height } = surface.getSize();
  current = createShip(width / 2, height / 2);
  previous = current;
}

function simulate(dt) {
  if (input.justPressed("KeyR")) reset();
  const { width, height } = surface.getSize();
  const controls = {
    turn:
      Number(input.isDown("KeyD") || input.isDown("ArrowRight")) -
      Number(input.isDown("KeyA") || input.isDown("ArrowLeft")),
    thrust: input.isDown("KeyW") || input.isDown("ArrowUp"),
  };
  const next = integrate(current, controls, dt);
  ({ previous, current } = wrapState(current, next, width, height));
}

function render(alpha) {
  const size = surface.getSize();
  if (size.width <= 0 || size.height <= 0) return;
  drawArena(surface.ctx, size);
  drawShip(surface.ctx, interpolateShip(previous, current, alpha), {
    reducedMotion: reducedMotion.matches,
  });
  drawHud(surface.ctx, loop.getStats(), size);
}

const loop = createLoop({ simulate, render });
reset();
loop.start();

function focusArena() {
  canvas.focus({ preventScroll: true });
}
canvas.addEventListener("pointerdown", focusArena);

// Vite replaces modules during development; leave no old listeners or rAF behind.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    loop.stop();
    input.destroy();
    surface.destroy();
    canvas.removeEventListener("pointerdown", focusArena);
  });
}
