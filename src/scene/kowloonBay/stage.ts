import * as THREE from "three";
import {
  KB_BACK_WALL_Z,
  KB_STAGE_FRONT_Z,
  KB_WALKWAY_HEIGHT,
  KB_WALKWAY_STEPS,
  type ElevatedPlatform,
  type VenueDefinition,
} from "../../config/venue";
import { addBox, setInstanceTransform, speakerGrilleTexture, type InstanceTransform, type SharedMaterials } from "../venueKit";
import { frontierLedTexture } from "./textures";

const LED_WIDTH = 8.4;
const LED_HEIGHT = LED_WIDTH * (9 / 16);
const LED_ART_URL = "/textures/kb-led-frontier.png";

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

  buildLedWall(group, mats, height);
  buildTrussWalkway(group, mats, walkway);
  buildWalkwayStairs(group, mats, -1);
  buildWalkwayStairs(group, mats, 1);
}

/** 16:9 video wall flush to the back curtain, showing the Frontier title card. */
function buildLedWall(group: THREE.Group, mats: SharedMaterials, stageHeight: number): void {
  const ledTexture = frontierLedTexture();
  const ledMaterial = new THREE.MeshStandardMaterial({
    map: ledTexture,
    emissive: 0xffffff,
    emissiveMap: ledTexture,
    emissiveIntensity: 1.05,
    roughness: 0.28,
    metalness: 0.12,
  });
  const ledWall = new THREE.Mesh(new THREE.PlaneGeometry(LED_WIDTH, LED_HEIGHT), ledMaterial);
  ledWall.name = "led-screen";
  ledWall.position.set(0, stageHeight + LED_HEIGHT / 2, KB_BACK_WALL_Z + 0.12);
  group.add(ledWall);
  addBox(
    group,
    LED_WIDTH + 0.22,
    LED_HEIGHT + 0.22,
    0.1,
    mats.fixtureBlack,
    0,
    ledWall.position.y,
    KB_BACK_WALL_Z + 0.06,
    "led-frame",
    false,
  );

  if (typeof document !== "undefined") {
    new THREE.TextureLoader().load(LED_ART_URL, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      ledMaterial.map = tex;
      ledMaterial.emissiveMap = tex;
      ledMaterial.needsUpdate = true;
    });
  }
}

/**
 * Stacked tiers of box-section lighting truss (the kind normally hung from the ceiling) laid along the stage front,
 * with a diamond-plate top and five wedge monitors facing the stage. Each tier is a full square section:
 * four main chords, verticals and diagonals on the front and back faces, and ties across the top and bottom.
 */
function buildTrussWalkway(group: THREE.Group, mats: SharedMaterials, walkway: VenueDefinition["crowdBarrier"]): void {
  const truss = new THREE.Group();
  truss.name = "truss-walkway";
  const width = walkway.maxX - walkway.minX;
  const depth = walkway.maxZ - walkway.minZ;
  const cx = (walkway.minX + walkway.maxX) / 2;
  const cz = (walkway.minZ + walkway.maxZ) / 2;
  const top = walkway.maxY;
  const chordR = 0.03;
  const braceR = 0.016;
  const zFaces = [walkway.minZ + chordR + 0.02, walkway.maxZ - chordR - 0.02];

  const aluminium = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.35, metalness: 0.85 });
  const chords: InstanceTransform[] = [];
  const braces: InstanceTransform[] = [];
  const bays = Math.round(width / 0.5);
  const bay = width / bays;
  // Stack as many ~0.45 m truss sections as the walkway height needs
  const tiers = Math.max(2, Math.round(top / 0.45));
  const tier = top / tiers;
  const sections = Array.from({ length: tiers }, (_, t) => [t * tier + chordR, (t + 1) * tier - chordR] as const);
  for (const [lo, hi] of sections) {
    const mid = (lo + hi) / 2;
    const rise = hi - lo;
    for (const z of zFaces) {
      // Main chords running the full length
      for (const y of [lo, hi]) chords.push([cx, y, z, 0, 0, Math.PI / 2, 1, width, 1]);
      for (let i = 0; i <= bays; i++) {
        const x = walkway.minX + i * bay;
        // Verticals
        braces.push([x, mid, z, 0, 0, 0, 1, rise, 1]);
        // Alternating diagonals
        if (i < bays) {
          const angle = Math.atan2(rise, bay) * (i % 2 === 0 ? 1 : -1);
          braces.push([x + bay / 2, mid, z, 0, 0, Math.PI / 2 - angle, 1, Math.hypot(bay, rise), 1]);
        }
      }
    }
    // Ties across the section between the front and back faces, top and bottom
    for (let i = 0; i <= bays; i++) {
      const x = walkway.minX + i * bay;
      for (const y of [lo, hi]) braces.push([x, y, cz, Math.PI / 2, 0, 0, 1, zFaces[1]! - zFaces[0]!, 1]);
    }
    // End plates where the two tiers bolt together
    for (const x of [walkway.minX, walkway.maxX]) {
      addBox(truss, 0.04, rise + 2 * chordR, depth, aluminium, x, mid, cz, "", false);
    }
  }
  const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(chordR, chordR, 1, 8), aluminium, chords.length);
  chords.forEach((t, i) => setInstanceTransform(tubes, i, t));
  tubes.instanceMatrix.needsUpdate = true;
  tubes.castShadow = false;
  truss.add(tubes);
  const bracing = new THREE.InstancedMesh(new THREE.CylinderGeometry(braceR, braceR, 1, 6), aluminium, braces.length);
  braces.forEach((t, i) => setInstanceTransform(bracing, i, t));
  bracing.instanceMatrix.needsUpdate = true;
  bracing.castShadow = false;
  truss.add(bracing);

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

/** Treads at one end of the walkway, rising toward the stage to the walkway height, with an outer handrail. */
function buildWalkwayStairs(group: THREE.Group, mats: SharedMaterials, side: -1 | 1): void {
  const stairs = new THREE.Group();
  stairs.name = side < 0 ? "walkway-stairs-left" : "walkway-stairs-right";
  const cx = side < 0 ? -3.95 : 3.95; // Tread span x ∈ [-4.4, -3.5] or [3.5, 4.4]
  const steps = KB_WALKWAY_STEPS;
  const tread = 0.3;
  const rise = KB_WALKWAY_HEIGHT;

  for (let i = 0; i < steps; i++) {
    const h = (rise / steps) * (i + 1);
    const z = KB_STAGE_FRONT_Z + tread * (steps - i - 0.5); // Top tread sits against the stage front
    addBox(stairs, 0.9, h, tread, STEP_MAT, cx, h / 2, z);
    addBox(stairs, 0.9, 0.03, 0.05, STRIPE_MAT, cx, h + 0.015, z + tread / 2 - 0.025, "", false);
  }

  const railX = cx + side * 0.47;
  const bottomZ = KB_STAGE_FRONT_Z + tread * steps;
  const topZ = KB_STAGE_FRONT_Z;
  const run = bottomZ - topZ;
  for (const [z, h] of [[bottomZ, 0.9], [topZ, 0.9 + rise]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 6), mats.steel);
    post.position.set(railX, h / 2, z);
    stairs.add(post);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(run, rise), 6), mats.steel);
  rail.position.set(railX, 0.9 + rise / 2, (bottomZ + topZ) / 2);
  rail.rotation.x = -Math.atan2(run, rise); // Rises toward -Z
  stairs.add(rail);
  group.add(stairs);
}
