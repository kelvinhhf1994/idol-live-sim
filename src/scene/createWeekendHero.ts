import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  GLOW_STICK_HEIGHT,
  GLOW_STICK_RADIUS,
  type PersonRig,
} from "./createCharacter";
import { addOutline } from "./outline";

/** Game characters face -Z; the studio HTML faced +Z. */
const FACE = -1;

export type WeekendHairStyle =
  | "bob"
  | "ponytail"
  | "double-bun"
  | "long"
  | "pixie"
  | "side-part"
  | "crop"
  | "curly"
  | "tuft"
  | "swept";

export interface WeekendHeroColors {
  skin: string;
  blush: string;
  hair: string;
  hairLight: string;
  hoodie: string;
  ribbing: string;
  pants: string;
  denimCuff: string;
  cream: string;
  sole: string;
  ink: string;
  accent: string;
}

export interface WeekendHeroOptions {
  glowStick?: boolean;
  scale?: number;
  hairstyle?: WeekendHairStyle;
  colors?: Partial<WeekendHeroColors>;
}

const PROPORTIONS = {
  headUnit: 0.6,
  headCount: 2.7,
  shoulderWidth: 0.94,
  hipWidth: 0.39,
  upperArm: 0.36,
  forearm: 0.32,
  thigh: 0.4,
  shin: 0.36,
  ankleHeight: 0.1,
  torsoWidth: 0.91,
  torsoDepth: 0.63,
};

const DEFAULT_COLORS: WeekendHeroColors = {
  skin: "#f0bd98",
  blush: "#e99b8b",
  hair: "#45312b",
  hairLight: "#594035",
  hoodie: "#8bbfaf",
  ribbing: "#78aa99",
  pants: "#3e4a61",
  denimCuff: "#526077",
  cream: "#fff5e5",
  sole: "#e7dece",
  ink: "#302926",
  accent: "#ff719a",
};

/** Studio looks used to mix audience clothes and hair. */
export const WEEKEND_LOOKS: readonly Partial<WeekendHeroColors>[] = [
  { hoodie: "#8bbfaf", ribbing: "#78aa99" },
  {
    skin: "#d99b76",
    hair: "#342927",
    hairLight: "#4b3730",
    hoodie: "#c2a2cf",
    ribbing: "#a888b4",
    accent: "#f3d4ef",
  },
  {
    skin: "#f3c7a6",
    hair: "#76503b",
    hairLight: "#916247",
    hoodie: "#e3a080",
    ribbing: "#c9886c",
    pants: "#665970",
    denimCuff: "#7d6f88",
    accent: "#ffe6b0",
  },
  {
    skin: "#a96f50",
    blush: "#c77f73",
    hair: "#302526",
    hairLight: "#483235",
    hoodie: "#d9a0b3",
    ribbing: "#bd8298",
    pants: "#53576e",
    accent: "#f8dfbf",
  },
  {
    hair: "#a57b48",
    hairLight: "#bf965d",
    hoodie: "#dec887",
    ribbing: "#bfa967",
    pants: "#66756d",
    denimCuff: "#809184",
    accent: "#fff0cc",
  },
  {
    hoodie: "#8eaed1",
    ribbing: "#7694b6",
    hair: "#49352e",
    hairLight: "#63483a",
  },
  {
    skin: "#c08a64",
    hair: "#302927",
    hairLight: "#463933",
    hoodie: "#a2b493",
    ribbing: "#82966f",
    pants: "#62584d",
    denimCuff: "#7c7061",
  },
  {
    skin: "#915e43",
    blush: "#b77266",
    hair: "#30231f",
    hairLight: "#4a3329",
    hoodie: "#bd9b80",
    ribbing: "#9e7c63",
    pants: "#465366",
    denimCuff: "#607087",
  },
  {
    skin: "#f3c4a0",
    hair: "#865138",
    hairLight: "#a56844",
    hoodie: "#d58f83",
    ribbing: "#b67368",
    pants: "#5a6172",
    denimCuff: "#757d90",
  },
  {
    skin: "#d8a07a",
    hair: "#343238",
    hairLight: "#4e4854",
    hoodie: "#79aaad",
    ribbing: "#5b8d91",
    pants: "#424d61",
    denimCuff: "#5e6c82",
  },
];

