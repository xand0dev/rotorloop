import { applyHoming } from "./behaviors.js";
import { Entity } from "./entity.js";
import { Vector2 } from "./vector.js";

export class Bullet extends Entity {
  constructor({ pos, vel, angle = 0, ownerId = null, ttl = 1.6, homing } = {}) {
    super({ kind: "bullet", pos, vel, angle, radius: 4 });
    this.ownerId = ownerId;
    this.ttl = ttl;
    this.damage = 34;
    this.homing = homing;
  }

  update(dt, world) {
    this.beginStep();
    applyHoming(this, world, dt);
    this.pos = this.pos.add(this.vel.scale(dt));
    this.ttl -= dt;
    if (this.ttl <= 0) world.despawn(this.id);
  }
}

export class Asteroid extends Entity {
  constructor({ pos, vel = new Vector2(), radius = 24, homing } = {}) {
    super({ kind: "asteroid", pos, vel, radius });
    this.hp = Math.round(radius * 1.4);
    this.maxHp = this.hp;
    this.spin = ((radius % 7) - 3) * 0.15;
    this.homing = homing;
  }

  update(dt, world) {
    this.beginStep();
    applyHoming(this, world, dt);
    this.angle += this.spin * dt;
    this.pos = this.pos.add(this.vel.scale(dt));
    const { width, height } = world.bounds;
    if (this.pos.x < this.radius || this.pos.x > width - this.radius) {
      this.pos = new Vector2(
        Math.max(this.radius, Math.min(width - this.radius, this.pos.x)),
        this.pos.y,
      );
      this.vel = new Vector2(-this.vel.x, this.vel.y);
    }
    if (this.pos.y < this.radius || this.pos.y > height - this.radius) {
      this.pos = new Vector2(
        this.pos.x,
        Math.max(this.radius, Math.min(height - this.radius, this.pos.y)),
      );
      this.vel = new Vector2(this.vel.x, -this.vel.y);
    }
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp === 0;
  }
}

export class Pickup extends Entity {
  constructor({ pos, effect = "shield" } = {}) {
    super({ kind: "pickup", pos, radius: 13 });
    this.pickup =
      effect === "rapid-fire"
        ? { effect, seconds: 6 }
        : { effect: "shield", amount: 35 };
    this.phase = 0;
  }

  update(dt) {
    this.beginStep();
    this.phase += dt;
  }
}

export class Explosion extends Entity {
  constructor({ pos, color = "#ffae62", rng = Math.random } = {}) {
    super({ kind: "explosion", pos, radius: 0 });
    this.ttl = 0.65;
    this.color = color;
    this.particles = Array.from({ length: 16 }, (_, index) => ({
      offset: new Vector2(),
      velocity: Vector2.fromAngle(
        (index / 16) * Math.PI * 2 + (rng() - 0.5) * 0.18,
        55 + rng() * 135,
      ),
      size: 1.5 + rng() * 2.5,
    }));
  }

  update(dt, world) {
    this.beginStep();
    this.ttl -= dt;
    for (const particle of this.particles) {
      particle.offset = particle.offset.add(particle.velocity.scale(dt));
      particle.velocity = particle.velocity.scale(Math.exp(-2.8 * dt));
    }
    if (this.ttl <= 0) world.despawn(this.id);
  }
}
