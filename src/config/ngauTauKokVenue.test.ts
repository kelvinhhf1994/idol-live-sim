import { describe, expect, it } from "vitest";
import { formationPoints } from "../show/formation";
import { MAX_IDOL_COUNT } from "../show/idolMembers";
import {
  NGAU_TAU_KOK_VENUE,
  NTK_BACK_WALL_Z,
  NTK_ENTRANCE_Z,
  NTK_GLASS_Z,
  NTK_MALL_END_Z,
} from "./venue";

describe("NGAU_TAU_KOK_VENUE configuration", () => {
  it("spans hall, foyer and mall corridor (~14.0m x ~29.7m, 9.2m stage against the back wall)", () => {
    const totalWidth = NGAU_TAU_KOK_VENUE.bounds.maxX - NGAU_TAU_KOK_VENUE.bounds.minX;
    const totalLength = NGAU_TAU_KOK_VENUE.bounds.maxZ - NGAU_TAU_KOK_VENUE.bounds.minZ;

    expect(totalWidth).toBeCloseTo(14.0, 1);
    expect(totalLength).toBeCloseTo(NTK_MALL_END_Z - NTK_BACK_WALL_Z, 5);
    expect(totalLength).toBeGreaterThan(29);

    const stage = NGAU_TAU_KOK_VENUE.platforms[0].bounds;
    expect(stage.maxX - stage.minX).toBeCloseTo(9.2, 1);
    expect(stage.maxZ - stage.minZ).toBeCloseTo(3.0, 1);
    expect(stage.minZ).toBeCloseTo(NTK_BACK_WALL_Z, 5);
    expect(NGAU_TAU_KOK_VENUE.platforms[0].height).toBe(0.7);
  });

  it("orders the depth lines back wall -> entrance -> glass front -> mall end", () => {
    expect(NTK_BACK_WALL_Z).toBeLessThan(NTK_ENTRANCE_Z);
    expect(NTK_ENTRANCE_Z).toBeLessThan(NTK_GLASS_Z);
    expect(NTK_GLASS_Z).toBeLessThan(NTK_MALL_END_Z);
  });

  it("places crowd barrier in front of the stage with appropriate height", () => {
    const stage = NGAU_TAU_KOK_VENUE.platforms[0].bounds;
    const barrier = NGAU_TAU_KOK_VENUE.crowdBarrier;

    expect(barrier.minZ).toBeGreaterThan(stage.maxZ);
    expect(barrier.maxY).toBeGreaterThan(1.0);
    expect(NGAU_TAU_KOK_VENUE.colliders).toContain(barrier);
  });

  it("keeps a full seven-idol line safely on the stage platform", () => {
    const stage = NGAU_TAU_KOK_VENUE.platforms[0].bounds;
    const performers = formationPoints(NGAU_TAU_KOK_VENUE.show.performerLine, MAX_IDOL_COUNT);
    expect(performers).toHaveLength(7);

    for (const { x, y, z } of performers) {
      expect(x).toBeGreaterThanOrEqual(stage.minX);
      expect(x).toBeLessThanOrEqual(stage.maxX);
      expect(z).toBeGreaterThanOrEqual(stage.minZ);
      expect(z).toBeLessThanOrEqual(stage.maxZ);
      expect(y).toBe(NGAU_TAU_KOK_VENUE.platforms[0].height);
    }
  });

  it("positions audience on the floor outside the stage and barrier", () => {
    for (const [, y, z] of NGAU_TAU_KOK_VENUE.show.audiencePoints) {
      expect(y).toBe(0);
      expect(z).toBeGreaterThan(NGAU_TAU_KOK_VENUE.crowdBarrier.maxZ);
    }
  });

  it("configures stage right stairs (上台在台右) stepping onto the stage deck", () => {
    const stageStairs = NGAU_TAU_KOK_VENUE.platforms.filter(
      (p) => p.bounds.minX > 4.5 && p.bounds.minZ < -5.3 && p.height < 0.7,
    );
    expect(stageStairs.length).toBeGreaterThanOrEqual(3);
    const sorted = [...stageStairs].sort((a, b) => a.height - b.height);
    expect(sorted[0].height).toBeCloseTo(0.175, 2);
    expect(sorted[1].height).toBeCloseTo(0.35, 2);
    expect(sorted[2].height).toBeCloseTo(0.525, 2);
  });

  it("configures the control booth platform against the entrance wall (rear left) with side stairs", () => {
    const boothPlatform = NGAU_TAU_KOK_VENUE.platforms.find(
      (p) => p.height === 0.48 && p.bounds.minX < 0 && p.bounds.maxX - p.bounds.minX > 2,
    );
    expect(boothPlatform).toBeDefined();
    expect(boothPlatform!.bounds.maxX).toBeLessThan(0);
    expect(boothPlatform!.bounds.maxZ).toBeCloseTo(NTK_ENTRANCE_Z - 0.15, 5);
    // No collider wedged between the booth and the entrance wall (booth backs directly onto it)
    const behindBooth = NGAU_TAU_KOK_VENUE.colliders.filter(
      (c) => c.maxX < 0 && c.minZ >= boothPlatform!.bounds.maxZ - 0.1 && c.maxZ <= NTK_ENTRANCE_Z - 0.15,
    );
    expect(behindBooth).toHaveLength(0);

    const step1 = NGAU_TAU_KOK_VENUE.platforms.find((p) => p.height === 0.16);
    const step2 = NGAU_TAU_KOK_VENUE.platforms.find((p) => p.height === 0.32);
    expect(step1).toBeDefined();
    expect(step2).toBeDefined();
    expect(step1!.bounds.minZ).toBeGreaterThan(step2!.bounds.minZ);
  });

  it("leaves door gaps in the entrance wall and the glass shopfront", () => {
    const wallsAt = (z: number) =>
      NGAU_TAU_KOK_VENUE.colliders.filter((c) => c.minZ < z && c.maxZ > z && c.maxX - c.minX > 3);

    const entrance = wallsAt(NTK_ENTRANCE_Z);
    expect(entrance).toHaveLength(2);
    expect(Math.max(...entrance.map((c) => c.minX).filter((x) => x > 0))).toBeCloseTo(1.1, 5);

    const glass = wallsAt(NTK_GLASS_Z);
    expect(glass).toHaveLength(2);
    expect(Math.max(...glass.map((c) => c.minX).filter((x) => x > 0))).toBeCloseTo(1.0, 5);

    const mallEnd = wallsAt(NTK_MALL_END_Z);
    expect(mallEnd).toHaveLength(1);
  });

  it("keeps the foyer open: no partition colliders between tuck shop and display area", () => {
    const partitions = NGAU_TAU_KOK_VENUE.colliders.filter(
      (c) =>
        c.minZ >= NTK_ENTRANCE_Z &&
        c.maxZ <= NTK_GLASS_Z &&
        c.maxX - c.minX < 0.5 &&
        c.maxZ - c.minZ > 2,
    );
    expect(partitions).toHaveLength(0);

    const tuckShop = NGAU_TAU_KOK_VENUE.colliders.filter(
      (c) => c.maxX < -3 && c.minZ > NTK_ENTRANCE_Z && c.maxZ < NTK_GLASS_Z,
    );
    const display = NGAU_TAU_KOK_VENUE.colliders.filter(
      (c) => c.minX > 3 && c.minZ > NTK_ENTRANCE_Z && c.maxZ < NTK_GLASS_Z,
    );
    expect(tuckShop.length).toBeGreaterThanOrEqual(3);
    expect(display.length).toBeGreaterThanOrEqual(3);
  });

  it("forms a rope queue lane in the mall corridor that the player can step over only when lifted", () => {
    const ropes = NGAU_TAU_KOK_VENUE.colliders.filter(
      (c) => c.minZ >= NTK_GLASS_Z && c.maxZ <= NTK_MALL_END_Z && c.maxY !== undefined,
    );
    expect(ropes).toHaveLength(2);
    expect(ropes.some((c) => c.maxX < 0)).toBe(true);
    expect(ropes.some((c) => c.minX > 0)).toBe(true);
  });
});
