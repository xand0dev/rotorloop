import { shortestAngleDelta } from "../sim/arena.js";

const COLORS = {
  field: "#0d1a24",
  fieldGlow: "#122635",
  grid: "#1c3443",
  marking: "#36576a",
  muted: "#8fa7b5",
  pale: "#e8f0ee",
  orange: "#ffad61",
  amber: "#f7d37b",
  cyan: "#65d6c1",
  danger: "#ff6577",
};
const MONO = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';

export function interpolateShip(previous, current, alpha) {
  const previousX = previous.x ?? previous.pos.x;
  const previousY = previous.y ?? previous.pos.y;
  const currentX = current.x ?? current.pos.x;
  const currentY = current.y ?? current.pos.y;
  return {
    ...current,
    x: previousX + (currentX - previousX) * alpha,
    y: previousY + (currentY - previousY) * alpha,
    angle:
      previous.angle +
      shortestAngleDelta(previous.angle, current.angle) * alpha,
  };
}

function interpolateEntity(entity, alpha) {
  return {
    x: entity.previousPos.x + (entity.pos.x - entity.previousPos.x) * alpha,
    y: entity.previousPos.y + (entity.pos.y - entity.previousPos.y) * alpha,
    angle:
      entity.previousAngle +
      shortestAngleDelta(entity.previousAngle, entity.angle) * alpha,
  };
}

