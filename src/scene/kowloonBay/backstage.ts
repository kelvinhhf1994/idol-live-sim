import * as THREE from "three";
import {
  KB_BACKSTAGE_GAP,
  KB_BACK_WALL_Z,
  KB_DECK_HEIGHT,
  KB_DECK_MIN_Z,
  KB_DECK_RAIL_GAP,
  KB_GLASS_SOFA,
  KB_DOORWAY,
  KB_HALL_CEILING,
  KB_LANDING,
  KB_LOWER_STAIR,
  KB_MIN_X,
  KB_PARTITION_X,
  KB_REAR_WALL_Z,
  KB_STAGE_FRONT_Z,
  KB_STAGE_HEIGHT,
  KB_UPPER_STAIR,
  KB_VESTIBULE,
} from "../../config/venue";
import { addBox, labelPlane, pleatedCurtainTexture, setInstanceTransform, type InstanceTransform, type SharedMaterials } from "../venueKit";
import { buildBackstageSet } from "./backstageSet";
import { acousticTileMaterial } from "./shell";
import { PLUSHIE_COLORS } from "./textures";

// Floor-to-ceiling glazing: a low kick plate at deck level, glass running up to the hall slab
const GLASS_SILL_Y = KB_DECK_HEIGHT + 0.08;
const GLASS_TOP_Y = KB_HALL_CEILING;
const GAP_HEAD_Y = 2.5; // Clear height of the idol gap through the partition curtain
const STEP_MAT = new THREE.MeshStandardMaterial({ color: 0x1a1920, roughness: 0.75, metalness: 0.2 });
const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: 0xffee00, emissive: 0xffaa00, emissiveIntensity: 0.8, roughness: 0.3 });

export function buildBackstage(group: THREE.Group, mats: SharedMaterials): void {
  buildPartition(group, mats);
  buildLanding(group);
  buildLowerStairs(group, mats);
  buildUpperStairs(group, mats);
  buildUpperDeck(group, mats);
  buildBackstageInterior(group, mats);
  buildVestibule(group, mats);
  buildGlassRoom(group, mats);
  buildBackstageLights(group, mats);
  buildBackstageSet(group, mats);
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
  // Over the stage wing the 1/F stays open (landing -> stage); the curtain closes the 2/F from deck level up
  hang(KB_BACK_WALL_Z, KB_STAGE_FRONT_Z, KB_DECK_HEIGHT, KB_HALL_CEILING);
  hang(KB_STAGE_FRONT_Z, KB_BACKSTAGE_GAP.minZ, 0, KB_HALL_CEILING);
  hang(KB_BACKSTAGE_GAP.minZ, KB_BACKSTAGE_GAP.maxZ, GAP_HEAD_Y, KB_HALL_CEILING);
  hang(KB_BACKSTAGE_GAP.maxZ, KB_VESTIBULE.minZ, 0, KB_HALL_CEILING);
  const gapLen = KB_BACKSTAGE_GAP.maxZ - KB_BACKSTAGE_GAP.minZ;
  addBox(partition, 0.12, 0.5, gapLen + 0.2, mats.matteBlack, KB_PARTITION_X, GAP_HEAD_Y + 0.25, (KB_BACKSTAGE_GAP.minZ + KB_BACKSTAGE_GAP.maxZ) / 2, "backstage-gap-valance", false);
  const trackLen = KB_VESTIBULE.minZ - KB_BACK_WALL_Z;
  const track = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, trackLen, 8), mats.steel);
  track.rotation.x = Math.PI / 2;
  track.position.set(KB_PARTITION_X, KB_HALL_CEILING - 0.05, KB_BACK_WALL_Z + trackLen / 2);
  partition.add(track);
  group.add(partition);
}

