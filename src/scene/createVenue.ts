import * as THREE from "three";
import { GENERIC_FOH_CHAIRS, GENERIC_FOH_DESK, type VenueDefinition } from "../config/venue";
import type { Aabb2 } from "../core/collision";
import { createNgauTauKokVenue } from "./createNgauTauKokVenue";
import { createKowloonBayVenue } from "./kowloonBay/createKowloonBayVenue";
import { addBox as addKitBox, buildFohChair, buildLightingConsole, buildSoundMixer } from "./venueKit";

export interface HouseLights {
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
}

/** Per-frame driver for a venue's moving / colour-changing rig. */
export interface LightShow {
  update(elapsed: number): void;
}

export interface VenueBuild {
  group: THREE.Group;
  colliders: Aabb2[];
  audiencePoints: THREE.Vector3[];
  stageLights: THREE.SpotLight[];
  /** Venue-level work lights (ceiling panels + ambient). Absent when a venue has no house-light toggle. */
  houseLights?: HouseLights;
  /** Animated rig (sweeping heads, drifting colours). Absent for venues with a static rig. */
  lightShow?: LightShow;
  /** Decorative dummies and standees that mosh / lift can knock. */
  knockableProps: THREE.Object3D[];
}

type InstanceTransform = readonly [number, number, number, number, number, number, number, number, number];

