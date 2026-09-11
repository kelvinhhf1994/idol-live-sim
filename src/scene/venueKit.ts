import * as THREE from "three";
import type { HouseLights } from "./createVenue";

// Generic building blocks shared by the procedural venue builders (牛頭角, 九龍灣).

export type InstanceTransform = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface FakeBeam {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: number;
  radius: number;
}

export interface SharedMaterials {
  steel: THREE.MeshStandardMaterial;
  matteBlack: THREE.MeshStandardMaterial;
  wallCharcoal: THREE.MeshStandardMaterial;
  fixtureBlack: THREE.MeshStandardMaterial;
  offWhite: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  frameBlack: THREE.MeshStandardMaterial;
}

export function createSharedMaterials(): SharedMaterials {
  return {
    steel: material(0x60636d, 0.35, 0.7),
    matteBlack: material(0x0b0b0e, 0.9),
    wallCharcoal: material(0x141319, 0.88),
    fixtureBlack: new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.55, metalness: 0.45 }),
    // Faint emissive stands in for bounced light in bright side rooms (three.js has no local ambient)
    offWhite: new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.85, metalness: 0.02, emissive: 0x1a1816 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xdff4ff,
      transparent: true,
      opacity: 0.22,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
    frameBlack: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.45, metalness: 0.6 }),
  };
}

export interface HouseLightParts {
  panelMaterial: THREE.MeshStandardMaterial;
}

// Aim helpers: a fixture hangs at `from` and its lens looks at `to`
export function aimAngles(from: THREE.Vector3, to: THREE.Vector3): { pan: number; tilt: number } {
  const d = new THREE.Vector3().subVectors(to, from).normalize();
  const horizontal = Math.hypot(d.x, d.z);
  return { pan: Math.atan2(-d.x, -d.z), tilt: Math.atan2(horizontal, -d.y) };
}

/** Live parts of a moving head so a light show can drive pan (fixture.rotation.y), tilt (head.rotation.x) and lens colour. */
export interface MovingHeadHandle {
  fixture: THREE.Group;
  head: THREE.Group;
  lens: THREE.MeshStandardMaterial;
}

export interface ParCanHandle {
  face: THREE.MeshStandardMaterial;
}

export function addMovingHead(
  parent: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  lensColor: number,
  mats: SharedMaterials,
): MovingHeadHandle {
  const fixture = new THREE.Group();
  fixture.name = "moving-head";
  // `from` is the pivot of the head; the base hangs 0.5m above it under the truss
  fixture.position.copy(from);
  const { pan, tilt } = aimAngles(from, to);
  fixture.rotation.y = pan;

  const bodyMat = mats.fixtureBlack;
  // Clamp + base disc hanging from the truss
  addBox(fixture, 0.14, 0.1, 0.14, mats.steel, 0, 0.47, 0, "", false);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), bodyMat);
  base.position.y = 0.36;
  fixture.add(base);
  // Yoke arms
  addBox(fixture, 0.035, 0.42, 0.07, bodyMat, -0.15, 0.1, 0, "", false);
  addBox(fixture, 0.035, 0.42, 0.07, bodyMat, 0.15, 0.1, 0, "", false);
  // Head
  const head = new THREE.Group();
  head.rotation.x = tilt;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.34, 12), bodyMat);
  head.add(barrel);
  const lensMat = new THREE.MeshStandardMaterial({
    color: lensColor,
    emissive: lensColor,
    emissiveIntensity: 3.0,
    roughness: 0.2,
  });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 14), lensMat);
  lens.position.y = -0.171;
  lens.rotation.x = Math.PI / 2; // face -Y in head space
  head.add(lens);
  fixture.add(head);
  parent.add(fixture);
  return { fixture, head, lens: lensMat };
}

