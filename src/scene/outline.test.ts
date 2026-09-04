import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { addOutline, OUTLINE_THICKNESS } from "./outline";

describe("addOutline", () => {
  it("attaches a back-faced shell that shares the source geometry", () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6));
    const shell = addOutline(mesh);

    expect(shell.parent).toBe(mesh);
    expect(shell.geometry).toBe(mesh.geometry);
    expect((shell.material as THREE.MeshBasicMaterial).side).toBe(THREE.BackSide);
    expect(shell.castShadow).toBe(false);
    expect(shell.receiveShadow).toBe(false);
  });

  it("grows the silhouette by a fixed thickness regardless of mesh size", () => {
    const sizes = [0.05, 0.27, 1.4];

    for (const radius of sizes) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8));
      const shell = addOutline(mesh);
      const grown = radius * shell.scale.x;

      expect(grown - radius).toBeCloseTo(OUTLINE_THICKNESS, 6);
    }
  });
});