export const WEEKEND_HAIRSTYLES: readonly WeekendHairStyle[] = [
  "bob",
  "ponytail",
  "double-bun",
  "long",
  "pixie",
  "side-part",
  "crop",
  "curly",
  "tuft",
  "swept",
];

const sphereGeometry = new THREE.SphereGeometry(1, 24, 18);

type ClayMaterials = Record<keyof WeekendHeroColors, THREE.MeshStandardMaterial>;

interface BodyMeasure {
  u: number;
  pelvisY: number;
  chestY: number;
  neckY: number;
  headY: number;
  torsoHeight: number;
  shoulderX: number;
  hipX: number;
  upperArm: number;
  forearm: number;
  thigh: number;
  shin: number;
  ankleY: number;
  torsoWidth: number;
  torsoDepth: number;
}

function measurements(): BodyMeasure {
  const u = PROPORTIONS.headUnit;
  const height = PROPORTIONS.headCount * u;
  const ankleY = PROPORTIONS.ankleHeight * u;
  const thigh = PROPORTIONS.thigh * u;
  const shin = PROPORTIONS.shin * u;
  const pelvisY = ankleY + thigh + shin;
  const headY = height - u * 0.5;
  const neckY = headY - u * 0.46;
  const torsoHeight = neckY - pelvisY;
  return {
    u,
    pelvisY,
    chestY: pelvisY + torsoHeight / 2,
    neckY,
    headY,
    torsoHeight,
    shoulderX: (PROPORTIONS.shoulderWidth * u) / 2,
    hipX: (PROPORTIONS.hipWidth * u) / 2,
    upperArm: PROPORTIONS.upperArm * u,
    forearm: PROPORTIONS.forearm * u,
    thigh,
    shin,
    ankleY,
    torsoWidth: PROPORTIONS.torsoWidth * u,
    torsoDepth: PROPORTIONS.torsoDepth * u,
  };
}

/** Deterministic clothes/hair mix for crowd members. */
export function mixWeekendAudienceLook(index: number): WeekendHeroOptions {
  const clothes = WEEKEND_LOOKS[index % WEEKEND_LOOKS.length];
  const hairLook = WEEKEND_LOOKS[(index * 3 + 5) % WEEKEND_LOOKS.length];
  const skinLook = WEEKEND_LOOKS[(index * 2 + 1) % WEEKEND_LOOKS.length];
  return {
    scale: 0.88 + (index % 4) * 0.03,
    glowStick: true,
    hairstyle: WEEKEND_HAIRSTYLES[(index * 7 + 2) % WEEKEND_HAIRSTYLES.length],
    colors: {
      ...clothes,
      hair: hairLook.hair ?? DEFAULT_COLORS.hair,
      hairLight: hairLook.hairLight ?? DEFAULT_COLORS.hairLight,
      skin: skinLook.skin ?? DEFAULT_COLORS.skin,
      blush: skinLook.blush ?? DEFAULT_COLORS.blush,
    },
  };
}

/**
 * Little Weekend clay hoodie person on a V2 PersonRig, using the studio
 * proportion system and hairstyles. Default look is Mint / bob.
 */
