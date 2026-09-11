import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { PersonRig } from "./createCharacter";
import { addOutline } from "./outline";

export type IdolHairStyle =
  | "twintails"
  | "bob"
  | "ponytail"
  | "buns"
  | "long"
  | "sidebraid"
  | "waves"
  | "pixie"
  | "sidepony"
  | "braids"
  | "curls"
  | "hime";

export type IdolOutfit =
  | "classic"
  | "sailor"
  | "sport"
  | "ballet"
  | "celestial"
  | "cottage"
  | "rock"
  | "future"
  | "bubble"
  | "academy"
  | "retro"
  | "royal";

export type IdolSleeve = "puff" | "short" | "bell" | "long" | "cap";

export interface IdolMember {
  name: string;
  hairStyle: IdolHairStyle;
  outfit: IdolOutfit;
  sleeve: IdolSleeve;
  main: string;
  accent: string;
  trim: string;
  hair: string;
  hairLight: string;
  skin: string;
  socks: string;
  shoes: string;
  height: number;
}

const PROPORTIONS = {
  headUnit: 0.4,
  headCount: 4.55,
  shoulderWidth: 0.38,
  hipWidth: 0.22,
  upperArm: 0.265,
  forearm: 0.235,
  thigh: 0.43,
  shin: 0.4,
  ankleHeight: 0.08,
  torsoWidth: 0.35,
  torsoDepth: 0.215,
};

/** Compress the original body, not the head. */
const CHIBI = {
  bodyWidth: 0.86,
  bodyHeight: 0.7,
};

interface BodyMeasure {
  height: number;
  pelvisY: number;
  headY: number;
  neckY: number;
  torsoHeight: number;
  chestY: number;
  shoulderX: number;
  hipX: number;
  upperArm: number;
  forearm: number;
  thigh: number;
  shin: number;
  ankleHeight: number;
}

function measurements(): BodyMeasure {
  const height = PROPORTIONS.headUnit * PROPORTIONS.headCount;
  const pelvisY = PROPORTIONS.ankleHeight + PROPORTIONS.thigh + PROPORTIONS.shin;
  const headY = height - PROPORTIONS.headUnit * 0.5;
  const neckY = headY - PROPORTIONS.headUnit * 0.46;
  const torsoHeight = neckY - pelvisY;
  return {
    height,
    pelvisY,
    headY,
    neckY,
    torsoHeight,
    chestY: pelvisY + torsoHeight * 0.5,
    shoulderX: PROPORTIONS.shoulderWidth * 0.5,
    hipX: PROPORTIONS.hipWidth * 0.5,
    upperArm: PROPORTIONS.upperArm,
    forearm: PROPORTIONS.forearm,
    thigh: PROPORTIONS.thigh,
    shin: PROPORTIONS.shin,
    ankleHeight: PROPORTIONS.ankleHeight,
  };
}

const B = measurements();

const sphereGeometry = new THREE.SphereGeometry(1, 20, 14);
const geometryCache = new Map<string, THREE.BufferGeometry>();
const materialCache = new Map<string, THREE.MeshStandardMaterial>();

const SKIP_OUTLINE = new Set([
  "shadow",
  "eye",
  "eye-highlight",
  "cheek",
  "smile",
  "eyebrow",
  "glasses",
  "earring",
  "pearl",
  "star",
  "flower",
  "button",
  "cream-button",
  "stud",
  "polka-dot",
  "lace",
  "strap-button",
  "beret-stem",
  "gold-hairpin",
  "bow-knot",
  "bow-ribbon",
  "bow-loop",
]);

interface IdolMaterials {
  main: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  hairLight: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  socks: THREE.MeshStandardMaterial;
  shoes: THREE.MeshStandardMaterial;
}

/**
 * Slim clay stage idol on the V2 PersonRig. Atlas characters face +Z so the
 * existing stage line-up does not need a yaw flip.
 */
