import { Vector2 } from "./vector.js";

export class Entity {
  static #nextId = 1;

  constructor({
    kind = "entity",
    pos = new Vector2(),
    vel = new Vector2(),
    angle = 0,
    radius = 0,
  } = {}) {
    this.id = Entity.#nextId++;
    this.kind = kind;
    this.pos = pos;
    this.previousPos = new Vector2(pos.x, pos.y);
    this.vel = vel;
    this.angle = angle;
    this.previousAngle = angle;
    this.radius = radius;
    this.alive = true;
  }

  beginStep() {
    this.previousPos = new Vector2(this.pos.x, this.pos.y);
    this.previousAngle = this.angle;
  }

  update(dt) {
    this.beginStep();
    this.pos = this.pos.add(this.vel.scale(dt));
  }

  get x() {
    return this.pos.x;
  }

  set x(value) {
    this.pos = new Vector2(value, this.pos.y);
  }

  get y() {
    return this.pos.y;
  }

  set y(value) {
    this.pos = new Vector2(this.pos.x, value);
  }

  get vx() {
    return this.vel.x;
  }

  set vx(value) {
    this.vel = new Vector2(value, this.vel.y);
  }

  get vy() {
    return this.vel.y;
  }

  set vy(value) {
    this.vel = new Vector2(this.vel.x, value);
  }
}