export function addParCan(
  parent: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
  mats: SharedMaterials,
): ParCanHandle {
  const can = new THREE.Group();
  can.name = "par-can";
  can.position.copy(from);
  const { pan, tilt } = aimAngles(from, to);
  can.rotation.y = pan;
  addBox(can, 0.1, 0.1, 0.1, mats.steel, 0, 0.07, 0, "", false);
  const body = new THREE.Group();
  body.rotation.x = tilt;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.3, 12), mats.fixtureBlack);
  body.add(shell);
  const faceMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: 0.3 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), faceMat);
  face.position.y = -0.151;
  face.rotation.x = Math.PI / 2;
  body.add(face);
  can.add(body);
  parent.add(can);
  return { face: faceMat };
}

const BEAM_UP = new THREE.Vector3(0, 1, 0);
const beamDir = new THREE.Vector3();
const beamMid = new THREE.Vector3();
const beamQuat = new THREE.Quaternion();
const beamScale = new THREE.Vector3();
const beamMatrix = new THREE.Matrix4();
const beamColor = new THREE.Color();

/** Writes one cone's transform and colour; the caller flags instanceMatrix / instanceColor dirty. */
export function setBeamInstance(mesh: THREE.InstancedMesh, index: number, beam: FakeBeam): void {
  beamDir.subVectors(beam.from, beam.to);
  const dist = beamDir.length();
  beamMid.addVectors(beam.from, beam.to).multiplyScalar(0.5);
  beamQuat.setFromUnitVectors(BEAM_UP, beamDir.normalize());
  beamScale.set(beam.radius, dist, beam.radius);
  beamMatrix.compose(beamMid, beamQuat, beamScale);
  mesh.setMatrixAt(index, beamMatrix);
  mesh.setColorAt(index, beamColor.setHex(beam.color));
}

export function createBeamCones(beams: readonly FakeBeam[]): THREE.InstancedMesh {
  const geometry = new THREE.ConeGeometry(1, 1, 10, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, mat, beams.length);
  beams.forEach((beam, idx) => setBeamInstance(mesh, idx, beam));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.name = "light-beams";
  return mesh;
}

export function createHouseLights(
  group: THREE.Group,
  parts: HouseLightParts,
  showOnly: readonly THREE.Object3D[],
): HouseLights {
  const ambient = new THREE.AmbientLight(0xfff2e4, 0);
  const hemisphere = new THREE.HemisphereLight(0xfff6ea, 0x6b5a4a, 0);
  ambient.name = "house-ambient";
  hemisphere.name = "house-hemisphere";
  group.add(ambient, hemisphere);

  let enabled = false;
  const apply = () => {
    parts.panelMaterial.emissiveIntensity = enabled ? 1.7 : 0;
    parts.panelMaterial.color.setHex(enabled ? 0xffffff : 0x2a2a30);
    ambient.intensity = enabled ? 1.9 : 0;
    hemisphere.intensity = enabled ? 2.2 : 0;
    for (const object of showOnly) object.visible = !enabled;
  };
  apply();

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(next: boolean) {
      if (next === enabled) return;
      enabled = next;
      apply();
    },
  };
}

export function addBox(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  meshMaterial: THREE.Material,
  x: number,
  y: number,
  z: number,
  name = "",
  castsShadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), meshMaterial);
  mesh.position.set(x, y, z);
  mesh.castShadow = castsShadow;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

export function material(
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

export function labelPlane(
  text: string,
  background: string,
  color: string,
  width: number,
  height: number,
): THREE.Mesh {
  const aspect = width / height;
  const texW = 1024;
  const texH = Math.max(128, Math.round(texW / aspect));
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: textTexture(text, background, color, texW, texH),
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
}

export function textTexture(
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
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, width * 0.006);
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = text.split("\n");
  const fontSize = Math.floor(Math.min(height * 0.32, (width * 1.6) / Math.max(...lines.map((l) => l.length))));
  ctx.font = `bold ${fontSize}px sans-serif`;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, height / 2 + (index - (lines.length - 1) / 2) * height * 0.38);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createExitSignTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#00c853";
  ctx.fillRect(0, 0, 512, 200);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 484, 172);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 68px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXIT 出路 ➡", 256, 100);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Fire exit door set into a wall. Local +Z points into the room, local +X runs along the wall.
 * `rotationY` orients the local frame: 0 for the back wall, +PI/2 for the left wall, -PI/2 for the right wall.
 */
