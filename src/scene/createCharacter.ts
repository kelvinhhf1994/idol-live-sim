import * as THREE from "three";
import { getFaceTexture } from "./faceTexture";
import { addOutline } from "./outline";
import { makeToonMaterial } from "./toonMaterials";

export interface CharacterPalette {
  skin: number;
  hair: number;
  top: number;
  bottom: number;
  accent: number;
  /** Iris colour, only used by the anime style. */
  eye: number;
}

export interface CharacterOptions {
  palette?: Partial<CharacterPalette>;
  scale?: number;
  hairStyle?: "bob" | "ponytail" | "short" | "twin";
  skirt?: boolean;
  glowStick?: boolean;
  /** "anime" swaps in cel shading, a drawn face, layered hair, and outlines. */
  style?: "lowpoly" | "anime";
}

export interface PersonRig {
  rigVersion: 2;
  /** Bind-pose pelvis height. applyPersonPose restores this plus pose.pelvisY. */
  pelvisRestY: number;
  group: THREE.Group;
  body: THREE.Group;
  pelvis: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Mesh;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftUpperArm: THREE.Mesh;
  rightUpperArm: THREE.Mesh;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftHand: THREE.Mesh;
  rightHand: THREE.Mesh;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftUpperLeg: THREE.Mesh;
  rightUpperLeg: THREE.Mesh;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftLowerLeg: THREE.Mesh;
  rightLowerLeg: THREE.Mesh;
  leftAnkle: THREE.Group;
  rightAnkle: THREE.Group;
  leftFootPivot: THREE.Group;
  rightFootPivot: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
  /** Player/audience penlight mesh when glowStick option is enabled. */
  glowStick: THREE.Mesh | null;
  /** Inverted-hull outline shells, empty unless the anime style is used. */
  outlines: THREE.Mesh[];
}

/** Concert penlight radius (~44% thicker than the original 0.018 slim stick). */
export const GLOW_STICK_RADIUS = 0.026;
/** Full glow-stick length along local +Y after grip pivot correction. */
export const GLOW_STICK_HEIGHT = 0.48;

function createGlowStickGeometry(): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(
    GLOW_STICK_RADIUS,
    GLOW_STICK_RADIUS,
    GLOW_STICK_HEIGHT,
    6,
  );
  // Pivot at the bottom handle so the palm grips the lower tip, not mid-shaft.
  geometry.translate(0, GLOW_STICK_HEIGHT / 2, 0);
  return geometry;
}

const geometries = {
  head: new THREE.SphereGeometry(0.27, 12, 8),
  hair: new THREE.SphereGeometry(0.285, 10, 7),
  torso: new THREE.CylinderGeometry(0.23, 0.3, 0.58, 8),
  skirt: new THREE.CylinderGeometry(0.26, 0.39, 0.42, 10),
  limb: new THREE.CapsuleGeometry(0.07, 0.34, 4, 8),
  legSegment: new THREE.CapsuleGeometry(0.07, 0.15, 4, 8),
  armSegment: new THREE.CapsuleGeometry(0.065, 0.16, 4, 8),
  hand: new THREE.SphereGeometry(0.075, 8, 6),
  shoe: new THREE.BoxGeometry(0.18, 0.12, 0.28),
  eye: new THREE.SphereGeometry(0.025, 6, 4),
  ponytail: new THREE.CapsuleGeometry(0.105, 0.2, 4, 8),
  glowStick: createGlowStickGeometry(),
  shadow: new THREE.CircleGeometry(0.4, 16),
  // Spherical patch hugging the front of the skull, carrying the face decal.
  face: new THREE.SphereGeometry(0.2725, 20, 16, -Math.PI / 2 - 0.91, 1.82, 0.8975, 1.1341),
  hairStrand: new THREE.ConeGeometry(0.042, 0.175, 4),
};

/** Classic indigo denim — readable against dark live-house floors. */
export const DENIM_JEANS = 0x2c5282;
/** Off-white canvas sneakers for foot silhouette contrast on black stage. */
export const CANVAS_SNEAKER = 0xf0ece4;

const defaultPalette: CharacterPalette = {
  skin: 0xf1ad85,
  hair: 0x211923,
  top: 0xe8e0d4,
  bottom: DENIM_JEANS,
  accent: 0xff397d,
  eye: 0x3f5c8c,
};

