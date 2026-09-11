import * as THREE from "three";
import {
  KB_BACKSTAGE_GAP,
  KB_DECK_HEIGHT,
  KB_DECK_MIN_Z,
  KB_DOORWAY,
  KB_HALL_CEILING,
  KB_MIN_X,
  KB_PARTITION_X,
  KB_STAGE_FRONT_Z,
  KB_STAGE_HEIGHT,
  KB_UPPER_STAIR,
  KB_VESTIBULE,
} from "../../config/venue";
import { addBox, labelPlane, pleatedCurtainTexture, setInstanceTransform, type InstanceTransform, type SharedMaterials } from "../venueKit";
import { acousticTileMaterial } from "./shell";
import { PLUSHIE_COLORS } from "./textures";

const GLASS_ROOM_CEILING_Y = 5.8;
// Floor-to-ceiling glazing: a low kick plate at deck level and a slim header under the roof
const GLASS_SILL_Y = KB_DECK_HEIGHT + 0.08;
const GLASS_TOP_Y = GLASS_ROOM_CEILING_Y - 0.12;
const GAP_HEAD_Y = 2.5; // Clear height of the idol gap through the partition curtain
const STEP_MAT = new THREE.MeshStandardMaterial({ color: 0x1a1920, roughness: 0.75, metalness: 0.2 });
const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: 0xffee00, emissive: 0xffaa00, emissiveIntensity: 0.8, roughness: 0.3 });

export function buildBackstage(group: THREE.Group, mats: SharedMaterials): void {
  buildPartition(group, mats);
  buildStageStairs(group, mats);
  buildUpperStairs(group, mats);
  buildUpperDeck(group, mats);
  buildVestibule(group, mats);
  buildGlassRoom(group, mats);
  buildRoadCases(group, mats);
}

/** Floor-to-ceiling black curtain wall between the hall and the two-storey backstage, with the idol gap on 1/F. */
function buildPartition(group: THREE.Group, mats: SharedMaterials): void {
  const partition = new THREE.Group();
  partition.name = "backstage-partition";
  const curtainMat = new THREE.MeshStandardMaterial({ map: pleatedCurtainTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const hang = (minZ: number, maxZ: number, y0: number, y1: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(maxZ - minZ, y1 - y0), curtainMat);
    mesh.position.set(KB_PARTITION_X, (y0 + y1) / 2, (minZ + maxZ) / 2);
    mesh.rotation.y = Math.PI / 2;
    partition.add(mesh);
  };
  hang(KB_STAGE_FRONT_Z, KB_BACKSTAGE_GAP.minZ, 0, KB_HALL_CEILING);
  hang(KB_BACKSTAGE_GAP.minZ, KB_BACKSTAGE_GAP.maxZ, GAP_HEAD_Y, KB_HALL_CEILING);
  hang(KB_BACKSTAGE_GAP.maxZ, KB_VESTIBULE.minZ, 0, KB_HALL_CEILING);
  const gapLen = KB_BACKSTAGE_GAP.maxZ - KB_BACKSTAGE_GAP.minZ;
  addBox(partition, 0.12, 0.5, gapLen + 0.2, mats.matteBlack, KB_PARTITION_X, GAP_HEAD_Y + 0.25, (KB_BACKSTAGE_GAP.minZ + KB_BACKSTAGE_GAP.maxZ) / 2, "backstage-gap-valance", false);
  const trackLen = KB_VESTIBULE.minZ - KB_STAGE_FRONT_Z;
  const track = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, trackLen, 8), mats.steel);
  track.rotation.x = Math.PI / 2;
  track.position.set(KB_PARTITION_X, KB_HALL_CEILING - 0.05, KB_STAGE_FRONT_Z + trackLen / 2);
  partition.add(track);
  group.add(partition);
}

