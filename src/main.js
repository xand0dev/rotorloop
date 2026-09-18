import { createInput } from "./input.js";
import { createLoop } from "./loop.js";
import { createCanvas } from "./render/canvas.js";
import { drawArena, drawHud, drawWorld } from "./render/draw.js";
import { World } from "./sim/world.js";
import "./style.css";

const canvas = document.querySelector("#arena");
const input = createInput(window);
const world = new World();
const surface = createCanvas(canvas, ({ width, height }) => {
  world.resize(width, height);
});
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let showTelemetry = surface.getSize().width >= 900;

function reset() {
  const { width, height } = surface.getSize();
  world.resize(width, height);
  world.reset();
}

// The wrapper keeps Ship#fire attached to its receiver; see README's `this` note.
const fire = () => world.firePlayerWeapon();

function simulate(dt) {
  if (input.justPressed("KeyR")) reset();
  const turnRight =
    input.isDown("KeyD") ||
    input.isDown("ArrowRight") ||
    input.justPressed("KeyD") ||
    input.justPressed("ArrowRight");
  const turnLeft =
    input.isDown("KeyA") ||
    input.isDown("ArrowLeft") ||
    input.justPressed("KeyA") ||
    input.justPressed("ArrowLeft");
  const thrust =
    input.isDown("KeyW") ||
    input.isDown("ArrowUp") ||
    input.justPressed("KeyW") ||
    input.justPressed("ArrowUp");
  world.step(
    dt,
    {
      turn: Number(turnRight) - Number(turnLeft),
      thrust,
      fire: input.isDown("Space") || input.justPressed("Space"),
    },
    fire,
  );
}

function render(alpha) {
  if (input.justPressed("KeyH")) showTelemetry = !showTelemetry;
  surface.syncDpr();
  const size = surface.getSize();
  if (size.width <= 0 || size.height <= 0) return;
  drawArena(surface.ctx, size);
  drawWorld(surface.ctx, world, alpha, {
    reducedMotion: reducedMotion.matches,
  });
  drawHud(surface.ctx, loop.getStats(), world, size, alpha, showTelemetry);
}

const loop = createLoop({ simulate, render });
reset();
loop.start();

function focusArena() {
  canvas.focus({ preventScroll: true });
}
canvas.addEventListener("pointerdown", focusArena);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    loop.stop();
    input.destroy();
    surface.destroy();
    canvas.removeEventListener("pointerdown", focusArena);
  });
}