/** Stage-height landing filling the stage end of the corridor; its +X edge is open onto the stage wing. */
function buildLanding(group: THREE.Group): void {
  const l = KB_LANDING;
  const w = l.maxX - l.minX;
  const d = l.maxZ - l.minZ;
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.85 });
  addBox(group, w, KB_STAGE_HEIGHT, d, deckMat, (l.minX + l.maxX) / 2, KB_STAGE_HEIGHT / 2, (l.minZ + l.maxZ) / 2, "backstage-landing");
  // Yellow edge stripe along the drop toward the corridor, leaving the lower stair open
  const s = KB_LOWER_STAIR;
  for (const [a, b] of [[l.minX, s.minX], [s.maxX, l.maxX]] as const) {
    addBox(group, b - a, 0.03, 0.05, STRIPE_MAT, (a + b) / 2, KB_STAGE_HEIGHT + 0.015, l.maxZ - 0.025, "", false);
  }
}

/** Five treads from the corridor floor up to the landing, rising toward -Z, with a handrail on each side. */
function buildLowerStairs(group: THREE.Group, mats: SharedMaterials): void {
  const { minX, maxX, topZ, tread, rise, steps } = KB_LOWER_STAIR;
  const stairs = new THREE.Group();
  stairs.name = "lower-stairs";
  const width = maxX - minX;
  const cx = (minX + maxX) / 2;
  for (let i = 0; i < steps; i++) {
    const h = rise * (i + 1);
    const z = topZ + tread * (steps - i - 0.5);
    addBox(stairs, width, h, tread, STEP_MAT, cx, h / 2, z);
    addBox(stairs, width, 0.03, 0.05, STRIPE_MAT, cx, h + 0.015, z + tread / 2 - 0.025, "", false);
  }
  const run = tread * steps;
  const totalRise = rise * steps;
  const bottomZ = topZ + run;
  for (const x of [minX - 0.03, maxX + 0.03]) {
    for (const [z, h] of [[bottomZ, 0.9], [topZ, 0.9 + totalRise]] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 6), mats.steel);
      post.position.set(x, h / 2, z);
      stairs.add(post);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(run, totalRise), 6), mats.steel);
    rail.position.set(x, 0.9 + totalRise / 2, topZ + run / 2);
    rail.rotation.x = -Math.atan2(run, totalRise); // Rises toward -Z
    stairs.add(rail);
  }
  group.add(stairs);
}

/** Ten steel treads with stringers and handrails, rising from the landing toward -X along the back wall to the deck. */
function buildUpperStairs(group: THREE.Group, mats: SharedMaterials): void {
  const { minZ, maxZ, startX, tread, rise, steps } = KB_UPPER_STAIR;
  const stairs = new THREE.Group();
  stairs.name = "upper-stairs";
  const width = maxZ - minZ;
  const cz = (minZ + maxZ) / 2;
  const base = KB_STAGE_HEIGHT;
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7, metalness: 0.35 });
  const riserMat = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.8 });
  for (let i = 0; i < steps; i++) {
    const h = base + rise * (i + 1);
    const x = startX - tread * (i + 0.5);
    addBox(stairs, tread, 0.05, width, treadMat, x, h - 0.025, cz);
    addBox(stairs, 0.03, rise, width - 0.1, riserMat, x + tread / 2 - 0.015, h - rise / 2, cz, "", false);
  }
  const run = tread * steps;
  const totalRise = rise * steps;
  const slopeLen = Math.hypot(run, totalRise);
  const slope = Math.atan2(totalRise, run);
  const midX = startX - run / 2;
  for (const z of [minZ + 0.03, maxZ - 0.03]) {
    const stringer = addBox(stairs, slopeLen, 0.25, 0.06, mats.steel, midX, base + totalRise / 2 - 0.1, z);
    stringer.rotation.z = -slope; // Rises toward -X
  }
  // Handrail on the open (+Z) side only; the -Z side is the back wall
  const railZ = maxZ + 0.03;
  for (let i = 0; i <= steps; i += 5) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), mats.steel);
    post.position.set(startX - tread * i, base + rise * i + 0.45, railZ);
    stairs.add(post);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, slopeLen, 6), mats.steel);
  rail.position.set(midX, base + totalRise / 2 + 0.9, railZ);
  rail.rotation.z = Math.PI / 2 - slope; // Rises toward -X
  stairs.add(rail);
  group.add(stairs);
}