/** Four treads from the corridor floor up onto the stage wing, rising toward +X. */
function buildStageStairs(group: THREE.Group, mats: SharedMaterials): void {
  const stairs = new THREE.Group();
  stairs.name = "stage-stairs";
  const treadW = 0.25;
  const depth = 1.0;
  const cz = -9.0;
  for (let i = 0; i < 4; i++) {
    const h = (KB_STAGE_HEIGHT / 4) * (i + 1);
    const x = -5.5 + treadW * (i + 0.5);
    addBox(stairs, treadW, h, depth, STEP_MAT, x, h / 2, cz);
    addBox(stairs, 0.05, 0.03, depth, STRIPE_MAT, x - treadW / 2 + 0.025, h + 0.015, cz, "", false);
  }
  const railZ = cz - depth / 2 - 0.03;
  for (const [x, h] of [[-5.5, 0.9], [-4.5, 0.9 + KB_STAGE_HEIGHT]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 6), mats.steel);
    post.position.set(x, h / 2, railZ);
    stairs.add(post);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(1.0, KB_STAGE_HEIGHT), 6), mats.steel);
  rail.position.set(-5.0, 0.9 + KB_STAGE_HEIGHT / 2, railZ);
  rail.rotation.z = -Math.atan2(1.0, KB_STAGE_HEIGHT); // Rises toward +X
  stairs.add(rail);
  group.add(stairs);
}

/** Fifteen steel treads with stringers and handrails, rising toward +Z to the deck. */
function buildUpperStairs(group: THREE.Group, mats: SharedMaterials): void {
  const { minX, maxX, startZ, tread, rise, steps } = KB_UPPER_STAIR;
  const stairs = new THREE.Group();
  stairs.name = "upper-stairs";
  const width = maxX - minX;
  const cx = (minX + maxX) / 2;
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7, metalness: 0.35 });
  const riserMat = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.8 });
  for (let i = 0; i < steps; i++) {
    const h = rise * (i + 1);
    const z = startZ + tread * (i + 0.5);
    addBox(stairs, width, 0.05, tread, treadMat, cx, h - 0.025, z);
    addBox(stairs, width - 0.1, rise, 0.03, riserMat, cx, h - rise / 2, z - tread / 2 + 0.015, "", false);
  }
  const run = tread * steps;
  const totalRise = rise * steps;
  const slopeLen = Math.hypot(run, totalRise);
  const slope = Math.atan2(totalRise, run);
  for (const x of [minX + 0.03, maxX - 0.03]) {
    const stringer = addBox(stairs, 0.06, 0.25, slopeLen, mats.steel, x, totalRise / 2 - 0.1, startZ + run / 2);
    stringer.rotation.x = -slope;
  }
  for (const x of [minX - 0.03, maxX + 0.03]) {
    for (let i = 0; i <= steps; i += 5) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), mats.steel);
      post.position.set(x, rise * i + 0.45, startZ + tread * i);
      stairs.add(post);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, slopeLen, 6), mats.steel);
    rail.position.set(x, totalRise / 2 + 0.9, startZ + run / 2);
    rail.rotation.x = Math.PI / 2 - slope;
    stairs.add(rail);
  }
  group.add(stairs);
}

