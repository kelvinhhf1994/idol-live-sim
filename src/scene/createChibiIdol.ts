import * as THREE from "three";
import type { PersonRig } from "./createCharacter";
import { getFaceTexture } from "./faceTexture";
import { addOutline } from "./outline";
import { makeToonMaterial } from "./toonMaterials";

export type IdolHairStyle = "long" | "twin" | "bob" | "sideTail" | "halfUp" | "hime";
export type IdolHeadpiece = "catEars" | "ribbon" | "bow" | "none";

export interface IdolMember {
  hair: IdolHairStyle;
  hairColor: number;
  /** Optional second hair colour for two-tone streaks. */
  streakColor?: number;
  /** Member colour used for ties, ribbons, inner ears and skirt piping. */
  accent: number;
  headpiece: IdolHeadpiece;
  expression: "open" | "closed";
  eye: number;
  socks: "knee" | "thigh";
  sleeves: "crop" | "jacket";
}

/**
 * Stage costume is uniform across the team; only hair and accents vary. The
 * cel ramp lights the top step to full white, so trims stay dark greys or the
 * outfit reads as a white maid dress instead of black-and-silver gothic.
 */
const OUTFIT_BLACK = 0x17141d;
const OUTFIT_CHARCOAL = 0x2a2733;
const OUTFIT_SILVER = 0x6a7280;
const SHOE_BLACK = 0x131118;
const SHOE_SOLE = 0x30343d;
const IDOL_SKIN = 0xf6bd9b;

/** Rig-space anchors. The pelvis must stay at 0.64 for applyPersonPose. */
const PELVIS_Y = 0.64;
const CHEST_Y = 0.3;
const NECK_Y = 0.5825;
const HEAD_RADIUS = 0.35;

const geometries = {
  head: new THREE.SphereGeometry(HEAD_RADIUS, 16, 12).scale(1, 0.95, 0.94),
  hairShell: new THREE.SphereGeometry(0.372, 14, 10).scale(1.05, 1.04, 0.9),
  face: new THREE.SphereGeometry(0.3525, 24, 18, -Math.PI / 2 - 0.95, 1.9, 1.0, 1.2),
  fringe: new THREE.ConeGeometry(0.062, 0.26, 4),
  ahoge: new THREE.ConeGeometry(0.028, 0.26, 4),
  sideLock: new THREE.CapsuleGeometry(0.075, 0.26, 4, 8),
  longLock: new THREE.CapsuleGeometry(0.085, 0.42, 4, 8),
  tail: new THREE.CapsuleGeometry(0.095, 0.3, 4, 8),
  knot: new THREE.SphereGeometry(0.11, 8, 6),
  tie: new THREE.TorusGeometry(0.075, 0.024, 6, 10),
  ear: new THREE.ConeGeometry(0.085, 0.19, 4),
  earInner: new THREE.ConeGeometry(0.05, 0.12, 4),
  ribbonLoop: new THREE.BoxGeometry(0.15, 0.1, 0.06),
  ribbonKnot: new THREE.SphereGeometry(0.04, 6, 5),
  top: new THREE.CylinderGeometry(0.2, 0.235, 0.22, 12),
  collar: new THREE.CylinderGeometry(0.206, 0.206, 0.022, 12),
  topHem: new THREE.CylinderGeometry(0.238, 0.238, 0.022, 12),
  midriff: new THREE.CylinderGeometry(0.185, 0.2, 0.19, 12),
  belt: new THREE.TorusGeometry(0.205, 0.02, 6, 14),
  skirtTop: new THREE.CylinderGeometry(0.2, 0.26, 0.1, 14),
  skirtMid: new THREE.CylinderGeometry(0.25, 0.31, 0.08, 14),
  skirtHem: new THREE.CylinderGeometry(0.295, 0.35, 0.07, 14),
  skirtPiping: new THREE.CylinderGeometry(0.353, 0.353, 0.018, 14),
  upperArm: new THREE.CapsuleGeometry(0.058, 0.1, 4, 8),
  lowerArm: new THREE.CapsuleGeometry(0.052, 0.1, 4, 8),
  hand: new THREE.SphereGeometry(0.068, 8, 6),
  upperLeg: new THREE.CapsuleGeometry(0.085, 0.1, 4, 8),
  lowerLeg: new THREE.CapsuleGeometry(0.08, 0.11, 4, 8),
  sockCuff: new THREE.CylinderGeometry(0.088, 0.088, 0.03, 10),
  shoe: new THREE.BoxGeometry(0.2, 0.14, 0.3),
  sole: new THREE.BoxGeometry(0.212, 0.07, 0.31),
  shadow: new THREE.CircleGeometry(0.36, 16),
};

