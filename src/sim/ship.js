import { Bullet } from "./entities.js";
import { Entity } from "./entity.js";
import { Vector2 } from "./vector.js";

export const TURN_RATE = 3;
export const THRUST_ACCELERATION = 480;
export const DRAG = 1.2;
export const MAX_SPEED = 340;
export const SHIP_MAX_HP = 100;
export const FIRE_INTERVAL = 0.24;
export const RAPID_FIRE_INTERVAL = 0.09;

export class Ship extends Entity {
  #hp = SHIP_MAX_HP;

  constructor(x = 0, y = 0) {
    super({
      kind: "ship",
      pos: new Vector2(x, y),
      angle: -Math.PI / 2,
      radius: 18,
    });
    this.thrust = false;
    this.controls = { turn: 0, thrust: false };
    this.fireCooldown = 0;
    this.rapidFireRemaining = 0;
    this.damageCooldown = 0;
  }

  get hp() {
    return this.#hp;
  }

  get maxHp() {
    return SHIP_MAX_HP;
  }

  get rapidFire() {
    return this.rapidFireRemaining > 0;
  }

  setControls(controls = {}) {
    this.controls = {
      turn: Math.max(-1, Math.min(1, controls.turn ?? 0)),
      thrust: Boolean(controls.thrust),
    };
  }

  update(dt) {
    this.beginStep();
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.rapidFireRemaining = Math.max(0, this.rapidFireRemaining - dt);
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    const angle = this.angle + this.controls.turn * TURN_RATE * dt;
    const acceleration = this.controls.thrust ? THRUST_ACCELERATION : 0;
    const damping = Math.exp(-DRAG * dt);
    let velocity = this.vel
      .add(Vector2.fromAngle(angle, acceleration * dt))
      .scale(damping);
    const speed = velocity.length();
    if (speed > MAX_SPEED) velocity = velocity.scale(MAX_SPEED / speed);
    this.angle = angle;
    this.vel = velocity;
    this.pos = this.pos.add(this.vel.scale(dt));
    this.thrust = this.controls.thrust;
  }

  fire() {
    if (!this.alive || this.fireCooldown > 0) return null;
    const direction = Vector2.fromAngle(this.angle);
    this.fireCooldown = this.rapidFire ? RAPID_FIRE_INTERVAL : FIRE_INTERVAL;
    return new Bullet({
      pos: this.pos.add(direction.scale(this.radius + 10)),
      vel: this.vel.add(direction.scale(520)),
      angle: this.angle,
      ownerId: this.id,
      homing: { targetKind: "asteroid", turnRate: 3.8 },
    });
  }

  damage(amount) {
    if (!this.alive || this.damageCooldown > 0 || amount <= 0) return false;
    this.#hp = Math.max(0, this.#hp - amount);
    this.damageCooldown = 0.55;
    return true;
  }

  heal(amount) {
    this.#hp = Math.min(SHIP_MAX_HP, this.#hp + Math.max(0, amount));
  }

  grantRapidFire(seconds) {
    this.rapidFireRemaining = Math.max(this.rapidFireRemaining, seconds);
  }

  prepareRespawn(position) {
    this.pos = position;
    this.previousPos = new Vector2(position.x, position.y);
    this.vel = new Vector2();
    this.angle = -Math.PI / 2;
    this.previousAngle = this.angle;
    this.#hp = SHIP_MAX_HP;
    this.fireCooldown = 0;
    this.rapidFireRemaining = 0;
    this.damageCooldown = 1;
    this.alive = true;
  }
}

export function createShip(x = 0, y = 0) {
  return new Ship(x, y);
}

// Pure Lab 01 regression seam; production uses Ship#update in place.
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
    x: ship.x + vx * dt,
    y: ship.y + vy * dt,
    vx,
    vy,
    angle,
    thrust,
  };
}
