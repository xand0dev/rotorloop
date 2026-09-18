export function createDetailEvent(type, detail) {
  if (typeof CustomEvent === "function") {
    return new CustomEvent(type, { detail });
  }
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail });
  return event;
}

export function emit(target, type, detail) {
  target.dispatchEvent(createDetailEvent(type, detail));
}

export class GameEvents extends EventTarget {
  emit(type, detail) {
    emit(this, type, detail);
  }
}