/**
 * Big-headed (~2.8 head) stage idol sharing the PersonRig joint layout, so the
 * existing dance, knockback and outline-quality code drives it unchanged.
 */
export function createChibiIdol(member: IdolMember, scale = 0.8): PersonRig {
  const materials = {
    skin: makeToonMaterial(IDOL_SKIN),
    hair: makeToonMaterial(member.hairColor),
    streak: makeToonMaterial(member.streakColor ?? member.hairColor),
    accent: makeToonMaterial(member.accent, member.accent),
    black: makeToonMaterial(OUTFIT_BLACK),
    charcoal: makeToonMaterial(OUTFIT_CHARCOAL),
    silver: makeToonMaterial(OUTFIT_SILVER),
    shoe: makeToonMaterial(SHOE_BLACK),
    sole: makeToonMaterial(SHOE_SOLE),
  };

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const pelvis = new THREE.Group();
  pelvis.position.y = PELVIS_Y;
  body.add(pelvis);
  const chest = new THREE.Group();
  chest.position.y = CHEST_Y;
  pelvis.add(chest);
  const neck = new THREE.Group();
  neck.position.set(0, NECK_Y, -0.02);
  chest.add(neck);

  const shadow = new THREE.Mesh(
    geometries.shadow,
    new THREE.MeshBasicMaterial({ color: 0x050307, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shadow.name = "shadow";
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  const legMaterial = member.socks === "thigh" ? materials.black : materials.skin;
  const leftLeg = createLeg(-0.115, legMaterial, materials);
  const rightLeg = createLeg(0.115, legMaterial, materials);
  pelvis.add(leftLeg.hip, rightLeg.hip);

  addTorso(chest, materials);
  addSkirt(pelvis, materials);

  const sleeveMaterial = member.sleeves === "jacket" ? materials.black : materials.skin;
  const leftArm = createArm(-1, sleeveMaterial, materials);
  const rightArm = createArm(1, sleeveMaterial, materials);
  chest.add(leftArm.shoulder, rightArm.shoulder);

  const head = new THREE.Mesh(geometries.head, materials.skin);
  head.name = "head";
  neck.add(head);

  const face = new THREE.Mesh(geometries.face, makeFaceMaterial(member));
  face.name = "face";
  head.add(face);

  addHairShell(head, materials.hair);
  addFringe(head, materials, Boolean(member.streakColor));
  addHairStyle(head, member, materials);
  addHeadpiece(head, member, materials);

  group.scale.setScalar(scale);
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object !== shadow;
    object.receiveShadow = object !== shadow;
  });

  const outlines: THREE.Mesh[] = [];
  const targets: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object === shadow || object === face) return;
    targets.push(object);
  });
  for (const mesh of targets) outlines.push(addOutline(mesh));

  return {
    rigVersion: 2,
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

type IdolMaterials = Record<
  "skin" | "hair" | "streak" | "accent" | "black" | "charcoal" | "silver" | "shoe" | "sole",
  THREE.Material
>;

function createLeg(
  x: number,
  legMaterial: THREE.Material,
  materials: IdolMaterials,
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
  hip.position.set(x, 0, 0.01);
  const upperLeg = new THREE.Mesh(geometries.upperLeg, legMaterial);
  upperLeg.name = "thigh";
  upperLeg.position.y = -0.135;
  if (legMaterial === materials.black) {
    const band = new THREE.Mesh(geometries.sockCuff, materials.silver);
    band.name = "sock-cuff";
    band.position.y = 0.115;
    upperLeg.add(band);
  }

  const knee = new THREE.Group();
  knee.position.y = -0.27;
  const lowerLeg = new THREE.Mesh(geometries.lowerLeg, materials.black);
  lowerLeg.name = "sock";
  lowerLeg.position.y = -0.135;

  const ankle = new THREE.Group();
  ankle.position.y = -0.27;
  const footPivot = new THREE.Group();
  const foot = new THREE.Mesh(geometries.shoe, materials.shoe);
  foot.name = "shoe";
  foot.position.set(0, 0.03, -0.08);
  const sole = new THREE.Mesh(geometries.sole, materials.sole);
  sole.name = "shoe-sole";
  sole.position.y = -0.095;
  foot.add(sole);

  footPivot.add(foot);
  ankle.add(footPivot);
  knee.add(lowerLeg, ankle);
  hip.add(upperLeg, knee);
  return { hip, upperLeg, knee, lowerLeg, ankle, footPivot, foot };
}

function createArm(
  side: number,
  sleeveMaterial: THREE.Material,
  materials: IdolMaterials,
): { shoulder: THREE.Group; upperArm: THREE.Mesh; elbow: THREE.Group; hand: THREE.Mesh } {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.245, 0.21, 0);
  shoulder.rotation.z = side * -0.12;
  const upperArm = new THREE.Mesh(geometries.upperArm, sleeveMaterial);
  upperArm.name = "upper-arm";
  upperArm.position.y = -0.11;

  const elbow = new THREE.Group();
  elbow.position.y = -0.22;
  // Black arm warmer covers the forearm on every member for a uniform stage look.
  const lowerArm = new THREE.Mesh(geometries.lowerArm, materials.black);
  lowerArm.name = "arm-warmer";
  lowerArm.position.y = -0.105;
  const hand = new THREE.Mesh(geometries.hand, materials.skin);
  hand.name = "hand";
  hand.position.y = -0.225;

  elbow.add(lowerArm, hand);
  shoulder.add(upperArm, elbow);
  return { shoulder, upperArm, elbow, hand };
}

