import * as THREE from "three";
import {
  NTK_BACK_WALL_Z,
  NTK_ENTRANCE_Z,
  NTK_FOH_CHAIRS,
  NTK_GLASS_Z,
  NTK_HALL_CEILING,
  NTK_MALL_END_Z,
  NTK_PA_BOOTH_MIN_Z,
  type VenueDefinition,
} from "../config/venue";
import type { VenueBuild } from "./createVenue";
import {
  addBox,
  addMovingHead,
  addParCan,
  buildFohChair,
  buildLightingConsole,
  buildSoundMixer,
  createAtmosphericCrowd,
  createBeamCones,
  createExitDoor,
  createFridgeTexture,
  createHouseLights,
  createSharedMaterials,
  labelPlane,
  material,
  pleatedCurtainTexture,
  setInstanceTransform,
  speakerGrilleTexture,
  woodPlankTexture,
  type FakeBeam,
  type HouseLightParts,
  type InstanceTransform,
  type SharedMaterials,
} from "./venueKit";

// ---------------------------------------------------------------------------
// Layout constants. Every coordinate below is derived from these so the venue
// can be re-proportioned by editing a handful of numbers.
// ---------------------------------------------------------------------------
const HALF_WIDTH = 7.0; // Inner half width of hall, foyer and mall corridor
const WALL_T = 0.3; // Wall thickness
const HALL_MIN_Z = NTK_BACK_WALL_Z;
const HALL_MAX_Z = NTK_ENTRANCE_Z;
const HALL_DEPTH = HALL_MAX_Z - HALL_MIN_Z;
const HALL_CENTER_Z = (HALL_MIN_Z + HALL_MAX_Z) / 2;
const CEILING_Y = NTK_HALL_CEILING;
const TRUSS_Y = 5.0; // Centre line of the box trusses
const TRUSS_SIZE = 0.3; // Box truss cross-section
const TRUSS_BOTTOM_Y = TRUSS_Y - TRUSS_SIZE / 2;
const FOYER_MIN_Z = NTK_ENTRANCE_Z + WALL_T / 2;
const FOYER_MAX_Z = NTK_GLASS_Z;
const FOYER_CEILING_Y = 3.6;
const MALL_MIN_Z = NTK_GLASS_Z;
const MALL_MAX_Z = NTK_MALL_END_Z;
const MALL_CEILING_Y = 4.4;
const HALL_DOOR_HALF = 1.1; // Double doors into the hall: x in [-1.1, 1.1]
const GLASS_DOOR_HALF = 1.0; // Glass shopfront doors: x in [-1.0, 1.0]
const STAGE_RIGHT_EXIT_X = 5.9; // EXIT door on the back wall, right of the stage (the only EXIT inside the hall)

// Truss lines (z) across the hall
const TRUSS_STAGE_REAR_Z = -8.5;
const TRUSS_STAGE_FRONT_Z = -6.0;
const TRUSS_AUDIENCE_FRONT_Z = -3.2;
const TRUSS_AUDIENCE_MID_Z = 1.5;
const TRUSS_AUDIENCE_REAR_Z = 6.5;
const TRUSS_SIDE_X = 5.6;

// Penlight crowd standing positions on the hall floor
const NTK_CROWD_POSITIONS: readonly (readonly [number, number])[] = [
  [-3.8, -4.8], [-2.0, -4.9], [0.8, -4.8], [2.2, -4.9], [3.8, -4.7],
  [-4.2, -3.8], [-2.6, -3.7], [-0.8, -3.9], [1.2, -3.7], [2.8, -3.8], [4.2, -3.9],
  [-3.5, -2.7], [-1.8, -2.5], [0.3, -2.6], [2.0, -2.5], [3.5, -2.8],
  [-3.0, -1.6], [-1.2, -1.4], [0.6, -1.5], [2.4, -1.7], [3.8, -1.5],
  [-2.2, -0.4], [-0.4, -0.2], [1.4, -0.3], [3.0, -0.5],
];

export function createNgauTauKokVenue(definition: VenueDefinition): VenueBuild {
  const group = new THREE.Group();
  group.name = definition.id;
  const colliders = definition.colliders.map((collider) => ({ ...collider }));

  const mats = createSharedMaterials();

  const stagePlatform = definition.platforms[0];
  const showOnly: THREE.Object3D[] = []; // Hidden while house lights are on (volumetric beams)
  const fakeBeams: FakeBeam[] = [];

  const houseLightParts = buildHallShell(group, mats);
  buildStage(group, mats, stagePlatform);
  buildStageRightExit(group);
  buildRigging(group, mats, fakeBeams);
  buildSpeakers(group, mats);
  buildDiscoBall(group, mats);
  buildPaBooth(group, mats);
  createNgauTauKokCrowdBarrier(group, mats, definition.crowdBarrier);
  const crowdDummies = createAtmosphericCrowd(group, NTK_CROWD_POSITIONS);
  const foyerKnockables = buildFoyer(group, mats);
  buildMallCorridor(group, mats);

  const stageLights = createShowLighting(group, definition.show.lightColors, stagePlatform, fakeBeams, showOnly);
  const houseLights = createHouseLights(group, houseLightParts, showOnly);

  const audiencePoints = definition.show.audiencePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));

  return {
    group,
    colliders,
    audiencePoints,
    stageLights,
    houseLights,
    knockableProps: [...crowdDummies, ...foyerKnockables],
  };
}

// ---------------------------------------------------------------------------
// Hall shell: floor, ceiling, walls, curtains, ceiling panels, ducts
// ---------------------------------------------------------------------------
function buildHallShell(group: THREE.Group, mats: SharedMaterials): HouseLightParts {
  const hall = new THREE.Group();
  hall.name = "hall-shell";

  // Floor: light oak planks (bright under house lights, reads dark under show lighting)
  const floorMat = new THREE.MeshStandardMaterial({
    map: woodPlankTexture(),
    color: 0xc9a373,
    roughness: 0.62,
    metalness: 0.03,
  });
  addBox(hall, HALF_WIDTH * 2, 0.2, HALL_DEPTH, floorMat, 0, -0.1, HALL_CENTER_Z, "wood-floor", false);

  // Ceiling slab: black industrial soffit
  addBox(hall, HALF_WIDTH * 2, 0.2, HALL_DEPTH, material(0x08080b, 0.95), 0, CEILING_Y + 0.1, HALL_CENTER_Z, "ceiling", false);

  // Walls
  const wallH = CEILING_Y + 0.4;
  addBox(hall, HALF_WIDTH * 2 + WALL_T * 2, wallH, WALL_T, mats.wallCharcoal, 0, wallH / 2, HALL_MIN_Z - WALL_T / 2, "back-wall");
  addBox(hall, WALL_T, wallH, HALL_DEPTH, mats.wallCharcoal, -HALF_WIDTH - WALL_T / 2, wallH / 2, HALL_CENTER_Z);
  addBox(hall, WALL_T, wallH, HALL_DEPTH, mats.wallCharcoal, HALF_WIDTH + WALL_T / 2, wallH / 2, HALL_CENTER_Z);

  // Entrance wall (hall side charcoal) with a 2.2m double-door opening
  const sideW = HALF_WIDTH - HALL_DOOR_HALF;
  addBox(hall, sideW, wallH, WALL_T, mats.wallCharcoal, -(HALL_DOOR_HALF + sideW / 2), wallH / 2, NTK_ENTRANCE_Z);
  addBox(hall, sideW, wallH, WALL_T, mats.wallCharcoal, HALL_DOOR_HALF + sideW / 2, wallH / 2, NTK_ENTRANCE_Z);
  const headerH = wallH - 3.1;
  addBox(hall, HALL_DOOR_HALF * 2, headerH, WALL_T, mats.wallCharcoal, 0, 3.1 + headerH / 2, NTK_ENTRANCE_Z);

  // Steel door frame + open double doors swinging into the foyer
  addBox(hall, 0.12, 3.1, 0.34, mats.steel, -HALL_DOOR_HALF, 1.55, NTK_ENTRANCE_Z, "door-post-left", false);
  addBox(hall, 0.12, 3.1, 0.34, mats.steel, HALL_DOOR_HALF, 1.55, NTK_ENTRANCE_Z, "door-post-right", false);
  addBox(hall, HALL_DOOR_HALF * 2 + 0.12, 0.12, 0.34, mats.steel, 0, 3.1, NTK_ENTRANCE_Z, "door-header", false);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x1c1b22, roughness: 0.6, metalness: 0.3 });
  const leafL = addBox(hall, 1.0, 3.0, 0.06, doorMat, -0.95, 1.5, NTK_ENTRANCE_Z + 0.45, "entrance-door", false);
  leafL.rotation.y = 0.6;
  const leafR = addBox(hall, 1.0, 3.0, 0.06, doorMat, 0.95, 1.5, NTK_ENTRANCE_Z + 0.45, "", false);
  leafR.rotation.y = -0.6;
  // Push bars on the leaves
  addBox(hall, 0.7, 0.05, 0.05, mats.steel, -0.95, 1.05, NTK_ENTRANCE_Z + 0.5, "", false).rotation.y = 0.6;
  addBox(hall, 0.7, 0.05, 0.05, mats.steel, 0.95, 1.05, NTK_ENTRANCE_Z + 0.5, "", false).rotation.y = -0.6;

  // Signage on the hall side of the entrance wall
  const hallSign = labelPlane("MAIN HALL · 觀塘廳 1", "#121217", "#00e5ff", 2.2, 0.6);
  hallSign.position.set(0, 3.55, NTK_ENTRANCE_Z - WALL_T / 2 - 0.01);
  hallSign.rotation.y = Math.PI;
  hall.add(hallSign);

  // Black pleated acoustic curtains running the full length of both side walls
  const curtainMat = new THREE.MeshStandardMaterial({
    map: pleatedCurtainTexture(),
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const curtainH = CEILING_Y - 0.4;
  for (const side of [-1, 1]) {
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(HALL_DEPTH - 0.2, curtainH), curtainMat);
    curtain.position.set(side * (HALF_WIDTH - 0.04), curtainH / 2, HALL_CENTER_Z);
    curtain.rotation.y = -side * (Math.PI / 2);
    hall.add(curtain);
  }

  // Stage-left wall treatment: dark red painted panel + curtain fold (reference photo 3)
  const redPanel = new THREE.MeshStandardMaterial({ color: 0x7a1220, roughness: 0.7 });
  addBox(hall, 1.9, 3.6, 0.06, redPanel, -5.75, 1.8, HALL_MIN_Z + 0.04, "stage-left-red-panel", false);
  const foldMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.6), curtainMat);
  foldMesh.position.set(-4.95, 1.8, HALL_MIN_Z + 0.06);
  hall.add(foldMesh);

  // Ceiling LED work-light panels (2 columns x 5 rows) with white frames
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a30,
    emissive: 0xfff1df,
    emissiveIntensity: 0,
    roughness: 0.25,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, roughness: 0.5, metalness: 0.3 });
  for (const z of [-7.3, -3.0, 1.3, 5.6, 9.9]) {
    for (const x of [-3.2, 3.2]) {
      addBox(hall, 1.3, 0.06, 0.7, frameMat, x, CEILING_Y - 0.03, z, "", false);
      addBox(hall, 1.2, 0.03, 0.6, panelMaterial, x, CEILING_Y - 0.07, z, "ceiling-panel", false);
    }
  }

  // Services: large round ducts along both sides + red sprinkler mains
  const ductMat = new THREE.MeshStandardMaterial({ color: 0x3f3e46, roughness: 0.5, metalness: 0.7 });
  for (const x of [-5.9, 5.9]) {
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, HALL_DEPTH - 0.4, 14), ductMat);
    duct.position.set(x, CEILING_Y - 0.5, HALL_CENTER_Z);
    duct.rotation.x = Math.PI / 2;
    hall.add(duct);
    // Duct grilles every 4m
    for (let z = HALL_MIN_Z + 2; z < HALL_MAX_Z - 1; z += 4) {
      addBox(hall, 0.5, 0.12, 0.6, mats.fixtureBlack, x, CEILING_Y - 0.9, z, "", false);
    }
  }
  const crossDuct = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, HALF_WIDTH * 2 - 0.4, 14), ductMat);
  crossDuct.position.set(0, CEILING_Y - 0.5, 4.2);
  crossDuct.rotation.z = Math.PI / 2;
  hall.add(crossDuct);
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0xa8202a, roughness: 0.5, metalness: 0.4 });
  for (const x of [-1.6, 1.6]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, HALL_DEPTH - 0.4, 8), pipeMat);
    pipe.position.set(x, CEILING_Y - 0.25, HALL_CENTER_Z);
    pipe.rotation.x = Math.PI / 2;
    hall.add(pipe);
  }

  group.add(hall);
  return { panelMaterial };
}

