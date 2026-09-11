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

export function addMovingHead(
  parent: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  lensColor: number,
  mats: SharedMaterials,
): void {
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
}

export function addParCan(
  parent: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
  mats: SharedMaterials,
): void {
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
  const up = new THREE.Vector3(0, 1, 0);
  beams.forEach((beam, idx) => {
    const dir = new THREE.Vector3().subVectors(beam.from, beam.to);
    const dist = dir.length();
    const matrix = new THREE.Matrix4();
    matrix.compose(
      new THREE.Vector3().addVectors(beam.from, beam.to).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()),
      new THREE.Vector3(beam.radius, dist, beam.radius),
    );
    mesh.setMatrixAt(idx, matrix);
    mesh.setColorAt(idx, new THREE.Color(beam.color));
  });
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

export function consoleMixerTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#1e1e24";
  ctx.fillRect(0, 0, 512, 256);
  for (let c = 0; c < 24; c++) {
    const x = 20 + c * 20;
    ctx.fillStyle = "#0e0e12";
    ctx.fillRect(x, 40, 6, 170);
    const knobY = 80 + ((c * 17) % 90);
    ctx.fillStyle = c % 4 === 0 ? "#ff2f7d" : "#00e5ff";
    ctx.fillRect(x - 4, knobY, 14, 12);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