export function createVenue(definition: VenueDefinition): VenueBuild {
  if (definition.scene.kind !== "procedural") {
    throw new Error(`Unsupported venue scene: ${definition.id}`);
  }

  if (definition.scene.builderId === "ngau-tau-kok") {
    return createNgauTauKokVenue(definition);
  }

  if (definition.scene.builderId === "kowloon-bay") {
    return createKowloonBayVenue(definition);
  }

  if (definition.scene.builderId !== "neon-backstage") {
    throw new Error(`Unsupported venue scene: ${definition.id}`);
  }

  const group = new THREE.Group();
  group.name = definition.id;
  const colliders = definition.colliders.map((collider) => ({ ...collider }));

  const concrete = material(0x25242c, 0.9);
  const black = material(0x0d0b12, 0.78);
  const charcoal = material(0x17141d, 0.82);
  const steel = material(0x50525c, 0.38, 0.68);
  const stage = material(0x171119, 0.7);
  const wood = material(0x8c3f24, 0.72);
  const pink = material(0xff2f7d, 0.38, 0.08, 0xff2f7d);
  const acid = material(0xcfff3d, 0.4, 0.04, 0xcfff3d);
  const violet = material(0x7147d9, 0.38, 0.08, 0x4d27ad);
  const red = material(0xa51f42, 0.58);

  const addBox = (
    width: number,
    height: number,
    depth: number,
    meshMaterial: THREE.Material,
    x: number,
    y: number,
    z: number,
    castsShadow = true,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), meshMaterial);
    mesh.position.set(x, y, z);
    mesh.castShadow = castsShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const floor = addBox(18, 0.2, 38, concrete, 0, -0.1, 3, false);
  floor.receiveShadow = true;
  addBox(18, 0.18, 34, black, 0, 6.05, 1, false);

  addBox(0.35, 6, 34, charcoal, -9, 3, 1);
  addBox(0.35, 6, 34, charcoal, 9, 3, 1);
  addBox(18, 6, 0.35, charcoal, 0, 3, -16);

  addBox(7, 6, 0.35, charcoal, -5.5, 3, 18);
  addBox(7, 6, 0.35, charcoal, 5.5, 3, 18);

  addBox(6.7, 4.4, 0.28, black, -5.65, 2.2, 9.5);
  addBox(6.7, 4.4, 0.28, black, 5.65, 2.2, 9.5);

  const entranceFrame = addBox(4.6, 0.26, 0.24, steel, 0, 5.45, 17.78);
  entranceFrame.castShadow = false;
  addBox(0.26, 5, 0.24, steel, -2.25, 2.5, 17.78);
  addBox(0.26, 5, 0.24, steel, 2.25, 2.5, 17.78);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 1.15),
    new THREE.MeshBasicMaterial({
      map: textTexture(definition.name.toUpperCase(), "#080611", "#d6ff3f", 1024, 256),
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  sign.position.set(0, 4.35, 17.56);
  group.add(sign);

  addBox(3.2, 1.12, 1.45, wood, -6.75, 0.56, 12.8);
  addBox(2.7, 0.06, 1.05, pink, -6.75, 1.15, 12.8);
  const ticketLabel = labelPlane("TICKETS", "#ff2f7d", "#fff6ee", 1.6, 0.55);
  ticketLabel.position.set(-6.75, 2.25, 13.56);
  group.add(ticketLabel);

  for (let index = 0; index < 6; index += 1) {
    const post = addBox(0.06, 3.8, 0.06, steel, -8.72 + index * 3.48, 3.9, 8.7, false);
    post.rotation.z = index % 2 === 0 ? 0.04 : -0.04;
  }

  const stagePlatform = definition.platforms[0];
  if (!stagePlatform) throw new Error("The venue must define a stage platform");
  const stageWidth = stagePlatform.bounds.maxX - stagePlatform.bounds.minX;
  const stageDepth = stagePlatform.bounds.maxZ - stagePlatform.bounds.minZ;
  const stageX = (stagePlatform.bounds.minX + stagePlatform.bounds.maxX) / 2;
  const stageZ = (stagePlatform.bounds.minZ + stagePlatform.bounds.maxZ) / 2;
  const stageTop = addBox(
    stageWidth,
    stagePlatform.height,
    stageDepth,
    stage,
    stageX,
    stagePlatform.height / 2,
    stageZ,
  );
  stageTop.receiveShadow = true;
  addBox(stageWidth + 0.4, 0.12, 0.26, pink, stageX, 0.72, stagePlatform.bounds.maxZ + 0.03, false);
  addBox(stageWidth + 0.4, 0.12, 0.26, violet, stageX, 0.58, stagePlatform.bounds.maxZ + 0.03, false);
  createStageDetails(
    group,
    steel,
    black,
    definition.show.lightColors,
    stagePlatform,
    definition.crowdBarrier,
  );

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(stageWidth - 0.5, 4.6),
    new THREE.MeshBasicMaterial({
      map: curtainTexture(),
      side: THREE.DoubleSide,
    }),
  );
  backdrop.position.set(0, 3.05, -15.78);
  group.add(backdrop);

  addBox(2.8, 1.05, 7.8, wood, 7.15, 0.525, -1.4);
  addBox(2.96, 0.11, 7.96, acid, 7.15, 1.08, -1.4, false);
  for (let z = -4.1; z <= 1.4; z += 1.8) {
    const stool = addBox(0.58, 0.12, 0.58, red, 5.25, 0.76, z);
    addBox(0.11, 0.72, 0.11, steel, 5.25, 0.36, z);
    stool.rotation.y = 0.2;
  }
  const barLabel = labelPlane("BAR", "#d6ff3f", "#0a0811", 1.55, 0.68);
  barLabel.position.set(8.76, 3.25, -1.4);
  barLabel.rotation.y = -Math.PI / 2;
  group.add(barLabel);

  // FOH desk: sound mixer and lighting console on a black table, an operator chair behind each
  const fohDesk = new THREE.Group();
  fohDesk.name = "foh-desk";
  fohDesk.position.set(GENERIC_FOH_DESK.x, 0, GENERIC_FOH_DESK.z);
  const deskTopY = 0.78;
  addKitBox(fohDesk, GENERIC_FOH_DESK.width, 0.05, GENERIC_FOH_DESK.depth, black, 0, deskTopY - 0.025, 0);
  addKitBox(fohDesk, GENERIC_FOH_DESK.width - 0.1, 0.03, 0.05, violet, 0, deskTopY - 0.06, -GENERIC_FOH_DESK.depth / 2 + 0.03, "", false);
  for (const [lx, lz] of [[-1.4, -0.3], [1.4, -0.3], [-1.4, 0.3], [1.4, 0.3]] as const) {
    addKitBox(fohDesk, 0.06, deskTopY - 0.05, 0.06, steel, lx, (deskTopY - 0.05) / 2, lz, "", false);
  }
  const mixer = buildSoundMixer();
  mixer.position.set(GENERIC_FOH_CHAIRS[0].x - GENERIC_FOH_DESK.x, deskTopY, 0);
  fohDesk.add(mixer);
  const lightingConsole = buildLightingConsole();
  lightingConsole.position.set(GENERIC_FOH_CHAIRS[1].x - GENERIC_FOH_DESK.x, deskTopY, 0);
  fohDesk.add(lightingConsole);
  for (const { x, z } of GENERIC_FOH_CHAIRS) {
    const chair = buildFohChair();
    chair.position.set(x - GENERIC_FOH_DESK.x, 0, z - GENERIC_FOH_DESK.z);
    fohDesk.add(chair);
  }
  group.add(fohDesk);
  const soundLabel = labelPlane("FOH", "#8b5cf6", "#ffffff", 1.4, 0.55);
  soundLabel.position.set(GENERIC_FOH_DESK.x, 2.35, GENERIC_FOH_DESK.z - 0.7);
  group.add(soundLabel);

  addBox(0.5, 5.4, 0.24, black, -8.75, 2.7, -9.75);
  addBox(0.4, 5.4, 0.24, black, -7.1, 2.7, -9.75);
  addBox(0.24, 5.4, 4.4, black, -7.05, 2.7, -12);
  const backstageLabel = labelPlane("BACKSTAGE", "#ff2f7d", "#ffffff", 2, 0.55);
  backstageLabel.position.set(-7.5, 3.25, -9.61);
  group.add(backstageLabel);

  const exitLabel = labelPlane("EXIT", "#1d8f5a", "#ffffff", 1.2, 0.5);
  exitLabel.position.set(7.7, 3.8, -15.77);
  group.add(exitLabel);

  const stageLights = createStageLights(group, definition.show.lightColors, stagePlatform);
  const audiencePoints = definition.show.audiencePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));

  return {
    group,
    colliders,
    audiencePoints,
    stageLights,
    knockableProps: [],
  };
}

