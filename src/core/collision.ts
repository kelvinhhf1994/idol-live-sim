export interface Point2 {
  x: number;
  z: number;
}

export interface Aabb2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY?: number;
}

export function moveCircleWithCollisions(
  position: Point2,
  delta: Point2,
  radius: number,
  colliders: readonly Aabb2[],
  baseY = Number.NEGATIVE_INFINITY,
): Point2 {
  const result = { ...position };
  const nextX = { x: result.x + delta.x, z: result.z };

  if (!colliders.some((collider) => blocksAxis(position, nextX, radius, collider, baseY, "x"))) {
    result.x = nextX.x;
  }

  const nextZ = { x: result.x, z: result.z + delta.z };
  const zStart = { x: result.x, z: position.z };
  if (!colliders.some((collider) => blocksAxis(zStart, nextZ, radius, collider, baseY, "z"))) {
    result.z = nextZ.z;
  }

  return result;
}

function blocksAxis(
  start: Point2,
  end: Point2,
  radius: number,
  collider: Aabb2,
  baseY: number,
  axis: "x" | "z",
): boolean {
  if (collider.maxY !== undefined && baseY >= collider.maxY) return false;
  if (collider.maxY !== undefined && overlaps(start, radius, collider)) return false;
  if (overlaps(end, radius, collider)) return true;

  if (axis === "x") {
    if (start.z < collider.minZ - radius || start.z > collider.maxZ + radius) return false;
    const min = collider.minX - radius;
    const max = collider.maxX + radius;
    return (start.x < min && end.x > max) || (start.x > max && end.x < min);
  }

  if (start.x < collider.minX - radius || start.x > collider.maxX + radius) return false;
  const min = collider.minZ - radius;
  const max = collider.maxZ + radius;
  return (start.z < min && end.z > max) || (start.z > max && end.z < min);
}

function overlaps(position: Point2, radius: number, collider: Aabb2): boolean {
  const closestX = Math.max(collider.minX, Math.min(position.x, collider.maxX));
  const closestZ = Math.max(collider.minZ, Math.min(position.z, collider.maxZ));
  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}
