import assert from "node:assert/strict";
import { test } from "node:test";
import { applyHoming, applyPickup } from "../src/sim/behaviors.js";
import { circlesOverlap, collisionPairs } from "../src/sim/collision.js";
import { Asteroid, Bullet, Pickup } from "../src/sim/entities.js";
import { Entity } from "../src/sim/entity.js";
import { Ship } from "../src/sim/ship.js";
import { Vector2 } from "../src/sim/vector.js";
import { World } from "../src/sim/world.js";

test("Vector2 operations are pure, including zero normalization", () => {
  const a = Object.freeze(new Vector2(3, 4));
  const b = Object.freeze(new Vector2(-1, 2));
  assert.deepEqual(a.add(b), new Vector2(2, 6));
  assert.deepEqual(a.sub(b), new Vector2(4, 2));
  assert.deepEqual(a.scale(2), new Vector2(6, 8));
  assert.equal(a.length(), 5);
  assert.ok(Math.abs(a.normalize().x - 0.6) < 1e-12);
  assert.ok(Math.abs(a.normalize().y - 0.8) < 1e-12);
  assert.deepEqual(new Vector2().normalize(), new Vector2());
  const rotated = new Vector2(1, 0).rotate(Math.PI / 2);
  assert.ok(Math.abs(rotated.x) < 1e-12);
  assert.ok(Math.abs(rotated.y - 1) < 1e-12);
  assert.equal(a.dot(b), 5);
  const angled = Vector2.fromAngle(Math.PI, 2);
  assert.ok(Math.abs(angled.x + 2) < 1e-12);
  assert.ok(Math.abs(angled.y) < 1e-12);
  assert.deepEqual(a, new Vector2(3, 4));
});

test("entities have unique IDs and Ship delegates through one prototype level", () => {
  const entity = new Entity();
  const ship = new Ship();
  const bullet = new Bullet({ pos: new Vector2(), vel: new Vector2() });
  assert.equal(new Set([entity.id, ship.id, bullet.id]).size, 3);
  assert.equal(ship instanceof Ship, true);
  assert.equal(ship instanceof Entity, true);
  assert.equal(Object.getPrototypeOf(ship), Ship.prototype);
  assert.equal(Object.getPrototypeOf(Ship.prototype), Entity.prototype);
  assert.equal(Object.hasOwn(ship, "update"), false);
});

test("World iterates in insertion order, filters by generator, and sweeps deferred removals", () => {
  const world = new World();
  const ship = world.spawn(new Ship());
  const rock = world.spawn(new Asteroid({ pos: new Vector2(80, 80) }));
  assert.deepEqual([...world], [ship, rock]);
  assert.deepEqual([...world.ofKind("asteroid")], [rock]);
  assert.equal(world.despawn(rock.id), true);
  assert.equal(world.get(rock.id), rock);
  world.step(0);
  assert.equal(world.get(rock.id), undefined);
});

test("Ship fires from its nose with inherited velocity and held fire is rate limited", () => {
  const ship = new Ship(100, 80);
  ship.angle = 0;
  ship.vel = new Vector2(20, -5);
  const bullet = ship.fire();
  assert.equal(bullet.pos.x, 128);
  assert.equal(bullet.pos.y, 80);
  assert.deepEqual(bullet.vel, new Vector2(540, -5));
  assert.equal(bullet.ownerId, ship.id);
  ship.fireCooldown = 0;
  const world = new World({ width: 500, height: 400 });
  world.spawn(ship);
  for (let tick = 0; tick < 10; tick += 1) world.step(1 / 60, { fire: true });
  assert.equal([...world.ofKind("bullet")].length, 1);
  for (let tick = 0; tick < 6; tick += 1) world.step(1 / 60, { fire: true });
  assert.equal([...world.ofKind("bullet")].length, 2);
});

test("bullet TTL despawns on the end-of-step sweep", () => {
  const world = new World();
  const bullet = world.spawn(
    new Bullet({ pos: new Vector2(), vel: new Vector2(), ttl: 0.1 }),
  );
  world.step(0.1);
  assert.equal(world.get(bullet.id), undefined);
});

