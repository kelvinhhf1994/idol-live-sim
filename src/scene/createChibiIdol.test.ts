import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { IDOL_MEMBERS } from "../show/idolMembers";
import { createChibiIdol, type IdolMember } from "./createChibiIdol";
import { getFaceTexture } from "./faceTexture";
import { getCelGradientMap } from "./toonMaterials";

const baseMember: IdolMember = {
  hair: "twin",
  hairColor: 0x201828,
  accent: 0xff397d,
  headpiece: "catEars",
  expression: "open",
  eye: 0x8b5cf6,
  socks: "knee",
  sleeves: "crop",
};

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
    const rig = createChibiIdol(baseMember);

    expect(rig.rigVersion).toBe(2);
    expect(rig.pelvis.position.y).toBeCloseTo(0.64, 5);
    for (const joint of [
      rig.body,
      rig.chest,
      rig.neck,
      rig.leftShoulder,
      rig.rightElbow,
      rig.leftHip,
      rig.rightKnee,
      rig.leftFootPivot,
    ]) {
      expect(joint).toBeInstanceOf(THREE.Object3D);
    }
    expect(rig.glowStick).toBeNull();
  });

  it("stands on the ground with chibi proportions of roughly three heads", () => {
    const rig = createChibiIdol(baseMember);
    const box = new THREE.Box3().setFromObject(rig.group);
    rig.head.geometry.computeBoundingBox();
    const skullHeight =
      (rig.head.geometry.boundingBox?.getSize(new THREE.Vector3()).y ?? 0) * rig.group.scale.y;

    expect(Math.abs(box.min.y)).toBeLessThan(0.005);
    expect(box.max.y).toBeGreaterThan(1.2);
    expect(box.max.y).toBeLessThan(1.75);
    expect(box.max.y / skullHeight).toBeGreaterThan(2.4);
    expect(box.max.y / skullHeight).toBeLessThan(3.4);
  });

  it("is shorter than the low-poly hero so the stage reads as a chibi line-up", () => {
    expect(boundingSize(createChibiIdol(baseMember)).y).toBeLessThan(1.8842);
  });

  it("cel-shades every body part with the shared gradient ramp", () => {
    const rig = createChibiIdol(baseMember);

    for (const mesh of [rig.head, rig.leftUpperArm, rig.rightUpperLeg, rig.leftFoot]) {
      const material = mesh.material as THREE.MeshToonMaterial;
      expect(material).toBeInstanceOf(THREE.MeshToonMaterial);
      expect(material.gradientMap).toBe(getCelGradientMap());
    }
  });

  it("wears a drawn face instead of eye spheres, with a layered skirt and thick shoes", () => {
    const rig = createChibiIdol(baseMember);

    expect(meshesNamed(rig.group, "eye")).toHaveLength(0);
    expect(meshesNamed(rig.head, "face")).toHaveLength(1);
    expect(meshesNamed(rig.head, "hair-strand").length).toBeGreaterThanOrEqual(5);
    expect(meshesNamed(rig.group, "skirt-tier")).toHaveLength(3);
    expect(meshesNamed(rig.group, "shoe-sole")).toHaveLength(2);
  });

  it("uses the closed-eye decal only for members drawn mid-smile", () => {
    const open = createChibiIdol({ ...baseMember, expression: "open" });
    const closed = createChibiIdol({ ...baseMember, expression: "closed" });

    const openFace = meshesNamed(open.head, "face")[0].material as THREE.MeshToonMaterial;
    const closedFace = meshesNamed(closed.head, "face")[0].material as THREE.MeshToonMaterial;
    expect(openFace.map).toBe(getFaceTexture(baseMember.eye, "chibi-open"));
    expect(closedFace.map).toBe(getFaceTexture(baseMember.eye, "chibi-closed"));
  });

  it("outlines the body but not the face decal or the ground shadow", () => {
    const rig = createChibiIdol(baseMember);

    expect(rig.outlines.length).toBeGreaterThan(10);
    for (const shell of rig.outlines) {
      expect((shell.material as THREE.MeshBasicMaterial).side).toBe(THREE.BackSide);
      expect(shell.castShadow).toBe(false);
    }
    for (const excluded of ["face", "shadow"]) {
      expect(meshesNamed(meshesNamed(rig.group, excluded)[0], "outline")).toHaveLength(0);
    }
  });

  it("builds every roster member with a headpiece where one is configured", () => {
    for (const member of IDOL_MEMBERS) {
      const rig = createChibiIdol(member);
      const box = new THREE.Box3().setFromObject(rig.group);

      expect(Math.abs(box.min.y)).toBeLessThan(0.005);
      const headpieces =
        meshesNamed(rig.head, "ear").length + meshesNamed(rig.head, "ribbon-loop").length;
      expect(headpieces).toBe(member.headpiece === "none" ? 0 : 2);
    }
  });
});
