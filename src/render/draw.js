import { shortestAngleDelta } from "../sim/arena.js";

const COLORS = {
  field: "#101c27",
  grid: "#1c2c39",
  marking: "#344b5b",
  muted: "#91a5b4",
  pale: "#e3eced",
  orange: "#ffae62",
};
const MONO = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';

export function interpolateShip(previous, current, alpha) {
  return {
    ...current,
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
    angle:
      previous.angle +
      shortestAngleDelta(previous.angle, current.angle) * alpha,
  };
}

export function drawArena(ctx, { width, height }) {
  ctx.save();
  ctx.fillStyle = COLORS.field;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const spacing = 64;
  for (let x = width % spacing; x < width; x += spacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = height % spacing; y < height; y += spacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // A landing-ring reference makes both drift and heading easy to perceive.
  ctx.translate(width / 2, height / 2);
  const radius = Math.min(92, width * 0.2, height * 0.2);
  ctx.strokeStyle = COLORS.marking;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(14, 0);
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 14);
  ctx.stroke();
  ctx.restore();
}

export function drawShip(ctx, ship, { reducedMotion = false } = {}) {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  if (ship.thrust) {
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.globalAlpha = reducedMotion ? 0.45 : 0.7;
    ctx.beginPath();
    for (const y of [-9, 0, 9]) {
      ctx.moveTo(-22, y);
      ctx.lineTo(y === 0 ? -48 : -38, y * 1.6);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = COLORS.pale;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-15, -15);
  ctx.lineTo(15, 15);
  ctx.moveTo(-15, 15);
  ctx.lineTo(15, -15);
  ctx.stroke();

  for (const x of [-16, 16]) {
    for (const y of [-16, 16]) {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.field;
      ctx.fill();
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.pale;
      ctx.fill();
    }
  }

  ctx.fillStyle = COLORS.pale;
  ctx.fillRect(-11, -7, 23, 14);
  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(9, -7);
  ctx.lineTo(9, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTelemetry(ctx, stats, x, y, width, alpha) {
  const left = x + 14;
  const plotWidth = width - 28;
  const plotTop = y + 40;
  const plotHeight = 56;
  const chartMaxMs = 50;
  ctx.fillStyle = "rgba(16, 28, 39, 0.96)";
  ctx.fillRect(x, y, width, 272);
  ctx.fillStyle = COLORS.pale;
  ctx.font = `11px ${MONO}`;
  ctx.fillText("LOOP TELEMETRY", left, y + 20);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `9px ${MONO}`;
  ctx.fillText(
    `LAST ${stats.frameHistory.length}/120 INTERVALS · H HIDE`,
    left,
    y + 33,
  );

  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(left, plotTop, plotWidth, plotHeight);
  const barWidth = plotWidth / 120;
  for (const [index, interval] of stats.frameHistory.entries()) {
    const barHeight = Math.min(interval / chartMaxMs, 1) * plotHeight;
    ctx.fillStyle = interval > 1000 / 60 ? "#ff7373" : COLORS.muted;
    ctx.fillRect(
      left + (120 - stats.frameHistory.length + index) * barWidth,
      plotTop + plotHeight - barHeight,
      Math.max(1, barWidth - 0.5),
      barHeight,
    );
  }
  const referenceY = plotTop + plotHeight * (1 - 1000 / 60 / chartMaxMs);
  ctx.strokeStyle = COLORS.orange;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(left, referenceY);
  ctx.lineTo(left + plotWidth, referenceY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("16.7 ms REF · SCALE 0–50 ms (CLIPPED)", left, y + 108);

  const columns = [
    ["MEAN ms", stats.meanFrameMs],
    ["P95 ms", stats.p95FrameMs],
    ["MAX ms", stats.maxFrameMs],
  ];
  for (const [index, [label, value]] of columns.entries()) {
    const columnX = left + (index * plotWidth) / 3;
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(label, columnX, y + 126);
    ctx.font = `12px ${MONO}`;
    ctx.fillStyle = COLORS.pale;
    ctx.fillText(
      stats.frameHistory.length ? value.toFixed(1) : "—",
      columnX,
      y + 142,
    );
  }

  const rows = [
    ["STEPS / FRAME", `${stats.stepsThisFrame}`],
    ["SIM CLOCK", `${stats.simulationSeconds.toFixed(2)} s`],
    ["TOTAL TICKS", `${stats.totalSteps}`],
    ["CLAMP LOST", `${(stats.discardedMs / 1000).toFixed(3)} s`],
  ];
  ctx.font = `10px ${MONO}`;
  for (const [index, [label, value]] of rows.entries()) {
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(label, left, y + 164 + index * 18);
    ctx.fillStyle = COLORS.pale;
    ctx.fillText(value, left + 135, y + 164 + index * 18);
  }
  ctx.fillStyle = COLORS.marking;
  ctx.fillRect(left, y + 234, plotWidth, 3);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(left, y + 234, plotWidth * alpha, 3);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `9px ${MONO}`;
  ctx.fillText(
    `α ${alpha.toFixed(2)} · TOTALS SINCE LOOP START`,
    left,
    y + 254,
  );
}

export function drawHud(
  ctx,
  stats,
  { width, height },
  alpha = 0,
  showTelemetry = false,
) {
  const inset = width < 500 ? 20 : 32;
  ctx.save();
  ctx.fillStyle = "rgba(16, 28, 39, 0.93)";
  ctx.fillRect(inset - 10, inset - 12, 248, 151);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(inset, inset, 4, 23);
  ctx.fillStyle = COLORS.pale;
  ctx.font = '700 22px "Arial Narrow", Arial, sans-serif';
  ctx.fillText("ROTORLOOP", inset + 14, inset + 20);
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("FPV DRONE ARENA / LAB 01", inset, inset + 42);

  const rows = [
    ["SIM", `${stats.stepsPerSecond.toFixed(1)} steps/s`],
    ["DISPLAY", `${stats.framesPerSecond.toFixed(1)} fps`],
    ["FRAME", `${stats.frameMs.toFixed(1)} ms`],
  ];
  ctx.font = `12px ${MONO}`;
  for (const [index, [label, value]] of rows.entries()) {
    const y = inset + 69 + index * 23;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(label, inset, y);
    ctx.fillStyle = COLORS.pale;
    ctx.fillText(value, inset + 85, y);
  }

  // This is the real accumulator remainder, not a decorative progress meter.
  const telemetryFits =
    width >= 300 && (width >= 900 ? height >= 390 : height >= 540);
  const expanded = showTelemetry && telemetryFits;
  if (expanded) {
    const panelWidth = Math.min(320, width - 2 * inset);
    drawTelemetry(
      ctx,
      stats,
      width >= 900 ? width - inset - panelWidth : inset,
      width >= 900 ? inset : 178,
      panelWidth,
      alpha,
    );
  } else if (width >= 720) {
    const x = width - inset - 200;
    ctx.fillStyle = COLORS.muted;
    ctx.font = `10px ${MONO}`;
    ctx.fillText("BETWEEN SIMULATION TICKS", x, inset + 9);
    ctx.fillStyle = COLORS.marking;
    ctx.fillRect(x, inset + 22, 200, 3);
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(x, inset + 22, 200 * alpha, 3);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`α ${alpha.toFixed(2)}  ·  FIXED 1/60 s`, x, inset + 44);
  }

  const compact = width < 900;
  const lines = compact
    ? ["W / ↑ THRUST   A D / ← → YAW", "R RESET  ·  H METRICS  ·  WRAP"]
    : [
        "W / ↑ THRUST    A D / ← → YAW    R RESET    H METRICS    ·    EDGES WRAP",
      ];
  ctx.fillStyle = "rgba(16, 28, 39, 0.93)";
  ctx.fillRect(
    0,
    height - inset - lines.length * 22,
    width,
    inset + lines.length * 22,
  );
  ctx.font = `11px ${MONO}`;
  ctx.fillStyle = COLORS.muted;
  for (const [index, line] of lines.entries()) {
    ctx.fillText(line, inset, height - inset - (lines.length - 1 - index) * 22);
  }
  ctx.restore();
}