export function createWeekendHero(options: WeekendHeroOptions = {}): PersonRig {
  const colors = { ...DEFAULT_COLORS, ...options.colors };
  const hairstyle = options.hairstyle ?? "bob";
  const b = measurements();
  const materials = Object.fromEntries(
    (Object.keys(DEFAULT_COLORS) as (keyof WeekendHeroColors)[]).map((key) => [
      key,
      clay(colors[key]),
    ]),
  ) as ClayMaterials;

  const skipOutline = new Set<THREE.Mesh>();
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const pelvis = new THREE.Group();
  pelvis.position.y = b.pelvisY;
  body.add(pelvis);
  const chest = new THREE.Group();
  chest.position.y = b.chestY - b.pelvisY;
  pelvis.add(chest);
  const neck = new THREE.Group();
  neck.position.set(0, b.neckY - b.chestY, 0);
  chest.add(neck);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 16),
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
  skipOutline.add(shadow);

  const leftLeg = createLeg(-1, materials, b, skipOutline);
  const rightLeg = createLeg(1, materials, b, skipOutline);
  pelvis.add(leftLeg.hip, rightLeg.hip);
  addHoodie(chest, materials, b, skipOutline);

  const leftArm = createArm(-1, materials, b);
  const rightArm = createArm(1, materials, b);
  chest.add(leftArm.shoulder, rightArm.shoulder);

  ellipsoid(neck, materials.skin, [0, b.u * 0.025, 0], [b.u * 0.12, b.u * 0.12, b.u * 0.12], "neck");

  const headGeometry = new THREE.SphereGeometry(1, 24, 18);
  headGeometry.scale(0.324, 0.3, 0.276);
  const head = new THREE.Mesh(headGeometry, materials.skin);
  head.name = "head";
  head.position.set(0, b.headY - b.neckY, 0);
  neck.add(head);
  addFace(head, materials, skipOutline);
  addHair(head, materials, hairstyle, skipOutline);

  let glowStick: THREE.Mesh | null = null;
  if (options.glowStick) {
    glowStick = createGlowStick(rightArm.hand, colors.accent);
    skipOutline.add(glowStick);
  }

  group.scale.setScalar(options.scale ?? 1);
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object !== shadow;
    object.receiveShadow = object !== shadow;
  });

  const outlines: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object === shadow || skipOutline.has(object) || object.name === "outline") return;
    outlines.push(addOutline(object));
  });

  return {
    rigVersion: 2,
    pelvisRestY: b.pelvisY,
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
    glowStick,
    outlines,
  };
}

function clay(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  name: string,
): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function ellipsoid(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  name: string,
): THREE.Mesh {
  const object = mesh(sphereGeometry, material, parent, ...position, name);
  object.scale.set(...scale);
  return object;
}

function box(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: readonly [number, number, number],
  size: readonly [number, number, number],
  radius: number,
  name: string,
): THREE.Mesh {
  const cap = Math.min(radius, Math.min(...size) / 2);
  return mesh(new RoundedBoxGeometry(...size, 3, cap), material, parent, ...position, name);
}

function tube(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: ReadonlyArray<readonly [number, number, number]>,
  radius: number,
  name: string,
  skipOutline: Set<THREE.Mesh>,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const object = mesh(new THREE.TubeGeometry(curve, 16, radius, 6, false), material, parent, 0, 0, 0, name);
  skipOutline.add(object);
  return object;
}

