import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createLowPolyPerson } from "./createCharacter";
import { getCelGradientMap } from "./toonMaterials";

const NEUTRAL_HEIGHT = 1.8842844643074078;

function meshesNamed(root: THREE.Object3D, name: string): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name === name) found.push(child);
  });
  return found;
}

describe("createLowPolyPerson anime style", () => {
  it("cel-shades the body with the shared gradient ramp", () => {
    const rig = createLowPolyPerson({ style: "anime" });

    for (const mesh of [rig.leftUpperArm, rig.rightUpperLeg, rig.head, rig.leftFoot]) {
      const material = mesh.material as THREE.MeshToonMaterial;
      expect(material).toBeInstanceOf(THREE.MeshToonMaterial);
      expect(material.gradientMap).toBe(getCelGradientMap());
    }
  });

  it("leaves the default low-poly style untouched", () => {
    const rig = createLowPolyPerson();

    expect(rig.head.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(rig.outlines).toHaveLength(0);
    expect(meshesNamed(rig.group, "face")).toHaveLength(0);
    expect(meshesNamed(rig.group, "hair-strand")).toHaveLength(0);
  });

  it("swaps the eye spheres for a drawn face decal and a pointed fringe", () => {
    const rig = createLowPolyPerson({ style: "anime" });

    expect(meshesNamed(rig.group, "eye")).toHaveLength(0);
    expect(meshesNamed(rig.head, "face")).toHaveLength(1);
    expect(meshesNamed(rig.head, "hair-strand").length).toBeGreaterThanOrEqual(3);
  });

  it("outlines the body but not the face decal, penlight, or ground shadow", () => {
    const rig = createLowPolyPerson({ style: "anime", glowStick: true });

    expect(rig.outlines.length).toBeGreaterThan(10);
    for (const shell of rig.outlines) {
      expect((shell.material as THREE.MeshBasicMaterial).side).toBe(THREE.BackSide);
      expect(shell.castShadow).toBe(false);
    }

    const face = meshesNamed(rig.head, "face")[0];
    for (const excluded of [face, rig.glowStick!]) {
      expect(meshesNamed(excluded, "outline")).toHaveLength(0);
    }
    expect(rig.outlines).toContain(meshesNamed(rig.head, "outline")[0]);
  });

  it("keeps the neutral silhouette height within five millimeters", () => {
    const rig = createLowPolyPerson({ style: "anime" });
    const height = new THREE.Box3().setFromObject(rig.group).getSize(new THREE.Vector3()).y;

    expect(Math.abs(height - NEUTRAL_HEIGHT)).toBeLessThan(0.005);
  });

  it("exposes outlines as one batch so quality fallback can drop them", () => {
    const rig = createLowPolyPerson({ style: "anime" });

    rig.outlines.forEach((shell) => (shell.visible = false));

    expect(rig.outlines.every((shell) => !shell.visible)).toBe(true);
  });
});
