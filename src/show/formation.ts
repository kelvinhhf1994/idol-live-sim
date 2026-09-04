import * as THREE from "three";

/** Straight idol row on the stage deck; x is derived from the member count. */
export interface PerformerLine {
  y: number;
  z: number;
  spacing: number;
}

/** Evenly spaced stage marks, centred on x = 0 whatever the member count. */
export function formationPoints(line: PerformerLine, count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < count; index += 1) {
    points.push(new THREE.Vector3((index - (count - 1) / 2) * line.spacing, line.y, line.z));
  }
  return points;
}
