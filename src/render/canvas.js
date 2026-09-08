// CSS pixels belong to the arena; physical pixels belong only to this module.
export function createCanvas(canvas, onResize = () => {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("RotorLoop requires Canvas 2D support.");

  let size = { width: 0, height: 0, dpr: 1 };
  let media;
  let destroyed = false;

  function resize() {
    if (destroyed) return;
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (width === size.width && height === size.height && dpr === size.dpr) {
      return;
    }
    size = { width, height, dpr };
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // An absolute transform cannot compound across repeated resize events.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize({ ...size });
  }

  function watchDensity() {
    media?.removeEventListener("change", watchDensity);
    if (destroyed) return;
    resize();
    media = window.matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`,
    );
    media.addEventListener("change", watchDensity);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener("resize", resize);
  watchDensity();

  return {
    ctx,
    getSize: () => ({ ...size }),
    // Some hosts change DPR without delivering a media-query change event.
    // This cheap frame check reads layout only when density actually changes.
    syncDpr() {
      if ((window.devicePixelRatio || 1) !== size.dpr) watchDensity();
    },
    destroy() {
      destroyed = true;
      observer.disconnect();
      window.removeEventListener("resize", resize);
      media?.removeEventListener("change", watchDensity);
    },
  };
}