// ---------------------------------------------------------------------------
// Stage: deck, LED wall, stairs, monitors, sub stacks
// ---------------------------------------------------------------------------
function buildStage(
  group: THREE.Group,
  mats: SharedMaterials,
  stagePlatform: VenueDefinition["platforms"][number],
): void {
  const stage = new THREE.Group();
  stage.name = "stage";
  const b = stagePlatform.bounds;
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const h = stagePlatform.height;

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.8, metalness: 0.08 });
  addBox(stage, width, h, depth, deckMat, cx, h / 2, cz, "main-stage");

  // Light wood veneer front face and lip (reference photo 3)
  const veneerMat = new THREE.MeshStandardMaterial({
    map: woodPlankTexture(),
    color: 0xd4b088,
    roughness: 0.55,
  });
  addBox(stage, width + 0.04, h - 0.02, 0.04, veneerMat, cx, h / 2 - 0.01, b.maxZ + 0.02, "stage-front-veneer", false);
  addBox(stage, width + 0.06, 0.05, 0.08, veneerMat, cx, h - 0.025, b.maxZ + 0.02, "", false);
  // Side skirts
  addBox(stage, 0.04, h - 0.02, depth, veneerMat, b.minX - 0.02, h / 2 - 0.01, cz, "", false);
  addBox(stage, 0.04, h - 0.02, depth, veneerMat, b.maxX + 0.02, h / 2 - 0.01, cz, "", false);

  // Stage edge safety strip (subtle white tape, not neon)
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xe9e9ee, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 });
  addBox(stage, width, 0.01, 0.05, tapeMat, cx, h + 0.005, b.maxZ - 0.03, "", false);

  // 8.1m LED video wall flush against the back wall (artwork kept as before)
  const ledTexture = createLiveEventLedTexture();
  const ledMaterial = new THREE.MeshStandardMaterial({
    map: ledTexture,
    emissive: 0xffffff,
    emissiveMap: ledTexture,
    emissiveIntensity: 0.9,
    roughness: 0.35,
    metalness: 0.1,
  });
  const ledWall = new THREE.Mesh(new THREE.PlaneGeometry(8.1, 3.4), ledMaterial);
  ledWall.name = "led-screen";
  ledWall.position.set(0, h + 1.9, HALL_MIN_Z + 0.1);
  stage.add(ledWall);
  addBox(stage, 8.3, 3.6, 0.1, mats.fixtureBlack, 0, h + 1.9, HALL_MIN_Z + 0.04, "led-frame", false);
  // LED wall ground support frame legs
  for (const x of [-3.9, -1.3, 1.3, 3.9]) {
    addBox(stage, 0.06, h + 0.2, 0.06, mats.steel, x, h + 0.1, HALL_MIN_Z + 0.25, "", false);
  }

  // Stage right access stairs (上台在台右)
  createStageRightStairs(stage, 5.15, -5.2, b.maxZ, h, 4, mats.steel);

  // Wedge monitors along the front lip
  const wedgeGeom = new THREE.BoxGeometry(0.62, 0.3, 0.46);
  const wedgeMat = new THREE.MeshStandardMaterial({ color: 0x1b1b20, roughness: 0.85 });
  const grille = new THREE.MeshStandardMaterial({ map: speakerGrilleTexture(), roughness: 0.9 });
  for (const x of [-3.4, -1.15, 1.15, 3.4]) {
    const wedge = new THREE.Mesh(wedgeGeom, wedgeMat);
    wedge.position.set(x, h + 0.16, b.maxZ - 0.42);
    wedge.rotation.x = -0.6;
    stage.add(wedge);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.26), grille);
    face.position.set(x, h + 0.29, b.maxZ - 0.29);
    face.rotation.x = -Math.PI / 2 + 0.95; // lie on the tilted front
    stage.add(face);
  }

  // Floor subwoofer stacks flanking the stage
  const subMat = new THREE.MeshStandardMaterial({ color: 0x17171b, roughness: 0.75, metalness: 0.2 });
  const addSub = (x: number, z: number, w: number, d: number, levels: number) => {
    for (let i = 0; i < levels; i++) {
      addBox(stage, w, 0.62, d, subMat, x, 0.31 + i * 0.64, z, "sub-stack");
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 0.5), grille);
      face.position.set(x, 0.31 + i * 0.64, z + d / 2 + 0.005);
      stage.add(face);
    }
  };
  addSub(-6.0, -7.0, 1.2, 1.1, 2);
  addSub(6.45, -6.75, 0.9, 0.85, 2);

  group.add(stage);
}

// Stage-right EXIT door: on the back wall right of the stage (reference photos 1 & 3)
function buildStageRightExit(group: THREE.Group): void {
  createExitDoor(group, STAGE_RIGHT_EXIT_X, 0, HALL_MIN_Z, 0, "exit-door-stage-right");
}

