import { isAbortError } from "./assets/errors.js";
import { fetchJson, loadAll, withRetry } from "./assets/loader.js";
import { AudioEngine } from "./audio.js";
import { GameEvents } from "./events.js";
import { createHudModel } from "./hud.js";
import { createInput } from "./input.js";
import { Lobby } from "./lobby/lobby.js";
import { mountLobby } from "./lobby/view.js";
import { createLoop } from "./loop.js";
import { createCanvas } from "./render/canvas.js";
import { drawArena, drawHud, drawWorld } from "./render/draw.js";
import { drawLoadingScreen, drawLobbyField } from "./render/screens.js";
import { World } from "./sim/world.js";
import "./style.css";

const canvas = document.querySelector("#arena");
const uiRoot = document.querySelector("#ui-root");
const liveRegion = document.querySelector("#status-live");
const events = new GameEvents();
const input = createInput(window);
const world = new World({ events });
const hud = createHudModel(events);
const audio = new AudioEngine();
const surface = createCanvas(canvas, ({ width, height }) => {
  world.resize(width, height);
});
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
const manifestUrl = new URL("assets/manifest.json", baseUrl).href;
const roomsUrl = new URL("api/rooms", baseUrl).href;

let showTelemetry = surface.getSize().width >= 900;
let screen = "loading";
let assets = null;
let spriteSheet = null;
let lobby = null;
let lobbyView = null;
let loadingController = null;
let staticFrame = null;
let loadingState = {
  phase: "loading",
  label: "Requesting asset manifest",
  completed: 0,
  total: null,
  ratio: 0,
};

function publicManifest(manifest) {
  const resolveItems = (items = []) =>
    items.map((item) => ({
      ...item,
      url: new URL(item.url, manifestUrl).href,
    }));
  return {
    ...manifest,
    sprites: resolveItems(manifest.sprites),
    audio: resolveItems(manifest.audio),
    json: resolveItems(manifest.json),
  };
}

function reset(arena = world.arena) {
  const { width, height } = surface.getSize();
  world.resize(width, height);
  world.reset(arena);
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
    sprites: spriteSheet,
  });
  drawHud(
    surface.ctx,
    loop.getStats(),
    world,
    size,
    alpha,
    showTelemetry,
    hud.snapshot(),
  );
}

const loop = createLoop({ simulate, render });

function drawStatic() {
  surface.syncDpr();
  const size = surface.getSize();
  if (screen === "loading") {
    drawLoadingScreen(surface.ctx, size, loadingState);
  } else if (screen === "lobby") {
    drawLobbyField(surface.ctx, size);
  } else {
    staticFrame = null;
    return;
  }
  staticFrame = requestAnimationFrame(drawStatic);
}

function ensureStaticRendering() {
  if (staticFrame === null) staticFrame = requestAnimationFrame(drawStatic);
}

function setLoadingControls(mode) {
  uiRoot.className = "ui-layer loading-controls";
  if (mode === "loading") {
    uiRoot.innerHTML =
      '<button class="quiet-action" type="button">Cancel loading</button>';
    uiRoot.querySelector("button").addEventListener("click", () => {
      loadingController?.abort(
        new DOMException("Cancelled by pilot", "AbortError"),
      );
    });
  } else {
    uiRoot.innerHTML =
      '<button class="primary-action" type="button">Retry startup</button>';
    uiRoot.querySelector("button").addEventListener("click", () => {
      void startPipeline();
    });
  }
}

function startLobby() {
  loop.stop();
  input.clear();
  screen = "lobby";
  uiRoot.className = "ui-layer lobby-layer";
  if (!lobby) {
    lobby = new Lobby({ url: roomsUrl });
    lobbyView = mountLobby(uiRoot, lobby);
    lobby.addEventListener("joined", (event) => void beginGame(event.detail));
  } else if (!lobbyView) {
    lobbyView = mountLobby(uiRoot, lobby);
  }
  lobby.enter();
  ensureStaticRendering();
}

async function beginGame({ playerName, room }) {
  try {
    await audio.unlock();
  } catch (error) {
    console.warn("Audio remains muted", error);
  }
  lobbyView?.destroy();
  lobbyView = null;
  uiRoot.className = "ui-layer game-controls";
  uiRoot.innerHTML =
    '<div class="pilot-chip"><span></span><small></small></div><button class="quiet-action" type="button">Leave arena</button>';
  uiRoot.querySelector(".pilot-chip span").textContent = playerName;
  uiRoot.querySelector(".pilot-chip small").textContent = room.name;
  uiRoot.querySelector("button").addEventListener("click", startLobby);
  const baseArena = assets.json.get("arena");
  screen = "game";
  if (staticFrame !== null) cancelAnimationFrame(staticFrame);
  staticFrame = null;
  reset({ ...baseArena, ...room.arena });
  loop.start();
  canvas.focus({ preventScroll: true });
}

async function startPipeline() {
  loadingController?.abort(new DOMException("Restarted", "AbortError"));
  loadingController = new AbortController();
  const { signal } = loadingController;
  loop.stop();
  screen = "loading";
  loadingState = {
    phase: "loading",
    label: "Requesting asset manifest",
    completed: 0,
    total: null,
    ratio: 0,
  };
  setLoadingControls("loading");
  ensureStaticRendering();
  let acceptingProgress = true;
  try {
    const manifest = publicManifest(
      await withRetry(() => fetchJson(manifestUrl, { signal }), { signal }),
    );
    const total =
      manifest.sprites.length + manifest.audio.length + manifest.json.length;
    loadingState = { ...loadingState, total, label: "Manifest verified" };
    const audioContext = audio.prepareContext();
    assets = await loadAll(manifest, {
      signal,
      audioContext,
      onProgress(progress) {
        if (!acceptingProgress || signal.aborted) return;
        loadingState = {
          phase: "loading",
          label: progress.item.name ?? progress.item.id,
          completed: progress.completed,
          total: progress.total,
          ratio: progress.ratio,
        };
        liveRegion.textContent = `${loadingState.label}: ${Math.round(progress.ratio * 100)} percent loaded`;
      },
    });
    const sprites = manifest.sprites.find((item) => item.id === "entities");
    spriteSheet = {
      image: assets.sprites.get("entities"),
      frames: sprites.frames,
    };
    audio.attach(events, assets.audio);
    loadingState = {
      phase: "loading",
      label: "All systems ready",
      completed: total,
      total,
      ratio: 1,
    };
    startLobby();
  } catch (error) {
    if (signal !== loadingController.signal) return;
    acceptingProgress = false;
    if (!signal.aborted) loadingController.abort(error);
    screen = "loading";
    ensureStaticRendering();
    const cancelled = isAbortError(error);
    loadingState = {
      ...loadingState,
      phase: cancelled ? "cancelled" : "error",
      message: cancelled
        ? "No pending request or retry delay remains."
        : error.message,
    };
    liveRegion.textContent = cancelled
      ? "Startup cancelled. Retry is available."
      : `Startup failed: ${error.message}. Retry is available.`;
    setLoadingControls("retry");
  }
}

function focusArena() {
  if (screen === "game") canvas.focus({ preventScroll: true });
}
canvas.addEventListener("pointerdown", focusArena);

void startPipeline();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    loadingController?.abort();
    lobby?.leave();
    lobbyView?.destroy();
    loop.stop();
    input.destroy();
    hud.destroy();
    audio.detach();
    surface.destroy();
    canvas.removeEventListener("pointerdown", focusArena);
    if (staticFrame !== null) cancelAnimationFrame(staticFrame);
  });
}