/** 2/F floor: corridor deck (stairwell open at z < KB_DECK_MIN_Z) and the glass room deck; the hall side is the curtain wall. */
function buildUpperDeck(group: THREE.Group, mats: SharedMaterials): void {
  const deck = new THREE.Group();
  deck.name = "upper-deck";
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.72 });
  const dark = mats.wallCharcoal;
  // +X / -Z faces sit on the hall; keep those charcoal so the cream slab does not flash outside
  const corridorDeck = [dark, deckMat, deckMat, dark, deckMat, deckMat];
  const glassDeck = [dark, deckMat, deckMat, dark, deckMat, dark];
  const corridorLen = KB_VESTIBULE.minZ - KB_DECK_MIN_Z;
  addBox(deck, KB_PARTITION_X - KB_MIN_X, 0.12, corridorLen, deckMat, (KB_MIN_X + KB_PARTITION_X) / 2, KB_DECK_HEIGHT - 0.06, (KB_DECK_MIN_Z + KB_VESTIBULE.minZ) / 2, "deck-corridor").material =
    corridorDeck;
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
  ).material = glassDeck;

  // Two-rail steel balustrade along the stairwell edge, open at the top-of-stair landing
  const edges: Array<{ from: readonly [number, number]; to: readonly [number, number] }> = [
    { from: [KB_DECK_RAIL_GAP.maxX, KB_DECK_MIN_Z], to: [KB_PARTITION_X, KB_DECK_MIN_Z] },
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
  group.add(deck);
}

/** White painted room: walls and ceilings on both backstage floors so the furniture reads as one interior. */
function buildBackstageInterior(group: THREE.Group, mats: SharedMaterials): void {
  const interior = new THREE.Group();
  interior.name = "backstage-interior";
  const white = mats.offWhite;
  const dark = mats.wallCharcoal;
  // BoxGeometry groups: +X, -X, +Y, -Y, +Z, -Z. Keep white on the room side only.
  const outerWall = [white, dark, white, white, white, white];
  const backWall = [dark, white, white, white, white, dark];
  const partitionWall = [dark, white, white, white, white, white];
  const cx = (KB_MIN_X + KB_PARTITION_X) / 2;
  const depth = KB_REAR_WALL_Z - KB_BACK_WALL_Z;
  const midZ = (KB_BACK_WALL_Z + KB_REAR_WALL_Z) / 2;
  addBox(interior, 0.05, KB_HALL_CEILING, depth, white, KB_MIN_X + 0.03, KB_HALL_CEILING / 2, midZ, "backstage-wall", false).material = outerWall;
  addBox(interior, KB_PARTITION_X - KB_MIN_X, KB_HALL_CEILING, 0.05, white, cx, KB_HALL_CEILING / 2, KB_BACK_WALL_Z + 0.02, "backstage-wall", false).material = backWall;
  const paintPartition = (minZ: number, maxZ: number, y0: number, y1: number) => {
    addBox(interior, 0.04, y1 - y0, maxZ - minZ, white, KB_PARTITION_X - 0.06, (y0 + y1) / 2, (minZ + maxZ) / 2, "backstage-wall", false).material = partitionWall;
  };
  paintPartition(KB_STAGE_FRONT_Z, KB_BACKSTAGE_GAP.minZ, 0, KB_DECK_HEIGHT);
  paintPartition(KB_BACKSTAGE_GAP.maxZ, KB_VESTIBULE.minZ, 0, KB_DECK_HEIGHT);
  paintPartition(KB_DECK_MIN_Z, KB_VESTIBULE.minZ, KB_DECK_HEIGHT, KB_HALL_CEILING);
  paintPartition(KB_BACK_WALL_Z, KB_STAGE_FRONT_Z, KB_DECK_HEIGHT, KB_HALL_CEILING);
  const soffitLen = KB_VESTIBULE.minZ - KB_DECK_MIN_Z;
  const soffit = [dark, white, dark, white, white, dark];
  addBox(interior, KB_PARTITION_X - KB_MIN_X, 0.04, soffitLen, white, cx, KB_DECK_HEIGHT - 0.14, (KB_DECK_MIN_Z + KB_VESTIBULE.minZ) / 2, "backstage-ceiling", false).material = soffit;
  addBox(
    interior,
    KB_VESTIBULE.maxX - KB_VESTIBULE.minX,
    0.04,
    KB_VESTIBULE.maxZ - KB_VESTIBULE.minZ,
    white,
    (KB_VESTIBULE.minX + KB_VESTIBULE.maxX) / 2,
    KB_DECK_HEIGHT - 0.14,
    (KB_VESTIBULE.minZ + KB_VESTIBULE.maxZ) / 2,
    "backstage-ceiling",
    false,
  ).material = soffit;
  addBox(interior, KB_PARTITION_X - KB_MIN_X, 0.06, KB_VESTIBULE.minZ - KB_DECK_MIN_Z, white, cx, KB_HALL_CEILING - 0.08, (KB_DECK_MIN_Z + KB_VESTIBULE.minZ) / 2, "backstage-ceiling", false).material =
    [dark, white, dark, white, white, dark];
  addBox(interior, 0.06, 0.1, soffitLen, white, KB_MIN_X + 0.08, 0.05, (KB_DECK_MIN_Z + KB_VESTIBULE.minZ) / 2, "", false);
  addBox(interior, 0.06, 0.1, soffitLen, white, KB_MIN_X + 0.08, KB_DECK_HEIGHT + 0.05, (KB_DECK_MIN_Z + KB_VESTIBULE.minZ) / 2, "", false);
  group.add(interior);
}

