import { describe, expect, it } from "vitest";
import { GENERIC_VENUE } from "./venue";

describe("generic venue stage layout", () => {
  it("uses the approved 1.25x stage with a fixed rear edge", () => {
    const stage = GENERIC_VENUE.platforms[0];

    expect(stage.bounds).toEqual({
      minX: -5.625,
      maxX: 5.625,
      minZ: -14.95,
      maxZ: -9.075,
    });
    expect(stage.bounds.maxX - stage.bounds.minX).toBe(11.25);
    expect(stage.bounds.maxZ - stage.bounds.minZ).toBe(5.875);
    expect(stage.height).toBe(0.75);
  });

  it("shares exact stage and barrier bounds with height-aware colliders", () => {
    const stage = GENERIC_VENUE.platforms[0];
    const stageCollider = GENERIC_VENUE.colliders.find(
      (collider) => collider.maxY === stage.height && collider.minZ === stage.bounds.minZ,
    );

    expect(stageCollider).toEqual({ ...stage.bounds, maxY: stage.height });
    expect(GENERIC_VENUE.colliders).toContain(GENERIC_VENUE.crowdBarrier);
    expect((GENERIC_VENUE.crowdBarrier.minZ + GENERIC_VENUE.crowdBarrier.maxZ) / 2).toBeCloseTo(
      -8.28,
    );
    expect(GENERIC_VENUE.crowdBarrier.maxY).toBe(1.32);
  });

  it("keeps performers within the wider stage and audience in front of the barrier", () => {
    const stage = GENERIC_VENUE.platforms[0].bounds;
    const performerXs = GENERIC_VENUE.show.performerPoints.map(([x]) => x);

    expect(Math.min(...performerXs)).toBeLessThanOrEqual(-4);
    expect(Math.max(...performerXs)).toBeGreaterThanOrEqual(4);
    for (const [x, y, z] of GENERIC_VENUE.show.performerPoints) {
      expect(x).toBeGreaterThan(stage.minX + 0.5);
      expect(x).toBeLessThan(stage.maxX - 0.5);
      expect(y).toBe(0.75);
      expect(z).toBeGreaterThan(stage.minZ + 0.5);
      expect(z).toBeLessThan(stage.maxZ - 0.5);
    }
    for (const [, , z] of GENERIC_VENUE.show.audiencePoints) {
      expect(z).toBeGreaterThan(GENERIC_VENUE.crowdBarrier.maxZ);
    }
  });

  it("keeps the backstage side wall clear of the widened stage", () => {
    const stage = GENERIC_VENUE.platforms[0].bounds;
    const backstageSideWall = GENERIC_VENUE.colliders.find(
      (collider) => collider.minZ === -14.2 && collider.maxZ === -9.8,
    );

    expect(backstageSideWall?.maxX).toBeLessThan(stage.minX);
    expect(stage.minX - (backstageSideWall?.maxX ?? stage.minX)).toBeGreaterThan(1);
  });
});
