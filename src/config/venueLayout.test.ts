import { describe, expect, it } from "vitest";
import { moveCircleWithCollisions } from "../core/collision";
import { isOnSeat } from "../core/venueGround";
import { formationPoints } from "../show/formation";
import { MAX_IDOL_COUNT } from "../show/idolMembers";
import { GENERIC_FOH_CHAIRS, GENERIC_FOH_DESK, GENERIC_VENUE } from "./venue";

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
    const performers = formationPoints(GENERIC_VENUE.show.performerLine, MAX_IDOL_COUNT);
    const performerXs = performers.map(({ x }) => x);

    expect(Math.min(...performerXs)).toBeLessThanOrEqual(-4);
    expect(Math.max(...performerXs)).toBeGreaterThanOrEqual(4);
    for (const { x, y, z } of performers) {
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

  it("puts two sittable FOH chairs behind the desk that a floor player can walk onto", () => {
    const seats = GENERIC_VENUE.platforms.filter((p) => p.seat);
    expect(seats).toHaveLength(2);
    const desk = GENERIC_VENUE.colliders.find((c) => c.minZ === GENERIC_FOH_DESK.z - GENERIC_FOH_DESK.depth / 2)!;
    expect(desk).toBeDefined();
    for (const [i, seat] of seats.entries()) {
      expect(seat.height).toBe(0);
      expect(seat.sitYaw).toBe(0); // Facing the stage (-Z)
      expect(seat.bounds.minZ).toBeGreaterThanOrEqual(desk.maxZ);
      const chair = GENERIC_FOH_CHAIRS[i];
      // Walk in from the open hall behind the desk and stop on the chair
      const onto = moveCircleWithCollisions({ x: chair.x, z: chair.z + 2 }, { x: 0, z: -2 }, 0.34, GENERIC_VENUE.colliders, 0);
      expect(onto.z).toBeCloseTo(chair.z, 5);
      expect(isOnSeat(GENERIC_VENUE, onto.x, onto.z, 0)).toBe(true);
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
