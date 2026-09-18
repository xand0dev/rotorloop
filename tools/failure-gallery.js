import { loadImage, loadJson } from "../src/assets/loader.js";
import { createCanvas } from "../src/render/canvas.js";
import { drawLoadingScreen } from "../src/render/screens.js";
import "../src/style.css";

const canvas = document.querySelector("#arena");
const uiRoot = document.querySelector("#ui-root");
const liveRegion = document.querySelector("#status-live");
const surface = createCanvas(canvas);
const caseId = new URLSearchParams(window.location.search).get("case") ?? "404";
let controller = null;
let attempt = 0;
let state = {
  phase: "loading",
  label: `Failure evidence: ${caseId}`,
  completed: 0,
  total: 1,
  ratio: 0,
};

const cases = {
  404: (signal) => loadImage("/missing-sprite.svg", { signal }),
  timeout: () =>
    loadJson("/__lab03/slow-json", { signal: AbortSignal.timeout(80) }),
  abort: (signal) => {
    const timer = setTimeout(
      () => controller.abort(new DOMException("Evidence abort", "AbortError")),
      80,
    );
    return loadJson("/__lab03/slow-json", { signal }).finally(() =>
      clearTimeout(timer),
    );
  },
  malformed: (signal) => loadJson("/evidence-malformed.txt", { signal }),
};

async function recoveredLoad(signal) {
  if (caseId === "404") {
    return await loadImage("/assets/rotorloop-sprites.svg", { signal });
  }
  return await loadJson("/assets/arena.json", { signal });
}

function render() {
  surface.syncDpr();
  drawLoadingScreen(surface.ctx, surface.getSize(), state);
  requestAnimationFrame(render);
}

function setButton(label, action) {
  uiRoot.innerHTML = '<button class="primary-action" type="button"></button>';
  const button = uiRoot.querySelector("button");
  button.textContent = label;
  button.addEventListener("click", action, { once: true });
}

async function run() {
  controller?.abort();
  controller = new AbortController();
  state = {
    phase: "loading",
    label: attempt === 0 ? `Running ${caseId} case` : "Using recovered asset",
    completed: 0,
    total: 1,
    ratio: 0,
  };
  uiRoot.replaceChildren();
  try {
    if (attempt === 0) {
      await cases[caseId](controller.signal);
      throw new Error(`Unknown evidence case: ${caseId}`);
    }
    await recoveredLoad(controller.signal);
    state = {
      phase: "loading",
      label: `${caseId} case recovered successfully`,
      completed: 1,
      total: 1,
      ratio: 1,
      message: "The same loader completed with a corrected endpoint.",
    };
    liveRegion.textContent = `${caseId} case recovered`;
    setButton("Recovery verified", () => {});
  } catch (error) {
    state = {
      ...state,
      phase: error.name === "AbortError" ? "cancelled" : "error",
      message: `${error.name}: ${error.message}`,
    };
    liveRegion.textContent = `${caseId} case failed safely: ${state.message}`;
    setButton("Retry recovered path", () => {
      attempt += 1;
      void run();
    });
  }
}

requestAnimationFrame(render);
void run();