function createLeg(
  side: number,
  materials: ClayMaterials,
  b: BodyMeasure,
  skipOutline: Set<THREE.Mesh>,
): {
  hip: THREE.Group;
  upperLeg: THREE.Mesh;
  knee: THREE.Group;
  lowerLeg: THREE.Mesh;
  ankle: THREE.Group;
  footPivot: THREE.Group;
  foot: THREE.Mesh;
} {
  const u = b.u;
  const hip = new THREE.Group();
  hip.position.set(side * b.hipX, 0, 0);
  const upperLeg = box(
    hip,
    materials.pants,
    [0, -b.thigh / 2, 0],
    [u * 0.265, b.thigh + u * 0.045, u * 0.28],
    u * 0.075,
    "pants",
  );

  const knee = new THREE.Group();
  knee.position.y = -b.thigh;
  const lowerLeg = box(
    knee,
    materials.pants,
    [0, -b.shin / 2, 0],
    [u * 0.245, b.shin + u * 0.02, u * 0.26],
    u * 0.065,
    "pants",
  );
  box(knee, materials.denimCuff, [0, -b.shin + u * 0.065, 0], [u * 0.265, u * 0.09, u * 0.285], u * 0.025, "pants-cuff");

  const ankle = new THREE.Group();
  ankle.position.y = -b.shin;
  const footPivot = new THREE.Group();
  footPivot.rotation.y = side * 0.055;
  const foot = box(
    footPivot,
    materials.cream,
    [0, -b.ankleY + u * 0.11, FACE * u * 0.1],
    [u * 0.31, u * 0.15, u * 0.45],
    u * 0.06,
    "sneaker",
  );
  const sole = box(
    foot,
    materials.sole,
    [0, -u * 0.085, 0],
    [u * 0.34, u * 0.05, u * 0.49],
    u * 0.024,
    "sneaker-sole",
  );
  skipOutline.add(sole);
  box(foot, materials.ribbing, [0, u * 0.02, FACE * -u * 0.22], [u * 0.18, u * 0.065, u * 0.035], u * 0.012, "sneaker-heel");
  for (let i = 0; i < 3; i++) {
    skipOutline.add(
      box(
        foot,
        materials.cream,
        [0, u * 0.08, FACE * u * (-0.075 + i * 0.06)],
        [u * 0.17, u * 0.016, u * 0.022],
        u * 0.007,
        "sneaker-lace",
      ),
    );
  }

  footPivot.add(foot);
  ankle.add(footPivot);
  knee.add(lowerLeg, ankle);
  hip.add(upperLeg, knee);
  return { hip, upperLeg, knee, lowerLeg, ankle, footPivot, foot };
}

function createArm(
  side: number,
  materials: ClayMaterials,
  b: BodyMeasure,
): { shoulder: THREE.Group; upperArm: THREE.Mesh; elbow: THREE.Group; hand: THREE.Mesh } {
  const u = b.u;
  const shoulder = new THREE.Group();
  shoulder.position.set(side * b.shoulderX, b.torsoHeight * 0.3, 0);
  shoulder.rotation.z = side * 0.1;
  ellipsoid(shoulder, materials.hoodie, [0, -u * 0.045, 0], [u * 0.13, u * 0.14, u * 0.145], "shoulder-sleeve");
  const upperArm = box(
    shoulder,
    materials.hoodie,
    [0, -b.upperArm / 2, 0],
    [u * 0.235, b.upperArm + u * 0.045, u * 0.26],
    u * 0.09,
    "sleeve",
  );

  const elbow = new THREE.Group();
  elbow.position.y = -b.upperArm;
  box(elbow, materials.hoodie, [0, -b.forearm * 0.44, 0], [u * 0.215, b.forearm * 0.98, u * 0.24], u * 0.08, "sleeve");
  box(elbow, materials.ribbing, [0, -b.forearm + u * 0.035, 0], [u * 0.215, u * 0.085, u * 0.245], u * 0.03, "sleeve-cuff");
  const hand = ellipsoid(
    elbow,
    materials.skin,
    [0, -b.forearm - u * 0.065, FACE * u * 0.012],
    [u * 0.095, u * 0.11, u * 0.095],
    "hand",
  );

  shoulder.add(upperArm, elbow);
  return { shoulder, upperArm, elbow, hand };
}