export function createChibiIdol(member: IdolMember, scale = 1): PersonRig {
  const m: IdolMaterials = {
    main: clay(member.main),
    accent: clay(member.accent),
    trim: clay(member.trim),
    hair: clay(member.hair),
    hairLight: clay(member.hairLight),
    skin: clay(member.skin),
    socks: clay(member.socks),
    shoes: clay(member.shoes),
  };

  const group = new THREE.Group();
  group.name = member.name;
  group.scale.set(
    member.height * CHIBI.bodyWidth * scale,
    member.height * CHIBI.bodyHeight * scale,
    member.height * CHIBI.bodyWidth * scale,
  );

  const body = makeJoint(group, "root");
  const pelvis = makeJoint(body, "pelvis", 0, B.pelvisY, 0);
  const chest = makeJoint(pelvis, "chest", 0, B.chestY - B.pelvisY, 0);
  const neck = makeJoint(chest, "neck", 0, B.neckY - B.chestY, 0);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 16),
    new THREE.MeshBasicMaterial({
      color: 0x050307,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  shadow.name = "shadow";
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  addBodice(chest, m, member);
  addSkirt(pelvis, m, member);
  cylinder(neck, m.skin, [0, 0.005, 0], 0.045, 0.048, 0.115, "neck");

  const headGeometry = new THREE.SphereGeometry(1, 20, 14);
  headGeometry.scale(0.185, 0.2, 0.167);
  const head = new THREE.Mesh(headGeometry, m.skin);
  head.name = "head";
  head.position.set(0, B.headY - B.neckY, 0);
  head.scale.set(1 / CHIBI.bodyWidth, 1 / CHIBI.bodyHeight, 1 / CHIBI.bodyWidth);
  neck.add(head);
  addFace(head, m, member);
  addHair(head, m, member);

  const leftArm = createArm(chest, -1, m, member);
  const rightArm = createArm(chest, 1, m, member);
  const leftLeg = createLeg(pelvis, -1, m, member);
  const rightLeg = createLeg(pelvis, 1, m, member);

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object !== shadow;
    object.receiveShadow = object !== shadow;
  });

  const outlines: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.name === "outline" || SKIP_OUTLINE.has(object.name)) return;
    outlines.push(addOutline(object));
  });

  return {
    rigVersion: 2,
    pelvisRestY: B.pelvisY,
    group,
    body,
    pelvis,
    chest,
    neck,
    head,
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftUpperArm: leftArm.upperArm,
    rightUpperArm: rightArm.upperArm,
    leftElbow: leftArm.elbow,
    rightElbow: rightArm.elbow,
    leftArm: leftArm.shoulder,
    rightArm: rightArm.shoulder,
    leftForearm: leftArm.elbow,
    rightForearm: rightArm.elbow,
    leftHand: leftArm.hand,
    rightHand: rightArm.hand,
    leftHip: leftLeg.hip,
    rightHip: rightLeg.hip,
    leftUpperLeg: leftLeg.upperLeg,
    rightUpperLeg: rightLeg.upperLeg,
    leftKnee: leftLeg.knee,
    rightKnee: rightLeg.knee,
    leftLowerLeg: leftLeg.lowerLeg,
    rightLowerLeg: rightLeg.lowerLeg,
    leftAnkle: leftLeg.ankle,
    rightAnkle: rightLeg.ankle,
    leftFootPivot: leftLeg.footPivot,
    rightFootPivot: rightLeg.footPivot,
    leftLeg: leftLeg.hip,
    rightLeg: rightLeg.hip,
    leftFoot: leftLeg.foot,
    rightFoot: rightLeg.foot,
    glowStick: null,
    outlines,
  };
}

function clay(color: string, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}:${metalness}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: metalness ? 0.48 : 0.84,
    metalness,
  });
  materialCache.set(key, material);
  return material;
}

const cream = clay("#fff1df");
const ink = clay("#352b31");
const blush = clay("#d99087");
const gold = clay("#d9b66e", 0.22);

function cachedGeometry(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const geometry = build();
  geometryCache.set(key, geometry);
  return geometry;
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number] = [0, 0, 0],
  name = "",
): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.name = name;
  parent.add(object);
  return object;
}

function ellipsoid(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  name = "",
): THREE.Mesh {
  const object = mesh(parent, sphereGeometry, material, position, name);
  object.scale.set(...scale);
  return object;
}

function box(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: readonly [number, number, number],
  size: readonly [number, number, number],
  radius = 0.025,
  name = "",
): THREE.Mesh {
  const cap = Math.min(radius, Math.min(...size) * 0.49);
  const geometry = cachedGeometry(`box:${size.join(",")}:${cap}`, () => new RoundedBoxGeometry(...size, 2, cap));
  return mesh(parent, geometry, material, position, name);
}

function cylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: readonly [number, number, number],
  top: number,
  bottom: number,
  height: number,
  name = "",
  segments = 24,
): THREE.Mesh {
  const geometry = cachedGeometry(
    `cylinder:${top}:${bottom}:${height}:${segments}`,
    () => new THREE.CylinderGeometry(top, bottom, height, segments),
  );
  return mesh(parent, geometry, material, position, name);
}

