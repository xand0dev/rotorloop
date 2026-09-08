const ARROW_CONTROLS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp"]);

function isEditable(element) {
  return (
    element?.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName)
  );
}

export function createInput(target = window) {
  const down = new Set();
  const pressed = new Set();
  const documentTarget =
    target.ownerDocument ??
    target.document ??
    (target.nodeType === 9 ? target : undefined);
  const blurTarget = documentTarget?.defaultView ?? target;

  function clear() {
    down.clear();
    pressed.clear();
  }

  function onKeyDown(event) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      isEditable(event.target)
    ) {
      return;
    }
    if (ARROW_CONTROLS.has(event.code)) event.preventDefault();
    if (!down.has(event.code) && !event.repeat) pressed.add(event.code);
    down.add(event.code);
  }

  function onKeyUp(event) {
    // Always release, including when focus or modifier state changed meanwhile.
    down.delete(event.code);
  }

  function onVisibilityChange() {
    if (documentTarget.hidden) clear();
  }

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  blurTarget.addEventListener("blur", clear);
  documentTarget?.addEventListener("visibilitychange", onVisibilityChange);

  return {
    isDown: (code) => down.has(code),
    justPressed: (code) => pressed.delete(code),
    clear,
    destroy() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      blurTarget.removeEventListener("blur", clear);
      documentTarget?.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
      clear();
    },
  };
}