// ---------------------------------------------------------------------------
// Rigging: box trusses, moving heads, PAR cans, LED battens
// ---------------------------------------------------------------------------
function buildRigging(group: THREE.Group, mats: SharedMaterials, fakeBeams: FakeBeam[]): void {
  const rig = new THREE.Group();
  rig.name = "rigging";

  const segments: [THREE.Vector3, THREE.Vector3][] = [];
  const span = TRUSS_SIDE_X + TRUSS_SIZE / 2;
  for (const z of [TRUSS_STAGE_REAR_Z, TRUSS_STAGE_FRONT_Z, TRUSS_AUDIENCE_FRONT_Z, TRUSS_AUDIENCE_MID_Z, TRUSS_AUDIENCE_REAR_Z]) {
    collectBoxTruss(segments, new THREE.Vector3(-span, TRUSS_Y, z), new THREE.Vector3(span, TRUSS_Y, z));
  }
  for (const x of [-TRUSS_SIDE_X, TRUSS_SIDE_X]) {
    collectBoxTruss(
      segments,
      new THREE.Vector3(x, TRUSS_Y, TRUSS_STAGE_REAR_Z),
      new THREE.Vector3(x, TRUSS_Y, TRUSS_AUDIENCE_REAR_Z),
    );
  }
  // Ceiling drop points holding the grid
  for (const z of [TRUSS_STAGE_REAR_Z, TRUSS_STAGE_FRONT_Z, TRUSS_AUDIENCE_FRONT_Z, TRUSS_AUDIENCE_MID_Z, TRUSS_AUDIENCE_REAR_Z]) {
    for (const x of [-TRUSS_SIDE_X, 0, TRUSS_SIDE_X]) {
      segments.push([new THREE.Vector3(x, TRUSS_Y + TRUSS_SIZE / 2, z), new THREE.Vector3(x, CEILING_Y, z)]);
    }
  }
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x9a9ca4, roughness: 0.4, metalness: 0.75 });
  rig.add(instancedSegments(segments, 0.028, trussMat, "box-truss"));

  // Moving heads. Front stage truss: 12 heads aimed at the stage/audience mix.
  const headColors = [0x3f6cff, 0x8a3cff, 0x00d0ff, 0xffffff];
  const stageFocus = new THREE.Vector3(0, 1.2, -7.6);
  for (let i = 0; i < 12; i++) {
    const x = -5.5 + i;
    const from = new THREE.Vector3(x, TRUSS_BOTTOM_Y - 0.5, TRUSS_STAGE_FRONT_Z);
    // Alternate: even heads light the stage, odd heads throw beams over the crowd
    const to = i % 2 === 0
      ? new THREE.Vector3(x * 0.55, 0.9, -7.7)
      : new THREE.Vector3(x * 0.9 + (i % 4 === 1 ? 1.2 : -1.2), 0.2, 2.0 + (i % 3) * 1.4);
    const color = headColors[i % headColors.length];
    addMovingHead(rig, from, to, color, mats);
    if (i % 2 === 1) fakeBeams.push({ from, to, color, radius: 0.55 });
  }
  // Rear stage truss: 8 heads as back light through the performers
  for (let i = 0; i < 8; i++) {
    const x = -4.9 + i * 1.4;
    const from = new THREE.Vector3(x, TRUSS_BOTTOM_Y - 0.5, TRUSS_STAGE_REAR_Z);
    const to = new THREE.Vector3(x * 0.4, 0.3, -1.5 + (i % 2) * 2.5);
    const color = i % 2 === 0 ? 0x3f6cff : 0x8a3cff;
    addMovingHead(rig, from, to, color, mats);
    if (i % 2 === 0) fakeBeams.push({ from, to, color, radius: 0.7 });
  }
  // Audience front truss: 6 heads facing the crowd
  for (let i = 0; i < 6; i++) {
    const x = -4.5 + i * 1.8;
    const from = new THREE.Vector3(x, TRUSS_BOTTOM_Y - 0.5, TRUSS_AUDIENCE_FRONT_Z);
    const to = new THREE.Vector3(-x * 0.6, 0.1, 3.5 + (i % 2) * 3);
    const color = i % 3 === 0 ? 0x00d0ff : 0x6a3cff;
    addMovingHead(rig, from, to, color, mats);
    if (i % 3 === 1) fakeBeams.push({ from, to, color, radius: 0.5 });
  }

  // LED PAR cans on the front truss between the heads, tilted onto the stage
  for (let i = 0; i < 11; i++) {
    const x = -5.0 + i;
    const color = [0x3f6cff, 0xff2f7d, 0x00e5ff, 0xffaa00][i % 4];
    addParCan(rig, new THREE.Vector3(x, TRUSS_BOTTOM_Y - 0.12, TRUSS_STAGE_FRONT_Z + 0.35), stageFocus, color, mats);
  }
  // Blinders on the audience-mid truss facing the crowd
  for (const x of [-3.0, 3.0]) {
    addParCan(rig, new THREE.Vector3(x, TRUSS_BOTTOM_Y - 0.12, TRUSS_AUDIENCE_MID_Z), new THREE.Vector3(x, 0, 9), 0xffd9a0, mats);
  }

  // Linear LED battens under the trusses
  const batten = (color: number, len: number, z: number, intensity: number) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3 });
    addBox(rig, len, 0.05, 0.08, m, 0, TRUSS_BOTTOM_Y - 0.03, z, "", false);
  };
  batten(0x00e5ff, 9.4, TRUSS_STAGE_FRONT_Z - 0.2, 1.6);
  batten(0x8a3cff, 11.0, TRUSS_AUDIENCE_FRONT_Z + 0.2, 1.2);
  batten(0xff2f7d, 11.0, TRUSS_AUDIENCE_MID_Z + 0.2, 0.9);

  group.add(rig);
}

function collectBoxTruss(
  out: [THREE.Vector3, THREE.Vector3][],
  start: THREE.Vector3,
  end: THREE.Vector3,
): void {
  const axis = new THREE.Vector3().subVectors(end, start);
  const length = axis.length();
  const dir = axis.clone().normalize();
  // Perpendicular frame for the square cross-section
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(dir, up).normalize();
  const half = TRUSS_SIZE / 2;
  const corners = [
    up.clone().multiplyScalar(half).add(side.clone().multiplyScalar(half)),
    up.clone().multiplyScalar(half).add(side.clone().multiplyScalar(-half)),
    up.clone().multiplyScalar(-half).add(side.clone().multiplyScalar(half)),
    up.clone().multiplyScalar(-half).add(side.clone().multiplyScalar(-half)),
  ];
  // Four main chords
  for (const c of corners) {
    out.push([start.clone().add(c), end.clone().add(c)]);
  }
  // Zig-zag diagonals on the four faces
  const faces: [THREE.Vector3, THREE.Vector3][] = [
    [corners[0], corners[1]], // top
    [corners[2], corners[3]], // bottom
    [corners[0], corners[2]], // side +
    [corners[1], corners[3]], // side -
  ];
  const step = 0.6;
  const count = Math.max(1, Math.floor(length / step));
  const actualStep = length / count;
  for (const [a, b] of faces) {
    for (let i = 0; i < count; i++) {
      const t0 = i * actualStep;
      const t1 = (i + 1) * actualStep;
      const p0 = start.clone().add(dir.clone().multiplyScalar(t0)).add(i % 2 === 0 ? a : b);
      const p1 = start.clone().add(dir.clone().multiplyScalar(t1)).add(i % 2 === 0 ? b : a);
      out.push([p0, p1]);
    }
  }
  // End verticals
  out.push([start.clone().add(corners[0]), start.clone().add(corners[2])]);
  out.push([start.clone().add(corners[1]), start.clone().add(corners[3])]);
  out.push([end.clone().add(corners[0]), end.clone().add(corners[2])]);
  out.push([end.clone().add(corners[1]), end.clone().add(corners[3])]);
}

function instancedSegments(
  segments: readonly [THREE.Vector3, THREE.Vector3][],
  radius: number,
  mat: THREE.Material,
  name: string,
): THREE.InstancedMesh {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 6);
  const mesh = new THREE.InstancedMesh(geometry, mat, segments.length);
  const up = new THREE.Vector3(0, 1, 0);
  const matrix = new THREE.Matrix4();
  segments.forEach(([a, b], idx) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    matrix.compose(
      new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()),
      new THREE.Vector3(radius, len, radius),
    );
    mesh.setMatrixAt(idx, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.name = name;
  return mesh;
}

// ---------------------------------------------------------------------------
// PA: flown line arrays either side of the stage
// ---------------------------------------------------------------------------
function buildSpeakers(group: THREE.Group, mats: SharedMaterials): void {
  const pa = new THREE.Group();
  pa.name = "line-arrays";
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x16161b, roughness: 0.7, metalness: 0.35 });
  const grille = new THREE.MeshStandardMaterial({ map: speakerGrilleTexture(), roughness: 0.9 });
  const cabinetGeom = new THREE.BoxGeometry(0.95, 0.34, 0.62);
  const z = TRUSS_STAGE_FRONT_Z - 0.4;
  for (const x of [-TRUSS_SIDE_X, TRUSS_SIDE_X]) {
    const inward = x > 0 ? -0.14 : 0.14;
    // Fly bumper hanging from the truss
    addBox(pa, 1.0, 0.1, 0.7, mats.steel, x, TRUSS_BOTTOM_Y - 0.06, z, "", false);
    for (const dx of [-0.35, 0.35]) {
      addBox(pa, 0.03, 0.4, 0.03, mats.steel, x + dx, TRUSS_BOTTOM_Y - 0.31, z, "", false);
    }
    // Six cabinets, splaying downward into a J curve
    for (let i = 0; i < 6; i++) {
      const y = TRUSS_BOTTOM_Y - 0.55 - i * 0.36;
      const cab = new THREE.Mesh(cabinetGeom, cabinetMat);
      cab.position.set(x, y, z + i * 0.05);
      cab.rotation.x = 0.04 * i * i * 0.6;
      cab.rotation.y = inward;
      pa.add(cab);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.28), grille);
      face.position.set(0, 0, 0.315);
      cab.add(face);
    }
  }
  group.add(pa);
}

// ---------------------------------------------------------------------------
// Disco ball over the audience front truss (ported)
// ---------------------------------------------------------------------------
function buildDiscoBall(group: THREE.Group, mats: SharedMaterials): void {
  const discoBallGroup = new THREE.Group();
  discoBallGroup.name = "disco-ball";
  const ballY = TRUSS_BOTTOM_Y - 0.75;
  discoBallGroup.position.set(1.0, ballY, TRUSS_AUDIENCE_FRONT_Z);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 8), mats.steel);
  rod.position.y = 0.375 + 0.2;
  discoBallGroup.add(rod);

  const discoBallTexture = createDiscoBallTexture();
  const mirrorBallMat = new THREE.MeshStandardMaterial({
    map: discoBallTexture,
    color: 0xffffff,
    metalness: 0.88,
    roughness: 0.12,
    flatShading: true,
    emissive: 0x555566,
    emissiveMap: discoBallTexture,
    emissiveIntensity: 0.4,
  });
  const mirrorBall = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14), mirrorBallMat);
  discoBallGroup.add(mirrorBall);

  const discoSpotPink = new THREE.SpotLight(0xff0066, 90, 15, 0.3, 0.5, 1.0);
  discoSpotPink.position.set(-2.0, TRUSS_BOTTOM_Y, TRUSS_AUDIENCE_FRONT_Z + 0.5);
  discoSpotPink.target = mirrorBall;
  const discoSpotCyan = new THREE.SpotLight(0x00d5ff, 90, 15, 0.3, 0.5, 1.0);
  discoSpotCyan.position.set(3.5, TRUSS_BOTTOM_Y, TRUSS_AUDIENCE_FRONT_Z + 0.5);
  discoSpotCyan.target = mirrorBall;
  group.add(discoSpotPink, discoSpotCyan, discoBallGroup);
}