export function createExitDoor(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  rotationY: number,
  name: string,
  options: { illuminatedSign?: boolean } = {},
): void {
  const exitGroup = new THREE.Group();
  exitGroup.name = name;
  exitGroup.position.set(x, y, z);
  exitGroup.rotation.y = rotationY;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2d2c35, roughness: 0.6 });
  const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.25, 0.15), frameMat);
  frameMesh.position.set(0, 1.125, 0);
  exitGroup.add(frameMesh);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0x222129, roughness: 0.7, metalness: 0.25 });
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.08), doorMat);
  doorMesh.position.set(0, 1.05, 0.04);
  exitGroup.add(doorMesh);

  const trimMat = new THREE.MeshStandardMaterial({ color: 0x484654, roughness: 0.5, metalness: 0.5 });
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.18), trimMat);
  topTrim.position.set(0, 2.24, 0.05);
  const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.18), trimMat);
  leftTrim.position.set(-0.6, 1.15, 0.05);
  const rightTrim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.18), trimMat);
  rightTrim.position.set(0.6, 1.15, 0.05);
  exitGroup.add(topTrim, leftTrim, rightTrim);

  const kickPlateMat = new THREE.MeshStandardMaterial({ color: 0x888895, roughness: 0.35, metalness: 0.75 });
  const kickPlate = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.28, 0.02), kickPlateMat);
  kickPlate.position.set(0, 0.16, 0.09);
  exitGroup.add(kickPlate);

  const barMat = new THREE.MeshStandardMaterial({ color: 0xd82035, roughness: 0.35, metalness: 0.5 });
  const pushBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.07, 0.07), barMat);
  pushBar.position.set(0, 1.0, 0.12);
  exitGroup.add(pushBar);

  if (options.illuminatedSign !== false) {
    // Illuminated EXIT box above the door, protruding into the room
    const signBoxMat = new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.6 });
    const signBox = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 0.22), signBoxMat);
    signBox.position.set(0, 2.62, 0.14);
    exitGroup.add(signBox);

    const signTexture = createExitSignTexture();
    const signFaceMat = new THREE.MeshStandardMaterial({
      map: signTexture,
      emissive: 0x00ff66,
      emissiveMap: signTexture,
      emissiveIntensity: 3.0,
      roughness: 0.1,
    });
    const signFaceFront = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.32), signFaceMat);
    signFaceFront.position.set(0, 2.62, 0.255);
    const signFaceA = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.32), signFaceMat);
    signFaceA.position.set(0.455, 2.62, 0.14);
    signFaceA.rotation.y = Math.PI / 2;
    const signFaceB = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.32), signFaceMat);
    signFaceB.position.set(-0.455, 2.62, 0.14);
    signFaceB.rotation.y = -Math.PI / 2;
    exitGroup.add(signFaceFront, signFaceA, signFaceB);

    const exitGlow = new THREE.PointLight(0x00ff66, 6.0, 4, 1.8);
    exitGlow.position.set(0, 2.5, 0.5);
    exitGroup.add(exitGlow);
  }

  group.add(exitGroup);
}

