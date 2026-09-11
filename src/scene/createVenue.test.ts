import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GENERIC_FOH_CHAIRS, GENERIC_FOH_DESK, GENERIC_VENUE } from "../config/venue";
import { createVenue } from "./createVenue";

describe("createVenue for Neon Backstage", () => {
  it("builds an FOH desk carrying the sound mixer and lighting console with a chair behind each", () => {
    const build = createVenue(GENERIC_VENUE);
    build.group.updateMatrixWorld(true);
    const desk = build.group.getObjectByName("foh-desk")!;
    expect(desk).toBeDefined();
    expect(desk.getObjectByName("sound-mixer")).toBeDefined();
    expect(desk.getObjectByName("lighting-console")).toBeDefined();

    const chairs: THREE.Object3D[] = [];
    desk.traverse((o) => {
      if (o.name === "foh-chair") chairs.push(o);
    });
    expect(chairs).toHaveLength(2);
    chairs.forEach((chair, i) => {
      const pos = chair.getWorldPosition(new THREE.Vector3());
      expect(pos.x).toBeCloseTo(GENERIC_FOH_CHAIRS[i].x, 5);
      expect(pos.z).toBeCloseTo(GENERIC_FOH_CHAIRS[i].z, 5);
      expect(pos.z).toBeGreaterThan(GENERIC_FOH_DESK.z + GENERIC_FOH_DESK.depth / 2);
    });

    for (const name of ["sound-mixer", "lighting-console"]) {
      const box = new THREE.Box3().setFromObject(desk.getObjectByName(name)!);
      expect(box.min.y).toBeCloseTo(0.78, 2); // Resting on the desk top
      expect(box.min.x).toBeGreaterThan(GENERIC_FOH_DESK.x - GENERIC_FOH_DESK.width / 2);
      expect(box.max.x).toBeLessThan(GENERIC_FOH_DESK.x + GENERIC_FOH_DESK.width / 2);
    }
  });
});
