import { applyPickup } from "./behaviors.js";
import { collisionPairs } from "./collision.js";
import { Asteroid, Bullet, Explosion, Pickup } from "./entities.js";
import { Ship } from "./ship.js";
import { Vector2 } from "./vector.js";

const RESPAWN_DELAY = 2;

export class World {
  #entities = new Map();
  #pendingRemoval = new Set();
  #respawn = null;

  constructor({ width = 960, height = 640, rng = Math.random } = {}) {
    this.bounds = { width, height };
    this.rng = rng;
    this.score = 0;
    this.player = null;
    this.respawnRemaining = 0;
  }

  spawn(entity) {
    entity.alive = true;
    this.#entities.set(entity.id, entity);
    if (entity.kind === "ship") this.player = entity;
    return entity;
  }

  despawn(id) {
    const entity = this.#entities.get(id);
    if (!entity) return false;
    entity.alive = false;
    this.#pendingRemoval.add(id);
    return true;
  }

  get(id) {
    return this.#entities.get(id);
  }

  *[Symbol.iterator]() {
    yield* this.#entities.values();
  }

  *ofKind(kind) {
    for (const entity of this) {
      if (entity.kind === kind) yield entity;
    }
  }

  resize(width, height) {
    this.bounds = { width, height };
    for (const entity of this) this.#wrap(entity);
  }

  reset() {
    this.#entities.clear();
    this.#pendingRemoval.clear();
    this.#respawn = null;
    this.respawnRemaining = 0;
    this.score = 0;
    const ship = this.spawn(
      new Ship(this.bounds.width / 2, this.bounds.height / 2),
    );
    const layout = [
      [0.18, 0.24, 68, 32],
      [0.8, 0.22, -62, 24],
      [0.23, 0.76, 54, -38],
      [0.76, 0.72, -48, -42],
      [0.5, 0.14, 0, 48],
    ];
    for (const [x, y, vx, vy] of layout) {
      this.spawn(
        new Asteroid({
          pos: new Vector2(this.bounds.width * x, this.bounds.height * y),
          vel: new Vector2(vx, vy),
          radius: 20 + this.rng() * 9,
        }),
      );
    }
    const hunter = [...this.ofKind("asteroid")].at(-1);
    hunter.homing = { targetKind: "ship", turnRate: 0.28 };
    this.spawn(
      new Pickup({
        pos: new Vector2(this.bounds.width * 0.35, this.bounds.height * 0.42),
        effect: "shield",
      }),
    );
    this.spawn(
      new Pickup({
        pos: new Vector2(this.bounds.width * 0.67, this.bounds.height * 0.58),
        effect: "rapid-fire",
      }),
    );
    return ship;
  }

  firePlayerWeapon() {
    const bullet = this.player?.fire();
    if (bullet) this.spawn(bullet);
    return bullet;
  }

  step(dt, controls = {}, fireAction = () => this.firePlayerWeapon()) {
    if (this.#respawn) this.#advanceRespawn(dt);
    if (this.player?.alive) this.player.setControls(controls);
    const updating = [...this];
    for (const entity of updating) {
      if (!entity.alive) continue;
      entity.update(dt, this);
      this.#wrap(entity);
    }
    if (controls.fire && this.player?.alive) fireAction();
    for (const [a, b] of collisionPairs(this)) this.#resolveCollision(a, b);
    this.#sweep();
  }

  #resolveCollision(a, b) {
    if (!a.alive || !b.alive) return;
    const kinds = new Set([a.kind, b.kind]);
    if (kinds.has("bullet") && kinds.has("asteroid")) {
      const bullet = a instanceof Bullet ? a : b;
      const asteroid = a instanceof Asteroid ? a : b;
      this.despawn(bullet.id);
      if (asteroid.damage(bullet.damage)) {
        this.score += 100;
        this.#explode(asteroid.pos, "#ffae62");
        this.despawn(asteroid.id);
      } else {
        this.score += 15;
        this.#explode(bullet.pos, "#f7d37b");
      }
      return;
    }
    if (kinds.has("bullet") && kinds.has("ship")) {
      const bullet = a instanceof Bullet ? a : b;
      const ship = a instanceof Ship ? a : b;
      if (bullet.ownerId === ship.id) return;
      this.despawn(bullet.id);
      if (ship.damage(bullet.damage)) {
        this.#explode(bullet.pos, "#ff6577");
        if (ship.hp === 0) this.#destroyShip(ship);
      }
      return;
    }
    if (kinds.has("ship") && kinds.has("pickup")) {
      const ship = a instanceof Ship ? a : b;
      const pickup = a instanceof Pickup ? a : b;
      applyPickup(ship, pickup);
      this.score += 25;
      this.#explode(pickup.pos, "#65d6c1");
      this.despawn(pickup.id);
      return;
    }
    if (kinds.has("ship") && kinds.has("asteroid")) {
      const ship = a instanceof Ship ? a : b;
      if (ship.damage(34) && ship.hp === 0) this.#destroyShip(ship);
    }
  }

  #destroyShip(ship) {
    this.#explode(ship.pos, "#ff6577");
    this.#respawn = ship;
    this.respawnRemaining = RESPAWN_DELAY;
    this.despawn(ship.id);
  }

  #advanceRespawn(dt) {
    this.respawnRemaining = Math.max(0, this.respawnRemaining - dt);
    if (this.respawnRemaining > 1e-9) return;
    const ship = this.#respawn;
    this.#respawn = null;
    ship.prepareRespawn(this.#safePosition(ship.radius));
    this.spawn(ship);
  }

  #safePosition(radius) {
    const candidates = [
      new Vector2(this.bounds.width / 2, this.bounds.height / 2),
      new Vector2(this.bounds.width * 0.25, this.bounds.height * 0.5),
      new Vector2(this.bounds.width * 0.75, this.bounds.height * 0.5),
      new Vector2(this.bounds.width * 0.5, this.bounds.height * 0.75),
    ];
    const start = Math.floor(this.rng() * candidates.length);
    for (let offset = 0; offset < candidates.length; offset += 1) {
      const candidate = candidates[(start + offset) % candidates.length];
      const safe = [...this.ofKind("asteroid")].every(
        (asteroid) =>
          asteroid.pos.sub(candidate).length() > asteroid.radius + radius + 80,
      );
      if (safe) return candidate;
    }
    return new Vector2(radius + 8, this.bounds.height / 2);
  }

  #explode(pos, color) {
    this.spawn(
      new Explosion({
        pos: new Vector2(pos.x, pos.y),
        color,
        rng: this.rng,
      }),
    );
  }

  #wrap(entity) {
    const { width, height } = this.bounds;
    if (!(width > 0 && height > 0)) return;
    if (entity.kind === "ship" || entity.kind === "bullet") {
      const x = ((entity.pos.x % width) + width) % width;
      const y = ((entity.pos.y % height) + height) % height;
      if (x !== entity.pos.x)
        entity.previousPos = new Vector2(x, entity.previousPos.y);
      if (y !== entity.pos.y)
        entity.previousPos = new Vector2(entity.previousPos.x, y);
      entity.pos = new Vector2(x, y);
    }
  }

  #sweep() {
    for (const id of this.#pendingRemoval) this.#entities.delete(id);
    this.#pendingRemoval.clear();
  }
}

export { RESPAWN_DELAY };