/**
 * Backstage work lighting: cool-white fluorescent battens on both floors that stay on permanently.
 * Their emissive material and point lights are independent of the hall's house/show lights.
 */
function buildBackstageLights(group: THREE.Group, mats: SharedMaterials): void {
  const lights = new THREE.Group();
  lights.name = "backstage-lights";
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f7ff, emissiveIntensity: 1.6, roughness: 0.4 });
  const cx = (KB_MIN_X + KB_PARTITION_X) / 2;
  const glassCx = (KB_VESTIBULE.minX + KB_VESTIBULE.maxX) / 2;
  const glassCz = (KB_VESTIBULE.minZ + KB_VESTIBULE.maxZ) / 2;
  const batten = (x: number, y: number, z: number, intensity: number, distance: number, rodTo?: number) => {
    addBox(lights, 1.25, 0.07, 0.14, mats.matteBlack, x, y + 0.05, z, "batten", false);
    addBox(lights, 1.2, 0.04, 0.06, tubeMat, x, y, z, "backstage-tube", false);
    const light = new THREE.PointLight(0xf4f7ff, intensity, distance, 1.8);
    light.position.set(x, y - 0.15, z);
    light.name = "backstage-light";
    lights.add(light);
    if (rodTo !== undefined) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, rodTo - y, 6), mats.steel);
      rod.position.set(x, (y + rodTo) / 2, z);
      lights.add(rod);
    }
  };
  // 1/F: under the deck soffit over the corridor and the vestibule; the landing is lit from the open stairwell
  const soffitY = KB_DECK_HEIGHT - 0.2;
  batten(cx, KB_DECK_HEIGHT + 1.6, (KB_UPPER_STAIR.minZ + KB_UPPER_STAIR.maxZ) / 2, 10, 8, KB_HALL_CEILING);
  batten(cx, soffitY, -5.5, 8, 6);
  batten(cx, soffitY, -1.5, 8, 6);
  batten(glassCx, soffitY, glassCz, 10, 6);
  // 2/F: hung from the slab over the deck corridor, and under the glass room roof
  const deckY = KB_DECK_HEIGHT + 2.6;
  for (const z of [-7.5, -3.0]) batten(cx, deckY, z, 8, 7, KB_HALL_CEILING);
  batten(glassCx, KB_HALL_CEILING - 0.25, glassCz, 12, 7);
  group.add(lights);
}