export function createAtmosphericCrowd(
  group: THREE.Group,
  positions: readonly (readonly [number, number])[],
): THREE.Group[] {
  const glowColors = [0xff2244, 0xffaa00, 0x00ff66, 0x00d5ff, 0xff00cc];
  const hairColors = [0xff3388, 0x00c8ff, 0xffd500, 0xaa44ff, 0x00e599, 0xff4422, 0x222226];
  const outfitColors = [0x1c1b24, 0x3a2542, 0x1a2e45, 0xd4336c, 0x283850, 0xe0e0ea];

  const headGeom = new THREE.SphereGeometry(0.13, 8, 8);
  const hairGeom = new THREE.SphereGeometry(0.145, 8, 8);
  const bodyGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.85, 8);
  const stickGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6);

  const crowd = new THREE.Group();
  crowd.name = "atmospheric-crowd";
  const people: THREE.Group[] = [];

  positions.forEach(([x, z], i) => {
    const person = new THREE.Group();
    person.name = "crowd-dummy";
    person.position.set(x, 0, z);

    const outfitMat = new THREE.MeshStandardMaterial({ color: outfitColors[i % outfitColors.length], roughness: 0.85 });
    const body = new THREE.Mesh(bodyGeom, outfitMat);
    body.position.y = 0.9;
    person.add(body);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd9c2, roughness: 0.7 });
    const head = new THREE.Mesh(headGeom, skinMat);
    head.position.y = 1.45;
    person.add(head);

    const hairColor = hairColors[i % hairColors.length];
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.6, emissive: hairColor, emissiveIntensity: 0.15 });
    const hair = new THREE.Mesh(hairGeom, hairMat);
    hair.position.set(0, 1.48, 0.02);
    person.add(hair);

    const colorHex = glowColors[i % glowColors.length];
    const stickMat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 2.2, roughness: 0.2 });
    const stick = new THREE.Mesh(stickGeom, stickMat);
    stick.position.set(0.24, 1.35 + (i % 3) * 0.1, -0.1);
    stick.rotation.z = -0.35;
    stick.rotation.x = -0.25 + (i % 4) * 0.15;
    person.add(stick);

    crowd.add(person);
    people.push(person);
  });

  group.add(crowd);
  return people;
}

export interface WoodPlankPalette {
  base: string;
  planks: readonly string[];
  grain: string;
  seam: string;
}

export const OAK_PLANKS: WoodPlankPalette = {
  base: "#c8a070",
  planks: ["#c49a68", "#cfa672", "#d6b07c", "#bd9260", "#b48a5a", "#c9a06c"],
  grain: "rgba(90, 55, 25, 0.16)",
  seam: "rgba(60, 35, 15, 0.55)",
};