function addHoodie(
  chest: THREE.Group,
  materials: ClayMaterials,
  b: BodyMeasure,
  skipOutline: Set<THREE.Mesh>,
): void {
  const u = b.u;
  const w = b.torsoWidth;
  const h = b.torsoHeight;
  const d = b.torsoDepth;
  const front = FACE * (d / 2);

  box(chest, materials.hoodie, [0, 0, 0], [w, h + u * 0.025, d], u * 0.16, "hoodie");
  box(chest, materials.ribbing, [0, -h / 2 + u * 0.025, 0], [w - u * 0.035, u * 0.1, d - u * 0.01], u * 0.035, "hoodie-hem");
  ellipsoid(chest, materials.hoodie, [0, h / 2 - u * 0.015, FACE * -u * 0.09], [u * 0.35, u * 0.15, u * 0.27], "hoodie-hood");
  ellipsoid(chest, materials.ribbing, [0, h / 2, FACE * u * 0.005], [u * 0.19, u * 0.055, u * 0.17], "hoodie-collar");
  box(chest, materials.hoodie, [0, -h * 0.18, front + FACE * u * 0.015], [w * 0.49, h * 0.26, u * 0.06], u * 0.045, "hoodie-pocket");
  box(chest, materials.cream, [w * 0.22, h * 0.19, front + FACE * u * 0.012], [u * 0.095, u * 0.039, u * 0.018], u * 0.006, "hoodie-label");

  for (const side of [-1, 1]) {
    tube(
      chest,
      materials.cream,
      [
        [side * u * 0.075, h / 2, FACE * u * 0.15],
        [side * u * 0.085, h * 0.3, front + FACE * u * 0.02],
        [side * u * 0.075, h * 0.08, front + FACE * u * 0.025],
      ],
      u * 0.009,
      "hoodie-string",
      skipOutline,
    );
    tube(
      chest,
      materials.ribbing,
      [
        [side * w * 0.21, -h * 0.08, front + FACE * u * 0.048],
        [side * w * 0.18, -h * 0.18, front + FACE * u * 0.05],
        [side * w * 0.18, -h * 0.27, front + FACE * u * 0.048],
      ],
      u * 0.007,
      "pocket-stitch",
      skipOutline,
    );
  }
}

function addFace(head: THREE.Mesh, materials: ClayMaterials, skipOutline: Set<THREE.Mesh>): void {
  for (const side of [-1, 1]) {
    ellipsoid(head, materials.skin, [side * 0.315, -0.012, 0], [0.057, 0.077, 0.06], "ear");
    skipOutline.add(
      ellipsoid(head, materials.blush, [side * 0.337, -0.012, FACE * 0.045], [0.024, 0.039, 0.018], "inner-ear"),
    );
    const eye = ellipsoid(head, materials.ink, [side * 0.096, 0.006, FACE * 0.263], [0.023, 0.034, 0.015], "eye");
    skipOutline.add(eye);
    skipOutline.add(
      ellipsoid(head, materials.cream, [side * 0.096 - 0.007, 0.017, FACE * 0.276], [0.007, 0.008, 0.004], "eye-highlight"),
    );
    const cheek = ellipsoid(head, materials.blush, [side * 0.166, -0.063, FACE * 0.232], [0.042, 0.021, 0.013], "blush");
    cheek.rotation.y = side * 0.48 * FACE;
    skipOutline.add(cheek);
    tube(
      head,
      materials.hair,
      [
        [side * 0.096 - 0.025, 0.07, FACE * 0.255],
        [side * 0.096, 0.078, FACE * 0.26],
        [side * 0.096 + 0.025, 0.07, FACE * 0.255],
      ],
      0.0045,
      "brow",
      skipOutline,
    );
  }
  ellipsoid(head, materials.skin, [0, -0.029, FACE * 0.276], [0.026, 0.024, 0.024], "nose");
  tube(
    head,
    materials.ink,
    [
      [-0.033, -0.084, FACE * 0.264],
      [0, -0.098, FACE * 0.264],
      [0.033, -0.084, FACE * 0.264],
    ],
    0.004,
    "mouth",
    skipOutline,
  );
}