/** 2/F floor: corridor deck (stairwell open at z < KB_DECK_MIN_Z) and the glass room deck; the hall side is the curtain wall. */
function buildUpperDeck(group: THREE.Group, mats: SharedMaterials): void {
  const deck = new THREE.Group();
  deck.name = "upper-deck";
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x1d1c22, roughness: 0.8 });
  const corridorLen = KB_VESTIBULE.minZ - KB_DECK_MIN_Z;
  addBox(deck, KB_PARTITION_X - KB_MIN_X, 0.12, corridorLen, deckMat, (KB_MIN_X + KB_PARTITION_X) / 2, KB_DECK_HEIGHT - 0.06, (KB_DECK_MIN_Z + KB_VESTIBULE.minZ) / 2, "deck-corridor");
  addBox(
    deck,
    KB_VESTIBULE.maxX - KB_VESTIBULE.minX,
    0.12,
    KB_VESTIBULE.maxZ - KB_VESTIBULE.minZ,
    deckMat,
    (KB_VESTIBULE.minX + KB_VESTIBULE.maxX) / 2,
    KB_DECK_HEIGHT - 0.06,
    (KB_VESTIBULE.minZ + KB_VESTIBULE.maxZ) / 2,
    "deck-glass-room",
  );

  // Two-rail steel balustrade across the stairwell edge
  const edges: Array<{ from: readonly [number, number]; to: readonly [number, number] }> = [
    { from: [KB_UPPER_STAIR.maxX, KB_DECK_MIN_Z], to: [KB_PARTITION_X, KB_DECK_MIN_Z] },
  ];
  const transforms: InstanceTransform[] = [];
  for (const { from, to } of edges) {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const cx = (from[0] + to[0]) / 2;
    const cz = (from[1] + to[1]) / 2;
    const alongX = Math.abs(to[0] - from[0]) > Math.abs(to[1] - from[1]);
    for (const y of [KB_DECK_HEIGHT + 0.55, KB_DECK_HEIGHT + 1.05]) {
      transforms.push(alongX ? [cx, y, cz, 0, 0, Math.PI / 2, 1, len, 1] : [cx, y, cz, Math.PI / 2, 0, 0, 1, len, 1]);
    }
    const posts = Math.max(2, Math.round(len / 1.2) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      transforms.push([from[0] + (to[0] - from[0]) * t, KB_DECK_HEIGHT + 0.525, from[1] + (to[1] - from[1]) * t, 0, 0, 0, 1, 1.05, 1]);
    }
  }
  const rails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), mats.steel, transforms.length);
  transforms.forEach((t, i) => setInstanceTransform(rails, i, t));
  rails.instanceMatrix.needsUpdate = true;
  rails.name = "deck-rail";
  deck.add(rails);

  // Work light over the enclosed corridor deck
  const light = new THREE.PointLight(0xfff1dc, 6, 7, 1.6);
  light.position.set((KB_MIN_X + KB_PARTITION_X) / 2, KB_DECK_HEIGHT + 2.6, (KB_DECK_MIN_Z + KB_VESTIBULE.minZ) / 2);
  light.name = "deck-light";
  deck.add(light);
  group.add(deck);
}

/** Ground-floor entrance box under the glass room: acoustic-tiled faces, doorway opening into the hall (+X), chairs, outer door. */
function buildVestibule(group: THREE.Group, mats: SharedMaterials): void {
  const vestibule = new THREE.Group();
  vestibule.name = "entrance-vestibule";
  const v = KB_VESTIBULE;

  // Solid -Z face; tiles face -Z toward the stage
  const frontLen = v.maxX - v.minX;
  addBox(vestibule, frontLen, KB_DECK_HEIGHT, 0.2, mats.wallCharcoal, (v.minX + v.maxX) / 2, KB_DECK_HEIGHT / 2, v.minZ, "vestibule-wall");
  const frontTiles = new THREE.Mesh(new THREE.PlaneGeometry(frontLen, KB_DECK_HEIGHT), acousticTileMaterial(frontLen, KB_DECK_HEIGHT));
  frontTiles.rotation.y = Math.PI;
  frontTiles.position.set((v.minX + v.maxX) / 2, KB_DECK_HEIGHT / 2, v.minZ - 0.101);
  vestibule.add(frontTiles);
  // +X face in two segments around the doorway; tiles face +X into the hall
  for (const [a, b] of [[v.minZ, KB_DOORWAY.minZ], [KB_DOORWAY.maxZ, v.maxZ]] as const) {
    addBox(vestibule, 0.2, KB_DECK_HEIGHT, b - a, mats.wallCharcoal, v.maxX, KB_DECK_HEIGHT / 2, (a + b) / 2, "vestibule-wall");
    const tiles = new THREE.Mesh(new THREE.PlaneGeometry(b - a, KB_DECK_HEIGHT), acousticTileMaterial(b - a, KB_DECK_HEIGHT));
    tiles.rotation.y = Math.PI / 2;
    tiles.position.set(v.maxX + 0.101, KB_DECK_HEIGHT / 2, (a + b) / 2);
    vestibule.add(tiles);
  }
  // Header over the doorway and steel trims
  const doorCz = (KB_DOORWAY.minZ + KB_DOORWAY.maxZ) / 2;
  const doorW = KB_DOORWAY.maxZ - KB_DOORWAY.minZ;
  addBox(vestibule, 0.2, KB_DECK_HEIGHT - 2.2, doorW, mats.wallCharcoal, v.maxX, 2.2 + (KB_DECK_HEIGHT - 2.2) / 2, doorCz, "", false);
  const doorway = new THREE.Group();
  doorway.name = "entrance-doorway";
  doorway.position.set(v.maxX, 0, doorCz);
  addBox(doorway, 0.26, 2.24, 0.08, mats.frameBlack, 0, 1.12, -doorW / 2 - 0.04, "", false);
  addBox(doorway, 0.26, 2.24, 0.08, mats.frameBlack, 0, 1.12, doorW / 2 + 0.04, "", false);
  addBox(doorway, 0.26, 0.08, doorW + 0.16, mats.frameBlack, 0, 2.24, 0, "", false);
  vestibule.add(doorway);

  // Warm light inside so the doorway reads bright from the dark hall
  const light = new THREE.PointLight(0xffe9c8, 12, 7, 1.6);
  light.position.set((v.minX + v.maxX) / 2, 2.7, (v.minZ + v.maxZ) / 2);
  light.name = "vestibule-light";
  vestibule.add(light);

  // Stacked folding chairs along the -X wall
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2c2c31, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const chair = addBox(vestibule, 0.45, 0.9, 0.06, chairMat, -6.0 + i * 0.03, 0.5, 2.3 + i * 0.4, "folding-chair");
    chair.rotation.x = 0.12;
  }

  // Outer door on the rear wall with the entrance sign
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a2830, roughness: 0.7, metalness: 0.2 });
  addBox(vestibule, 1.0, 2.1, 0.08, doorMat, -4.8, 1.05, v.maxZ - 0.06, "outer-door");
  const sign = labelPlane("入口 ENTRANCE", "#111114", "#ffffff", 1.2, 0.35);
  sign.position.set(-4.8, 2.5, v.maxZ - 0.12);
  sign.rotation.y = Math.PI;
  vestibule.add(sign);
  group.add(vestibule);
}