export function drawArena(ctx, { width, height }) {
  ctx.save();
  ctx.fillStyle = COLORS.field;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.68,
  );
  glow.addColorStop(0, COLORS.fieldGlow);
  glow.addColorStop(1, "rgba(13, 26, 36, 0)");
  ctx.fillStyle = glow;
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
  if (ship.damageCooldown > 0) {
    ctx.globalAlpha = 0.42 + (Math.sin(ship.damageCooldown * 34) + 1) * 0.18;
  }
  if (ship.thrust) {
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.globalAlpha = reducedMotion ? 0.45 : 0.75;
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
  ctx.fillStyle = ship.rapidFire ? COLORS.cyan : COLORS.orange;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(9, -7);
  ctx.lineTo(9, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBullet(ctx, bullet, visual) {
  ctx.save();
  ctx.strokeStyle = bullet.homing ? COLORS.cyan : COLORS.amber;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(bullet.previousPos.x, bullet.previousPos.y);
  ctx.lineTo(visual.x, visual.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.pale;
  ctx.beginPath();
  ctx.arc(visual.x, visual.y, bullet.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAsteroid(ctx, asteroid, visual) {
  ctx.save();
  ctx.translate(visual.x, visual.y);
  ctx.rotate(visual.angle);
  ctx.fillStyle = "#172a36";
  ctx.strokeStyle = asteroid.homing ? COLORS.danger : COLORS.muted;
  ctx.lineWidth = asteroid.homing ? 2.5 : 1.5;
  ctx.beginPath();
  const sides = 9;
  for (let index = 0; index < sides; index += 1) {
    const angle = (index / sides) * Math.PI * 2;
    const jitter = 0.83 + ((asteroid.id * 17 + index * 11) % 23) / 100;
    const x = Math.cos(angle) * asteroid.radius * jitter;
    const y = Math.sin(angle) * asteroid.radius * jitter;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (asteroid.homing) {
    ctx.fillStyle = COLORS.danger;
    ctx.fillRect(-4, -2, 8, 4);
  }
  ctx.restore();
}

function drawPickup(ctx, pickup, visual, reducedMotion) {
  const pulse = reducedMotion ? 1 : 1 + Math.sin(pickup.phase * 4) * 0.08;
  ctx.save();
  ctx.translate(visual.x, visual.y);
  ctx.scale(pulse, pulse);
  ctx.rotate(pickup.phase * 0.65);
  ctx.strokeStyle = COLORS.cyan;
  ctx.fillStyle = "rgba(101, 214, 193, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-11, -11, 22, 22);
  ctx.fill();
  ctx.stroke();
  ctx.rotate(-pickup.phase * 0.65);
  ctx.fillStyle = COLORS.cyan;
  if (pickup.pickup.effect === "shield") {
    ctx.fillRect(-7, -2, 14, 4);
    ctx.fillRect(-2, -7, 4, 14);
  } else {
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(2, -2);
    ctx.lineTo(-1, -2);
    ctx.lineTo(6, 8);
    ctx.lineTo(-3, 2);
    ctx.lineTo(0, 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawExplosion(ctx, explosion, reducedMotion) {
  ctx.save();
  ctx.fillStyle = explosion.color;
  ctx.globalAlpha = Math.max(0, explosion.ttl / 0.65);
  const particles = reducedMotion
    ? explosion.particles.filter((_, index) => index % 3 === 0)
    : explosion.particles;
  for (const particle of particles) {
    ctx.beginPath();
    ctx.arc(
      explosion.pos.x + particle.offset.x,
      explosion.pos.y + particle.offset.y,
      particle.size,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

export function drawWorld(ctx, world, alpha, { reducedMotion = false } = {}) {
  for (const entity of world) {
    if (!entity.alive) continue;
    const visual = interpolateEntity(entity, alpha);
    if (entity.kind === "ship") {
      drawShip(
        ctx,
        { ...entity, ...visual, rapidFire: entity.rapidFire },
        { reducedMotion },
      );
    } else if (entity.kind === "bullet") {
      drawBullet(ctx, entity, visual);
    } else if (entity.kind === "asteroid") {
      drawAsteroid(ctx, entity, visual);
    } else if (entity.kind === "pickup") {
      drawPickup(ctx, entity, visual, reducedMotion);
    } else if (entity.kind === "explosion") {
      drawExplosion(ctx, entity, reducedMotion);
    }
  }
}

function drawTelemetry(ctx, stats, x, y, width, alpha) {
  const left = x + 14;
  const plotWidth = width - 28;
  const plotTop = y + 40;
  const plotHeight = 50;
  ctx.fillStyle = "rgba(10, 22, 31, 0.96)";
  ctx.fillRect(x, y, width, 254);
  ctx.fillStyle = COLORS.pale;
  ctx.font = `11px ${MONO}`;
  ctx.fillText("LOOP TELEMETRY", left, y + 20);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `9px ${MONO}`;
  ctx.fillText(`LAST ${stats.frameHistory.length}/120 · H HIDE`, left, y + 33);
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(left, plotTop, plotWidth, plotHeight);
  const barWidth = plotWidth / 120;
  for (const [index, interval] of stats.frameHistory.entries()) {
    const barHeight = Math.min(interval / 50, 1) * plotHeight;
    ctx.fillStyle = interval > 1000 / 60 ? COLORS.danger : COLORS.muted;
    ctx.fillRect(
      left + (120 - stats.frameHistory.length + index) * barWidth,
      plotTop + plotHeight - barHeight,
      Math.max(1, barWidth - 0.5),
      barHeight,
    );
  }
  const rows = [
    [
      "MEAN / P95",
      `${stats.meanFrameMs.toFixed(1)} / ${stats.p95FrameMs.toFixed(1)} ms`,
    ],
    ["STEPS / FRAME", `${stats.stepsThisFrame}`],
    ["SIM CLOCK", `${stats.simulationSeconds.toFixed(2)} s`],
    ["TOTAL TICKS", `${stats.totalSteps}`],
    ["CLAMP LOST", `${(stats.discardedMs / 1000).toFixed(3)} s`],
  ];
  ctx.font = `10px ${MONO}`;
  for (const [index, [label, value]] of rows.entries()) {
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(label, left, y + 112 + index * 20);
    ctx.fillStyle = COLORS.pale;
    ctx.fillText(value, left + 130, y + 112 + index * 20);
  }
  ctx.fillStyle = COLORS.marking;
  ctx.fillRect(left, y + 226, plotWidth, 3);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(left, y + 226, plotWidth * alpha, 3);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`α ${alpha.toFixed(2)} · FIXED 1/60 s`, left, y + 246);
}

export function drawHud(
  ctx,
  stats,
  world,
  { width, height },
  alpha = 0,
  showTelemetry = false,
) {
  const inset = width < 500 ? 18 : 30;
  const ship = world.player;
  ctx.save();
  ctx.fillStyle = "rgba(10, 22, 31, 0.93)";
  ctx.fillRect(inset - 10, inset - 12, 264, 169);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(inset, inset, 4, 23);
  ctx.fillStyle = COLORS.pale;
  ctx.font = '700 22px "Arial Narrow", Arial, sans-serif';
  ctx.fillText("ROTORLOOP", inset + 14, inset + 20);
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("ENTITY ARENA / LAB 02", inset, inset + 42);
  const hp = ship?.alive ? ship.hp : 0;
  const hpRatio = hp / (ship?.maxHp ?? 100);
  ctx.fillStyle = COLORS.marking;
  ctx.fillRect(inset, inset + 57, 150, 7);
  ctx.fillStyle = hpRatio > 0.35 ? COLORS.cyan : COLORS.danger;
  ctx.fillRect(inset, inset + 57, 150 * hpRatio, 7);
  ctx.font = `11px ${MONO}`;
  const rows = [
    ["HULL", ship?.alive ? `${hp} / ${ship.maxHp}` : "OFFLINE"],
    ["SCORE", String(world.score).padStart(6, "0")],
    ["OBJECTS", `${[...world].length}`],
    [
      "WEAPON",
      ship?.rapidFire
        ? `RAPID ${ship.rapidFireRemaining.toFixed(1)}s`
        : "HOMING",
    ],
  ];
  for (const [index, [label, value]] of rows.entries()) {
    const y = inset + 84 + index * 20;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(label, inset, y);
    ctx.fillStyle = COLORS.pale;
    ctx.fillText(value, inset + 82, y);
  }
  if (!ship?.alive && world.respawnRemaining > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(10, 22, 31, 0.9)";
    ctx.fillRect(width / 2 - 150, height / 2 - 34, 300, 68);
    ctx.fillStyle = COLORS.danger;
    ctx.font = `700 12px ${MONO}`;
    ctx.fillText("SIGNAL LOST", width / 2, height / 2 - 7);
    ctx.fillStyle = COLORS.pale;
    ctx.font = `18px ${MONO}`;
    ctx.fillText(
      `RESPAWN ${world.respawnRemaining.toFixed(1)} s`,
      width / 2,
      height / 2 + 19,
    );
    ctx.textAlign = "start";
  }
  const telemetryFits =
    width >= 300 && (width >= 900 ? height >= 360 : height >= 550);
  if (showTelemetry && telemetryFits) {
    const panelWidth = Math.min(314, width - 2 * inset);
    drawTelemetry(
      ctx,
      stats,
      width >= 900 ? width - inset - panelWidth : inset,
      width >= 900 ? inset : 190,
      panelWidth,
      alpha,
    );
  }
  const compact = width < 850;
  const lines = compact
    ? ["SPACE FIRE   W / ↑ THRUST", "A D / ← → YAW   R RESET   H METRICS"]
    : [
        "SPACE FIRE    W / ↑ THRUST    A D / ← → YAW    R RESET    H METRICS    ·    EDGES WRAP",
      ];
  ctx.fillStyle = "rgba(10, 22, 31, 0.93)";
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
