import assert from "node:assert/strict";
import test from "node:test";
import { createInput } from "../src/input.js";

function fixture() {
  const target = new EventTarget();
  target.document = new EventTarget();
  target.document.defaultView = target;
  target.document.hidden = false;
  const input = createInput(target);
  function key(type, code, properties = {}) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      code: { value: code },
      ...Object.fromEntries(
        Object.entries(properties).map(([name, value]) => [name, { value }]),
      ),
    });
    target.dispatchEvent(event);
    return event;
  }
  return { target, input, key };
}

test("held state and a quick tap preserve one consuming press edge", () => {
  const { input, key } = fixture();
  key("keydown", "KeyW");
  assert.equal(input.isDown("KeyW"), true);
  assert.equal(input.justPressed("KeyW"), true);
  key("keydown", "KeyW", { repeat: true });
  assert.equal(input.justPressed("KeyW"), false);
  key("keyup", "KeyW");
  assert.equal(input.isDown("KeyW"), false);
  key("keydown", "KeyW");
  key("keyup", "KeyW");
  assert.equal(input.justPressed("KeyW"), true);
  assert.equal(input.justPressed("KeyW"), false);
  input.destroy();
});

test("blur, hidden document, and destruction clear held and pending input", () => {
  const { input, target, key } = fixture();
  key("keydown", "KeyW");
  target.dispatchEvent(new Event("blur"));
  assert.equal(input.isDown("KeyW"), false);
  assert.equal(input.justPressed("KeyW"), false);
  key("keydown", "KeyW");
  target.document.hidden = true;
  target.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(input.isDown("KeyW"), false);
  input.destroy();
  key("keydown", "KeyW");
  assert.equal(input.isDown("KeyW"), false);
});

test("shortcuts and editable input are ignored; only control arrows prevent defaults", () => {
  const { input, key } = fixture();
  assert.equal(key("keydown", "ArrowUp").defaultPrevented, true);
  assert.equal(key("keydown", "KeyW").defaultPrevented, false);
  input.clear();
  assert.equal(
    key("keydown", "ArrowUp", { ctrlKey: true }).defaultPrevented,
    false,
  );
  assert.equal(input.isDown("ArrowUp"), false);
  key("keydown", "KeyW", { target: { tagName: "INPUT" } });
  assert.equal(input.isDown("KeyW"), false);
  key("keydown", "KeyW", { target: { isContentEditable: true } });
  assert.equal(input.isDown("KeyW"), false);
  input.destroy();
});
