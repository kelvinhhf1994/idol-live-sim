import * as THREE from "three";

export interface CharacterPalette {
  skin: number;
  hair: number;
  top: number;
  bottom: number;
  accent: number;
}

export interface CharacterOptions {
  palette?: Partial<CharacterPalette>;
  scale?: number;
  hairStyle?: "bob" | "ponytail" | "short" | "twin";
  skirt?: boolean;
  glowStick?: boolean;
}

export interface PersonRig {
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftHand: THREE.Mesh;
  rightHand: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
}

const geometries = {
  head: new THREE.SphereGeometry(0.27, 12, 8),
  hair: new THREE.SphereGeometry(0.285, 10, 7),
  torso: new THREE.CylinderGeometry(0.23, 0.3, 0.58, 8),
  skirt: new THREE.CylinderGeometry(0.26, 0.39, 0.42, 10),
  limb: new THREE.CapsuleGeometry(0.07, 0.34, 4, 8),
  armSegment: new THREE.CapsuleGeometry(0.065, 0.16, 4, 8),
  hand: new THREE.SphereGeometry(0.075, 8, 6),
  shoe: new THREE.BoxGeometry(0.18, 0.12, 0.28),
  eye: new THREE.SphereGeometry(0.025, 6, 4),
  ponytail: new THREE.CapsuleGeometry(0.105, 0.2, 4, 8),
  glowStick: new THREE.CylinderGeometry(0.018, 0.018, 0.48, 6),
  shadow: new THREE.CircleGeometry(0.4, 16),
};

const defaultPalette: CharacterPalette = {
  skin: 0xf1ad85,
  hair: 0x211923,
  top: 0xe8e0d4,
  bottom: 0x26202e,
  accent: 0xff397d,
};

export function createLowPolyPerson(options: CharacterOptions = {}): PersonRig {
  const palette = { ...defaultPalette, ...options.palette };
  const materials = {
    skin: makeMaterial(palette.skin),
    hair: makeMaterial(palette.hair),
    top: makeMaterial(palette.top),
    bottom: makeMaterial(palette.bottom),
    accent: makeMaterial(palette.accent, palette.accent),
    eye: makeMaterial(0x171119),
    shoe: makeMaterial(0x100d14),
  };

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const shadow = new THREE.Mesh(
    geometries.shadow,
    new THREE.MeshBasicMaterial({ color: 0x050307, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  const leftLeg = createLeg(-0.14, materials.bottom, materials.shoe);
  const rightLeg = createLeg(0.14, materials.bottom, materials.shoe);
  body.add(leftLeg.pivot, rightLeg.pivot);

  const torso = new THREE.Mesh(geometries.torso, materials.top);
  torso.position.y = 1.04;
  torso.scale.z = 0.74;
  body.add(torso);

  if (options.skirt) {
    const skirt = new THREE.Mesh(geometries.skirt, materials.bottom);
    skirt.position.y = 0.74;
    body.add(skirt);
  }

  const leftArm = createArm(-1, materials.top, materials.skin);
  const rightArm = createArm(1, materials.top, materials.skin);
  body.add(leftArm.pivot, rightArm.pivot);

  const hairBack = new THREE.Mesh(geometries.hair, materials.hair);
  hairBack.position.set(0, 1.55, 0.04);
  hairBack.scale.set(1.06, 1.08, 0.92);
  body.add(hairBack);

  const head = new THREE.Mesh(geometries.head, materials.skin);
  head.position.set(0, 1.55, -0.055);
  head.scale.set(0.94, 1.03, 0.9);
  body.add(head);

  addHair(body, options.hairStyle ?? "short", materials.hair, materials.accent);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(geometries.eye, materials.eye);
    eye.position.set(side * 0.075, 1.585, -0.29);
    body.add(eye);
  }

  if (options.glowStick) {
    const stick = new THREE.Mesh(geometries.glowStick, materials.accent);
    stick.position.set(0, -0.55, -0.02);
    stick.rotation.z = 0.15;
    rightArm.pivot.add(stick);
  }

  group.scale.setScalar(options.scale ?? 1);
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object !== shadow;
    object.receiveShadow = object !== shadow;
  });

  return {
    group,
    body,
    head,
    leftArm: leftArm.pivot,
    rightArm: rightArm.pivot,
    leftForearm: leftArm.forearm,
    rightForearm: rightArm.forearm,
    leftHand: leftArm.hand,
    rightHand: rightArm.hand,
    leftLeg: leftLeg.pivot,
    rightLeg: rightLeg.pivot,
    leftFoot: leftLeg.foot,
    rightFoot: rightLeg.foot,
  };
}

function createLeg(
  x: number,
  legMaterial: THREE.Material,
  shoeMaterial: THREE.Material,
): { pivot: THREE.Group; foot: THREE.Mesh } {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.64, 0.02);
  const leg = new THREE.Mesh(geometries.limb, legMaterial);
  leg.position.y = -0.3;
  const foot = new THREE.Mesh(geometries.shoe, shoeMaterial);
  foot.position.set(0, -0.58, -0.075);
  pivot.add(leg, foot);
  return { pivot, foot };
}

function createArm(
  side: number,
  sleeveMaterial: THREE.Material,
  skinMaterial: THREE.Material,
): { pivot: THREE.Group; forearm: THREE.Group; hand: THREE.Mesh } {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.31, 1.25, 0);
  pivot.rotation.z = side * -0.12;
  const upperArm = new THREE.Mesh(geometries.armSegment, sleeveMaterial);
  upperArm.position.y = -0.145;
  const forearm = new THREE.Group();
  forearm.position.y = -0.29;
  const lowerArm = new THREE.Mesh(geometries.armSegment, skinMaterial);
  lowerArm.position.y = -0.145;
  const hand = new THREE.Mesh(geometries.hand, skinMaterial);
  hand.position.y = -0.3;
  forearm.add(lowerArm, hand);
  pivot.add(upperArm, forearm);
  return { pivot, forearm, hand };
}

function addHair(
  body: THREE.Group,
  style: NonNullable<CharacterOptions["hairStyle"]>,
  hairMaterial: THREE.Material,
  accentMaterial: THREE.Material,
): void {
  if (style === "short") {
    const fringe = new THREE.Mesh(geometries.ponytail, hairMaterial);
    fringe.position.set(-0.08, 1.72, -0.18);
    fringe.rotation.z = 1.25;
    body.add(fringe);
    return;
  }

  if (style === "bob") {
    for (const side of [-1, 1]) {
      const sideHair = new THREE.Mesh(geometries.ponytail, hairMaterial);
      sideHair.position.set(side * 0.22, 1.45, 0);
      sideHair.rotation.z = side * -0.08;
      body.add(sideHair);
    }
    return;
  }

  if (style === "ponytail") {
    const ponytail = new THREE.Mesh(geometries.ponytail, hairMaterial);
    ponytail.position.set(0.22, 1.47, 0.28);
    ponytail.rotation.z = -0.65;
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 10), accentMaterial);
    tie.position.set(0.15, 1.62, 0.23);
    tie.rotation.y = Math.PI / 2;
    body.add(ponytail, tie);
    return;
  }

  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(geometries.ponytail, hairMaterial);
    tail.position.set(side * 0.23, 1.42, 0.18);
    tail.rotation.z = side * -0.45;
    body.add(tail);
  }
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