function material(
  color: number,
  roughness: number,
  metalness = 0,
  emissive = 0x000000,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity: emissive === 0 ? 0 : 0.45,
    flatShading: true,
  });
}

function labelPlane(
  text: string,
  background: string,
  color: string,
  width: number,
  height: number,
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: textTexture(text, background, color, 512, 256),
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
}

function textTexture(
  text: string,
  background: string,
  color: string,
  width: number,
  height: number,
): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = color;
  context.lineWidth = Math.max(4, width * 0.008);
  context.strokeRect(12, 12, width - 24, height - 24);
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${Math.floor(height * 0.38)}px sans-serif`;
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    context.fillText(line, width / 2, height / 2 + (index - (lines.length - 1) / 2) * height * 0.36);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function curtainTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");

  context.fillStyle = "#08070b";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 32) {
    const fold = context.createLinearGradient(x, 0, x + 32, 0);
    fold.addColorStop(0, "#08070b");
    fold.addColorStop(0.42, "#24212a");
    fold.addColorStop(0.58, "#18151d");
    fold.addColorStop(1, "#050407");
    context.fillStyle = fold;
    context.fillRect(x, 0, 32, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStageDetails(
  group: THREE.Group,
  steel: THREE.Material,
  black: THREE.Material,
  colors: readonly number[],
  stage: VenueDefinition["platforms"][number],
  barrier: VenueDefinition["crowdBarrier"],
): void {
  createStageTruss(group, steel, stage);
  createFixtureArray(group, black, colors, stage);
  createSpeakerStacks(group, stage);
  createWedgeMonitors(group, black, stage);
  createCrowdBarrier(group, steel, barrier);
}

function createStageTruss(
  group: THREE.Group,
  steel: THREE.Material,
  stage: VenueDefinition["platforms"][number],
): void {
  const bars: InstanceTransform[] = [];
  const { bounds } = stage;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  for (let index = 0; index < 4; index += 1) {
    const z = bounds.maxZ - 0.3 - (index * (depth - 0.6)) / 3;
    bars.push([0, 5.46, z, 0, 0, Math.PI / 2, 1, width - 0.1, 1]);
  }
  for (let index = 0; index < 5; index += 1) {
    const x = bounds.minX + 0.225 + (index * (width - 0.45)) / 4;
    bars.push([x, 5.46, centerZ, Math.PI / 2, 0, 0, 1, depth - 0.7, 1]);
  }
  const frontZ = bounds.maxZ - 0.3;
  const sideX = width / 2 - 0.175;
  bars.push(
    [-sideX, 3.15, frontZ, 0, 0, 0, 1, 5, 1],
    [sideX, 3.15, frontZ, 0, 0, 0, 1, 5, 1],
    [0, 5.68, frontZ, 0, 0, Math.PI / 2, 1, width - 0.05, 1],
    [-width / 4, 5.47, frontZ - 0.01, 0, 0, 0.08, 1, width / 2, 1],
    [width / 4, 5.47, frontZ - 0.01, 0, 0, -0.08, 1, width / 2, 1],
  );
  const geometry = new THREE.CylinderGeometry(0.055, 0.055, 1, 6);
  const truss = new THREE.InstancedMesh(geometry, steel, bars.length);
  bars.forEach((transform, index) => setInstanceTransform(truss, index, transform));
  truss.instanceMatrix.needsUpdate = true;
  truss.castShadow = false;
  group.add(truss);
}

function createFixtureArray(
  group: THREE.Group,
  black: THREE.Material,
  colors: readonly number[],
  stage: VenueDefinition["platforms"][number],
): void {
  const positions: Array<readonly [number, number, number]> = [];
  const { bounds } = stage;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  for (const z of [bounds.maxZ - 0.58, centerZ, bounds.minZ + 0.58]) {
    for (const x of [-4.5, -2.25, 0, 2.25, 4.5]) {
      positions.push([x, 5.18, z]);
    }
  }

  const fixtureGeometry = new THREE.CylinderGeometry(0.28, 0.22, 0.46, 8);
  const fixtures = new THREE.InstancedMesh(fixtureGeometry, black, positions.length);
  const lensMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  const lensGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.025, 8);
  const lenses = new THREE.InstancedMesh(lensGeometry, lensMaterial, positions.length);
  positions.forEach(([x, y, z], index) => {
    setInstanceTransform(fixtures, index, [x, y, z, 1.95, 0, 0, 1, 1, 1]);
    setInstanceTransform(lenses, index, [x, y - 0.085, z + 0.214, 1.95, 0, 0, 1, 1, 1]);
    lenses.setColorAt(index, new THREE.Color(colors[index % colors.length] ?? 0xffffff));
  });
  fixtures.instanceMatrix.needsUpdate = true;
  lenses.instanceMatrix.needsUpdate = true;
  if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true;
  fixtures.castShadow = false;
  group.add(fixtures, lenses);
}

function createSpeakerStacks(
  group: THREE.Group,
  stage: VenueDefinition["platforms"][number],
): void {
  const cabinetGeometry = new THREE.BoxGeometry(1.05, 0.62, 0.72);
  const cabinetMaterial = new THREE.MeshStandardMaterial({
    color: 0x202129,
    roughness: 0.72,
    metalness: 0.24,
    flatShading: true,
  });
  const cabinets = new THREE.InstancedMesh(cabinetGeometry, cabinetMaterial, 10);
  const grillGeometry = new THREE.PlaneGeometry(0.9, 0.48);
  const grillMaterial = new THREE.MeshStandardMaterial({
    color: 0x444650,
    roughness: 0.7,
    metalness: 0.42,
    flatShading: true,
  });
  const grills = new THREE.InstancedMesh(grillGeometry, grillMaterial, 10);
  let index = 0;
  const speakerZ = stage.bounds.maxZ - 0.9;
  for (const x of [-6.3, 6.3]) {
    for (let level = 0; level < 5; level += 1) {
      const y = 1.1 + level * 0.61;
      const tilt = x < 0 ? -0.025 * level : 0.025 * level;
      setInstanceTransform(cabinets, index, [x, y, speakerZ, 0, 0, tilt, 1, 1, 1]);
      setInstanceTransform(grills, index, [x, y, speakerZ + 0.365, 0, 0, tilt, 1, 1, 1]);
      index += 1;
    }
  }
  cabinets.instanceMatrix.needsUpdate = true;
  grills.instanceMatrix.needsUpdate = true;
  cabinets.castShadow = false;
  group.add(cabinets, grills);
}

function createWedgeMonitors(
  group: THREE.Group,
  black: THREE.Material,
  stage: VenueDefinition["platforms"][number],
): void {
  const vertices = new Float32Array([
    -0.5, 0, 0.38, 0.5, 0, 0.38, -0.5, 0, -0.38, 0.5, 0, -0.38,
    -0.5, 0.12, 0.38, 0.5, 0.12, 0.38, -0.5, 0.48, -0.38, 0.5, 0.48, -0.38,
  ]);
  const indices = [
    0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2,
    1, 3, 7, 1, 7, 5, 4, 5, 7, 4, 7, 6, 0, 2, 3, 0, 3, 1,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const wedges = new THREE.InstancedMesh(geometry, black, 4);
  const grills = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.72, 0.48),
    new THREE.MeshStandardMaterial({ color: 0x5c5f69, roughness: 0.82, metalness: 0.28 }),
    4,
  );
  const z = stage.bounds.maxZ - 0.75;
  [-4.2, -1.4, 1.4, 4.2].forEach((x, index) => {
    setInstanceTransform(wedges, index, [x, 0.76, z, 0, 0, 0, 1, 1, 1]);
    setInstanceTransform(grills, index, [x, 1.07, z + 0.03, -1.0, 0, 0, 1, 1, 1]);
  });
  wedges.instanceMatrix.needsUpdate = true;
  grills.instanceMatrix.needsUpdate = true;
  group.add(wedges, grills);
}

function createCrowdBarrier(
  group: THREE.Group,
  steel: THREE.Material,
  barrier: VenueDefinition["crowdBarrier"],
): void {
  const transforms: InstanceTransform[] = [];
  const width = barrier.maxX - barrier.minX;
  const z = (barrier.minZ + barrier.maxZ) / 2;
  const segmentLength = width / 5;
  for (let index = 0; index < 5; index += 1) {
    const x = barrier.minX + segmentLength * (index + 0.5);
    transforms.push([x, 1.28, z, 0, 0, Math.PI / 2, 1, segmentLength * 0.95, 1]);
    transforms.push([x, 0.68, z, 0, 0, Math.PI / 2, 1, segmentLength * 0.95, 1]);
  }
  for (let index = 0; index <= 5; index += 1) {
    const x = barrier.minX + segmentLength * index;
    transforms.push([x, 0.68, z, 0, 0, 0, 1, 1.28, 1]);
    transforms.push([x, 0.08, z, Math.PI / 2, 0, 0, 1, 0.58, 1]);
  }
  const barrierMaterial = (steel as THREE.MeshStandardMaterial).clone();
  barrierMaterial.color.setHex(0x858892);
  const rails = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.055, 0.055, 1, 6),
    barrierMaterial,
    transforms.length,
  );
  transforms.forEach((transform, index) => setInstanceTransform(rails, index, transform));
  rails.instanceMatrix.needsUpdate = true;
  rails.castShadow = false;
  group.add(rails);
}

function setInstanceTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  transform: InstanceTransform,
): void {
  const [x, y, z, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ] = transform;
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, rotationY, rotationZ)),
    new THREE.Vector3(scaleX, scaleY, scaleZ),
  );
  mesh.setMatrixAt(index, matrix);
}

function createStageLights(
  group: THREE.Group,
  colors: readonly number[],
  stage: VenueDefinition["platforms"][number],
): THREE.SpotLight[] {
  const hemisphere = new THREE.HemisphereLight(0x46365f, 0x07060b, 1.2);
  const ambient = new THREE.AmbientLight(0x6e607f, 1.3);
  group.add(hemisphere, ambient);

  const key = new THREE.DirectionalLight(0xffe6cf, 1.6);
  key.position.set(-5, 8, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  group.add(key);

  const centerZ = (stage.bounds.minZ + stage.bounds.maxZ) / 2;
  const stageLights = colors.slice(0, 4).map((color, index) => {
    const light = new THREE.SpotLight(color, 38, 18, 0.45, 0.7, 1.4);
    light.position.set(-4.5 + index * 3, 5.1, stage.bounds.maxZ - 1);
    light.target.position.set(-3.75 + index * 2.5, 1, centerZ);
    light.castShadow = false;
    group.add(light, light.target);
    return light;
  });
  createLightBeams(group, stageLights);
  return stageLights;
}

function createLightBeams(group: THREE.Group, lights: readonly THREE.SpotLight[]): void {
  const geometry = new THREE.ConeGeometry(1.05, 1, 8, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  const beams = new THREE.InstancedMesh(geometry, material, lights.length);
  const up = new THREE.Vector3(0, 1, 0);
  lights.forEach((light, index) => {
    const target = light.target.position;
    const direction = new THREE.Vector3().subVectors(light.position, target);
    const distance = direction.length();
    const matrix = new THREE.Matrix4();
    matrix.compose(
      new THREE.Vector3().addVectors(light.position, target).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()),
      new THREE.Vector3(1, distance, 1),
    );
    beams.setMatrixAt(index, matrix);
    beams.setColorAt(index, light.color);
  });
  beams.instanceMatrix.needsUpdate = true;
  if (beams.instanceColor) beams.instanceColor.needsUpdate = true;
  beams.frustumCulled = false;
  group.add(beams);
}
