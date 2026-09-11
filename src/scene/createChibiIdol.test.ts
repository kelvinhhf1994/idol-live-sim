import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { IDOL_MEMBERS } from "../show/idolMembers";
import { createChibiIdol, type IdolMember } from "./createChibiIdol";

const rosie: IdolMember = IDOL_MEMBERS[0];

function meshesNamed(root: THREE.Object3D, name: string): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name === name) found.push(child);
  });
  return found;
}

function boundingSize(rig: { group: THREE.Object3D }): THREE.Vector3 {
  return new THREE.Box3().setFromObject(rig.group).getSize(new THREE.Vector3());
}

describe("createChibiIdol", () => {
  it("exposes the V2 rig joints the pose system drives", () => {
    const rig = createChibiIdol(rosie);

    expect(rig.rigVersion).toBe(2);
    expect(rig.pelvisRestY).toBeCloseTo(0.91, 5);
    expect(rig.pelvis.position.y).toBeCloseTo(0.91, 5);
    expect(rig.leftElbow.position.y).toBeCloseTo(-0.265, 5);
    expect(rig.leftKnee.position.y).toBeCloseTo(-0.43, 5);
    expect(rig.leftAnkle.position.y).toBeCloseTo(-0.4, 5);
    expect(rig.leftShoulder.position.x).toBeCloseTo(-0.19, 5);
    expect(rig.leftHip.position.x).toBeCloseTo(-0.11, 5);
    expect(rig.leftArm).toBe(rig.leftShoulder);
    expect(rig.leftForearm).toBe(rig.leftElbow);
    expect(rig.leftHand.parent).toBeInstanceOf(THREE.Object3D);
    expect(rig.glowStick).toBeNull();
  });

  it("stands on the ground with a short body and a full-size round head", () => {
    const rig = createChibiIdol(rosie);
    const box = new THREE.Box3().setFromObject(rig.group);
    rig.head.geometry.computeBoundingBox();
    const skullHeight =
      (rig.head.geometry.boundingBox?.getSize(new THREE.Vector3()).y ?? 0) *
      rig.group.scale.y *
      rig.head.scale.y;

    expect(Math.abs(box.min.y)).toBeLessThan(0.04);
    expect(box.max.y).toBeGreaterThan(1.15);
    expect(box.max.y).toBeLessThan(1.85);
    expect(box.max.y / skullHeight).toBeGreaterThan(2.8);
    expect(box.max.y / skullHeight).toBeLessThan(4.6);
  });

  it("keeps the slim atlas silhouette shorter than the adult weekend hero", () => {
    expect(boundingSize(createChibiIdol(rosie)).y).toBeLessThan(1.8842);
    expect(boundingSize(createChibiIdol(rosie)).x).toBeLessThan(0.95);
  });

  it("uses clay standard materials instead of the old cel ramp", () => {
    const rig = createChibiIdol(rosie);

    for (const mesh of [rig.head, rig.leftUpperArm, rig.rightUpperLeg, rig.leftFoot]) {
      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    }
  });

  it("builds a clay face looking toward stage-front +Z with Rosie twin tails", () => {
    const rig = createChibiIdol(rosie);

    expect(meshesNamed(rig.head, "eye")).toHaveLength(2);
    expect(meshesNamed(rig.head, "face")).toHaveLength(0);
    expect(meshesNamed(rig.head, "hair-strand").length).toBeGreaterThanOrEqual(2);
    expect(meshesNamed(rig.group, "skirt").length).toBeGreaterThan(0);
    expect(meshesNamed(rig.group, "shoe-sole")).toHaveLength(2);

    const eye = meshesNamed(rig.head, "eye")[0];
    expect(eye.position.z).toBeGreaterThan(0);
  });

  it("outlines the body but not the ground shadow or tiny face details", () => {
    const rig = createChibiIdol(rosie);

    expect(rig.outlines.length).toBeGreaterThan(10);
    for (const shell of rig.outlines) {
      expect((shell.material as THREE.MeshBasicMaterial).side).toBe(THREE.BackSide);
      expect(shell.castShadow).toBe(false);
    }
    expect(meshesNamed(meshesNamed(rig.group, "shadow")[0], "outline")).toHaveLength(0);
    expect(meshesNamed(meshesNamed(rig.head, "eye")[0], "outline")).toHaveLength(0);
  });

  it("builds every roster member with her named hair and outfit pieces", () => {
    const expected = {
      twintails: "hair-strand",
      bob: "barrette",
      ponytail: "hair-strand",
      buns: "space-bun",
      long: "hair-strand",
      sidebraid: "braid-link",
      waves: "hair-strand",
      pixie: "swept-crown",
      sidepony: "hair-strand",
      braids: "braid-link",
      curls: "curl",
      hime: "hime-side-lock",
    } as const;

    for (const member of IDOL_MEMBERS) {
      const rig = createChibiIdol(member);
      const box = new THREE.Box3().setFromObject(rig.group);

      expect(rig.group.name).toBe(member.name);
      expect(Math.abs(box.min.y)).toBeLessThan(0.08);
      expect(meshesNamed(rig.group, "bodice").length).toBeGreaterThan(0);
      expect(meshesNamed(rig.head, expected[member.hairStyle]).length).toBeGreaterThan(0);
    }
  });
});