// ---------------------------------------------------------------------------
// FOH / PA control booth at the very back of the hall (rear left, flush against the entrance wall).
// Geometry is authored with the platform front at local z = 1.0 and the group is shifted so that
// front lands on NTK_PA_BOOTH_MIN_Z.
// ---------------------------------------------------------------------------
function buildPaBooth(group: THREE.Group, mats: SharedMaterials): void {
  const steel = mats.steel;
  const paGroup = new THREE.Group();
  paGroup.name = "pa-console";
  paGroup.position.z = NTK_PA_BOOTH_MIN_Z - 1.0;

  const platformHeight = 0.48;
  const deckMat = material(0x18171f, 0.8, 0.1);

  // Elevated platform deck (3.0m wide x 3.6m deep x 0.48m high)
  // x: [-6.6, -3.6] (center x = -5.1), local z: [1.0, 4.6] (center z = 2.8); the rear edge touches the wall
  addBox(paGroup, 3.0, platformHeight, 3.6, deckMat, -5.1, platformHeight / 2, 2.8, "pa-platform", true);

  // Platform perimeter trim (no trim on the wall side)
  const trimCyan = material(0x00e5ff, 0.3, 0.1, 0x00e5ff);
  addBox(paGroup, 0.04, 0.04, 3.6, trimCyan, -6.6, platformHeight, 2.8, "", false);
  addBox(paGroup, 3.0, 0.04, 0.04, trimCyan, -5.1, platformHeight, 1.0, "", false);

  // Side stairs (x: [-3.6, -2.8], width 0.8m) stepping up towards stage (-Z direction)
  addBox(paGroup, 0.8, 0.16, 0.6, deckMat, -3.2, 0.08, 3.9, "pa-stair-1", true);
  addBox(paGroup, 0.8, 0.32, 0.6, deckMat, -3.2, 0.16, 3.3, "pa-stair-2", true);
  addBox(paGroup, 0.8, 0.48, 0.6, deckMat, -3.2, 0.24, 2.7, "pa-stair-3", true);

  // Outer handrail along side stairs (at x = -2.8)
  createSideStairHandrail(paGroup, steel, -2.8, 4.2, 2.4, platformHeight);

  // Safety railings around platform edges (with open gap for side stairs at local z: [2.4, 4.2]);
  // the rear edge backs onto the entrance wall so it gets no railing
  createNgauTauKokBoothRailings(paGroup, steel, -6.6, -3.6, 1.0, 4.6, platformHeight, 2.4, 4.2);

  // Red console desk casing / structure, wide enough for the mixer and the lighting desk side by side
  const redConsoleMat = material(0xd82035, 0.45, 0.25);
  const redTrimMat = material(0xff2f50, 0.3, 0.2, 0xff2f50);

  const deskY = platformHeight + 0.425;
  const deskWidth = 2.7;
  addBox(paGroup, deskWidth, 0.85, 0.85, redConsoleMat, -5.1, deskY, 1.5, "pa-desk", true);

  addBox(paGroup, deskWidth + 0.04, 0.05, 0.04, redTrimMat, -5.1, platformHeight + 0.85, 1.07, "pa-red-trim", false);
  addBox(paGroup, deskWidth - 0.04, 0.76, 0.03, redConsoleMat, -5.1, deskY - 0.03, 1.06, "", false);
  addBox(paGroup, 0.04, 0.87, 0.87, redTrimMat, -5.1 - deskWidth / 2 - 0.02, deskY, 1.5, "", false);
  addBox(paGroup, 0.04, 0.87, 0.87, redTrimMat, -5.1 + deskWidth / 2 + 0.02, deskY, 1.5, "", false);

  // Sound mixer (left) and lighting console (right) on the desk top, each with an operator chair behind it
  const deskTop = platformHeight + 0.85;
  const mixer = buildSoundMixer();
  mixer.position.set(NTK_FOH_CHAIRS[0].x, deskTop, 1.5);
  paGroup.add(mixer);
  const lightingConsole = buildLightingConsole();
  lightingConsole.position.set(NTK_FOH_CHAIRS[1].x, deskTop, 1.5);
  paGroup.add(lightingConsole);
  for (const { x, z } of NTK_FOH_CHAIRS) {
    const chair = buildFohChair();
    chair.position.set(x, platformHeight, z - paGroup.position.z);
    paGroup.add(chair);
  }

  // FOH / PA PANEL signage
  const fohSign = labelPlane("FOH / PA PANEL\n控制台", "#121217", "#00e5ff", 1.8, 0.65);
  fohSign.position.set(-5.1, platformHeight + 2.5, 1.0);
  fohSign.rotation.y = Math.PI; // readable from the hall (booth now backs onto the wall)
  paGroup.add(fohSign);
  group.add(paGroup);
}

// ---------------------------------------------------------------------------
// Foyer: open glass-fronted unit facing the mall (reference photo 4)
// Left: tuck shop line-up (powerbank kiosk, fridges, staff table). Right: display area.
// ---------------------------------------------------------------------------
function buildFoyer(group: THREE.Group, mats: SharedMaterials): THREE.Object3D[] {
  const foyer = new THREE.Group();
  foyer.name = "entrance-lobby";
  const depth = FOYER_MAX_Z - FOYER_MIN_Z;
  const cz = (FOYER_MIN_Z + FOYER_MAX_Z) / 2;

  // Floor: glossy white tiles
  const tileMat = new THREE.MeshStandardMaterial({
    map: createWhiteTileTexture(depth),
    roughness: 0.18,
    metalness: 0.08,
  });
  addBox(foyer, HALF_WIDTH * 2, 0.2, depth, tileMat, 0, -0.1, cz, "foyer-floor", false);

  // Ceiling, walls (off-white)
  addBox(foyer, HALF_WIDTH * 2, 0.2, depth, mats.offWhite, 0, FOYER_CEILING_Y + 0.1, cz, "foyer-ceiling", false);
  addBox(foyer, WALL_T, FOYER_CEILING_Y + 0.2, depth, mats.offWhite, -HALF_WIDTH - WALL_T / 2, FOYER_CEILING_Y / 2, cz);
  addBox(foyer, WALL_T, FOYER_CEILING_Y + 0.2, depth, mats.offWhite, HALF_WIDTH + WALL_T / 2, FOYER_CEILING_Y / 2, cz);
  // Foyer-side face of the entrance wall
  const sideW = HALF_WIDTH - HALL_DOOR_HALF;
  addBox(foyer, sideW, FOYER_CEILING_Y, 0.04, mats.offWhite, -(HALL_DOOR_HALF + sideW / 2), FOYER_CEILING_Y / 2, FOYER_MIN_Z + 0.02, "", false);
  addBox(foyer, sideW, FOYER_CEILING_Y, 0.04, mats.offWhite, HALL_DOOR_HALF + sideW / 2, FOYER_CEILING_Y / 2, FOYER_MIN_Z + 0.02, "", false);
  addBox(foyer, HALL_DOOR_HALF * 2, FOYER_CEILING_Y - 3.1, 0.04, mats.offWhite, 0, (3.1 + FOYER_CEILING_Y) / 2, FOYER_MIN_Z + 0.02, "", false);

  // Sign above the hall doors, readable from the foyer
  const entranceSign = labelPlane("✦ LIVE HOUSE ✦\n牛頭角 · MAIN HALL", "#121217", "#00e5ff", 2.2, 0.5);
  entranceSign.position.set(0, 3.35, FOYER_MIN_Z + 0.06);
  foyer.add(entranceSign);

  // Recessed downlights (emissive) + two attenuated warm point lights
  const downlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e6, emissiveIntensity: 2.2, roughness: 0.3 });
  for (const x of [-5.0, -2.5, 0, 2.5, 5.0]) {
    for (const z of [FOYER_MIN_Z + 1.0, FOYER_MAX_Z - 1.0]) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), downlightMat);
      disc.position.set(x, FOYER_CEILING_Y - 0.005, z);
      disc.rotation.x = Math.PI / 2;
      foyer.add(disc);
    }
  }
  // Placed near the centre line so the faces of furniture that look into the room are lit
  for (const x of [-2.0, 2.0]) {
    const light = new THREE.PointLight(0xfff1dc, 40, 7.5, 1.6);
    light.position.set(x, FOYER_CEILING_Y - 0.3, cz);
    foyer.add(light);
  }

  buildTuckShop(foyer, mats);
  const foyerKnockables = buildDisplayArea(foyer, mats);
  buildGlassShopfront(foyer, mats);

  group.add(foyer);
  return foyerKnockables;
}

