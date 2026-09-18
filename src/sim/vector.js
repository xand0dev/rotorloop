export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(other) {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  sub(other) {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  scale(factor) {
    return new Vector2(this.x * factor, this.y * factor);
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  normalize() {
    const magnitude = this.length();
    return magnitude === 0 ? new Vector2() : this.scale(1 / magnitude);
  }

  rotate(radians) {
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return new Vector2(
      this.x * cosine - this.y * sine,
      this.x * sine + this.y * cosine,
    );
  }

  dot(other) {
    return this.x * other.x + this.y * other.y;
  }

  static fromAngle(radians, length = 1) {
    return new Vector2(Math.cos(radians) * length, Math.sin(radians) * length);
  }
}
