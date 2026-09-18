export function circlesOverlap(a, b) {
  const radius = a.radius + b.radius;
  const dx = a.pos.x - b.pos.x;
  const dy = a.pos.y - b.pos.y;
  return dx * dx + dy * dy <= radius * radius;
}

// Deliberately naive for Lab 02; callers can swap this broad phase later.
export function* collisionPairs(entities) {
  const candidates = [...entities].filter(
    (entity) => entity.alive && entity.radius > 0,
  );
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const a = candidates[left];
      const b = candidates[right];
      if (circlesOverlap(a, b)) yield [a, b];
    }
  }
}