/**
 * Glass-walled room on 2/F over the vestibule with floor-to-ceiling glazing toward the stage (-Z) and the hall (+X).
 * The -Z side over the backstage corridor stays open so the deck corridor walks straight in. Shelves of plushies inside.
 */
function buildGlassRoom(group: THREE.Group, mats: SharedMaterials): void {
  const room = new THREE.Group();
  room.name = "glass-room";
  const v = KB_VESTIBULE;
  const w = v.maxX - v.minX;
  const d = v.maxZ - v.minZ;
  const cx = (v.minX + v.maxX) / 2;
  const cz = (v.minZ + v.maxZ) / 2;
  const sillH = GLASS_SILL_Y - KB_DECK_HEIGHT;
  const headerH = GLASS_ROOM_CEILING_Y - GLASS_TOP_Y;
  const frontW = v.maxX - KB_PARTITION_X;
  const frontCx = (KB_PARTITION_X + v.maxX) / 2;

  addBox(room, frontW, sillH, 0.15, mats.wallCharcoal, frontCx, KB_DECK_HEIGHT + sillH / 2, v.minZ, "glass-room-sill");
  addBox(room, frontW, headerH, 0.15, mats.wallCharcoal, frontCx, GLASS_TOP_Y + headerH / 2, v.minZ, "glass-room-header");
  glazing(room, mats, [KB_PARTITION_X + 0.05, v.maxX - 0.1], v.minZ, "z");
  addBox(room, 0.15, sillH, d, mats.wallCharcoal, v.maxX, KB_DECK_HEIGHT + sillH / 2, cz, "glass-room-sill");
  addBox(room, 0.15, headerH, d, mats.wallCharcoal, v.maxX, GLASS_TOP_Y + headerH / 2, cz, "glass-room-header");
  glazing(room, mats, [v.minZ + 0.1, v.maxZ - 0.1], v.maxX, "x");
  addBox(room, w + 0.15, 0.15, d + 0.15, mats.matteBlack, cx, GLASS_ROOM_CEILING_Y + 0.075, cz, "glass-room-roof");

  buildPlushieShelves(room, mats);

  const light = new THREE.PointLight(0xfff1dc, 14, 6, 1.4);
  light.position.set(cx, GLASS_ROOM_CEILING_Y - 0.2, cz);
  light.name = "glass-room-light";
  room.add(light);
  group.add(room);
}