export function woodPlankTexture(palette: WoodPlankPalette = OAK_PLANKS): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, 1024, 1024);

  const plankHeight = 40;
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let y = 0; y < 1024; y += plankHeight) {
    let x = -Math.floor(rand() * 200);
    while (x < 1024) {
      const plankWidth = 220 + Math.floor(rand() * 200);
      ctx.fillStyle = palette.planks[Math.floor(rand() * palette.planks.length)] ?? palette.base;
      ctx.fillRect(x, y, plankWidth, plankHeight);

      // Grain: many faint wavy lines
      ctx.strokeStyle = palette.grain;
      ctx.lineWidth = 1;
      for (let g = 0; g < 6; g++) {
        const gy = y + 4 + g * 6 + rand() * 3;
        ctx.beginPath();
        ctx.moveTo(x + 2, gy);
        for (let gx = x + 2; gx < x + plankWidth - 2; gx += 30) {
          ctx.lineTo(gx, gy + Math.sin(gx * 0.05 + g) * 1.5);
        }
        ctx.stroke();
      }
      // Bevelled seam
      ctx.strokeStyle = palette.seam;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, plankWidth - 1, plankHeight - 1);
      x += plankWidth;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 6);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function pleatedCurtainTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#0c0a10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 24) {
    const fold = ctx.createLinearGradient(x, 0, x + 24, 0);
    fold.addColorStop(0, "#08070b");
    fold.addColorStop(0.35, "#22202a");
    fold.addColorStop(0.65, "#15141c");
    fold.addColorStop(1, "#060509");
    ctx.fillStyle = fold;
    ctx.fillRect(x, 0, 24, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function speakerGrilleTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#101014";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#2a2a30";
  for (let y = 4; y < 256; y += 8) {
    for (let x = 4 + ((y / 8) % 2) * 4; x < 256; x += 8) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------------------------------------------------------------------------
// FOH desk props shared by every live house: lighting console, sound mixer, operator chair.
// All three face -Z (towards the stage); the operator sits on the +Z side.
// ---------------------------------------------------------------------------

function canvas2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  return [canvas, ctx];
}

function srgbTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Deterministic pseudo-random in [0, 1) so the panel art is stable between builds. */
function hash01(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Twin wide screens of a lighting desk: amber fixture-layout wireframe left, blue programmer grid right. */
function lightingConsoleScreenTexture(): THREE.Texture {
  const made = canvas2d(1024, 320);
  if (!made) return new THREE.Texture();
  const [canvas, ctx] = made;
  ctx.fillStyle = "#07080c";
  ctx.fillRect(0, 0, 1024, 320);

  // Left screen: amber CAD-style plot of the rig, with a channel strip along the bottom
  ctx.fillStyle = "#0a0b10";
  ctx.fillRect(12, 12, 492, 296);
  ctx.strokeStyle = "#f5a623";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 90; i++) {
    const x = 30 + hash01(i) * 450;
    const y = 30 + hash01(i + 100) * 190;
    const w = 6 + hash01(i + 200) * 40;
    const h = 4 + hash01(i + 300) * 26;
    ctx.strokeRect(x, y, w, h);
  }
  ctx.strokeStyle = "#ffb84d";
  ctx.beginPath();
  for (let x = 30; x < 480; x += 8) {
    const y = 120 + Math.sin(x * 0.05) * 30;
    if (x === 30) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let c = 0; c < 12; c++) {
    ctx.fillStyle = "#1a2033";
    ctx.fillRect(24 + c * 40, 240, 34, 56);
    ctx.fillStyle = c % 3 === 0 ? "#f5a623" : "#3f8cff";
    ctx.fillRect(28 + c * 40, 250 + hash01(c + 400) * 30, 26, 10);
  }

  // Right screen: blue cue-grid and a patch of lit amber cells
  ctx.fillStyle = "#0a0b10";
  ctx.fillRect(520, 12, 492, 296);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = "#12243d";
      ctx.fillRect(532 + c * 30, 24 + r * 30, 26, 26);
      if (hash01(r * 8 + c + 500) > 0.55) {
        ctx.fillStyle = hash01(r * 8 + c + 600) > 0.5 ? "#3f8cff" : "#f5a623";
        ctx.fillRect(538 + c * 30, 30 + r * 30, 14, 14);
      }
    }
  }
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = hash01(r * 8 + c + 700) > 0.4 ? "#f5a623" : "#13161f";
      ctx.fillRect(790 + c * 26, 24 + r * 22, 20, 16);
    }
  }
  for (let c = 0; c < 12; c++) {
    ctx.fillStyle = "#12243d";
    ctx.fillRect(532 + c * 40, 262, 34, 40);
    ctx.fillStyle = "#3f8cff";
    ctx.fillRect(538 + c * 40, 272, 22, 6);
  }
  return srgbTexture(canvas);
}

/** Top deck of the lighting desk: key blocks, encoder wheels and a bank of blue / amber backlit faders. */
function lightingConsoleDeckTexture(): THREE.Texture {
  const made = canvas2d(1024, 448);
  if (!made) return new THREE.Texture();
  const [canvas, ctx] = made;
  ctx.fillStyle = "#2b2c33";
  ctx.fillRect(0, 0, 1024, 448);

  // Left: fader bank with glowing strips
  for (let c = 0; c < 15; c++) {
    const x = 24 + c * 30;
    ctx.fillStyle = "#1a1b21";
    ctx.fillRect(x, 60, 20, 200);
    ctx.fillStyle = c % 5 === 4 ? "#ff9f1a" : "#4f7cff";
    ctx.fillRect(x + 4, 70, 12, 180);
    ctx.fillStyle = "#e8e8ec";
    ctx.fillRect(x - 2, 90 + hash01(c + 800) * 140, 24, 14);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = "#3a3b44";
      ctx.fillRect(x, 280 + k * 36, 20, 28);
    }
  }
  // Middle: key grid
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = hash01(r * 8 + c + 900) > 0.85 ? "#4f7cff" : "#3a3b44";
      ctx.fillRect(500 + c * 34, 40 + r * 38, 28, 30);
    }
  }
  // Right: touch strip + encoder rings + more keys
  ctx.fillStyle = "#10141f";
  ctx.fillRect(790, 40, 210, 90);
  ctx.strokeStyle = "#3f8cff";
  ctx.lineWidth = 2;
  ctx.strokeRect(796, 46, 198, 78);
  for (let c = 0; c < 6; c++) {
    for (let r = 0; r < 7; r++) {
      ctx.fillStyle = "#3a3b44";
      ctx.fillRect(790 + c * 35, 150 + r * 38, 28, 30);
    }
  }
  return srgbTexture(canvas);
}