function buildTuckShop(foyer: THREE.Group, mats: SharedMaterials): void {
  const tuck = new THREE.Group();
  tuck.name = "tuck-shop";
  const wallX = -HALF_WIDTH; // -7.0 inner face

  // Powerbank rental kiosk facing into the foyer (+X)
  const kioskBody = new THREE.MeshStandardMaterial({ color: 0xf2f2f4, roughness: 0.4, metalness: 0.2 });
  addBox(tuck, 0.6, 1.85, 0.62, kioskBody, wallX + 0.45, 0.925, 12.85, "powerbank-kiosk", true);
  const powerTexture = createPowerbankTexture();
  const powerFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 1.7),
    new THREE.MeshStandardMaterial({ map: powerTexture, emissive: 0x00838f, emissiveMap: powerTexture, emissiveIntensity: 0.5, roughness: 0.3 }),
  );
  powerFace.position.set(wallX + 0.76, 0.95, 12.85);
  powerFace.rotation.y = Math.PI / 2;
  tuck.add(powerFace);

  // Two glass-door beverage fridges, doors facing +X
  const fridgeTexture = createFridgeTexture();
  const fridgeFaceMat = new THREE.MeshStandardMaterial({
    map: fridgeTexture,
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0xffffff,
    emissiveMap: fridgeTexture,
    emissiveIntensity: 0.8,
  });
  const ledStrip = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const z of [13.85, 14.8]) {
    addBox(tuck, 0.8, 2.0, 0.9, mats.frameBlack, wallX + 0.5, 1.0, z, "tuck-fridge", true);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.8), fridgeFaceMat);
    face.position.set(wallX + 0.905, 1.03, z);
    face.rotation.y = Math.PI / 2;
    tuck.add(face);
    addBox(tuck, 0.02, 1.8, 0.03, ledStrip, wallX + 0.91, 1.03, z - 0.44, "", false);
    addBox(tuck, 0.02, 1.8, 0.03, ledStrip, wallX + 0.91, 1.03, z + 0.44, "", false);
    addBox(tuck, 0.02, 1.86, 0.86, mats.glass, wallX + 0.92, 1.03, z, "", false);
    // Brand header strip on the fridge top
    addBox(tuck, 0.82, 0.16, 0.03, material(0xd82035, 0.4, 0.2, 0xd82035), wallX + 0.905, 1.95, z, "", false);
  }
  const fridgeGlow = new THREE.PointLight(0xe0f2fe, 12, 3.2, 1.5);
  fridgeGlow.position.set(wallX + 1.3, 1.2, 14.3);
  tuck.add(fridgeGlow);

  // White folding staff table with till, card reader and price board
  const tableWhite = new THREE.MeshStandardMaterial({ color: 0xf7f7f9, roughness: 0.6, emissive: 0x1a1816 });
  addBox(tuck, 1.8, 0.05, 0.8, tableWhite, -4.8, 0.74, 14.9, "tuck-table", true);
  for (const [dx, dz] of [[-0.8, -0.32], [0.8, -0.32], [-0.8, 0.32], [0.8, 0.32]]) {
    addBox(tuck, 0.04, 0.72, 0.04, mats.steel, -4.8 + dx, 0.36, 14.9 + dz, "", false);
  }
  // Table skirt cloth in venue red
  addBox(tuck, 1.82, 0.5, 0.02, material(0xb3182a, 0.8), -4.8, 0.48, 15.31, "", false);
  addBox(tuck, 0.36, 0.14, 0.28, mats.fixtureBlack, -5.3, 0.84, 14.85, "", false); // cash box
  addBox(tuck, 0.12, 0.05, 0.18, material(0xeeeeee, 0.5), -4.75, 0.79, 14.75, "", false); // card reader
  const priceBoard = labelPlane("小賣部 TUCK SHOP\n飲品 $20 · 小食 $15", "#ffffff", "#b3182a", 0.7, 0.4);
  priceBoard.position.set(-4.3, 0.98, 14.72);
  priceBoard.rotation.x = -0.25;
  tuck.add(priceBoard);
  // Drink crates stacked under the table
  for (let i = 0; i < 2; i++) {
    addBox(tuck, 0.5, 0.3, 0.36, material(0x2563eb, 0.7), -4.4 + i * 0.0, 0.15 + i * 0.32, 15.0, "", false);
  }
  // Folding chair behind the table (facing the mall)
  addBox(tuck, 0.44, 0.04, 0.44, mats.fixtureBlack, -4.8, 0.46, 14.1, "", false);
  addBox(tuck, 0.44, 0.42, 0.04, mats.fixtureBlack, -4.8, 0.7, 13.9, "", false);
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    addBox(tuck, 0.03, 0.44, 0.03, mats.steel, -4.8 + dx, 0.22, 14.1 + dz, "", false);
  }

  // CHAMAME illuminated wooden sign on the entrance wall above the tuck shop side
  addBox(tuck, 2.5, 0.75, 0.04, new THREE.MeshStandardMaterial({ color: 0xd4b082, roughness: 0.6 }), -4.4, 2.5, FOYER_MIN_Z + 0.06, "chamame-sign-board", false);
  const chamameTexture = createChamameSignTexture();
  const chamameMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.72),
    new THREE.MeshStandardMaterial({ map: chamameTexture, emissive: 0xffffff, emissiveMap: chamameTexture, emissiveIntensity: 0.85, roughness: 0.3 }),
  );
  chamameMesh.position.set(-4.4, 2.5, FOYER_MIN_Z + 0.09);
  tuck.add(chamameMesh);

  foyer.add(tuck);
}

function buildDisplayArea(foyer: THREE.Group, mats: SharedMaterials): THREE.Object3D[] {
  const display = new THREE.Group();
  display.name = "display-area";
  const wallX = HALF_WIDTH;

  // 65" display on a black floor stand, screen facing into the foyer (-X)
  addBox(display, 0.9, 0.08, 1.3, mats.frameBlack, wallX - 0.6, 0.04, 13.8, "tv-display", true);
  addBox(display, 0.08, 1.2, 0.08, mats.frameBlack, wallX - 0.6, 0.64, 13.8, "", false);
  addBox(display, 0.06, 0.9, 1.55, mats.frameBlack, wallX - 0.6, 1.5, 13.8, "", true);
  const posterTexture = createLiveEventLedTexture();
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.48, 0.84),
    new THREE.MeshStandardMaterial({ map: posterTexture, emissive: 0xffffff, emissiveMap: posterTexture, emissiveIntensity: 0.75, roughness: 0.2 }),
  );
  screen.position.set(wallX - 0.635, 1.5, 13.8);
  screen.rotation.y = -Math.PI / 2;
  display.add(screen);
  const screenGlow = new THREE.PointLight(0x6aa7ff, 8, 3.5, 1.6);
  screenGlow.position.set(wallX - 1.2, 1.5, 13.8);
  display.add(screenGlow);

  // Merch table with white cloth, acrylic standees and two tee displays
  const tableWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x1a1816 });
  addBox(display, 1.8, 0.75, 0.9, tableWhite, 4.1, 0.375, 14.85, "merch-table", true);
  addBox(display, 1.86, 0.62, 0.96, tableWhite, 4.1, 0.44, 14.85, "", false);
  const acrylicMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, roughness: 0.1 });
  for (const x of [3.5, 3.85, 4.35, 4.7]) {
    addBox(display, 0.12, 0.22, 0.02, acrylicMat, x, 0.86, 14.75, "", false);
  }
  const brandCard = labelPlane("NAKIRA\n& MAIMA", "#ffffff", "#0284c7", 0.42, 0.22);
  brandCard.position.set(4.1, 0.88, 14.6);
  brandCard.rotation.x = -0.3;
  display.add(brandCard);
  const teeMannequins: THREE.Group[] = [];
  for (const [x, shirt, logo] of [[3.6, 0x18181c, 0x00e5ff], [4.6, 0xf4f4f6, 0xff2f7d]] as const) {
    const mannequin = new THREE.Group();
    mannequin.name = "tee-mannequin";
    mannequin.position.set(x, 0, 15.15);
    addBox(mannequin, 0.03, 0.6, 0.03, mats.steel, 0, 1.05, 0, "", false);
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
    addBox(mannequin, 0.38, 0.5, 0.14, shirtMat, 0, 1.5, 0, "", true);
    addBox(mannequin, 0.12, 0.2, 0.12, shirtMat, -0.24, 1.62, 0, "", true);
    addBox(mannequin, 0.12, 0.2, 0.12, shirtMat, 0.24, 1.62, 0, "", true);
    addBox(mannequin, 0.2, 0.2, 0.01, material(logo, 0.4, 0, logo), 0, 1.52, -0.08, "", false);
    display.add(mannequin);
    teeMannequins.push(mannequin);
  }

  // Life-size idol cutout standee in the far right corner
  const standee = new THREE.Group();
  standee.name = "idol-standee";
  standee.position.set(6.5, 0, 15.3);
  const idolTexture = createIdolCutoutTexture();
  const idolMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 1.65),
    new THREE.MeshStandardMaterial({ map: idolTexture, transparent: true, alphaTest: 0.1, roughness: 0.4, side: THREE.DoubleSide }),
  );
  idolMesh.position.set(0, 0.825, 0);
  idolMesh.rotation.y = -Math.PI / 2 + 0.35;
  standee.add(idolMesh);
  addBox(standee, 0.45, 1.4, 0.04, new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.8 }), 0.22, 0.7, 0, "", false);
  display.add(standee);

  // Polaroid / poster wall on the entrance wall, display side
  const posterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshStandardMaterial({ map: createPosterWallTexture(), roughness: 0.6 }),
  );
  posterMesh.position.set(4.4, 1.9, FOYER_MIN_Z + 0.06);
  display.add(posterMesh);
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.35, roughness: 0.5 });
  addBox(display, 3.0, 0.4, 0.02, bannerMat, 4.4, 3.0, FOYER_MIN_Z + 0.06, "merch-banner", false);

  foyer.add(display);
  return [...teeMannequins, standee];
}