/** Ground-floor entrance box under the glass room: acoustic-tiled faces, doorway opening into the hall (+X), chairs, outer door. */
function buildVestibule(group: THREE.Group, mats: SharedMaterials): void {
  const vestibule = new THREE.Group();
  vestibule.name = "entrance-vestibule";
  const v = KB_VESTIBULE;

  const dark = mats.wallCharcoal;
  const white = mats.offWhite;
  // Hall-facing faces stay charcoal; the room side stays white
  const frontBox = [dark, dark, dark, dark, white, dark];
  const sideBox = [dark, white, dark, dark, dark, dark];
  // Solid -Z face; tiles face -Z toward the stage
  const frontLen = v.maxX - v.minX;
  addBox(vestibule, frontLen, KB_DECK_HEIGHT, 0.2, white, (v.minX + v.maxX) / 2, KB_DECK_HEIGHT / 2, v.minZ, "vestibule-wall").material = frontBox;
  const frontTiles = new THREE.Mesh(new THREE.PlaneGeometry(frontLen, KB_DECK_HEIGHT), acousticTileMaterial(frontLen, KB_DECK_HEIGHT));
  frontTiles.rotation.y = Math.PI;
  frontTiles.position.set((v.minX + v.maxX) / 2, KB_DECK_HEIGHT / 2, v.minZ - 0.101);
  vestibule.add(frontTiles);
  // +X face in two segments around the doorway; tiles face +X into the hall
  for (const [a, b] of [[v.minZ, KB_DOORWAY.minZ], [KB_DOORWAY.maxZ, v.maxZ]] as const) {
    addBox(vestibule, 0.2, KB_DECK_HEIGHT, b - a, white, v.maxX, KB_DECK_HEIGHT / 2, (a + b) / 2, "vestibule-wall").material = sideBox;
    const tiles = new THREE.Mesh(new THREE.PlaneGeometry(b - a, KB_DECK_HEIGHT), acousticTileMaterial(b - a, KB_DECK_HEIGHT));
    tiles.rotation.y = Math.PI / 2;
    tiles.position.set(v.maxX + 0.101, KB_DECK_HEIGHT / 2, (a + b) / 2);
    vestibule.add(tiles);
  }
  // Header over the doorway and steel trims
  const doorCz = (KB_DOORWAY.minZ + KB_DOORWAY.maxZ) / 2;
  const doorW = KB_DOORWAY.maxZ - KB_DOORWAY.minZ;
  addBox(vestibule, 0.2, KB_DECK_HEIGHT - 2.2, doorW, dark, v.maxX, 2.2 + (KB_DECK_HEIGHT - 2.2) / 2, doorCz, "", false);
  const doorway = new THREE.Group();
  doorway.name = "entrance-doorway";
  doorway.position.set(v.maxX, 0, doorCz);
  addBox(doorway, 0.26, 2.24, 0.08, mats.frameBlack, 0, 1.12, -doorW / 2 - 0.04, "", false);
  addBox(doorway, 0.26, 2.24, 0.08, mats.frameBlack, 0, 1.12, doorW / 2 + 0.04, "", false);
  addBox(doorway, 0.26, 0.08, doorW + 0.16, mats.frameBlack, 0, 2.24, 0, "", false);
  vestibule.add(doorway);

  // Stacked folding chairs along the -X wall
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2c2c31, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const chair = addBox(vestibule, 0.45, 0.9, 0.06, chairMat, v.minX + 0.5 + i * 0.03, 0.5, 2.3 + i * 0.4, "folding-chair");
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
  const frontW = v.maxX - KB_PARTITION_X;
  const frontCx = (KB_PARTITION_X + v.maxX) / 2;

  addBox(room, frontW, sillH, 0.15, mats.wallCharcoal, frontCx, KB_DECK_HEIGHT + sillH / 2, v.minZ, "glass-room-sill");
  glazing(room, mats, [KB_PARTITION_X + 0.05, v.maxX - 0.1], v.minZ, "z");
  addBox(room, 0.15, sillH, d, mats.wallCharcoal, v.maxX, KB_DECK_HEIGHT + sillH / 2, cz, "glass-room-sill");
  glazing(room, mats, [v.minZ + 0.1, v.maxZ - 0.1], v.maxX, "x");
  const roof = addBox(room, w + 0.15, 0.12, d + 0.15, mats.offWhite, cx, KB_HALL_CEILING - 0.06, cz, "glass-room-roof");
  roof.material = [mats.wallCharcoal, mats.wallCharcoal, mats.wallCharcoal, mats.offWhite, mats.wallCharcoal, mats.wallCharcoal];

  buildPlushieShelves(room, mats);
  buildGlassSofa(room, mats);
  group.add(room);
}