function addTorso(chest: THREE.Group, materials: IdolMaterials): void {
  const top = new THREE.Mesh(geometries.top, materials.black);
  top.name = "crop-top";
  top.position.y = 0.1;
  top.scale.z = 0.82;

  const collar = new THREE.Mesh(geometries.collar, materials.silver);
  collar.name = "collar";
  collar.position.y = 0.205;
  collar.scale.z = 0.82;

  const hem = new THREE.Mesh(geometries.topHem, materials.silver);
  hem.name = "top-hem";
  hem.position.y = 0.005;
  hem.scale.z = 0.82;

  const midriff = new THREE.Mesh(geometries.midriff, materials.skin);
  midriff.name = "midriff";
  midriff.position.y = -0.095;
  midriff.scale.z = 0.8;

  const belt = new THREE.Mesh(geometries.belt, materials.silver);
  belt.name = "belt";
  belt.position.y = -0.19;
  belt.rotation.x = Math.PI / 2;
  belt.scale.z = 0.8;

  chest.add(top, collar, hem, midriff, belt);
}

function addSkirt(pelvis: THREE.Group, materials: IdolMaterials): void {
  const tiers: [THREE.BufferGeometry, THREE.Material, number][] = [
    [geometries.skirtTop, materials.black, 0.05],
    [geometries.skirtMid, materials.charcoal, -0.015],
    [geometries.skirtHem, materials.black, -0.07],
  ];
  for (const [geometry, material, y] of tiers) {
    const tier = new THREE.Mesh(geometry, material);
    tier.name = "skirt-tier";
    tier.position.y = y;
    tier.scale.z = 0.86;
    pelvis.add(tier);
  }

  const piping = new THREE.Mesh(geometries.skirtPiping, materials.silver);
  piping.name = "skirt-piping";
  piping.position.y = -0.103;
  piping.scale.z = 0.86;
  pelvis.add(piping);
}