// Floor-to-ceiling glass shopfront with black mullions, open glass doors and an illuminated fascia
function buildGlassShopfront(foyer: THREE.Group, mats: SharedMaterials): void {
  const front = new THREE.Group();
  front.name = "glass-shopfront";
  const z = NTK_GLASS_Z;
  const h = FOYER_CEILING_Y;

  for (const side of [-1, 1]) {
    const innerX = side * GLASS_DOOR_HALF;
    const outerX = side * HALF_WIDTH;
    const w = Math.abs(outerX - innerX);
    addBox(front, w, h, 0.03, mats.glass, (innerX + outerX) / 2, h / 2, z, "glass-front", false);
    // Mullions every 1.5m
    for (let x = Math.abs(innerX); x <= HALF_WIDTH + 0.01; x += 1.5) {
      addBox(front, 0.08, h, 0.1, mats.frameBlack, side * x, h / 2, z, "", false);
    }
  }
  addBox(front, HALF_WIDTH * 2, 0.1, 0.12, mats.frameBlack, 0, h - 0.05, z, "", false);
  addBox(front, HALF_WIDTH * 2, 0.06, 0.12, mats.frameBlack, 0, 0.03, z, "", false);
  // Door header
  addBox(front, GLASS_DOOR_HALF * 2 + 0.16, 0.08, 0.12, mats.frameBlack, 0, 2.55, z, "", false);
  addBox(front, GLASS_DOOR_HALF * 2, h - 2.6, 0.03, mats.glass, 0, (2.6 + h) / 2, z, "", false);
  // Open glass door leaves swung outward into the mall
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(side * GLASS_DOOR_HALF, 0, z + 0.05);
    leaf.rotation.y = -side * 1.0;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.45, 0.02), mats.glass);
    pane.position.set(-side * 0.48, 1.25, 0);
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.05), mats.frameBlack);
    stile.position.set(-side * 0.48, 2.48, 0);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.25, 0.05), mats.frameBlack);
    kick.position.set(-side * 0.48, 0.13, 0);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8), mats.steel);
    handle.position.set(-side * 0.85, 1.1, 0.05);
    leaf.add(pane, stile, kick, handle);
    front.add(leaf);
  }

  // Fascia signboard above the glass, facing the mall
  addBox(front, HALF_WIDTH * 2, MALL_CEILING_Y - h, 0.3, mats.fixtureBlack, 0, (h + MALL_CEILING_Y) / 2, z, "fascia", false);
  const fascia = labelPlane("✦ LIVE HOUSE 牛頭角 ✦   TUCK SHOP · MERCH · TICKETS", "#0b0b10", "#00e5ff", 8.0, 0.6);
  fascia.position.set(0, (h + MALL_CEILING_Y) / 2, z + 0.16);
  front.add(fascia);

  foyer.add(front);
}

// ---------------------------------------------------------------------------
// Mall corridor outside the glass: marble floor, carpet runner, rope queue
// ---------------------------------------------------------------------------
function buildMallCorridor(group: THREE.Group, mats: SharedMaterials): void {
  const mall = new THREE.Group();
  mall.name = "mall-corridor";
  const depth = MALL_MAX_Z - MALL_MIN_Z;
  const cz = (MALL_MIN_Z + MALL_MAX_Z) / 2;

  // Cream marble with dark brown border strips either side of the queue lane
  const marbleMat = new THREE.MeshStandardMaterial({ map: createMarbleTexture(depth), roughness: 0.15, metalness: 0.12 });
  addBox(mall, HALF_WIDTH * 2, 0.2, depth, marbleMat, 0, -0.1, cz, "mall-floor", false);
  const brownStrip = new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.25, metalness: 0.1 });
  for (const x of [-2.6, 2.6]) {
    addBox(mall, 0.3, 0.01, depth, brownStrip, x, 0.005, cz, "", false);
  }
  // Black carpet runner from the corridor into the glass doors
  addBox(mall, 1.8, 0.02, depth - 0.3, material(0x17161a, 0.98), 0, 0.011, cz + 0.05, "carpet-runner", false);

  // Ceiling and far wall, neighbouring shop glow on the side walls
  const mallCeiling = new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.8 });
  addBox(mall, HALF_WIDTH * 2, 0.2, depth, mallCeiling, 0, MALL_CEILING_Y + 0.1, cz, "mall-ceiling", false);
  addBox(mall, HALF_WIDTH * 2 + WALL_T * 2, MALL_CEILING_Y + 0.2, WALL_T, mats.offWhite, 0, MALL_CEILING_Y / 2, MALL_MAX_Z + WALL_T / 2, "mall-end-wall");
  addBox(mall, WALL_T, MALL_CEILING_Y + 0.2, depth, mats.offWhite, -HALF_WIDTH - WALL_T / 2, MALL_CEILING_Y / 2, cz);
  addBox(mall, WALL_T, MALL_CEILING_Y + 0.2, depth, mats.offWhite, HALF_WIDTH + WALL_T / 2, MALL_CEILING_Y / 2, cz);
  // Opposite shop window: dark frame with a softly lit display band
  addBox(mall, HALF_WIDTH * 2 - 1.0, 2.8, 0.08, mats.frameBlack, 0, 1.6, MALL_MAX_Z - 0.04, "", false);
  const shopGlow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe9cf, emissiveIntensity: 0.3, roughness: 0.3 });
  addBox(mall, HALF_WIDTH * 2 - 1.4, 2.2, 0.05, shopGlow, 0, 1.75, MALL_MAX_Z - 0.09, "", false);
  addBox(mall, HALF_WIDTH * 2, 0.15, 0.06, mats.frameBlack, 0, 0.075, MALL_MAX_Z - 0.03, "", false); // skirting
  const mallSign = labelPlane("牛頭角 · NGAU TAU KOK PLAZA   ⬆ 扶手電梯 ESCALATOR", "#f6f3ee", "#3b2a1c", 6.0, 0.5);
  mallSign.position.set(0, 3.4, MALL_MAX_Z - 0.04);
  mallSign.rotation.y = Math.PI;
  mall.add(mallSign);

  // Warm downlights (emissive discs) + attenuated point lights
  const downlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe3c2, emissiveIntensity: 2.4, roughness: 0.3 });
  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    for (const z of [MALL_MIN_Z + 1.1, MALL_MAX_Z - 1.1]) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), downlightMat);
      disc.position.set(x, MALL_CEILING_Y - 0.005, z);
      disc.rotation.x = Math.PI / 2;
      mall.add(disc);
    }
  }
  for (const x of [-3.2, 3.2]) {
    const light = new THREE.PointLight(0xffe6c8, 42, 7.5, 1.6);
    light.position.set(x, MALL_CEILING_Y - 0.4, cz);
    mall.add(light);
  }

  // Red velvet rope stanchions forming the queue lane (colliders live in venue.ts)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.3, metalness: 0.7 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a53a, roughness: 0.25, metalness: 0.9 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb3121f, roughness: 0.9 });
  const postZs = [16.6, 17.75, 18.9, 20.0];
  for (const x of [-1.55, 1.55]) {
    postZs.forEach((z, i) => {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.04, 14), postMat);
      base.position.set(x, 0.02, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.92, 10), postMat);
      post.position.set(x, 0.5, z);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), goldMat);
      cap.position.set(x, 0.99, z);
      mall.add(base, post, cap);
      if (i > 0) {
        const prev = postZs[i - 1];
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(x, 0.93, prev),
          new THREE.Vector3(x, 0.72, (prev + z) / 2),
          new THREE.Vector3(x, 0.93, z),
        );
        const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.022, 6, false), ropeMat);
        rope.name = "queue-rope";
        mall.add(rope);
      }
    });
  }

  // A-frame poster stand and planters by the queue
  const aStand = new THREE.Group();
  aStand.position.set(2.7, 0, 17.3);
  aStand.rotation.y = -0.4;
  const posterTexture = createLiveEventLedTexture();
  const posterMat = new THREE.MeshStandardMaterial({ map: posterTexture, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.03), mats.frameBlack);
    board.position.set(0, 0.5, s * 0.2);
    board.rotation.x = s * 0.35;
    aStand.add(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), posterMat);
    face.position.set(0, 0.5, s * 0.22);
    face.rotation.x = s * 0.35;
    face.rotation.y = s > 0 ? 0 : Math.PI;
    aStand.add(face);
  }
  mall.add(aStand);
  for (const x of [-5.6, 5.6]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.6 }));
    pot.position.set(x, 0.3, MALL_MAX_Z - 0.9);
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.9, flatShading: true }));
    foliage.position.set(x, 1.05, MALL_MAX_Z - 0.9);
    mall.add(pot, foliage);
  }

  group.add(mall);
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------
function createShowLighting(
  group: THREE.Group,
  colors: readonly number[],
  stage: VenueDefinition["platforms"][number],
  fakeBeams: FakeBeam[],
  showOnly: THREE.Object3D[],
): THREE.SpotLight[] {
  // Very low base fill so silhouettes stay readable with the house lights off
  const baseFill = new THREE.HemisphereLight(0x2a2450, 0x050409, 0.7);
  group.add(baseFill);
  const crowdWash = new THREE.PointLight(0x2a3cff, 26, 13, 1.5);
  crowdWash.position.set(0, 4.2, -1.0);
  group.add(crowdWash);

  // Stage key spots driven by ShowController
  const centerZ = (stage.bounds.minZ + stage.bounds.maxZ) / 2;
  const lights = colors.map((color, idx) => {
    const light = new THREE.SpotLight(color, 55, 18, 0.42, 0.6, 1.2);
    light.position.set(-3.6 + idx * 2.4, TRUSS_BOTTOM_Y - 0.3, TRUSS_STAGE_FRONT_Z);
    light.target.position.set(-3.0 + idx * 2.0, 0.8, centerZ);
    light.castShadow = false;
    group.add(light, light.target);
    return light;
  });

  // Blue / purple back lights thrown over the crowd (reference photo 2)
  const backBlue = new THREE.SpotLight(0x3f6cff, 70, 22, 0.55, 0.7, 1.1);
  backBlue.position.set(-2.8, TRUSS_BOTTOM_Y - 0.3, TRUSS_STAGE_REAR_Z);
  backBlue.target.position.set(2.0, 0, 3.0);
  const backPurple = new THREE.SpotLight(0x8a3cff, 70, 22, 0.55, 0.7, 1.1);
  backPurple.position.set(2.8, TRUSS_BOTTOM_Y - 0.3, TRUSS_STAGE_REAR_Z);
  backPurple.target.position.set(-2.0, 0, 3.0);
  group.add(backBlue, backBlue.target, backPurple, backPurple.target);

  // Volumetric cones: the four key spots, the two back lights and the moving-head fake beams
  const beams: FakeBeam[] = [
    ...lights.map((l) => ({ from: l.position.clone(), to: l.target.position.clone(), color: l.color.getHex(), radius: 0.9 })),
    { from: backBlue.position.clone(), to: backBlue.target.position.clone(), color: 0x3f6cff, radius: 1.3 },
    { from: backPurple.position.clone(), to: backPurple.target.position.clone(), color: 0x8a3cff, radius: 1.3 },
    ...fakeBeams,
  ];
  const beamMesh = createBeamCones(beams);
  group.add(beamMesh);
  showOnly.push(beamMesh);

  return lights;
}