/** Two glass panes split by a centre mullion, framed top and bottom. `axis` is the wall's running direction. */
function glazing(parent: THREE.Group, mats: SharedMaterials, span: readonly [number, number], at: number, axis: "x" | "z"): void {
  const len = span[1] - span[0];
  const mid = (span[0] + span[1]) / 2;
  const h = GLASS_TOP_Y - GLASS_SILL_Y;
  const cy = (GLASS_SILL_Y + GLASS_TOP_Y) / 2;
  const paneLen = len / 2 - 0.05;
  for (const offset of [-len / 4, len / 4]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(paneLen, h), mats.glass);
    pane.name = "glass-pane";
    if (axis === "z") {
      pane.position.set(mid + offset, cy, at);
    } else {
      pane.position.set(at, cy, mid + offset);
      pane.rotation.y = Math.PI / 2;
    }
    parent.add(pane);
  }
  for (const y of [GLASS_SILL_Y, GLASS_TOP_Y]) {
    if (axis === "z") addBox(parent, len, 0.08, 0.08, mats.frameBlack, mid, y, at, "", false);
    else addBox(parent, 0.08, 0.08, len, mats.frameBlack, at, y, mid, "", false);
  }
  for (const p of [span[0], mid, span[1]]) {
    if (axis === "z") addBox(parent, 0.08, h, 0.08, mats.frameBlack, p, cy, at, "", false);
    else addBox(parent, 0.08, h, 0.08, mats.frameBlack, at, cy, p, "", false);
  }
}

/** Two shelf tiers along the -X and rear walls, lined with instanced colourful plushie boxes. */
function buildPlushieShelves(room: THREE.Group, mats: SharedMaterials): void {
  const v = KB_VESTIBULE;
  const slots: Array<[number, number, number]> = [];
  for (const y of [KB_DECK_HEIGHT + 0.9, KB_DECK_HEIGHT + 1.6]) {
    addBox(room, 0.35, 0.04, v.maxZ - v.minZ - 0.4, mats.offWhite, v.minX + 0.2, y, (v.minZ + v.maxZ) / 2, "plushie-shelf");
    for (let z = v.minZ + 0.35; z < v.maxZ - 0.3; z += 0.27) slots.push([v.minX + 0.2, y + 0.13, z]);
    addBox(room, v.maxX - v.minX - 0.8, 0.04, 0.35, mats.offWhite, (v.minX + v.maxX) / 2 + 0.2, y, v.maxZ - 0.2, "plushie-shelf");
    for (let x = v.minX + 0.6; x < v.maxX - 0.3; x += 0.27) slots.push([x, y + 0.13, v.maxZ - 0.2]);
  }
  const boxes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    slots.length,
  );
  slots.forEach(([x, y, z], i) => {
    setInstanceTransform(boxes, i, [x, y, z, 0, ((i * 7) % 5) * 0.08, 0, 1, 1, 1]);
    boxes.setColorAt(i, new THREE.Color(PLUSHIE_COLORS[i % PLUSHIE_COLORS.length] ?? 0xffffff));
  });
  boxes.instanceMatrix.needsUpdate = true;
  if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true;
  boxes.name = "plushie-boxes";
  room.add(boxes);
}

/** Black road cases parked along the corridor's -X wall (colliders in venue.ts). */
function buildRoadCases(group: THREE.Group, mats: SharedMaterials): void {
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6, metalness: 0.3 });
  for (const [z0, z1] of [[-3.4, -2.6], [-1.6, -0.8]] as const) {
    const roadCase = addBox(group, 0.5, 1.0, z1 - z0, caseMat, -6.25, 0.5, (z0 + z1) / 2, "road-case");
    addBox(roadCase, 0.52, 0.04, z1 - z0 + 0.02, mats.steel, 0, 0.5, 0, "", false);
  }
}