function makeFaceMaterial(member: IdolMember): THREE.MeshToonMaterial {
  const material = makeToonMaterial(0xffffff);
  material.map = getFaceTexture(
    member.eye,
    member.expression === "closed" ? "chibi-closed" : "chibi-open",
  );
  material.transparent = true;
  // Decal shell sits 2.5mm off the skull; skip depth writes to avoid z-fighting.
  material.depthWrite = false;
  return material;
}

function addHairShell(head: THREE.Mesh, hairMaterial: THREE.Material): void {
  const shell = new THREE.Mesh(geometries.hairShell, hairMaterial);
  shell.name = "hair-back";
  shell.position.set(0, 0.008, 0.115);
  head.add(shell);
}

const FRINGE_AZIMUTHS = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0];
const FRINGE_ROOT_Y = 0.235;
const STRAND_HALF_LENGTH = 0.13;
const STRAND_ROOT_EMBED = 0.04;

/** Pointed fringe over the brow; the middle strands carry the two-tone streak. */
function addFringe(head: THREE.Mesh, materials: IdolMaterials, streaked: boolean): void {
  const ringRadius = Math.sqrt(HEAD_RADIUS ** 2 - FRINGE_ROOT_Y ** 2);
  const up = new THREE.Vector3(0, 1, 0);

  FRINGE_AZIMUTHS.forEach((azimuth, index) => {
    const root = new THREE.Vector3(
      Math.sin(azimuth) * ringRadius,
      FRINGE_ROOT_Y,
      -Math.cos(azimuth) * ringRadius,
    );
    // Hang downward but follow the skull outward, so the tips clear the brow.
    const direction = new THREE.Vector3(0, -1, 0)
      .addScaledVector(root.clone().divideScalar(HEAD_RADIUS), 0.5)
      .normalize();

    const streak = streaked && (index === 2 || index === 3);
    const strand = new THREE.Mesh(geometries.fringe, streak ? materials.streak : materials.hair);
    strand.name = "hair-strand";
    strand.quaternion.setFromUnitVectors(up, direction);
    strand.position.copy(root).addScaledVector(direction, STRAND_HALF_LENGTH - STRAND_ROOT_EMBED);
    head.add(strand);
  });

  const ahoge = new THREE.Mesh(geometries.ahoge, materials.hair);
  ahoge.name = "hair-ahoge";
  ahoge.position.set(0.02, 0.34, 0.02);
  ahoge.rotation.set(0.55, 0, -0.25);
  head.add(ahoge);
}