// ---------------------------------------------------------------------------
// Doors, stairs, railings, barrier (ported and adjusted)
// ---------------------------------------------------------------------------
function createStageRightStairs(
  group: THREE.Group,
  baseX: number,
  startZ: number,
  endZ: number,
  totalHeight: number,
  stepCount: number,
  steel: THREE.Material,
): void {
  const stairGroup = new THREE.Group();
  stairGroup.name = "stairs-right";

  const width = 1.0;
  const totalDepth = Math.abs(endZ - startZ);
  const stepDepth = totalDepth / stepCount;
  const stepHeight = totalHeight / stepCount;

  const stepMat = new THREE.MeshStandardMaterial({ color: 0x1a1920, roughness: 0.75, metalness: 0.2 });
  const safetyStripeMat = new THREE.MeshStandardMaterial({
    color: 0xffee00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });

  for (let i = 0; i < stepCount; i++) {
    const curHeight = (i + 1) * stepHeight;
    const curZ = startZ - (i + 0.5) * stepDepth;
    const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(width, curHeight, stepDepth), stepMat);
    stepMesh.position.set(baseX, curHeight / 2, curZ);
    stepMesh.receiveShadow = true;
    stepMesh.castShadow = true;
    stairGroup.add(stepMesh);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, 0.05), safetyStripeMat);
    stripe.position.set(baseX, curHeight + 0.015, curZ + stepDepth / 2 - 0.025);
    stairGroup.add(stripe);
  }

  const railX = baseX + width / 2 + 0.02;
  const bottomPostH = 0.85;
  const topPostH = totalHeight + 0.85;

  const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, bottomPostH, 6), steel);
  post1.position.set(railX, bottomPostH / 2, startZ);
  const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, topPostH, 6), steel);
  post2.position.set(railX, topPostH / 2, endZ);
  const midZ = (startZ + endZ) / 2;
  const midPostH = (bottomPostH + topPostH) / 2;
  const postMid = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, midPostH, 6), steel);
  postMid.position.set(railX, midPostH / 2, midZ);
  const railLen = Math.hypot(totalDepth, totalHeight);
  const handrail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, railLen, 6), steel);
  handrail.position.set(railX, midPostH, midZ);
  handrail.rotation.x = Math.atan2(totalHeight, totalDepth);
  stairGroup.add(post1, post2, postMid, handrail);

  const innerRailX = baseX - width / 2 - 0.02;
  const inPost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, bottomPostH, 6), steel);
  inPost1.position.set(innerRailX, bottomPostH / 2, startZ);
  const inPost2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, topPostH, 6), steel);
  inPost2.position.set(innerRailX, topPostH / 2, endZ);
  const inHandrail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, railLen, 6), steel);
  inHandrail.position.set(innerRailX, midPostH, midZ);
  inHandrail.rotation.x = Math.atan2(totalHeight, totalDepth);
  stairGroup.add(inPost1, inPost2, inHandrail);

  group.add(stairGroup);
}

// Mojo-style crowd barrier: rails, posts, foot plates and mesh infill
function createNgauTauKokCrowdBarrier(
  group: THREE.Group,
  mats: SharedMaterials,
  barrier: VenueDefinition["crowdBarrier"],
): void {
  const barrierGroup = new THREE.Group();
  barrierGroup.name = "crowd-barrier";
  const transforms: InstanceTransform[] = [];
  const width = barrier.maxX - barrier.minX;
  const z = (barrier.minZ + barrier.maxZ) / 2;
  const segments = 6;
  const segLength = width / segments;
  const topY = barrier.maxY - 0.05;

  for (let i = 0; i < segments; i++) {
    const x = barrier.minX + segLength * (i + 0.5);
    transforms.push([x, topY, z, 0, 0, Math.PI / 2, 1, segLength * 0.96, 1]);
    transforms.push([x, topY * 0.5, z, 0, 0, Math.PI / 2, 1, segLength * 0.96, 1]);
  }
  for (let i = 0; i <= segments; i++) {
    const x = barrier.minX + segLength * i;
    transforms.push([x, topY / 2, z, 0, 0, 0, 1, topY, 1]);
  }

  const barrierMat = mats.steel.clone();
  barrierMat.color.setHex(0x222226);
  barrierMat.roughness = 0.8;
  const rails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), barrierMat, transforms.length);
  transforms.forEach((trans, idx) => setInstanceTransform(rails, idx, trans));
  rails.instanceMatrix.needsUpdate = true;
  rails.castShadow = false;
  barrierGroup.add(rails);

  // Perforated infill panels between the rails
  const meshMat = new THREE.MeshStandardMaterial({
    map: speakerGrilleTexture(),
    transparent: true,
    opacity: 0.85,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const infill = new THREE.Mesh(new THREE.PlaneGeometry(width, topY - 0.08), meshMat);
  infill.position.set(barrier.minX + width / 2, topY / 2, z);
  barrierGroup.add(infill);

  // Foot plates on the audience side and stage-side braces
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x1c1c21, roughness: 0.7, metalness: 0.5 });
  for (let i = 0; i < segments; i++) {
    const x = barrier.minX + segLength * (i + 0.5);
    addBox(barrierGroup, segLength * 0.96, 0.03, 0.6, plateMat, x, 0.015, z + 0.32, "", false);
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6), barrierMat);
    brace.position.set(x, topY * 0.42, z + 0.3);
    brace.rotation.x = -0.75;
    barrierGroup.add(brace);
  }

  group.add(barrierGroup);
}

function createSideStairHandrail(
  group: THREE.Group,
  mat: THREE.Material,
  x: number,
  startZ: number,
  endZ: number,
  topHeight: number,
): void {
  const depth = startZ - endZ;
  const bottomPostH = 0.8;
  const topPostH = topHeight + 0.8;

  const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, bottomPostH, 6), mat);
  post1.position.set(x, bottomPostH / 2, startZ);
  const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, topPostH, 6), mat);
  post2.position.set(x, topPostH / 2, endZ);
  const railLen = Math.hypot(depth, topHeight);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, railLen, 6), mat);
  rail.position.set(x, (bottomPostH + topPostH) / 2, (startZ + endZ) / 2);
  rail.rotation.x = -Math.atan2(topHeight, depth);
  group.add(post1, post2, rail);
}

function createNgauTauKokBoothRailings(
  group: THREE.Group,
  mat: THREE.Material,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  platformHeight: number,
  stairMinZ: number,
  stairMaxZ: number,
): void {
  const railY = platformHeight + 0.8;
  const addRail = (len: number, rotY: number, x: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.035, 0.035), mat);
    mesh.position.set(x, railY, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
  };
  const addPost = (x: number, z: number) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.82, 6), mat);
    post.position.set(x, platformHeight + 0.41, z);
    group.add(post);
  };

  addRail(maxZ - minZ, Math.PI / 2, minX, (minZ + maxZ) / 2);
  addPost(minX, minZ);
  addPost(minX, (minZ + maxZ) / 2);
  addPost(minX, maxZ);
  addPost(maxX, maxZ);

  const frontSideLen = stairMinZ - minZ;
  if (frontSideLen > 0) {
    addRail(frontSideLen, Math.PI / 2, maxX, minZ + frontSideLen / 2);
    addPost(maxX, minZ);
    addPost(maxX, stairMinZ);
  }
  const backSideLen = maxZ - stairMaxZ;
  if (backSideLen > 0) {
    addRail(backSideLen, Math.PI / 2, maxX, stairMaxZ + backSideLen / 2);
    addPost(maxX, stairMaxZ);
  }

  const leftFrontLen = -6.1 - minX;
  if (leftFrontLen > 0) {
    addRail(leftFrontLen, 0, minX + leftFrontLen / 2, minZ);
  }
  const rightFrontLen = maxX - -4.1;
  if (rightFrontLen > 0) {
    addRail(rightFrontLen, 0, -4.1 + rightFrontLen / 2, minZ);
    addPost(-4.1, minZ);
  }
}