/** Sofa against the rear wall, facing the stage through the glass. Walk up and idle to sit. */
function buildGlassSofa(room: THREE.Group, mats: SharedMaterials): void {
  const { minX, maxX, minZ, maxZ } = KB_GLASS_SOFA;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const sofa = new THREE.Group();
  sofa.name = "glass-sofa";
  sofa.position.set(cx, KB_DECK_HEIGHT, cz);
  const fabric = new THREE.MeshStandardMaterial({ color: 0xc4b8a8, roughness: 0.9 });
  const cushion = new THREE.MeshStandardMaterial({ color: 0xd8cfc2, roughness: 0.85 });
  addBox(sofa, w, 0.1, d, mats.matteBlack, 0, 0.12, 0);
  addBox(sofa, w - 0.1, 0.16, d - 0.18, fabric, 0, 0.26, -0.02);
  addBox(sofa, w - 0.08, 0.52, 0.14, fabric, 0, 0.52, d / 2 - 0.08);
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) addBox(sofa, 0.12, 0.36, d - 0.1, fabric, x, 0.4, 0, "", false);
  addBox(sofa, w * 0.42, 0.12, d * 0.38, cushion, -w * 0.18, 0.38, -0.04, "", false);
  addBox(sofa, w * 0.42, 0.12, d * 0.38, cushion, w * 0.18, 0.38, -0.04, "", false);
  room.add(sofa);
}

/** One floor-to-ceiling pane, framed only at the edges. `axis` is the wall's running direction. */
function glazing(parent: THREE.Group, mats: SharedMaterials, span: readonly [number, number], at: number, axis: "x" | "z"): void {
  const len = span[1] - span[0];
  const mid = (span[0] + span[1]) / 2;
  const h = GLASS_TOP_Y - GLASS_SILL_Y;
  const cy = (GLASS_SILL_Y + GLASS_TOP_Y) / 2;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.04, h), mats.glass);
  pane.name = "glass-pane";
  if (axis === "z") {
    pane.position.set(mid, cy, at);
  } else {
    pane.position.set(at, cy, mid);
    pane.rotation.y = Math.PI / 2;
  }
  parent.add(pane);
  for (const y of [GLASS_SILL_Y, GLASS_TOP_Y]) {
    if (axis === "z") addBox(parent, len, 0.08, 0.08, mats.frameBlack, mid, y, at, "", false);
    else addBox(parent, 0.08, 0.08, len, mats.frameBlack, at, y, mid, "", false);
  }
  for (const p of [span[0], span[1]]) {
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