function addHairStyle(head: THREE.Mesh, member: IdolMember, materials: IdolMaterials): void {
  const hair = materials.hair;
  const streak = member.streakColor ? materials.streak : materials.hair;

  if (member.hair === "long") {
    for (const side of [-1, 1]) {
      const lock = new THREE.Mesh(geometries.longLock, side < 0 ? streak : hair);
      lock.name = "hair-lock";
      lock.position.set(side * 0.315, -0.24, 0.12);
      lock.rotation.z = side * -0.08;
      head.add(lock);
    }
    return;
  }

  if (member.hair === "twin") {
    for (const side of [-1, 1]) {
      const tail = new THREE.Mesh(geometries.tail, hair);
      tail.name = "hair-tail";
      tail.position.set(side * 0.36, 0.02, 0.16);
      tail.rotation.z = side * -0.55;
      const tie = new THREE.Mesh(geometries.tie, materials.accent);
      tie.name = "hair-tie";
      tie.position.set(side * 0.29, 0.16, 0.14);
      tie.rotation.y = Math.PI / 2;
      head.add(tail, tie);
    }
    return;
  }

  if (member.hair === "bob") {
    for (const side of [-1, 1]) {
      const lobe = new THREE.Mesh(geometries.sideLock, hair);
      lobe.name = "hair-lock";
      lobe.position.set(side * 0.3, -0.1, 0.07);
      lobe.rotation.z = side * -0.12;
      head.add(lobe);
    }
    return;
  }

  if (member.hair === "sideTail") {
    const tail = new THREE.Mesh(geometries.tail, hair);
    tail.name = "hair-tail";
    tail.position.set(0.35, -0.12, 0.15);
    tail.rotation.z = -0.35;
    const tie = new THREE.Mesh(geometries.tie, materials.accent);
    tie.name = "hair-tie";
    tie.position.set(0.28, 0.08, 0.13);
    tie.rotation.y = Math.PI / 2;
    const lock = new THREE.Mesh(geometries.sideLock, streak);
    lock.name = "hair-lock";
    lock.position.set(-0.29, -0.12, 0.05);
    lock.rotation.z = 0.12;
    head.add(tail, tie, lock);
    return;
  }

  if (member.hair === "halfUp") {
    const knot = new THREE.Mesh(geometries.knot, hair);
    knot.name = "hair-knot";
    knot.position.set(0, 0.26, 0.28);
    const tie = new THREE.Mesh(geometries.tie, materials.accent);
    tie.name = "hair-tie";
    tie.position.set(0, 0.16, 0.3);
    tie.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const lock = new THREE.Mesh(geometries.longLock, hair);
      lock.name = "hair-lock";
      lock.position.set(side * 0.18, -0.26, 0.24);
      lock.rotation.z = side * -0.05;
      head.add(lock);
    }
    head.add(knot, tie);
    return;
  }

  // hime: blunt straight locks framing the face, plus long hair down the back.
  for (const side of [-1, 1]) {
    const frame = new THREE.Mesh(geometries.sideLock, side > 0 ? streak : hair);
    frame.name = "hair-lock";
    frame.position.set(side * 0.3, -0.14, -0.03);
    frame.scale.set(0.9, 1.05, 0.9);
    head.add(frame);

    const back = new THREE.Mesh(geometries.longLock, hair);
    back.name = "hair-lock";
    back.position.set(side * 0.16, -0.28, 0.26);
    head.add(back);
  }
}

function addHeadpiece(head: THREE.Mesh, member: IdolMember, materials: IdolMaterials): void {
  if (member.headpiece === "none") return;

  if (member.headpiece === "catEars") {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(geometries.ear, materials.hair);
      ear.name = "ear";
      ear.position.set(side * 0.19, 0.31, 0.03);
      ear.rotation.set(-0.12, 0, side * 0.3);
      const inner = new THREE.Mesh(geometries.earInner, materials.accent);
      inner.name = "ear-inner";
      inner.position.set(0, -0.012, -0.028);
      ear.add(inner);
      head.add(ear);
    }
    return;
  }

  const spread = member.headpiece === "ribbon" ? 0.13 : 0.09;
  const size = member.headpiece === "ribbon" ? 1 : 0.7;
  const offsetX = member.headpiece === "ribbon" ? 0 : 0.19;
  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(geometries.ribbonLoop, materials.accent);
    loop.name = "ribbon-loop";
    loop.position.set(offsetX + side * spread, 0.32, 0.05);
    loop.rotation.z = side * 0.45;
    loop.scale.setScalar(size);
    head.add(loop);
  }
  const knot = new THREE.Mesh(geometries.ribbonKnot, materials.accent);
  knot.name = "ribbon-knot";
  knot.position.set(offsetX, 0.32, 0.05);
  knot.scale.setScalar(size);
  head.add(knot);
}
