import { describe, expect, it } from "vitest";
import { moveCircleWithCollisions } from "./collision";

describe("moveCircleWithCollisions", () => {
  it("moves freely when no collider is reached", () => {
    expect(moveCircleWithCollisions({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.35, [])).toEqual({
      x: 1,
      z: 0,
    });
  });

  it("stops before crossing a wall", () => {
    const wall = { minX: 1, maxX: 2, minZ: -1, maxZ: 1 };
    const result = moveCircleWithCollisions({ x: 0, z: 0 }, { x: 2, z: 0 }, 0.35, [wall]);

    expect(result.x).toBeLessThan(1);
  });

  it("slides on the free axis", () => {
    const wall = { minX: 1, maxX: 2, minZ: -2, maxZ: 2 };
    const result = moveCircleWithCollisions({ x: 0, z: 0 }, { x: 2, z: 0.5 }, 0.35, [wall]);

    expect(result.z).toBeCloseTo(0.5);
  });
});
