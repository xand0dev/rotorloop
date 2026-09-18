import { drawArena } from "./draw.js";

const MONO = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';

function fitLabel(ctx, label, maxWidth) {
  if (ctx.measureText(label).width <= maxWidth) return label;
  let clipped = label;
  while (
    clipped.length > 4 &&
    ctx.measureText(`${clipped}…`).width > maxWidth
  ) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

export function drawLoadingScreen(ctx, size, state) {
  const { width, height } = size;
  drawArena(ctx, size);
  ctx.save();
  ctx.fillStyle = "rgba(6, 15, 22, 0.62)";
  ctx.fillRect(0, 0, width, height);
  const centerX = width / 2;
  const centerY = height / 2 - 28;
  const radius = Math.min(118, width * 0.22, height * 0.2);
  const segments = 16;
  const active = Math.round((state.ratio ?? 0) * segments);
  ctx.lineWidth = Math.max(5, radius * 0.07);
  ctx.lineCap = "round";
  for (let index = 0; index < segments; index += 1) {
    const start = -Math.PI / 2 + (index / segments) * Math.PI * 2;
    const end = start + (Math.PI * 2) / segments - 0.08;
    ctx.strokeStyle = index < active ? "#65d6c1" : "#274252";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, start, end);
    ctx.stroke();
  }
  ctx.strokeStyle = state.phase === "error" ? "#ff6577" : "#ffad61";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX - radius * 0.55, centerY);
  ctx.lineTo(centerX + radius * 0.55, centerY);
  ctx.moveTo(centerX, centerY - radius * 0.55);
  ctx.lineTo(centerX, centerY + radius * 0.55);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#e8f0ee";
  ctx.font = `700 ${Math.max(28, radius * 0.37)}px "Arial Narrow", Arial, sans-serif`;
  ctx.fillText(
    `${Math.round((state.ratio ?? 0) * 100)}%`,
    centerX,
    centerY + 12,
  );
  ctx.fillStyle = "#ffad61";
  ctx.font = `700 12px ${MONO}`;
  const heading =
    state.phase === "error"
      ? "STARTUP INTERRUPTED"
      : state.phase === "cancelled"
        ? "STARTUP CANCELLED"
        : "ASYNC STARTUP PIPELINE";
  ctx.fillText(heading, centerX, centerY + radius + 49);
  ctx.fillStyle = "#8fa7b5";
  ctx.font = `11px ${MONO}`;
  ctx.fillText(
    fitLabel(
      ctx,
      state.label ?? "Preparing manifest",
      Math.min(520, width - 48),
    ),
    centerX,
    centerY + radius + 72,
  );
  ctx.fillText(
    `${state.completed ?? 0} / ${state.total ?? "—"} ASSETS SETTLED`,
    centerX,
    centerY + radius + 93,
  );
  if (state.message) {
    ctx.fillStyle = state.phase === "error" ? "#ff6577" : "#e8f0ee";
    ctx.fillText(
      fitLabel(ctx, state.message, Math.min(620, width - 48)),
      centerX,
      centerY + radius + 119,
    );
  }
  ctx.restore();
}

export function drawLobbyField(ctx, size) {
  drawArena(ctx, size);
  const { width, height } = size;
  ctx.save();
  ctx.fillStyle = "rgba(6, 15, 22, 0.35)";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(101, 214, 193, 0.3)";
  ctx.lineWidth = 1;
  const radius = Math.min(width, height) * 0.34;
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.5, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
