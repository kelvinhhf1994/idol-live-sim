import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  clampCameraDestination,
  resolveCameraDistance,
} from "./CameraController";

describe("resolveCameraDistance", () => {
  it("keeps the camera on the player side of a nearby wall", () => {
    const distance = resolveCameraDistance(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 3, 4.2),
      [
      { minX: -1, maxX: 1, minZ: 0.2, maxZ: 0.4 },
      ],
    );

    expect(distance).toBeLessThan(0.2);
  });

  it("does not treat a stage platform below the 3D ray as a full-height wall", () => {
    const target = new THREE.Vector3(0, 2.05, -12);
    const desired = new THREE.Vector3(0, 3.05, -7.8);
    const fullDistance = target.distanceTo(desired);
    const distance = resolveCameraDistance(target, desired, [
      { minX: -5.625, maxX: 5.625, minZ: -14.95, maxZ: -9.075, maxY: 0.75 },
    ]);

    expect(distance).toBeCloseTo(fullDistance);
  });

  it("blocks a low ray through the stage platform", () => {
    const distance = resolveCameraDistance(
      new THREE.Vector3(0, 0.5, -12),
      new THREE.Vector3(0, 0.5, -7.8),
      [{ minX: -5.625, maxX: 5.625, minZ: -14.95, maxZ: -9.075, maxY: 0.75 }],
    );

    expect(distance).toBe(0.15);
  });

  it("uses ray height to block or clear the crowd barrier", () => {
    const barrier = {
      minX: -5.7,
      maxX: 5.7,
      minZ: -8.35,
      maxZ: -8.21,
      maxY: 1.32,
    };
    const low = resolveCameraDistance(
      new THREE.Vector3(0, 1, -9),
      new THREE.Vector3(0, 1, -7),
      [barrier],
    );
    const high = resolveCameraDistance(
      new THREE.Vector3(0, 1.7, -9),
      new THREE.Vector3(0, 1.7, -7),
      [barrier],
    );

    expect(low).toBeLessThan(2);
    expect(high).toBeCloseTo(2);
  });

  it("always blocks colliders without finite height metadata", () => {
    const distance = resolveCameraDistance(
      new THREE.Vector3(0, 8, 0),
      new THREE.Vector3(0, 10, 4),
      [{ minX: -1, maxX: 1, minZ: 1, maxZ: 1.2 }],
    );

    expect(distance).toBeLessThan(new THREE.Vector3(0, 8, 0).distanceTo(new THREE.Vector3(0, 10, 4)));
  });

  it("interpolates sample height between different target and camera Y", () => {
    const distance = resolveCameraDistance(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 2, 4),
      [{ minX: -1, maxX: 1, minZ: 1.8, maxZ: 2.2, maxY: 1.05 }],
    );

    expect(distance).toBeLessThan(Math.sqrt(20));
  });

  it.each([0, Math.PI, Math.PI / 2, -Math.PI / 2])(
    "keeps useful stage-center distance at yaw %s",
    (yaw) => {
      const target = new THREE.Vector3(0, 2.05, -12);
      const desired = new THREE.Vector3(
        target.x + Math.sin(yaw) * 4.2,
        3.05,
        target.z + Math.cos(yaw) * 4.2,
      );
      const distance = resolveCameraDistance(target, desired, [
        { minX: -5.625, maxX: 5.625, minZ: -14.95, maxZ: -9.075, maxY: 0.75 },
      ]);

      expect(distance).toBeGreaterThan(4);
    },
  );

  it.each([-0.7, -0.12, 0.55])(
    "clears the stage at supported pitch %s",
    (pitch) => {
      const playerY = 0.75;
      const target = new THREE.Vector3(
        0,
        playerY + 1.3 + Math.sin(pitch) * 1.5,
        -12,
      );
      const desired = new THREE.Vector3(0, playerY + 2.3, -7.8);
      const distance = resolveCameraDistance(target, desired, [
        { minX: -5.625, maxX: 5.625, minZ: -14.95, maxZ: -9.075, maxY: 0.75 },
      ]);

      expect(distance).toBeGreaterThan(4);
    },
  );
});

describe("clampCameraDestination", () => {
  it("clamps horizontal bounds without changing ray height", () => {
    const destination = new THREE.Vector3(10, 3.05, -20);

    clampCameraDestination(destination, {
      minX: -8.8,
      maxX: 8.8,
      minZ: -15.8,
      maxZ: 26,
    });

    expect(destination.toArray()).toEqual([8.8, 3.05, -15.8]);
  });

  it("checks the changed 3D path after a destination is clamped", () => {
    const target = new THREE.Vector3(0, 2, 0);
    const destination = new THREE.Vector3(12, 3, 6);
    clampCameraDestination(destination, {
      minX: -8.8,
      maxX: 8.8,
      minZ: -15.8,
      maxZ: 26,
    });

    const distance = resolveCameraDistance(target, destination, [
      { minX: 4, maxX: 5, minZ: 2.5, maxZ: 3.5 },
    ]);

    expect(distance).toBeLessThan(target.distanceTo(destination));
  });
});