// ---------------------------------------------------------------------------
// Canvas textures
// ---------------------------------------------------------------------------
function createDiscoBallTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const tiles = 16;
  const size = 256 / tiles;
  for (let r = 0; r < tiles; r++) {
    for (let c = 0; c < tiles; c++) {
      const brightness = 210 + ((r * 11 + c * 17) % 45);
      ctx.fillStyle = `rgb(${brightness}, ${brightness + 4}, ${brightness + 8})`;
      ctx.fillRect(c * size, r * size, size - 1, size - 1);
      ctx.fillStyle = "#1a1a1e";
      ctx.fillRect(c * size + size - 1, r * size, 1, size);
      ctx.fillRect(c * size, r * size + size - 1, size, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWhiteTileTexture(depth: number): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#ecebe7";
  ctx.fillRect(0, 0, 512, 512);
  // 2x2 tiles per texture, each with faint marbling
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const ox = tx * 256;
      const oy = ty * 256;
      const grad = ctx.createLinearGradient(ox, oy, ox + 256, oy + 256);
      grad.addColorStop(0, "#f1f0ec");
      grad.addColorStop(0.5, "#e6e4df");
      grad.addColorStop(1, "#efeee9");
      ctx.fillStyle = grad;
      ctx.fillRect(ox + 2, oy + 2, 252, 252);
      ctx.strokeStyle = "rgba(120, 115, 105, 0.25)";
      ctx.lineWidth = 1;
      for (let v = 0; v < 3; v++) {
        ctx.beginPath();
        ctx.moveTo(ox + 20 + v * 70, oy + 10);
        ctx.bezierCurveTo(ox + 90 + v * 40, oy + 90, ox + 30 + v * 60, oy + 170, ox + 120 + v * 40, oy + 246);
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = "rgba(90, 88, 84, 0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 512, 512);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(HALF_WIDTH * 2 / 1.2, depth / 1.2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMarbleTexture(depth: number): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#e4dccb";
  ctx.fillRect(0, 0, 512, 512);
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, "#ebe3d3");
  grad.addColorStop(0.5, "#dcd2bf");
  grad.addColorStop(1, "#ece5d6");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(140, 120, 90, 0.28)";
  ctx.lineWidth = 1.2;
  for (let v = 0; v < 7; v++) {
    ctx.beginPath();
    ctx.moveTo(v * 80 - 40, 0);
    ctx.bezierCurveTo(v * 80 + 120, 160, v * 80 - 60, 340, v * 80 + 80, 512);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(80, 70, 55, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(HALF_WIDTH * 2 / 1.5, depth / 1.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLiveEventLedTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 512);
  bgGrad.addColorStop(0, "#03071e");
  bgGrad.addColorStop(0.35, "#0a1945");
  bgGrad.addColorStop(0.7, "#112260");
  bgGrad.addColorStop(1, "#03071e");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 512);

  const skylineY = 360;
  ctx.fillStyle = "rgba(18, 38, 95, 0.75)";
  const buildings1 = [
    [30, 190, 70], [115, 250, 65], [195, 160, 85], [300, 220, 80],
    [410, 280, 95], [520, 210, 70], [605, 260, 85], [705, 180, 80],
    [800, 240, 70], [885, 200, 85],
  ];
  for (const [bx, bh, bw] of buildings1) {
    ctx.fillRect(bx, skylineY - bh, bw, bh);
  }

  ctx.fillStyle = "#1e377a";
  const buildings2 = [
    [70, 230, 75], [160, 190, 75], [250, 270, 90], [360, 180, 80],
    [465, 300, 100], [580, 230, 85], [680, 270, 80], [775, 190, 75],
    [860, 250, 85],
  ];
  for (const [bx, bh, bw] of buildings2) {
    ctx.fillRect(bx, skylineY - bh, bw, bh);
    ctx.fillStyle = "rgba(0, 229, 255, 0.35)";
    for (let wy = skylineY - bh + 16; wy < skylineY - 10; wy += 22) {
      for (let wx = bx + 10; wx < bx + bw - 10; wx += 16) {
        if ((wx + wy) % 5 !== 0) {
          ctx.fillRect(wx, wy, 8, 12);
        }
      }
    }
    ctx.fillStyle = "#1e377a";
  }

  ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= 1024; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, skylineY);
    ctx.lineTo(512 + (x - 512) * 1.5, 512);
    ctx.stroke();
  }
  for (let y = skylineY; y <= 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(110, 40);
  ctx.lineTo(250, 260);
  ctx.moveTo(910, 50);
  ctx.lineTo(770, 280);
  ctx.stroke();

  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 20, 968, 472);

  ctx.fillStyle = "#ffd500";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("✦", 220, 130);
  ctx.fillText("✦", 780, 140);
  ctx.fillStyle = "#00e5ff";
  ctx.fillText("✦", 310, 230);
  ctx.fillText("✦", 710, 220);

  ctx.fillStyle = "#00e5ff";
  ctx.beginPath();
  ctx.roundRect(585, 144, 180, 36, 18);
  ctx.fill();
  ctx.fillStyle = "#05081c";
  ctx.font = "bold italic 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("in Hong Kong", 675, 169);

  ctx.font = "900 86px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 24;
  ctx.fillText("SEKAI", 430, 175);

  const festGrad = ctx.createLinearGradient(300, 0, 720, 0);
  festGrad.addColorStop(0, "#ff2f7d");
  festGrad.addColorStop(0.5, "#ff88dd");
  festGrad.addColorStop(1, "#ffd500");
  ctx.fillStyle = festGrad;
  ctx.font = "italic 900 68px sans-serif";
  ctx.shadowColor = "#ff2f7d";
  ctx.shadowBlur = 20;
  ctx.fillText("FESTIVAL", 500, 248);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("牛頭角 ✦ LIVE HOUSE", 512, 296);

  for (let b = 0; b < 44; b++) {
    const barHeight = 22 + Math.sin(b * 0.45) * 45 + ((b * 19) % 35);
    const bx = 80 + b * 20;
    const barGrad = ctx.createLinearGradient(0, 480, 0, 480 - barHeight);
    barGrad.addColorStop(0, "#00e5ff");
    barGrad.addColorStop(0.5, "#ff2f7d");
    barGrad.addColorStop(1, "#ffd500");
    ctx.fillStyle = barGrad;
    ctx.fillRect(bx, 480 - barHeight, 14, barHeight);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createChamameSignTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#d4b082";
  ctx.fillRect(0, 0, 1024, 320);
  for (let y = 0; y < 320; y += 8) {
    ctx.fillStyle = y % 16 === 0 ? "rgba(180, 140, 90, 0.25)" : "rgba(230, 200, 160, 0.2)";
    ctx.fillRect(0, y, 1024, 4);
  }

  ctx.save();
  ctx.fillStyle = "#ffb300";
  ctx.shadowColor = "#ff8800";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(240, 160, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#2a1505";
  ctx.font = "bold 56px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("茶豆", 240, 160);
  ctx.restore();

  ctx.save();
  ctx.font = "900 88px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#ffdd88";
  ctx.shadowBlur = 25;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("CHAMAME", 370, 160);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createIdolCutoutTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.clearRect(0, 0, 512, 1024);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(256, 260, 175, 175, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(256, 600, 210, 290, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e0f2fe";
  ctx.beginPath();
  ctx.moveTo(100, 780);
  ctx.quadraticCurveTo(256, 850, 412, 780);
  ctx.lineTo(380, 520);
  ctx.lineTo(132, 520);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#bae6fd";
  for (let x = 110; x <= 400; x += 32) {
    ctx.beginPath();
    ctx.arc(x, 780, 16, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(190, 420, 132, 110);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(240, 430, 32, 90);
  ctx.fillStyle = "#ffedd5";
  ctx.beginPath();
  ctx.arc(256, 300, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0284c7";
  ctx.beginPath();
  ctx.ellipse(225, 295, 12, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(287, 295, 12, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f43f5e";
  ctx.beginPath();
  ctx.arc(256, 335, 18, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  ctx.arc(256, 270, 110, Math.PI * 0.85, Math.PI * 2.15);
  ctx.fill();
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(150, 200, 40, 40);
  ctx.fillRect(322, 200, 40, 40);
  ctx.fillStyle = "#ffedd5";
  ctx.fillRect(205, 780, 34, 150);
  ctx.fillRect(273, 780, 34, 150);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(195, 910, 50, 90);
  ctx.fillRect(267, 910, 50, 90);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPowerbankTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#f4f4f6";
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = "#00838f";
  ctx.fillRect(0, 0, 256, 24);
  ctx.fillStyle = "#111827";
  ctx.fillRect(24, 40, 208, 120);
  ctx.fillStyle = "#00e5ff";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("POWER BANK", 128, 90);
  ctx.font = "16px sans-serif";
  ctx.fillText("租借充電寶", 128, 125);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 2; col++) {
      const sx = 36 + col * 100;
      const sy = 190 + row * 60;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(sx, sy, 84, 42);
      ctx.fillStyle = row % 2 === 0 ? "#22c55e" : "#38bdf8";
      ctx.fillRect(sx + 6, sy + 6, 72, 30);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPosterWallTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#f3f0ea";
  ctx.fillRect(0, 0, 512, 512);
  const photos = [
    [40, 30, 110, 140, "#38bdf8", "#0369a1"],
    [170, 45, 120, 150, "#f472b6", "#be185d"],
    [310, 20, 115, 145, "#fbbf24", "#b45309"],
    [60, 200, 125, 155, "#a78bfa", "#6d28d9"],
    [210, 220, 110, 140, "#4ade80", "#15803d"],
    [340, 190, 120, 150, "#fb7185", "#be123c"],
  ];
  for (const [px, py, pw, ph, c1, c2] of photos as [number, number, number, number, string, string][]) {
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 8;
    ctx.fillRect(px, py, pw, ph);
    ctx.shadowBlur = 0;
    const pGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
    pGrad.addColorStop(0, c1);
    pGrad.addColorStop(1, c2);
    ctx.fillStyle = pGrad;
    ctx.fillRect(px + 8, py + 8, pw - 16, ph - 38);
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 14, py + ph - 16);
    ctx.lineTo(px + 40, py + ph - 20);
    ctx.lineTo(px + 70, py + ph - 14);
    ctx.stroke();
    ctx.fillStyle = "rgba(254, 240, 138, 0.85)";
    ctx.fillRect(px + pw / 2 - 20, py - 6, 40, 14);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