/** Three touch screens of a digital mixer: coloured channel strips, EQ curve, meters and a clock. */
function soundMixerScreenTexture(): THREE.Texture {
  const made = canvas2d(1024, 200);
  if (!made) return new THREE.Texture();
  const [canvas, ctx] = made;
  ctx.fillStyle = "#0a0a0d";
  ctx.fillRect(0, 0, 1024, 200);
  const stripColors = ["#e33b8b", "#f5a623", "#3f8cff", "#41d38b", "#9b5cff", "#f26b3a"];

  const channelStrips = (x0: number) => {
    for (let c = 0; c < 12; c++) {
      const x = x0 + c * 30;
      ctx.fillStyle = stripColors[c % stripColors.length];
      ctx.fillRect(x, 14, 26, 10);
      ctx.fillStyle = "#171a24";
      ctx.fillRect(x, 28, 26, 150);
      ctx.fillStyle = "#3f8cff";
      ctx.fillRect(x + 4, 60 + hash01(c + 1000) * 70, 18, 4);
      ctx.fillStyle = "#41d38b";
      ctx.fillRect(x + 8, 90 + hash01(c + 1100) * 60, 10, 80 - hash01(c + 1100) * 60);
    }
  };
  ctx.fillStyle = "#101219";
  ctx.fillRect(8, 6, 372, 188);
  channelStrips(16);

  // Middle: selected channel with EQ curve
  ctx.fillStyle = "#101219";
  ctx.fillRect(390, 6, 372, 188);
  ctx.fillStyle = "#3f8cff";
  ctx.fillRect(398, 14, 60, 12);
  ctx.strokeStyle = "#24304a";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(398, 40 + i * 24);
    ctx.lineTo(754, 40 + i * 24);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f5a623";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 398; x <= 754; x += 6) {
    const t = (x - 398) / 356;
    const y = 110 - Math.sin(t * Math.PI * 2.2) * 28 - Math.exp(-((t - 0.7) ** 2) * 40) * 40;
    if (x === 398) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (const [t, color] of [[0.15, "#e33b8b"], [0.45, "#41d38b"], [0.7, "#3f8cff"], [0.9, "#f5a623"]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(398 + t * 356, 108 - Math.sin(t * Math.PI * 2.2) * 28, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Right: utility screen with clock and user keys
  ctx.fillStyle = "#101219";
  ctx.fillRect(772, 6, 244, 188);
  ctx.fillStyle = "#e8e8ec";
  ctx.font = "bold 34px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("19:07:03", 894, 46);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = stripColors[(r * 4 + c) % stripColors.length];
      ctx.fillRect(784 + c * 56, 84 + r * 34, 48, 26);
    }
  }
  return srgbTexture(canvas);
}

/** Control surface of the mixer: fader slots, SEL / ON key rows, encoder knobs and the brand strip. */
function soundMixerDeckTexture(): THREE.Texture {
  const made = canvas2d(1024, 340);
  if (!made) return new THREE.Texture();
  const [canvas, ctx] = made;
  ctx.fillStyle = "#16161a";
  ctx.fillRect(0, 0, 1024, 340);
  ctx.fillStyle = "#e8e8ec";
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("YAMAHA", 16, 22);
  ctx.textAlign = "right";
  ctx.fillText("DM7", 1008, 22);

  const bankX = [16, 366, 716];
  bankX.forEach((x0, bank) => {
    for (let c = 0; c < 8; c++) {
      const x = x0 + c * 38;
      // Knob, SEL, ON keys, then the fader slot
      ctx.fillStyle = "#2c2c33";
      ctx.beginPath();
      ctx.arc(x + 14, 58, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hash01(bank * 8 + c + 1200) > 0.6 ? "#41d38b" : "#2c2c33";
      ctx.fillRect(x + 3, 78, 22, 14);
      ctx.fillStyle = "#f26b3a";
      ctx.fillRect(x + 3, 98, 22, 14);
      ctx.fillStyle = "#0b0b0e";
      ctx.fillRect(x + 12, 124, 4, 196);
      for (let tick = 0; tick < 10; tick++) {
        ctx.fillStyle = "#3a3a42";
        ctx.fillRect(x + 20, 128 + tick * 20, 6, 2);
      }
    }
  });
  // Master section between banks: coloured user keys
  const keyColors = ["#3f8cff", "#e33b8b", "#f5a623", "#41d38b", "#9b5cff"];
  for (const x0 of [324, 674]) {
    for (let r = 0; r < 6; r++) {
      ctx.fillStyle = keyColors[r % keyColors.length];
      ctx.fillRect(x0, 60 + r * 40, 30, 24);
    }
  }
  return srgbTexture(canvas);
}

/** Dark grey lighting desk (twin wide screens on a raised rear panel, encoders, backlit faders). Width 1.2m. */
export function buildLightingConsole(): THREE.Group {
  const desk = new THREE.Group();
  desk.name = "lighting-console";
  const shell = new THREE.MeshStandardMaterial({ color: 0x2a2b31, roughness: 0.55, metalness: 0.35 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.5, metalness: 0.5 });

  // Low wedge body with the deck art on top
  addBox(desk, 1.2, 0.1, 0.55, shell, 0, 0.05, 0.05);
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(1.14, 0.5),
    new THREE.MeshStandardMaterial({ map: lightingConsoleDeckTexture(), roughness: 0.6, emissive: 0x1b2a55, emissiveIntensity: 0.35 }),
  );
  deck.name = "console-deck";
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.101, 0.07);
  desk.add(deck);
  // Five encoder wheels in the centre-right of the deck
  const encoderGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16);
  for (let i = 0; i < 5; i++) {
    const encoder = new THREE.Mesh(encoderGeo, trim);
    encoder.name = "console-encoder";
    encoder.position.set(0.16 + i * 0.09, 0.11, -0.06);
    desk.add(encoder);
  }
  // Raised rear housing carrying the twin-screen panel, leaning back slightly
  addBox(desk, 1.2, 0.08, 0.22, shell, 0, 0.14, -0.28);
  const panel = new THREE.Group();
  panel.position.set(0, 0.18, -0.3);
  panel.rotation.x = -0.18;
  addBox(panel, 1.2, 0.42, 0.04, trim, 0, 0.21, 0);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.14, 0.36),
    new THREE.MeshStandardMaterial({ map: lightingConsoleScreenTexture(), emissive: 0xffffff, emissiveMap: lightingConsoleScreenTexture(), emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  screen.name = "console-screen";
  screen.position.set(0, 0.21, 0.021);
  panel.add(screen);
  desk.add(panel);
  // "Compact" badge on the -X side face
  const badge = labelPlane("Compact", "#2a2b31", "#ffffff", 0.32, 0.08);
  badge.position.set(-0.601, 0.06, 0.08);
  badge.rotation.y = -Math.PI / 2;
  desk.add(badge);
  return desk;
}

/** Flat black digital mixer: three screens on the far edge, 24 white-cap faders towards the operator. Width 1.1m. */
export function buildSoundMixer(): THREE.Group {
  const mixer = new THREE.Group();
  mixer.name = "sound-mixer";
  const shell = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.5, metalness: 0.4 });

  addBox(mixer, 1.1, 0.1, 0.6, shell, 0, 0.05, 0);
  const faders = new THREE.Mesh(
    new THREE.PlaneGeometry(1.04, 0.34),
    new THREE.MeshStandardMaterial({ map: soundMixerDeckTexture(), roughness: 0.6, emissive: 0x222226, emissiveIntensity: 0.4 }),
  );
  faders.name = "mixer-faders";
  faders.rotation.x = -Math.PI / 2;
  faders.position.set(0, 0.101, 0.11);
  mixer.add(faders);
  // Raised screen ledge along the far (-Z) edge
  addBox(mixer, 1.1, 0.06, 0.24, shell, 0, 0.13, -0.18);
  const screens = new THREE.Mesh(
    new THREE.PlaneGeometry(1.04, 0.2),
    new THREE.MeshStandardMaterial({ map: soundMixerScreenTexture(), emissive: 0xffffff, emissiveMap: soundMixerScreenTexture(), emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  screens.name = "mixer-screen";
  screens.rotation.x = -Math.PI / 2 + 0.25;
  screens.position.set(0, 0.165, -0.18);
  mixer.add(screens);
  // 24 white fader caps in three banks of eight, matching the deck texture columns
  const capGeo = new THREE.BoxGeometry(0.02, 0.014, 0.03);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f2, roughness: 0.5 });
  for (let bank = 0; bank < 3; bank++) {
    for (let c = 0; c < 8; c++) {
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.name = "fader-cap";
      const x = -0.505 + (bank * 350 + 16 + c * 38 + 14) / 1024 * 1.04;
      cap.position.set(x, 0.108, 0.1 + hash01(bank * 8 + c + 1300) * 0.16);
      mixer.add(cap);
    }
  }
  return mixer;
}

