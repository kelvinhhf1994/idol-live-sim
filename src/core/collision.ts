export interface Point2 {
  x: number;
  z: number;
}

export interface Aabb2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function moveCircleWithCollisions(
  position: Point2,
  delta: Point2,
  radius: number,
  colliders: readonly Aabb2[],
): Point2 {
  const result = { ...position };
  const nextX = { x: result.x + delta.x, z: result.z };

  if (!colliders.some((collider) => overlaps(nextX, radius, collider))) {
    result.x = nextX.x;
  }

  const nextZ = { x: result.x, z: result.z + delta.z };
  if (!colliders.some((collider) => overlaps(nextZ, radius, collider))) {
    result.z = nextZ.z;
  }

  return result;
}

function overlaps(position: Point2, radius: number, collider: Aabb2): boolean {
  const closestX = Math.max(collider.minX, Math.min(position.x, collider.maxX));
  const closestZ = Math.max(collider.minZ, Math.min(position.z, collider.maxZ));
  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}
