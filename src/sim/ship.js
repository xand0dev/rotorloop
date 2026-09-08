export const TURN_RATE = 3;
export const THRUST_ACCELERATION = 480;
export const DRAG = 1.2;
export const MAX_SPEED = 340;

export function createShip(x = 0, y = 0) {
  return { x, y, vx: 0, vy: 0, angle: -Math.PI / 2, thrust: false };
}

// Seconds in, CSS-pixel world coordinates out. No browser state is read here.
export function integrate(ship, input, dt) {
  const turn = Math.max(-1, Math.min(1, input.turn ?? 0));
  const angle = ship.angle + turn * TURN_RATE * dt;
  const thrust = Boolean(input.thrust);
  const acceleration = thrust ? THRUST_ACCELERATION : 0;
  const damping = Math.exp(-DRAG * dt);
  let vx = (ship.vx + Math.cos(angle) * acceleration * dt) * damping;
  let vy = (ship.vy + Math.sin(angle) * acceleration * dt) * damping;
  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    vx *= MAX_SPEED / speed;
    vy *= MAX_SPEED / speed;
  }
  // Semi-implicit Euler: position uses the newly integrated velocity.
  return {
    ...ship,
    x: ship.x + vx * dt,
    y: ship.y + vy * dt,
    vx,
    vy,
    angle,
    thrust,
  };
}