export function createLowPolyPerson(options: CharacterOptions = {}): PersonRig {
  const palette = { ...defaultPalette, ...options.palette };
  const anime = options.style === "anime";
  const surface = anime ? makeToonMaterial : makeMaterial;
  const materials = {
    skin: surface(palette.skin),
    hair: surface(palette.hair),
    top: surface(palette.top),
    bottom: surface(palette.bottom),
    accent: surface(palette.accent, palette.accent),
    eye: makeMaterial(0x171119),
    shoe: surface(CANVAS_SNEAKER),
  };

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.64;
  body.add(pelvis);
  const chest = new THREE.Group();
  chest.position.y = 0.4;
  pelvis.add(chest);
  const neck = new THREE.Group();
  neck.position.set(0, 0.51, -0.055);
  chest.add(neck);

  const shadow = new THREE.Mesh(
    geometries.shadow,
    new THREE.MeshBasicMaterial({ color: 0x050307, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  const leftLeg = createLeg(-0.14, materials.bottom, materials.shoe);
  const rightLeg = createLeg(0.14, materials.bottom, materials.shoe);
  pelvis.add(leftLeg.hip, rightLeg.hip);

  const torso = new THREE.Mesh(geometries.torso, materials.top);
  torso.scale.z = 0.74;
  chest.add(torso);

  if (options.skirt) {
    const skirt = new THREE.Mesh(geometries.skirt, materials.bottom);
    skirt.position.y = 0.1;
    pelvis.add(skirt);
  }

  const leftArm = createArm(-1, materials.top, materials.skin);
  const rightArm = createArm(1, materials.top, materials.skin);
  chest.add(leftArm.shoulder, rightArm.shoulder);

  const hairBack = new THREE.Mesh(geometries.hair, materials.hair);
  hairBack.name = "hair-back";
  setHeadChildTransform(hairBack, 0, 0, 0.095, 1.06, 1.08, 0.92);

  const head = new THREE.Mesh(geometries.head, materials.skin);
  head.scale.set(0.94, 1.03, 0.9);
  neck.add(head);
  head.add(hairBack);

  addHair(head, options.hairStyle ?? "short", materials.hair, materials.accent);

  let face: THREE.Mesh | null = null;
  if (anime) {
    face = new THREE.Mesh(geometries.face, makeFaceMaterial(palette.eye));
    face.name = "face";
    head.add(face);
    addAnimeFringe(head, materials.hair);
  } else {
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(geometries.eye, materials.eye);
      eye.name = "eye";
      setHeadChildTransform(eye, side * 0.075, 0.035, -0.235, 1, 1, 1);
      head.add(eye);
    }
  }

  let glowStick: THREE.Mesh | null = null;
  if (options.glowStick) {
    const stickMaterial = new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: palette.accent,
      emissiveIntensity: 2.35,
      roughness: 0.28,
      metalness: 0.05,
      flatShading: true,
    });
    glowStick = new THREE.Mesh(geometries.glowStick, stickMaterial);
    glowStick.name = "glow-stick";
    // Idle carry: grip sits in the palm; shaft extends along local +Y.
    glowStick.position.set(0.02, 0.02, -0.01);
    glowStick.rotation.set(0.15, 0.05, 0.08);
    rightArm.hand.add(glowStick);
  }

  group.scale.setScalar(options.scale ?? 1);
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object !== shadow;
    object.receiveShadow = object !== shadow;
  });

  const outlines: THREE.Mesh[] = [];
  if (anime) {
    const targets: THREE.Mesh[] = [];
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object === shadow || object === glowStick || object === face) return;
      targets.push(object);
    });
    for (const mesh of targets) outlines.push(addOutline(mesh));
  }

  return {
    rigVersion: 2,
    pelvisRestY: 0.64,
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

function createLeg(
  x: number,
  legMaterial: THREE.Material,
  shoeMaterial: THREE.Material,
): {
  hip: THREE.Group;
  upperLeg: THREE.Mesh;
  knee: THREE.Group;
  lowerLeg: THREE.Mesh;
  ankle: THREE.Group;
  footPivot: THREE.Group;
  foot: THREE.Mesh;
} {
  const hip = new THREE.Group();
  hip.position.set(x, 0, 0.02);
  const upperLeg = new THREE.Mesh(geometries.legSegment, legMaterial);
  upperLeg.position.y = -0.145;
  const knee = new THREE.Group();
  knee.position.y = -0.29;
  const lowerLeg = new THREE.Mesh(geometries.legSegment, legMaterial);
  lowerLeg.position.y = -0.145;
  const ankle = new THREE.Group();
  ankle.position.y = -0.29;
  const footPivot = new THREE.Group();
  const foot = new THREE.Mesh(geometries.shoe, shoeMaterial);
  foot.position.z = -0.075;
  footPivot.add(foot);
  ankle.add(footPivot);
  knee.add(lowerLeg, ankle);
  hip.add(upperLeg, knee);
  return { hip, upperLeg, knee, lowerLeg, ankle, footPivot, foot };
}

function createArm(
  side: number,
  sleeveMaterial: THREE.Material,
  skinMaterial: THREE.Material,
): { shoulder: THREE.Group; upperArm: THREE.Mesh; elbow: THREE.Group; hand: THREE.Mesh } {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.31, 0.21, 0);
  shoulder.rotation.z = side * -0.12;
  const upperArm = new THREE.Mesh(geometries.armSegment, sleeveMaterial);
  upperArm.position.y = -0.145;
  const elbow = new THREE.Group();
  elbow.position.y = -0.29;
  const lowerArm = new THREE.Mesh(geometries.armSegment, skinMaterial);
  lowerArm.position.y = -0.15;
  const hand = new THREE.Mesh(geometries.hand, skinMaterial);
  hand.position.y = -0.3;
  elbow.add(lowerArm, hand);
  shoulder.add(upperArm, elbow);
  return { shoulder, upperArm, elbow, hand };
}

