import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createSheepMount,
  SHEEP_HEAD_RADIUS,
  SHEEP_HEAD_SCALE,
  SHEEP_SEAT_HEIGHT,
  SHEEP_WIDTH_SCALE,
} from "./createSheepMount";

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name !== "outline") found.push(child);
  });
  return found;
}

describe("createSheepMount", () => {
  it("is a chubby stool, twice the sheet width, standing on the floor", () => {
    const mount = createSheepMount();
    mount.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mount.group);
    const size = box.getSize(new THREE.Vector3());

    expect(Math.abs(box.min.y)).toBeLessThan(0.03);
    // The enlarged head pushes the nose forward past the 0.83 m sheet length.
    expect(size.z).toBeGreaterThan(0.8);
    expect(size.z).toBeLessThan(1.15);
    expect(size.x).toBeGreaterThan(0.3 * SHEEP_WIDTH_SCALE - 0.04);
    expect(size.x).toBeLessThan(0.3 * SHEEP_WIDTH_SCALE + 0.08);
    expect(box.max.y).toBeGreaterThan(0.7);
    expect(box.max.y).toBeLessThan(1.05);
  });

  it("grows the loaf-shaped head uniformly by 1.5x", () => {
    const mount = createSheepMount();
    mount.group.updateMatrixWorld(true);
    const loaf = meshes(mount.head).find((part) => part.name === "sheep-head-loaf")!;
    const { radius, height: length } = (loaf.geometry as THREE.CapsuleGeometry).parameters;
    const worldScale = new THREE.Vector3();
    mount.head.getWorldScale(worldScale);

    // Uniform in world space even though the torso only widens X.
    expect(worldScale.x).toBeCloseTo(SHEEP_HEAD_SCALE, 5);
    expect(worldScale.y).toBeCloseTo(SHEEP_HEAD_SCALE, 5);
    expect(worldScale.z).toBeCloseTo(SHEEP_HEAD_SCALE, 5);
    // Chunky block: clearly longer than wide, but not a thin snout.
    expect(radius).toBeCloseTo(SHEEP_HEAD_RADIUS, 5);
    const total = length + radius * 2;
    expect(total / (radius * 2)).toBeGreaterThan(1.3);
    expect(total / (radius * 2)).toBeLessThan(2);
  });

  it("is built only from spheres and capsules", () => {
    const mount = createSheepMount();
    const parts = meshes(mount.group);

    expect(parts.length).toBeGreaterThanOrEqual(9);
    for (const part of parts) {
      const rounded =
        part.geometry instanceof THREE.SphereGeometry ||
        part.geometry instanceof THREE.CapsuleGeometry;
      expect(rounded, `${part.name} should be rounded`).toBe(true);
    }
  });

  it("has four leg pivots at hip height, head in front (-Z) and rump behind (+Z)", () => {
    const mount = createSheepMount();
    mount.group.updateMatrixWorld(true);
    const legs = [mount.frontLeftLeg, mount.frontRightLeg, mount.rearLeftLeg, mount.rearRightLeg];

    for (const leg of legs) {
      expect(leg.position.y).toBeGreaterThan(0.2);
      expect(meshes(leg).length).toBeGreaterThan(0);
    }
    expect(mount.frontLeftLeg.position.x).toBeLessThan(0);
    expect(mount.frontRightLeg.position.x).toBeGreaterThan(0);
    expect(mount.frontLeftLeg.position.z).toBeLessThan(mount.rearLeftLeg.position.z);

    const head = mount.head.getWorldPosition(new THREE.Vector3());
    expect(head.z).toBeLessThan(-0.2);
    expect(head.y).toBeGreaterThan(SHEEP_SEAT_HEIGHT);
    const rump = meshes(mount.group).find((part) => part.name === "sheep-rump");
    expect(rump?.position.z).toBeGreaterThan(0.1);
  });

  it("offers a flat seat at the photographed 0.50 m height", () => {
    const mount = createSheepMount();
    mount.group.updateMatrixWorld(true);
    const body = meshes(mount.group).find((part) => part.name === "sheep-body");
    const box = new THREE.Box3().setFromObject(body!);

    expect(box.max.y).toBeGreaterThan(SHEEP_SEAT_HEIGHT - 0.03);
    expect(box.max.y).toBeLessThan(SHEEP_SEAT_HEIGHT + 0.03);
  });

  it("has no facial features, like the plush stool", () => {
    const mount = createSheepMount();
    const names = meshes(mount.group).map((part) => part.name);

    expect(names.some((name) => /eye|mouth|nose/.test(name))).toBe(false);
    expect(names.filter((name) => name === "sheep-ear")).toHaveLength(2);
  });
});