/** Seat-top height of an FOH chair; matches the pelvis drop baked into the idle sit pose. */
export const FOH_CHAIR_SEAT_HEIGHT = 0.44;

/** Black operator chair on a pedestal base; the backrest is on +Z so the sitter faces the stage. */
export function buildFohChair(): THREE.Group {
  const chair = new THREE.Group();
  chair.name = "foh-chair";
  const fabric = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.85 });
  const steel = material(0x60636d, 0.35, 0.7);
  addBox(chair, 0.5, 0.06, 0.5, fabric, 0, FOH_CHAIR_SEAT_HEIGHT - 0.03, 0, "seat");
  addBox(chair, 0.5, 0.46, 0.06, fabric, 0, FOH_CHAIR_SEAT_HEIGHT + 0.23, 0.24, "backrest");
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, FOH_CHAIR_SEAT_HEIGHT - 0.09, 10), steel);
  post.position.y = (FOH_CHAIR_SEAT_HEIGHT - 0.09) / 2 + 0.03;
  chair.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 12), steel);
  base.position.y = 0.015;
  chair.add(base);
  return chair;
}

export function createFridgeTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#15151b";
  ctx.fillRect(0, 0, 512, 512);
  const shelfY = [90, 180, 270, 360, 445];
  const canColors = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];
  for (const y of shelfY) {
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(20, y, 472, 8);
    for (let i = 0; i < 15; i++) {
      const cx = 30 + i * 31;
      ctx.fillStyle = canColors[(i + y) % canColors.length];
      ctx.fillRect(cx, y - 55, 24, 54);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(cx + 2, y - 58, 20, 5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function setInstanceTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  transform: InstanceTransform,
): void {
  const [x, y, z, rotX, rotY, rotZ, scaleX, scaleY, scaleZ] = transform;
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ)),
    new THREE.Vector3(scaleX, scaleY, scaleZ),
  );
  mesh.setMatrixAt(index, matrix);
}