function addHair(
  head: THREE.Mesh,
  materials: ClayMaterials,
  style: WeekendHairStyle,
  skipOutline: Set<THREE.Mesh>,
): void {
  const cap = mesh(
    new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.hair,
    head,
    0,
    0.055,
    FACE * -0.018,
    "hair-cap",
  );
  cap.scale.set(0.339, 0.279, 0.288);
  ellipsoid(head, materials.hair, [0, 0.07, FACE * -0.16], [0.31, 0.245, 0.145], "hair-back");

  const swept = style === "side-part" || style === "swept" || style === "pixie";
  const short = style === "crop";
  if (style !== "curly") {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.097;
      const y = short ? 0.225 - Math.abs(i - 2) * 0.018 : swept ? 0.17 + i * 0.015 : 0.2 - Math.abs(i - 2) * 0.02;
      const lock = ellipsoid(
        head,
        i % 2 ? materials.hairLight : materials.hair,
        [x, y, FACE * (0.205 - Math.abs(i - 2) * 0.013)],
        [swept ? 0.095 : 0.073, short ? 0.065 : 0.1, 0.087],
        "hair-fringe",
      );
      lock.rotation.z = swept ? -0.42 : (i - 2) * 0.12;
    }
  }

  if (style === "bob" || style === "long") {
    const long = style === "long";
    ellipsoid(head, materials.hair, [0, long ? -0.12 : -0.015, FACE * -0.17], [0.315, long ? 0.38 : 0.25, 0.16], "hair-back");
    for (const side of [-1, 1]) {
      ellipsoid(head, materials.hair, [side * 0.285, long ? -0.115 : -0.015, FACE * -0.025], [0.073, long ? 0.34 : 0.235, 0.17], "side-lock");
    }
    skipOutline.add(
      box(head, materials.accent, [0.245, 0.13, FACE * 0.2], [0.065, 0.021, 0.018], 0.008, "hair-clip"),
    );
  }

  if (style === "ponytail") {
    skipOutline.add(ellipsoid(head, materials.accent, [0.2, 0.2, FACE * -0.23], [0.077, 0.067, 0.065], "hair-tie"));
    const tail = ellipsoid(head, materials.hair, [0.235, 0.01, FACE * -0.29], [0.115, 0.265, 0.13], "ponytail");
    tail.rotation.z = 0.22;
  }

  if (style === "double-bun") {
    for (const side of [-1, 1]) {
      skipOutline.add(
        ellipsoid(head, materials.accent, [side * 0.25, 0.225, FACE * -0.035], [0.09, 0.07, 0.09], "bun-tie"),
      );
      ellipsoid(head, materials.hair, [side * 0.29, 0.285, FACE * -0.055], [0.12, 0.12, 0.115], "hair-bun");
      skipOutline.add(
        ellipsoid(head, materials.hairLight, [side * 0.3, 0.31, FACE * 0.005], [0.063, 0.053, 0.045], "bun-highlight"),
      );
    }
  }

  if (style === "curly") {
    for (let i = 0; i < 11; i++) {
      const angle = (i / 11) * Math.PI * 2;
      ellipsoid(
        head,
        i % 3 === 0 ? materials.hairLight : materials.hair,
        [Math.cos(angle) * 0.255, 0.18 + Math.sin(angle) * 0.035, FACE * Math.sin(angle) * 0.205],
        [0.094, 0.097, 0.093],
        "curl",
      );
    }
    for (let i = 0; i < 5; i++) {
      ellipsoid(head, i % 2 ? materials.hairLight : materials.hair, [(i - 2) * 0.09, 0.285, FACE * -0.015], [0.083, 0.08, 0.09], "top-curl");
    }
  }

  if (style === "tuft" || style === "pixie") {
    const tuft = ellipsoid(head, materials.hairLight, [-0.065, 0.315, FACE * 0.015], [0.085, 0.105, 0.075], "hair-tuft");
    tuft.rotation.z = -0.45;
  }

  if (style === "swept") {
    const sweep = ellipsoid(head, materials.hairLight, [-0.075, 0.27, FACE * 0.135], [0.18, 0.09, 0.1], "top-sweep");
    sweep.rotation.z = -0.2;
  }
}

function createGlowStick(hand: THREE.Mesh, accent: string): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(GLOW_STICK_RADIUS, GLOW_STICK_RADIUS, GLOW_STICK_HEIGHT, 6);
  geometry.translate(0, GLOW_STICK_HEIGHT / 2, 0);
  const stick = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 2.35,
      roughness: 0.28,
      metalness: 0.05,
      flatShading: true,
    }),
  );
  stick.name = "glow-stick";
  stick.position.set(0.02, 0.02, -0.01);
  stick.rotation.set(0.15, 0.05, 0.08);
  stick.scale.set(1 / hand.scale.x, 1 / hand.scale.y, 1 / hand.scale.z);
  hand.add(stick);
  return stick;
}