test("circle system emits unique pairs and a dead bullet cannot damage twice", () => {
  const a = new Entity({ pos: new Vector2(0, 0), radius: 10 });
  const b = new Entity({ pos: new Vector2(15, 0), radius: 6 });
  const c = new Entity({ pos: new Vector2(40, 0), radius: 3 });
  assert.equal(circlesOverlap(a, b), true);
  assert.equal(circlesOverlap(a, c), false);
  assert.deepEqual([...collisionPairs([a, b, c])], [[a, b]]);

  const world = new World({ width: 400, height: 300 });
  const bullet = world.spawn(
    new Bullet({ pos: new Vector2(100, 100), vel: new Vector2() }),
  );
  const first = world.spawn(
    new Asteroid({ pos: new Vector2(100, 100), radius: 24 }),
  );
  const second = world.spawn(
    new Asteroid({ pos: new Vector2(100, 100), radius: 24 }),
  );
  world.step(0);
  assert.equal(world.get(bullet.id), undefined);
  assert.equal(world.get(first.id), undefined);
  assert.equal(second.hp, second.maxHp);
  assert.equal(world.score, 100);
});

test("hostile bullets damage ships while a ship cannot hit itself", () => {
  const world = new World({ width: 400, height: 300 });
  const ship = world.spawn(new Ship(100, 100));
  const ownBullet = world.spawn(
    new Bullet({
      pos: new Vector2(100, 100),
      vel: new Vector2(),
      ownerId: ship.id,
    }),
  );
  world.step(0);
  assert.equal(ship.hp, ship.maxHp);
  assert.equal(world.get(ownBullet.id), ownBullet);

  const hostileBullet = world.spawn(
    new Bullet({
      pos: new Vector2(100, 100),
      vel: new Vector2(),
      ownerId: -1,
    }),
  );
  world.step(0);
  assert.equal(ship.hp, ship.maxHp - hostileBullet.damage);
  assert.equal(world.get(hostileBullet.id), undefined);
});

test("private HP changes only through public behavior", () => {
  const ship = new Ship();
  assert.equal(Object.hasOwn(ship, "hp"), false);
  assert.equal(Object.keys(ship).includes("#hp"), false);
  assert.equal(ship.damage(30), true);
  assert.equal(ship.hp, 70);
  ship.damageCooldown = 0;
  ship.heal(15);
  assert.equal(ship.hp, 85);
  ship.heal(1000);
  assert.equal(ship.hp, ship.maxHp);
});

test("destroyed ship remains absent for two seconds then respawns safely", () => {
  const world = new World({ width: 800, height: 600, rng: () => 0 });
  const ship = world.spawn(new Ship(100, 100));
  world.spawn(new Asteroid({ pos: new Vector2(100, 100), vel: new Vector2() }));
  for (let hit = 0; hit < 3; hit += 1) {
    ship.damageCooldown = 0;
    world.step(0);
  }
  assert.equal(ship.alive, false);
  assert.equal(world.get(ship.id), undefined);
  world.step(1.99);
  assert.equal(world.get(ship.id), undefined);
  world.step(0.01);
  assert.equal(world.get(ship.id), ship);
  assert.equal(ship.hp, ship.maxHp);
  assert.equal(ship.alive, true);
});

test("homing is the same composable behavior on bullets and asteroids", () => {
  const world = new World({ width: 500, height: 500 });
  const ship = world.spawn(new Ship(100, 100));
  const rockTarget = world.spawn(
    new Asteroid({ pos: new Vector2(100, 200), vel: new Vector2() }),
  );
  const bullet = world.spawn(
    new Bullet({
      pos: new Vector2(100, 100),
      vel: new Vector2(100, 0),
      ownerId: ship.id,
      homing: { targetKind: "asteroid", turnRate: 1 },
    }),
  );
  applyHoming(bullet, world, 0.5);
  assert.ok(bullet.vel.y > 0);

  const hunter = world.spawn(
    new Asteroid({
      pos: new Vector2(100, 200),
      vel: new Vector2(100, 0),
      homing: { targetKind: "ship", turnRate: 1 },
    }),
  );
  applyHoming(hunter, world, 0.5);
  assert.ok(hunter.vel.y < 0);
  assert.equal(rockTarget.homing, undefined);
});

test("pickup data composes shield and rapid-fire effects", () => {
  const ship = new Ship();
  ship.damage(50);
  ship.damageCooldown = 0;
  const shield = new Pickup({ pos: new Vector2(), effect: "shield" });
  const rapid = new Pickup({ pos: new Vector2(), effect: "rapid-fire" });
  applyPickup(ship, shield);
  applyPickup(ship, rapid);
  assert.equal(ship.hp, 85);
  assert.equal(ship.rapidFire, true);
  assert.equal(ship.rapidFireRemaining, 6);
});

test("detaching Ship#fire loses this; wrapper arrow preserves the receiver", () => {
  const ship = new Ship();
  const detached = ship.fire;
  assert.throws(() => detached(), TypeError);
  const wrapper = () => ship.fire();
  assert.ok(wrapper() instanceof Bullet);
});
