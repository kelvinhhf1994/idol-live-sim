import * as THREE from "three";
import {
  KB_STAGE_FRONT_Z,
  KB_WALKWAY_FRONT_Z,
  type ElevatedPlatform,
  type VenueDefinition,
} from "../../config/venue";
import { addBox, setInstanceTransform, speakerGrilleTexture, type InstanceTransform, type SharedMaterials } from "../venueKit";

const STEP_MAT = new THREE.MeshStandardMaterial({ color: 0x1a1920, roughness: 0.75, metalness: 0.2 });
const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: 0xffee00, emissive: 0xffaa00, emissiveIntensity: 0.8, roughness: 0.3 });

export function buildStage(
  group: THREE.Group,
  mats: SharedMaterials,
  stage: ElevatedPlatform,
  walkway: VenueDefinition["crowdBarrier"],
): void {
  const { bounds, height } = stage;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.85 });
  addBox(group, width, height, depth, deckMat, cx, height / 2, cz, "main-stage");
  addBox(group, width + 0.04, 0.06, 0.06, mats.matteBlack, cx, height - 0.03, bounds.maxZ + 0.02, "", false);

  // Yellow gaffer T-marks along the front of the deck
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xf5d90a, emissive: 0xf5d90a, emissiveIntensity: 0.25, roughness: 0.6 });
  for (const x of [-3.2, -1.6, 0, 1.6, 3.2]) {
    addBox(group, 0.4, 0.004, 0.05, tapeMat, x, height + 0.002, bounds.maxZ - 0.6, "tape-mark", false);
    addBox(group, 0.05, 0.004, 0.3, tapeMat, x, height + 0.002, bounds.maxZ - 0.45, "", false);
  }

  buildTrussWalkway(group, mats, walkway);
  buildWalkwayStairs(group, mats, -1);
  buildWalkwayStairs(group, mats, 1);
}

/** Two-tier aluminium truss with a diamond-plate top and five wedge monitors facing the stage. */
function buildTrussWalkway(group: THREE.Group, mats: SharedMaterials, walkway: VenueDefinition["crowdBarrier"]): void {
  const truss = new THREE.Group();
  truss.name = "truss-walkway";
  const width = walkway.maxX - walkway.minX;
  const depth = walkway.maxZ - walkway.minZ;
  const cx = (walkway.minX + walkway.maxX) / 2;
  const cz = (walkway.minZ + walkway.maxZ) / 2;
  const top = walkway.maxY;
  const zFaces = [walkway.minZ + 0.05, walkway.maxZ - 0.05];

  const aluminium = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.35, metalness: 0.85 });
  const transforms: InstanceTransform[] = [];
  const bays = Math.round(width / 0.5);
  const bay = width / bays;
  for (const [lo, hi] of [[0.03, top / 2 - 0.03], [top / 2 + 0.03, top - 0.03]] as const) {
    const mid = (lo + hi) / 2;
    const rise = hi - lo;
    for (const z of zFaces) {
      // Horizontal chords
      for (const y of [lo, hi]) transforms.push([cx, y, z, 0, 0, Math.PI / 2, 1, width, 1]);
      for (let i = 0; i <= bays; i++) {
        const x = walkway.minX + i * bay;
        // Verticals
        transforms.push([x, mid, z, 0, 0, 0, 1, rise, 1]);
        // Alternating diagonals
        if (i < bays) {
          const angle = Math.atan2(rise, bay) * (i % 2 === 0 ? 1 : -1);
          transforms.push([x + bay / 2, mid, z, 0, 0, Math.PI / 2 - angle, 1, Math.hypot(bay, rise), 1]);
        }
      }
    }
    // Ties between the front and back faces
    for (let i = 0; i <= bays; i++) {
      const x = walkway.minX + i * bay;
      for (const y of [lo, hi]) transforms.push([x, y, cz, Math.PI / 2, 0, 0, 1, depth - 0.1, 1]);
    }
  }
  const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), aluminium, transforms.length);
  transforms.forEach((t, i) => setInstanceTransform(tubes, i, t));
  tubes.instanceMatrix.needsUpdate = true;
  tubes.castShadow = false;
  truss.add(tubes);

  const plateMat = new THREE.MeshStandardMaterial({ color: 0x9a9da5, roughness: 0.45, metalness: 0.7 });
  addBox(truss, width, 0.03, depth, plateMat, cx, top - 0.015, cz, "walkway-plate");

  const grilleMat = new THREE.MeshStandardMaterial({ map: speakerGrilleTexture(), roughness: 0.8 });
  for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) {
    const wedge = new THREE.Group();
    wedge.name = "wedge-monitor";
    wedge.position.set(x, top, cz);
    const body = addBox(wedge, 0.55, 0.3, 0.42, mats.fixtureBlack, 0, 0.16, 0);
    body.rotation.x = 0.55; // Tilted up toward the performers
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), grilleMat);
    grille.position.set(0, 0, -0.211);
    grille.rotation.y = Math.PI; // Face -Z (the stage)
    body.add(grille);
    truss.add(wedge);
  }
  group.add(truss);
}

/** Three treads at one end of the walkway, rising toward the stage, with an outer handrail. */
function buildWalkwayStairs(group: THREE.Group, mats: SharedMaterials, side: -1 | 1): void {
  const stairs = new THREE.Group();
  stairs.name = side < 0 ? "walkway-stairs-left" : "walkway-stairs-right";
  const cx = side < 0 ? -3.95 : 3.95; // Tread span x ∈ [-4.4, -3.5] or [3.5, 4.4]

  for (let i = 0; i < 3; i++) {
    const h = 0.2 * (i + 1);
    const z = KB_WALKWAY_FRONT_Z + 0.15 - 0.3 * i; // -7.25, -7.55, -7.85
    addBox(stairs, 0.9, h, 0.3, STEP_MAT, cx, h / 2, z);
    addBox(stairs, 0.9, 0.03, 0.05, STRIPE_MAT, cx, h + 0.015, z + 0.125, "", false);
  }

  const railX = cx + side * 0.47;
  const bottomZ = KB_WALKWAY_FRONT_Z + 0.3;
  const topZ = KB_STAGE_FRONT_Z;
  for (const [z, h] of [[bottomZ, 0.9], [topZ, 1.5]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 6), mats.steel);
    post.position.set(railX, h / 2, z);
    stairs.add(post);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(0.9, 0.6), 6), mats.steel);
  rail.position.set(railX, 1.2, (bottomZ + topZ) / 2);
  rail.rotation.x = -Math.atan2(0.9, 0.6); // Rises 0.6 over 0.9 toward -Z
  stairs.add(rail);
  group.add(stairs);
}
