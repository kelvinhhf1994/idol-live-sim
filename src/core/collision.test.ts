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

  it("blocks a low airborne crossing but allows clearance above collider top", () => {
    const barrier = { minX: -1, maxX: 1, minZ: -0.1, maxZ: 0.1, maxY: 1.32 };

    expect(
      moveCircleWithCollisions({ x: 0, z: 1 }, { x: 0, z: -2 }, 0.34, [barrier], 1.2).z,
    ).toBe(1);
    expect(
      moveCircleWithCollisions({ x: 0, z: 1 }, { x: 0, z: -2 }, 0.34, [barrier], 1.32).z,
    ).toBe(-1);
  });

  it("ignores an upper-floor wall (minY) for a player below it but blocks one standing at its base", () => {
    const upperWall = { minX: -1, maxX: 1, minZ: -0.1, maxZ: 0.1, minY: 3.0 };

    expect(
      moveCircleWithCollisions({ x: 0, z: 1 }, { x: 0, z: -2 }, 0.34, [upperWall], 0).z,
    ).toBe(-1);
    expect(
      moveCircleWithCollisions({ x: 0, z: 1 }, { x: 0, z: -2 }, 0.34, [upperWall], 3.0).z,
    ).toBe(1);
    expect(
      moveCircleWithCollisions({ x: 0, z: 1 }, { x: 0, z: -2 }, 0.34, [upperWall], 3.4).z,
    ).toBe(1);
  });

  it("does not tunnel through a thin low barrier with a large delta", () => {
    const barrier = { minX: -1, maxX: 1, minZ: -0.02, maxZ: 0.02, maxY: 0.75 };
    const result = moveCircleWithCollisions(
      { x: 0, z: 2 },
      { x: 0, z: -4 },
      0.34,
      [barrier],
      0.5,
    );

    expect(result.z).toBe(2);
  });
});
