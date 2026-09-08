function wrapCoordinate(value, size) {
  if (!(size > 0)) return value;
  if (value >= 0 && value < size) return value;
  return ((value % size) + size) % size;
}

export function wrapShip(ship, width, height) {
  return {
    ...ship,
    x: wrapCoordinate(ship.x, width),
    y: wrapCoordinate(ship.y, height),
  };
}

// Synchronize only crossed axes so interpolation never sweeps through the arena.
export function wrapState(previous, next, width, height) {
  const current = wrapShip(next, width, height);
  return {
    previous: {
      ...previous,
      x: current.x === next.x ? previous.x : current.x,
      y: current.y === next.y ? previous.y : current.y,
    },
    current,
  };
}

export function shortestAngleDelta(from, to) {
  const fullTurn = Math.PI * 2;
  return ((((to - from + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
}