function torus(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: readonly [number, number, number],
  radius: number,
  tube: number,
  name = "",
): THREE.Mesh {
  const geometry = cachedGeometry(`torus:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 6, 28));
  return mesh(parent, geometry, material, position, name);
}

function makeJoint(parent: THREE.Object3D, name: string, x = 0, y = 0, z = 0): THREE.Group {
  const joint = new THREE.Group();
  joint.name = name;
  joint.position.set(x, y, z);
  parent.add(joint);
  return joint;
}

function makeGroup(
  parent: THREE.Object3D,
  position: readonly [number, number, number] = [0, 0, 0],
  name = "",
): THREE.Group {
  const object = new THREE.Group();
  object.name = name;
  object.position.set(...position);
  parent.add(object);
  return object;
}

function lineTube(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: ReadonlyArray<readonly [number, number, number]>,
  radius = 0.008,
  name = "",
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return mesh(parent, new THREE.TubeGeometry(curve, 18, radius, 7, false), material, [0, 0, 0], name);
}

function hairStrand(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: ReadonlyArray<readonly [number, number, number]>,
  radius: number,
  tip = 0.35,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const segments = 20;
  const radial = 8;
  const geometry = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const positions = geometry.attributes.position;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = curve.getPointAt(t);
    const width = radius * (1 - (1 - tip) * t) * (0.94 + Math.sin(t * Math.PI) * 0.12);
    for (let j = 0; j <= radial; j++) {
      const index = i * (radial + 1) + j;
      positions.setXYZ(
        index,
        center.x + (positions.getX(index) - center.x) * width,
        center.y + (positions.getY(index) - center.y) * width,
        center.z + (positions.getZ(index) - center.z) * width,
      );
    }
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return mesh(parent, geometry, material, [0, 0, 0], "hair-strand");
}

function bow(parent: THREE.Object3D, material: THREE.Material, position: readonly [number, number, number], size = 0.06): THREE.Group {
  const pivot = makeGroup(parent, position, "bow");
  for (const side of [-1, 1]) {
    const loop = ellipsoid(pivot, material, [side * size * 0.6, 0, 0], [size * 0.72, size * 0.43, size * 0.25], "bow-loop");
    loop.rotation.z = side * 0.35;
    const ribbon = box(
      pivot,
      material,
      [side * size * 0.32, -size * 0.68, -0.005],
      [size * 0.37, size * 0.88, size * 0.15],
      0.006,
      "bow-ribbon",
    );
    ribbon.rotation.z = side * -0.23;
  }
  ellipsoid(pivot, material, [0, 0, 0.012], [size * 0.25, size * 0.3, size * 0.27], "bow-knot");
  return pivot;
}

function star(parent: THREE.Object3D, material: THREE.Material, position: readonly [number, number, number], radius = 0.035): THREE.Mesh {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? radius * 0.45 : radius;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = cachedGeometry(`star:${radius}`, () =>
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.009,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.002,
      bevelThickness: 0.002,
    }),
  );
  return mesh(parent, geometry, material, position, "star");
}

function flower(parent: THREE.Object3D, material: THREE.Material, position: readonly [number, number, number], radius = 0.034): THREE.Group {
  const pivot = makeGroup(parent, position, "flower");
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    ellipsoid(pivot, material, [Math.cos(a) * radius * 0.6, Math.sin(a) * radius * 0.6, 0], [
      radius * 0.47,
      radius * 0.47,
      radius * 0.22,
    ]);
  }
  ellipsoid(pivot, gold, [0, 0, 0.009], [radius * 0.3, radius * 0.3, radius * 0.22]);
  return pivot;
}

function skirt(
  parent: THREE.Object3D,
  material: THREE.Material,
  options: {
    top?: number;
    bottom?: number;
    length?: number;
    y?: number;
    pleat?: number;
    count?: number;
    slant?: number;
    zScale?: number;
  } = {},
): THREE.Mesh {
  const { top = 0.15, bottom = 0.25, length = 0.29, y = 0.01, pleat = 0.01, count = 12, slant = 0, zScale = 0.78 } =
    options;
  const radial = 72;
  const rings = 7;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      const fold = Math.cos(a * count) * pleat * (0.2 + t * 0.8);
      const r = top + (bottom - top) * t + fold;
      const drop = length + slant * Math.cos(a);
      positions.push(Math.cos(a) * r, y - drop * t, Math.sin(a) * r * zScale);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * (radial + 1) + i;
      const b = a + radial + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const cloth = material.clone();
  cloth.side = THREE.DoubleSide;
  return mesh(parent, geometry, cloth, [0, 0, 0], "skirt");
}

function hem(
  parent: THREE.Object3D,
  material: THREE.Material,
  y: number,
  radius: number,
  zScale = 0.78,
  thickness = 0.011,
): THREE.Mesh {
  const object = torus(parent, material, [0, y, 0], radius, thickness, "hem");
  object.rotation.x = Math.PI / 2;
  object.scale.y = zScale;
  return object;
}

function addFace(head: THREE.Mesh, m: IdolMaterials, d: IdolMember): void {
  for (const side of [-1, 1]) {
    ellipsoid(head, m.skin, [side * 0.18, -0.008, 0], [0.033, 0.047, 0.032], "ear");
    ellipsoid(head, ink, [side * 0.06, 0.004, 0.159], [0.0135, 0.022, 0.009], "eye");
    ellipsoid(head, cream, [side * 0.06 - 0.004, 0.012, 0.167], [0.0045, 0.0055, 0.003], "eye-highlight");
    const cheek = ellipsoid(head, blush, [side * 0.104, -0.044, 0.141], [0.028, 0.012, 0.007], "cheek");
    cheek.rotation.y = side * 0.4;
    lineTube(
      head,
      m.hair,
      [
        [side * 0.042, 0.043, 0.155],
        [side * 0.06, 0.048, 0.158],
        [side * 0.077, 0.044, 0.15],
      ],
      0.004,
      "eyebrow",
    );
  }
  ellipsoid(head, m.skin, [0, -0.02, 0.169], [0.016, 0.014, 0.016], "nose");
  lineTube(
    head,
    clay("#995e59"),
    [
      [-0.019, -0.069, 0.154],
      [0, -0.075, 0.158],
      [0.019, -0.069, 0.154],
    ],
    0.0035,
    "smile",
  );

  if (d.outfit === "academy") {
    for (const side of [-1, 1]) {
      torus(head, m.trim, [side * 0.062, 0.002, 0.176], 0.033, 0.004, "glasses");
    }
    lineTube(
      head,
      m.trim,
      [
        [-0.028, 0.006, 0.18],
        [0, 0.011, 0.184],
        [0.028, 0.006, 0.18],
      ],
      0.0035,
      "glasses",
    );
  }

  if (d.outfit === "celestial" || d.outfit === "royal" || d.outfit === "rock") {
    for (const side of [-1, 1]) {
      ellipsoid(head, gold, [side * 0.189, -0.045, 0.015], [0.012, 0.018, 0.009], "earring");
    }
  }
}

function addHair(head: THREE.Mesh, m: IdolMaterials, d: IdolMember): void {
  const capGeometry = cachedGeometry(
    "hair-cap",
    () => new THREE.SphereGeometry(1, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.53),
  );
  const cap = mesh(head, capGeometry, m.hair, [0, 0.035, -0.013], "hair-cap");
  cap.scale.set(0.202, 0.187, 0.183);
  ellipsoid(head, m.hair, [0, 0.018, -0.104], [0.178, 0.173, 0.094], "back-of-hair");

  const fringeCount = d.hairStyle === "pixie" ? 4 : 5;
  for (let i = 0; i < fringeCount; i++) {
    const x = (i - (fringeCount - 1) / 2) * 0.059;
    const blunt = d.hairStyle === "hime";
    const fringe = ellipsoid(
      head,
      i % 2 ? m.hairLight : m.hair,
      [x, blunt ? 0.116 : 0.139 - Math.abs(x) * 0.16, 0.13],
      [0.047, blunt ? 0.066 : 0.08, 0.053],
      "fringe",
    );
    fringe.rotation.z = blunt ? 0 : d.hairStyle === "pixie" ? -0.55 : -x * 2.5;
  }

  function hairPivot(name: string, position: readonly [number, number, number], tip: readonly [number, number, number]): THREE.Group {
    const joint = makeJoint(head, name, ...position);
    makeJoint(joint, `${name}-tip`, ...tip);
    return joint;
  }

  function braid(parent: THREE.Object3D, length = 0.39, radius = 0.043): void {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const r = radius * (1 - t * 0.45);
      for (const side of [-1, 1]) {
        const lump = ellipsoid(
          parent,
          (i + (side > 0 ? 1 : 0)) % 2 ? m.hair : m.hairLight,
          [side * r * 0.32, -t * length, Math.sin(i * 1.7) * 0.008],
          [r * 0.75, (length / count) * 0.8, r * 0.8],
          "braid-link",
        );
        lump.rotation.z = side * 0.5;
      }
    }
    bow(parent, m.accent, [0, -length, 0.03], 0.03);
  }

  function sideLocks(length = 0.19, width = 0.04): void {
    for (const side of [-1, 1]) {
      ellipsoid(head, m.hair, [side * 0.173, -0.02, 0.002], [width, length, 0.103], "side-lock");
    }
  }

  switch (d.hairStyle) {
    case "twintails": {
      sideLocks(0.12, 0.035);
      for (const side of [-1, 1]) {
        const pivot = hairPivot(`tail-${side}`, [side * 0.188, 0.09, -0.032], [side * 0.06, -0.43, -0.015]);
        hairStrand(
          pivot,
          m.hair,
          [
            [0, 0, 0],
            [side * 0.09, -0.105, -0.018],
            [side * 0.1, -0.27, -0.025],
            [side * 0.048, -0.425, 0.01],
          ],
          0.073,
          0.35,
        );
        hairStrand(
          pivot,
          m.hairLight,
          [
            [side * 0.023, -0.02, 0.047],
            [side * 0.07, -0.16, 0.044],
            [side * 0.05, -0.34, 0.035],
          ],
          0.021,
          0.2,
        );
        bow(head, m.accent, [side * 0.2, 0.1, 0.044], 0.045);
      }
      break;
    }
    case "bob": {
      sideLocks(0.185, 0.05);
      ellipsoid(head, m.hair, [0, -0.055, -0.117], [0.188, 0.19, 0.096], "bob-back");
      box(head, m.accent, [-0.148, 0.092, 0.137], [0.064, 0.016, 0.018], 0.006, "barrette").rotation.z = 0.35;
      break;
    }
    case "ponytail": {
      sideLocks(0.095, 0.027);
      const pivot = hairPivot("high-ponytail", [0, 0.177, -0.1], [0.08, -0.37, -0.11]);
      hairStrand(
        pivot,
        m.hair,
        [
          [0, 0, 0],
          [0.025, 0.04, -0.11],
          [0.095, -0.12, -0.15],
          [0.11, -0.32, -0.085],
          [0.065, -0.4, -0.015],
        ],
        0.086,
        0.25,
      );
      bow(head, m.trim, [0.035, 0.19, -0.07], 0.055);
      break;
    }
    case "buns": {
      sideLocks(0.135, 0.028);
      for (const side of [-1, 1]) {
        ellipsoid(head, m.hair, [side * 0.166, 0.175, -0.033], [0.09, 0.087, 0.083], "space-bun");
        const band = torus(head, m.hairLight, [side * 0.166, 0.178, -0.018], 0.067, 0.014);
        band.rotation.y = side * 0.4;
        for (let j = 0; j < 3; j++) {
          ellipsoid(
            head,
            m.accent,
            [side * (0.137 + j * 0.019), 0.223 - j * 0.006, 0.032],
            [0.011, 0.011, 0.01],
            "pearl",
          );
        }
      }
      break;
    }
    case "long": {
      for (let i = -2; i <= 2; i++) {
        hairStrand(
          head,
          i % 2 ? m.hair : m.hairLight,
          [
            [i * 0.062, 0.07, -0.115],
            [i * 0.075, -0.17, -0.157],
            [i * 0.085, -0.43, -0.16],
            [i * 0.075, -0.65, -0.12],
          ],
          0.057,
          0.65,
        );
      }
      sideLocks(0.21, 0.031);
      for (let i = -1; i <= 1; i++) {
        star(head, gold, [i * 0.065, 0.205 + (i === 0 ? 0.036 : 0), 0.086], i === 0 ? 0.035 : 0.025);
      }
      break;
    }
    case "sidebraid": {
      sideLocks(0.14, 0.034);
      const pivot = hairPivot("side-braid", [-0.173, -0.08, 0.03], [-0.035, -0.43, 0.015]);
      pivot.rotation.z = -0.08;
      braid(pivot, 0.43, 0.055);
      flower(head, m.accent, [-0.165, 0.066, 0.135], 0.04);
      break;
    }
    case "waves": {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          hairStrand(
            head,
            i % 2 ? m.hairLight : m.hair,
            [
              [side * (0.12 + i * 0.02), 0.1, -0.04 - i * 0.035],
              [side * (0.2 + i * 0.016), -0.055, -0.01 - i * 0.035],
              [side * (0.16 + i * 0.018), -0.18, 0.015 - i * 0.035],
              [side * (0.21 + i * 0.008), -0.3, 0.03 - i * 0.035],
            ],
            0.048,
            0.6,
          );
        }
      }
      star(head, gold, [0.155, 0.082, 0.132], 0.026);
      break;
    }
    case "pixie": {
      for (const side of [-1, 1]) {
        ellipsoid(head, m.hair, [side * 0.171, 0.03, -0.012], [0.035, 0.088, 0.085], "short-side");
      }
      for (let i = 0; i < 3; i++) {
        const lock = ellipsoid(
          head,
          m.hairLight,
          [-0.08 + i * 0.045, 0.167 + i * 0.005, 0.048],
          [0.057, 0.101, 0.085],
          "swept-crown",
        );
        lock.rotation.z = -0.72;
      }
      box(head, m.trim, [0.192, 0.01, 0], [0.028, 0.054, 0.043], 0.012, "ear-piece");
      break;
    }
    case "sidepony": {
      sideLocks(0.12, 0.032);
      const pivot = hairPivot("side-ponytail", [0.18, 0.115, -0.025], [0.125, -0.33, 0.01]);
      hairStrand(
        pivot,
        m.hair,
        [
          [0, 0, 0],
          [0.12, -0.035, -0.035],
          [0.16, -0.19, -0.015],
          [0.1, -0.35, 0.035],
        ],
        0.09,
        0.25,
      );
      hairStrand(
        pivot,
        m.hairLight,
        [
          [0.03, 0, 0.05],
          [0.15, -0.12, 0.047],
          [0.1, -0.3, 0.065],
        ],
        0.026,
        0.2,
      );
      bow(head, m.accent, [0.197, 0.12, 0.047], 0.055);
      break;
    }
    case "braids": {
      sideLocks(0.115, 0.031);
      for (const side of [-1, 1]) {
        const pivot = hairPivot(`braid-${side}`, [side * 0.162, -0.1, 0.005], [side * 0.015, -0.35, 0]);
        braid(pivot, 0.35, 0.043);
      }
      break;
    }
    case "curls": {
      for (let i = 0; i < 13; i++) {
        const a = (i / 12) * Math.PI;
        ellipsoid(
          head,
          i % 2 ? m.hairLight : m.hair,
          [Math.cos(a) * 0.179, 0.052 - Math.sin(a) * 0.19, -0.045],
          [0.073, 0.078, 0.099],
          "curl",
        );
      }
      for (const side of [-1, 1]) {
        ellipsoid(head, m.hairLight, [side * 0.178, -0.055, 0.045], [0.054, 0.066, 0.066], "front-curl");
      }
      const beret = ellipsoid(head, m.main, [-0.045, 0.212, -0.008], [0.159, 0.048, 0.133], "beret");
      beret.rotation.z = 0.2;
      ellipsoid(head, m.trim, [-0.05, 0.26, -0.01], [0.014, 0.022, 0.014], "beret-stem");
      break;
    }
    case "hime": {
      box(head, m.hair, [0, -0.19, -0.135], [0.338, 0.54, 0.115], 0.048, "long-straight-back");
      for (const side of [-1, 1]) {
        box(head, m.hair, [side * 0.165, -0.055, 0.061], [0.066, 0.25, 0.1], 0.021, "hime-side-lock");
        box(head, gold, [side * 0.174, 0.084, 0.133], [0.016, 0.084, 0.014], 0.006, "gold-hairpin").rotation.z =
          side * 0.4;
      }
      break;
    }
  }
}

function addBodice(chest: THREE.Group, m: IdolMaterials, d: IdolMember): void {
  const h = B.torsoHeight;
  const profile: Array<[number, number]> = [
    [0, -h / 2],
    [0.153, -h / 2],
    [0.15, -h * 0.35],
    [0.126, -h * 0.12],
    [0.133, h * 0.12],
    [0.169, h * 0.32],
    [0.158, h * 0.44],
    [0.1, h * 0.51],
    [0, h * 0.51],
  ];
  const geometry = cachedGeometry(
    "bodice",
    () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 32),
  );
  const bodiceMat = d.outfit === "academy" || d.outfit === "cottage" ? m.accent : m.main;
  const bodice = mesh(chest, geometry, bodiceMat, [0, 0, 0], "bodice");
  bodice.scale.z = 0.68;
  ellipsoid(chest, m.accent, [0, h * 0.44, 0.005], [0.082, 0.02, 0.067], "collar");

  if (d.outfit === "classic") {
    bow(chest, m.accent, [0, 0.155, 0.127], 0.064);
    for (let i = 0; i < 3; i++) {
      ellipsoid(chest, m.trim, [0, 0.045 - i * 0.05, 0.098], [0.009, 0.009, 0.006], "button");
    }
  }

  if (d.outfit === "sailor") {
    for (const side of [-1, 1]) {
      box(chest, m.accent, [side * 0.07, 0.154, 0.102], [0.077, 0.135, 0.028], 0.011, "sailor-collar").rotation.z =
        side * -0.48;
    }
    bow(chest, m.trim, [0, 0.085, 0.14], 0.047);
  }

  if (d.outfit === "sport") {
    for (const side of [-1, 1]) {
      box(chest, m.accent, [side * 0.094, 0.03, 0.094], [0.042, 0.31, 0.021], 0.008, "sport-stripe").rotation.z =
        side * -0.1;
    }
    star(chest, m.trim, [0, 0.125, 0.122], 0.045);
  }

  if (d.outfit === "ballet") {
    for (const side of [-1, 1]) {
      box(chest, m.accent, [side * 0.07, 0.08, 0.111], [0.02, 0.3, 0.014], 0.005, "bodice-ribbon").rotation.z =
        side * -0.4;
    }
    bow(chest, m.accent, [0, -0.075, 0.115], 0.049);
  }

  if (d.outfit === "celestial") {
    star(chest, gold, [0, 0.14, 0.123], 0.046);
    lineTube(chest, gold, [
      [-0.1, 0.17, 0.1],
      [0, 0.065, 0.12],
      [0.1, 0.17, 0.1],
    ], 0.006);
  }

  if (d.outfit === "cottage" || d.outfit === "academy") {
    for (const side of [-1, 1]) {
      box(chest, m.main, [side * 0.087, 0.043, 0.112], [0.043, 0.35, 0.02], 0.009, "pinafore-strap");
      ellipsoid(chest, m.trim, [side * 0.087, 0.135, 0.128], [0.012, 0.012, 0.006], "strap-button");
    }
    box(chest, m.main, [0, -0.043, 0.101], [0.17, 0.18, 0.037], 0.018, "pinafore-bib");
    if (d.outfit === "academy") bow(chest, m.trim, [0, 0.176, 0.13], 0.039);
  }

  if (d.outfit === "rock") {
    for (const side of [-1, 1]) {
      box(chest, m.trim, [side * 0.104, 0.08, 0.06], [0.081, 0.27, 0.12], 0.018, "jacket-panel");
      box(chest, m.accent, [side * 0.069, 0.138, 0.132], [0.04, 0.15, 0.019], 0.006, "lapel").rotation.z = side * -0.4;
    }
    lineTube(chest, gold, [
      [-0.09, -0.04, 0.14],
      [0, -0.085, 0.15],
      [0.09, -0.02, 0.14],
    ], 0.005, "jacket-chain");
  }

  if (d.outfit === "future") {
    box(chest, m.accent, [0, 0.032, 0.115], [0.13, 0.36, 0.025], 0.015, "front-inset");
    box(chest, m.trim, [0, 0.03, 0.132], [0.014, 0.28, 0.008], 0.003, "zip");
    for (const side of [-1, 1]) {
      ellipsoid(chest, m.trim, [side * 0.065, 0.15, 0.12], [0.01, 0.01, 0.007], "stud");
    }
  }

  if (d.outfit === "bubble") {
    box(chest, m.accent, [0, 0.06, 0.132], [0.049, 0.37, 0.016], 0.006, "sash").rotation.z = -0.48;
    flower(chest, m.accent, [-0.1, 0.2, 0.13], 0.037);
  }

  if (d.outfit === "retro") {
    skirt(chest, m.main, {
      top: 0.072,
      bottom: 0.223,
      length: 0.145,
      y: h * 0.51,
      pleat: 0.007,
      count: 8,
      zScale: 0.65,
    });
    bow(chest, m.accent, [0, 0.175, 0.153], 0.042);
    for (let i = 0; i < 3; i++) {
      ellipsoid(chest, m.accent, [0, 0.055 - i * 0.055, 0.112], [0.012, 0.012, 0.006], "cream-button");
    }
  }

  if (d.outfit === "royal") {
    for (const side of [-1, 1]) {
      box(chest, m.accent, [side * 0.029, 0.117, 0.123], [0.033, 0.24, 0.019], 0.005, "wrap-collar").rotation.z =
        side * 0.46;
    }
    box(chest, m.trim, [0, -0.075, 0], [0.275, 0.105, 0.196], 0.024, "obi");
    box(chest, gold, [0, -0.075, 0.109], [0.28, 0.022, 0.013], 0.006, "obi-band");
    bow(chest, m.trim, [0, -0.04, -0.14], 0.11);
  }
}

function addSkirt(pelvis: THREE.Group, m: IdolMaterials, d: IdolMember): void {
  const regular = { top: 0.153, bottom: 0.25, length: 0.29, y: 0.025 };
  ellipsoid(pelvis, m.main, [0, -0.035, 0], [0.158, 0.093, 0.108], "under-dress");

  switch (d.outfit) {
    case "classic":
      skirt(pelvis, m.accent, { ...regular, length: 0.31, bottom: 0.263 });
      skirt(pelvis, m.main, { ...regular, pleat: 0.016, count: 12 });
      bow(pelvis, m.trim, [-0.15, 0.015, 0.1], 0.045);
      break;
    case "sailor":
      skirt(pelvis, m.main, { ...regular, bottom: 0.235, length: 0.31, pleat: 0.018, count: 8 });
      hem(pelvis, m.accent, -0.265, 0.229, 0.78, 0.008);
      hem(pelvis, m.accent, -0.284, 0.237, 0.78, 0.008);
      break;
    case "sport":
      skirt(pelvis, m.accent, { ...regular, bottom: 0.26, length: 0.28, pleat: 0.006 });
      skirt(pelvis, m.main, { ...regular, bottom: 0.247, length: 0.245, pleat: 0.014, count: 10 });
      break;
    case "ballet":
      for (let i = 0; i < 3; i++) {
        skirt(pelvis, i % 2 ? m.accent : m.main, {
          top: 0.148 + i * 0.018,
          bottom: 0.23 + i * 0.026,
          length: 0.135,
          y: 0.015 - i * 0.071,
          pleat: 0.011,
          count: 14,
        });
      }
      break;
    case "celestial":
      skirt(pelvis, m.main, { top: 0.15, bottom: 0.3, length: 0.67, y: 0.025, pleat: 0.007, count: 10 });
      hem(pelvis, gold, -0.643, 0.3, 0.78, 0.01);
      for (let i = 0; i < 7; i++) {
        const y = -0.15 - (i % 3) * 0.15;
        const x = Math.sin(i * 2.4) * 0.125;
        const t = (0.025 - y) / 0.67;
        const radius = 0.15 + 0.15 * t;
        const z = Math.sqrt(Math.max(0, radius * radius - x * x)) * 0.78;
        star(pelvis, gold, [x, y, z + 0.008], 0.024);
      }
      break;
    case "cottage":
      skirt(pelvis, m.main, { ...regular, length: 0.37, bottom: 0.27, pleat: 0.012 });
      box(pelvis, m.accent, [0, -0.14, 0.176], [0.24, 0.28, 0.031], 0.041, "apron");
      box(pelvis, m.main, [0, -0.17, 0.197], [0.083, 0.06, 0.018], 0.012, "apron-pocket");
      bow(pelvis, m.accent, [0, 0.02, -0.13], 0.065);
      break;
    case "rock":
      skirt(pelvis, m.trim, { ...regular, length: 0.28, bottom: 0.23, pleat: 0.008 });
      skirt(pelvis, m.main, { top: 0.16, bottom: 0.26, length: 0.26, y: 0.035, slant: 0.09, pleat: 0.008 });
      break;
    case "future":
      skirt(pelvis, m.main, { top: 0.151, bottom: 0.225, length: 0.32, y: 0.025, pleat: 0, count: 6 });
      for (const side of [-1, 1]) {
        box(pelvis, m.accent, [side * 0.1, -0.135, 0.158], [0.077, 0.26, 0.021], 0.014, "geometric-panel").rotation.z =
          side * -0.17;
      }
      hem(pelvis, m.trim, -0.292, 0.225, 0.78, 0.009);
      break;
    case "bubble":
      ellipsoid(pelvis, m.main, [0, -0.1, 0], [0.244, 0.2, 0.181], "bubble-skirt");
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ellipsoid(pelvis, m.main, [Math.cos(a) * 0.172, -0.219, Math.sin(a) * 0.127], [0.066, 0.061, 0.056], "bubble-scallop");
      }
      hem(pelvis, m.accent, 0.012, 0.152, 0.73, 0.015);
      break;
    case "academy":
      skirt(pelvis, m.main, { ...regular, bottom: 0.24, length: 0.345, pleat: 0.017, count: 10 });
      hem(pelvis, m.trim, -0.293, 0.232, 0.78, 0.009);
      break;
    case "retro":
      skirt(pelvis, m.main, { ...regular, bottom: 0.29, length: 0.37, pleat: 0.006 });
      hem(pelvis, m.accent, -0.343, 0.29, 0.78, 0.012);
      for (let row = 0; row < 3; row++) {
        const t = 0.3 + row * 0.24;
        const r = 0.153 + (0.29 - 0.153) * t;
        for (let j = 0; j < 7; j++) {
          const a = 0.22 + (j / 6) * (Math.PI - 0.44) + row * 0.06;
          const dot = ellipsoid(
            pelvis,
            m.accent,
            [Math.cos(a) * r, 0.025 - t * 0.37, Math.sin(a) * r * 0.78],
            [0.012, 0.012, 0.006],
            "polka-dot",
          );
          dot.rotation.y = Math.PI / 2 - a;
        }
      }
      break;
    case "royal":
      skirt(pelvis, m.trim, { top: 0.153, bottom: 0.24, length: 0.45, y: 0.025, pleat: 0.011 });
      skirt(pelvis, m.main, { top: 0.16, bottom: 0.26, length: 0.35, y: 0.035, pleat: 0.014, count: 8, slant: 0.035 });
      hem(pelvis, gold, -0.423, 0.24, 0.78, 0.011);
      for (const side of [-1, 1]) {
        flower(pelvis, gold, [side * 0.12, -0.21, 0.162], 0.026);
      }
      break;
  }

  const belt = cylinder(pelvis, m.trim, [0, 0.015, 0], 0.154, 0.154, 0.03, "waistband");
  belt.scale.z = 0.71;
}

function createArm(
  chest: THREE.Group,
  side: number,
  m: IdolMaterials,
  d: IdolMember,
): { shoulder: THREE.Group; upperArm: THREE.Mesh; elbow: THREE.Group; hand: THREE.Mesh } {
  const prefix = side < 0 ? "left" : "right";
  const shoulder = makeJoint(chest, `${prefix}-shoulder`, side * B.shoulderX, B.torsoHeight * 0.3, 0);
  const upperArm = cylinder(shoulder, m.skin, [0, -B.upperArm / 2, 0], 0.043, 0.035, B.upperArm, "upper-arm");
  upperArm.scale.z = 0.94;
  ellipsoid(shoulder, m.skin, [0, 0, 0], [0.043, 0.046, 0.043]);

  const elbow = makeJoint(shoulder, `${prefix}-elbow`, 0, -B.upperArm, 0);
  ellipsoid(elbow, m.skin, [0, 0, 0], [0.036, 0.038, 0.035], "elbow");
  cylinder(elbow, m.skin, [0, -B.forearm / 2, 0], 0.035, 0.026, B.forearm, "forearm");

  const sleeveMat = d.outfit === "academy" || d.outfit === "cottage" ? m.accent : d.outfit === "rock" ? m.trim : m.main;
  if (d.sleeve === "puff") {
    ellipsoid(shoulder, sleeveMat, [0, -0.072, 0], [0.075, 0.106, 0.074], "puff-sleeve");
    cylinder(shoulder, m.accent, [0, -0.152, 0], 0.05, 0.05, 0.026, "puff-cuff");
  } else if (d.sleeve === "short") {
    cylinder(shoulder, sleeveMat, [0, -0.081, 0], 0.058, 0.065, 0.17, "short-sleeve");
    ellipsoid(shoulder, sleeveMat, [0, -0.008, 0], [0.058, 0.047, 0.059]);
    cylinder(shoulder, m.accent, [0, -0.159, 0], 0.066, 0.066, 0.02, "sleeve-trim");
  } else if (d.sleeve === "long" || d.sleeve === "bell") {
    cylinder(shoulder, sleeveMat, [0, -B.upperArm / 2, 0], 0.055, 0.048, B.upperArm + 0.018, "upper-sleeve");
    ellipsoid(shoulder, sleeveMat, [0, -0.01, 0], [0.055, 0.055, 0.055]);
    const wide = d.sleeve === "bell";
    cylinder(elbow, sleeveMat, [0, -B.forearm * 0.46, 0], 0.05, wide ? 0.091 : 0.039, B.forearm * 0.96, "lower-sleeve");
    cylinder(elbow, m.accent, [0, -B.forearm * 0.91, 0], wide ? 0.089 : 0.041, wide ? 0.092 : 0.041, 0.025, "wrist-cuff");
  } else {
    ellipsoid(shoulder, sleeveMat, [0, -0.026, 0], [0.055, 0.05, 0.055], "cap-sleeve");
  }

  if (d.outfit === "future") {
    box(shoulder, m.trim, [0, 0, 0], [0.125, 0.066, 0.12], 0.022, "shoulder-cap");
  }

  const wrist = makeJoint(elbow, `${prefix}-wrist`, 0, -B.forearm, 0);
  const hand = ellipsoid(wrist, m.skin, [0, -0.04, 0.005], [0.033, 0.05, 0.027], "hand");
  ellipsoid(wrist, m.skin, [-side * 0.026, -0.031, 0.011], [0.013, 0.027, 0.017], "thumb");
  if (d.outfit === "bubble" || d.outfit === "classic" || d.outfit === "rock") {
    cylinder(wrist, m.accent, [0, 0.004, 0], 0.029, 0.029, 0.016, "bracelet");
  }
  return { shoulder, upperArm, elbow, hand };
}

function createLeg(
  pelvis: THREE.Group,
  side: number,
  m: IdolMaterials,
  d: IdolMember,
): {
  hip: THREE.Group;
  upperLeg: THREE.Mesh;
  knee: THREE.Group;
  lowerLeg: THREE.Mesh;
  ankle: THREE.Group;
  footPivot: THREE.Group;
  foot: THREE.Mesh;
} {
  const prefix = side < 0 ? "left" : "right";
  const hip = makeJoint(pelvis, `${prefix}-hip`, side * B.hipX, 0, 0);
  const tights = d.outfit === "ballet" || d.outfit === "future" || d.outfit === "rock" || d.outfit === "celestial";
  const legMat = tights ? m.socks : m.skin;
  const upperLeg = cylinder(hip, legMat, [0, -B.thigh / 2, 0], 0.066, 0.047, B.thigh, "thigh");

  const knee = makeJoint(hip, `${prefix}-knee`, 0, -B.thigh, 0);
  ellipsoid(knee, legMat, [0, 0, 0], [0.047, 0.047, 0.046], "knee");
  const lowerLeg = cylinder(knee, legMat, [0, -B.shin / 2, 0], 0.045, 0.027, B.shin, "shin");

  if (!tights) {
    const sockLength = d.outfit === "retro" ? 0.18 : 0.3;
    cylinder(knee, m.socks, [0, -B.shin + sockLength / 2, 0], 0.043, 0.03, sockLength, "sock");
    cylinder(knee, m.accent, [0, -B.shin + sockLength, 0], 0.044, 0.044, 0.024, "sock-cuff");
  }

  const ankle = makeJoint(knee, `${prefix}-ankle`, 0, -B.shin, 0);
  makeJoint(ankle, `${prefix}-toe`, 0, -0.015, 0.17);
  const footPivot = makeGroup(ankle, [0, 0, 0], `${prefix}-footPivot`);
  footPivot.rotation.y = side * 0.055;
  box(footPivot, m.accent, [0, -B.ankleHeight + 0.016, 0.045], [0.119, 0.032, 0.24], 0.013, "shoe-sole");
  const foot = box(footPivot, m.shoes, [0, -B.ankleHeight + 0.061, 0.044], [0.112, 0.083, 0.226], 0.031, "shoe");

  if (d.outfit === "rock" || d.outfit === "future") {
    cylinder(footPivot, m.shoes, [0, 0.029, -0.015], 0.044, 0.049, 0.13, "boot-shaft");
    box(footPivot, m.accent, [0, 0.053, 0.032], [0.071, 0.022, 0.014], 0.005, "boot-band");
  } else {
    box(footPivot, m.accent, [0, -0.006, 0.065], [0.108, 0.018, 0.037], 0.008, "shoe-strap");
  }
  if (d.outfit === "ballet") bow(footPivot, m.accent, [0, -0.005, 0.11], 0.024);
  if (d.outfit === "sport") {
    for (let i = 0; i < 3; i++) {
      box(footPivot, m.accent, [0, 0.006, 0.045 + i * 0.024], [0.067, 0.01, 0.01], 0.004, "lace");
    }
  }

  return { hip, upperLeg, knee, lowerLeg, ankle, footPivot, foot };
}
