import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { resolveCameraDistance } from "./CameraController";

describe("resolveCameraDistance", () => {
  it("keeps the camera on the player side of a nearby wall", () => {
    const distance = resolveCameraDistance(new THREE.Vector3(0, 1, 0), 0, 4.2, [
      { minX: -1, maxX: 1, minZ: 0.2, maxZ: 0.4 },
    ]);

    expect(distance).toBeLessThan(0.2);
  });
});
