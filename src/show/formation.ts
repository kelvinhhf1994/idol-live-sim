import * as THREE from "three";

/** Front row of the idol formation on the stage deck; x is derived from the member count. */
export interface PerformerLine {
  y: number;
  z: number;
  spacing: number;
}

/** Largest line-up that still reads as a single V; bigger groups zigzag across two rows. */
const MAX_V_COUNT = 5;
/** Depth of one rank relative to the x gap, so the V angle is the same on every stage. */
const RANK_DEPTH_RATIO = 0.75;

/**
 * Rank (0 = front row) of each slot. Up to five idols form a V with the centre
 * in front and the outer pairs stepping back; six or more alternate front/back
 * so the centre idol still leads.
 */
function formationRanks(count: number): number[] {
  const centre = (count - 1) / 2;
  if (count <= MAX_V_COUNT) {
    const ranks = Array.from({ length: count }, (_, index) => Math.abs(index - centre));
    const front = Math.min(...ranks);
    return ranks.map((rank) => rank - front);
  }
  const frontIndex = Math.floor(centre);
  return Array.from({ length: count }, (_, index) => Math.abs(index - frontIndex) % 2);
}

/** Stage marks centred on x = 0; the front row sits on line.z and deeper ranks step toward -z. */
export function formationPoints(line: PerformerLine, count: number): THREE.Vector3[] {
  const ranks = formationRanks(count);
  const step = line.spacing * RANK_DEPTH_RATIO;
  return ranks.map(
    (rank, index) =>
      new THREE.Vector3((index - (count - 1) / 2) * line.spacing, line.y, line.z - rank * step),
  );
}
