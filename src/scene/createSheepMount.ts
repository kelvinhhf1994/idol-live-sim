import * as THREE from "three";
import { addOutline } from "./outline";

/**
 * Plush bouclé "sheep" footstool the hero rides during FT Special.
 * Proportions follow the product photo (83 cm long, 50 cm seat) but the body is
 * widened to 60 cm and the head to 1.5x for a chubbier look.
 * Faces -Z like the hero. Built only from spheres and capsules.
 */
export interface SheepMount {
  group: THREE.Group;
  /** Torso pivot; nods with the gallop. */
  body: THREE.Group;
  head: THREE.Group;
  frontLeftLeg: THREE.Group;
  frontRightLeg: THREE.Group;
  rearLeftLeg: THREE.Group;
  rearRightLeg: THREE.Group;
}

/** Top of the flat back where the rider sits. */
export const SHEEP_SEAT_HEIGHT = 0.5;
/** Body width multiplier over the 0.30 m product sheet. */
export const SHEEP_WIDTH_SCALE = 2;
/** Uniform head multiplier (width, height and length grow together). */
export const SHEEP_HEAD_SCALE = 1.5;
/** Radius of the chunky loaf-shaped head before scaling. */
export const SHEEP_HEAD_RADIUS = 0.11;
/** Resting muzzle tilt (radians, negative = nose down). The gallop nods around this. */
export const SHEEP_HEAD_TILT = -0.5;

const FLEECE_COLOR = "#f4eee4";
const sphereGeometry = new THREE.SphereGeometry(1, 28, 20);

export function createSheepMount(): SheepMount {
  const fleece = new THREE.MeshStandardMaterial({
    color: FLEECE_COLOR,
    roughness: 1,
    metalness: 0,
  });

  const group = new THREE.Group();
  group.name = "sheep-mount";
  const body = new THREE.Group();
  body.name = "sheep-torso";
  // Chubby plush: twice as wide as the product sheet, head 1.5x (set below).
  body.scale.x = SHEEP_WIDTH_SCALE;
  group.add(body);

  // Rump: big round cushion at the back edge.
  ellipsoid(body, fleece, [0, 0.33, 0.17], [0.15, 0.17, 0.18], "sheep-rump");
  // Body: horizontal capsule from rump to shoulders; its top is the seat.
  const torso = capsule(body, fleece, 0.13, 0.28, [0, SHEEP_SEAT_HEIGHT - 0.13, -0.03], "sheep-body");
  torso.rotation.x = Math.PI / 2;
  // Shoulder bulge where the neck rises, like the pinched front of the stool.
  ellipsoid(body, fleece, [0, 0.42, -0.2], [0.13, 0.13, 0.12], "sheep-shoulder");

  // Neck: short and thick, mostly buried between shoulders and head.
  const neck = capsule(body, fleece, 0.11, 0.08, [0, 0.54, -0.26], "sheep-neck");
  neck.rotation.x = -0.35;

  // Head: one chunky rounded loaf (like the photo) pointing forward and down,
  // with two little ears on the crown. Scaled uniformly; the parent only widens X,
  // so divide that axis back out.
  const head = new THREE.Group();
  head.name = "sheep-head";
  head.position.set(0, 0.66, -0.4);
  head.rotation.x = SHEEP_HEAD_TILT;
  head.scale.set(SHEEP_HEAD_SCALE / SHEEP_WIDTH_SCALE, SHEEP_HEAD_SCALE, SHEEP_HEAD_SCALE);
  body.add(head);
  const loaf = capsule(head, fleece, SHEEP_HEAD_RADIUS, 0.13, [0, 0, 0], "sheep-head-loaf");
  loaf.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    const ear = capsule(head, fleece, 0.032, 0.05, [side * 0.06, SHEEP_HEAD_RADIUS + 0.02, 0.06], "sheep-ear");
    ear.rotation.z = side * -0.3;
    ear.rotation.x = 0.35;
  }

  // Legs pivot at the hip so the gallop swings them from the body.
  const frontLeftLeg = leg(body, fleece, -0.085, -0.2, 0.42, 0.075, "sheep-front-leg");
  const frontRightLeg = leg(body, fleece, 0.085, -0.2, 0.42, 0.075, "sheep-front-leg");
  const rearLeftLeg = leg(body, fleece, -0.08, 0.2, 0.36, 0.085, "sheep-rear-leg");
  const rearRightLeg = leg(body, fleece, 0.08, 0.2, 0.36, 0.085, "sheep-rear-leg");

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  const parts: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) parts.push(object);
  });
  parts.forEach((part) => addOutline(part));

  return { group, body, head, frontLeftLeg, frontRightLeg, rearLeftLeg, rearRightLeg };
}

/** Vertical leg whose pivot sits at hip height `top`; the capsule reaches the floor. */
function leg(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  z: number,
  top: number,
  radius: number,
  name: string,
): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = `${name}-pivot`;
  pivot.position.set(x, top, z);
  parent.add(pivot);
  // Capsule total height = length + 2 * radius; bottom rests on y = 0 with a soft squash.
  const length = top - radius * 2 + 0.02;
  capsule(pivot, material, radius, length, [0, -(length / 2 + radius) + 0.02, 0], name);
  return pivot;
}

function capsule(
  parent: THREE.Object3D,
  material: THREE.Material,
  radius: number,
  length: number,
  position: readonly [number, number, number],
  name: string,
): THREE.Mesh {
  const object = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 14), material);
  object.name = name;
  object.position.set(...position);
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
  const object = new THREE.Mesh(sphereGeometry, material);
  object.name = name;
  object.position.set(...position);
  object.scale.set(...scale);
  parent.add(object);
  return object;
}