function addHair(
  head: THREE.Mesh,
  style: NonNullable<CharacterOptions["hairStyle"]>,
  hairMaterial: THREE.Material,
  accentMaterial: THREE.Material,
): void {
  if (style === "short") {
    const fringe = new THREE.Mesh(geometries.ponytail, hairMaterial);
    fringe.name = "hair-fringe";
    setHeadChildTransform(fringe, -0.08, 0.16046, -0.125, 1, 1, 1);
    fringe.rotation.z = 1.25;
    head.add(fringe);
    return;
  }

  if (style === "bob") {
    for (const side of [-1, 1]) {
      const sideHair = new THREE.Mesh(geometries.ponytail, hairMaterial);
      sideHair.name = "hair-bob";
      setHeadChildTransform(sideHair, side * 0.22, -0.1, 0.055, 1, 1, 1);
      sideHair.rotation.z = side * -0.08;
      head.add(sideHair);
    }
    return;
  }

  if (style === "ponytail") {
    const ponytail = new THREE.Mesh(geometries.ponytail, hairMaterial);
    ponytail.name = "hair-ponytail";
    setHeadChildTransform(ponytail, 0.22, -0.08, 0.335, 1, 1, 1);
    ponytail.rotation.z = -0.65;
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 10), accentMaterial);
    tie.name = "hair-tie";
    setHeadChildTransform(tie, 0.15, 0.07, 0.285, 1, 1, 1);
    tie.rotation.y = Math.PI / 2;
    head.add(ponytail, tie);
    return;
  }

  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(geometries.ponytail, hairMaterial);
    tail.name = "hair-tail";
    setHeadChildTransform(tail, side * 0.23, -0.13, 0.235, 1, 1, 1);
    tail.rotation.z = side * -0.45;
    head.add(tail);
  }
}

function makeFaceMaterial(eyeColor: number): THREE.MeshToonMaterial {
  const material = makeToonMaterial(0xffffff);
  material.map = getFaceTexture(eyeColor);
  material.transparent = true;
  // Decal shell sits 2.5mm off the skull; skip depth writes to avoid z-fighting.
  material.depthWrite = false;
  return material;
}

/** Head sphere radius in the head mesh's own space, before the head scale. */
const HEAD_RADIUS = 0.27;
const FRINGE_ROOT_Y = 0.175;
const FRINGE_AZIMUTHS = [-0.68, -0.34, 0, 0.34, 0.68];
const STRAND_HALF_LENGTH = 0.0875;
const STRAND_ROOT_EMBED = 0.035;

/** Pointed fringe strands over the brow — the anime silhouette cue. */
function addAnimeFringe(head: THREE.Mesh, hairMaterial: THREE.Material): void {
  const ringRadius = Math.sqrt(HEAD_RADIUS ** 2 - FRINGE_ROOT_Y ** 2);
  const up = new THREE.Vector3(0, 1, 0);

  for (const azimuth of FRINGE_AZIMUTHS) {
    const root = new THREE.Vector3(
      Math.sin(azimuth) * ringRadius,
      FRINGE_ROOT_Y,
      -Math.cos(azimuth) * ringRadius,
    );
    // Hang downward but follow the skull outward, so the tips clear the brow.
    const direction = new THREE.Vector3(0, -1, 0)
      .addScaledVector(root.clone().divideScalar(HEAD_RADIUS), 0.5)
      .normalize();

    const strand = new THREE.Mesh(geometries.hairStrand, hairMaterial);
    strand.name = "hair-strand";
    strand.quaternion.setFromUnitVectors(up, direction);
    strand.position.copy(root).addScaledVector(direction, STRAND_HALF_LENGTH - STRAND_ROOT_EMBED);
    head.add(strand);
  }
}

function setHeadChildTransform(
  child: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
): void {
  child.position.set(x / 0.94, y / 1.03, z / 0.9);
  child.scale.set(scaleX / 0.94, scaleY / 1.03, scaleZ / 0.9);
}

function makeMaterial(color: number, emissive = 0x000000): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    emissive,
    emissiveIntensity: emissive === 0 ? 0 : 0.45,
    flatShading: true,
  });
}
