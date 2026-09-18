import { shortestAngleDelta } from "./arena.js";
import { Vector2 } from "./vector.js";

export function nearestTarget(entity, world, targetKind) {
  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const target of world.ofKind(targetKind)) {
    if (
      !target.alive ||
      target.id === entity.id ||
      target.id === entity.ownerId
    ) {
      continue;
    }
    const distance = target.pos.sub(entity.pos).length();
    if (distance < closestDistance) {
      closest = target;
      closestDistance = distance;
    }
  }
  return closest;
}

export function applyHoming(entity, world, dt) {
  if (!entity.homing || entity.vel.length() === 0) return;
  const target = nearestTarget(entity, world, entity.homing.targetKind);
  if (!target) return;
  const targetAngle = Math.atan2(
    target.pos.y - entity.pos.y,
    target.pos.x - entity.pos.x,
  );
  const currentAngle = Math.atan2(entity.vel.y, entity.vel.x);
  const maxTurn = entity.homing.turnRate * dt;
  const turn = Math.max(
    -maxTurn,
    Math.min(maxTurn, shortestAngleDelta(currentAngle, targetAngle)),
  );
  const speed = entity.vel.length();
  entity.angle = currentAngle + turn;
  entity.vel = Vector2.fromAngle(entity.angle, speed);
}

export function applyPickup(ship, pickup) {
  if (pickup.pickup.effect === "shield") ship.heal(pickup.pickup.amount);
  if (pickup.pickup.effect === "rapid-fire") {
    ship.grantRapidFire(pickup.pickup.seconds);
  }
}
