import { describe, expect, it } from "vitest";
import { moveCircleWithCollisions } from "../core/collision";
import { OVERHEAD_CLEARANCE, groundHeightAt } from "../core/venueGround";
import { formationPoints } from "../show/formation";
import { MAX_IDOL_COUNT } from "../show/idolMembers";
import {
  KB_BACKSTAGE_GAP,
  KB_BACK_WALL_Z,
  KB_DECK_HEIGHT,
  KB_DECK_MIN_Z,
  KB_DOORWAY,
  KB_LANDING,
  KB_LOWER_STAIR,
  KB_MIN_X,
  KB_PARTITION_X,
  KB_REAR_WALL_Z,
  KB_STAGE_FRONT_Z,
  KB_STAGE_HEIGHT,
  KB_UPPER_STAIR,
  KB_VESTIBULE,
  KB_WALKWAY_HEIGHT,
  KOWLOON_BAY_VENUE,
} from "./venue";

const venue = KOWLOON_BAY_VENUE;
const inside = (x: number, z: number, b: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
  x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

describe("KOWLOON_BAY_VENUE configuration", () => {
  it("is a 15m x 15m footprint (11m hall + 4m backstage block) with a 9m stage against the back wall as platforms[0]", () => {
    expect(venue.id).toBe("kowloon-bay-live-house-01");
    expect(venue.scene).toEqual({ kind: "procedural", builderId: "kowloon-bay" });
    expect(venue.bounds.maxX - venue.bounds.minX).toBeCloseTo(15, 5);
    expect(KB_PARTITION_X - KB_MIN_X).toBeCloseTo(4, 5);
    expect(venue.bounds.maxZ - venue.bounds.minZ).toBeCloseTo(KB_REAR_WALL_Z - KB_BACK_WALL_Z, 5);
    const stage = venue.platforms[0];
    expect(stage.height).toBe(KB_STAGE_HEIGHT);
    expect(stage.bounds.minZ).toBe(KB_BACK_WALL_Z);
    expect(stage.bounds.maxX - stage.bounds.minX).toBeCloseTo(9, 5);
  });

  it("keeps a full twelve-idol line on the stage", () => {
    const stage = venue.platforms[0].bounds;
    for (const { x, y, z } of formationPoints(venue.show.performerLine, MAX_IDOL_COUNT)) {
      expect(inside(x, z, stage)).toBe(true);
      expect(y).toBe(KB_STAGE_HEIGHT);
    }
  });

  it("uses the truss walkway as the crowd barrier and lets a walkway-height player step onto the stage", () => {
    const walkway = venue.crowdBarrier;
    expect(walkway.maxY).toBe(KB_WALKWAY_HEIGHT);
    expect(walkway.minZ).toBe(venue.platforms[0].bounds.maxZ);
    expect(venue.colliders).toContain(walkway);
    const walkwayPlatform = venue.platforms.find(
      (p) => p.bounds === walkway || (p.bounds.minZ === walkway.minZ && p.height === KB_WALKWAY_HEIGHT),
    );
    expect(walkwayPlatform).toBeDefined();
    const stageCollider = venue.colliders.find((c) => c.minZ === KB_BACK_WALL_Z && c.maxX - c.minX === 9);
    expect(stageCollider?.maxY).toBe(KB_WALKWAY_HEIGHT);
  });

  it("climbs from the corridor floor to a stage-height landing that opens onto the stage wing", () => {
    const landing = venue.platforms.find((p) => p.bounds.minX === KB_LANDING.minX && p.bounds.maxZ === KB_LANDING.maxZ);
    expect(landing?.height).toBe(KB_STAGE_HEIGHT);
    expect(KB_LANDING.maxX).toBe(venue.platforms[0].bounds.minX);
    // The only wall between the landing and the stage wing is the 2/F-only one over it
    const wallsBetween = venue.colliders.filter(
      (c) => c.minX <= KB_PARTITION_X && c.maxX >= KB_PARTITION_X && c.maxX - c.minX < 0.3 && c.minZ < KB_LANDING.maxZ,
    );
    expect(wallsBetween).toHaveLength(1);
    expect(wallsBetween[0].minY).toBe(KB_DECK_HEIGHT);
    const treads = venue.platforms
      .filter((p) => p.bounds.minX === KB_LOWER_STAIR.minX && p.bounds.maxX === KB_LOWER_STAIR.maxX && p.height <= KB_STAGE_HEIGHT)
      .sort((a, b) => a.height - b.height);
    expect(treads).toHaveLength(KB_LOWER_STAIR.steps);
    treads.forEach((tread, i) => {
      expect(tread.height - (treads[i - 1]?.height ?? 0)).toBeLessThanOrEqual(0.22);
      if (i > 0) expect(tread.bounds.maxZ).toBeCloseTo(treads[i - 1].bounds.minZ, 5);
    });
    expect(treads[treads.length - 1].height).toBeCloseTo(KB_STAGE_HEIGHT, 5);
    expect(treads[treads.length - 1].bounds.minZ).toBeCloseTo(KB_LANDING.maxZ, 5);
    // From the landing a player walks straight onto the stage wing; from the 2/F deck above, the wall holds
    const z = (KB_LANDING.minZ + KB_LANDING.maxZ) / 2;
    const fromLanding = moveCircleWithCollisions({ x: -4.9, z }, { x: 0.5, z: 0 }, 0.34, venue.colliders, KB_STAGE_HEIGHT);
    expect(fromLanding.x).toBeCloseTo(-4.4, 5);
    expect(groundHeightAt(venue, fromLanding.x, z, KB_STAGE_HEIGHT)).toBe(KB_STAGE_HEIGHT);
    const fromDeck = moveCircleWithCollisions({ x: -5.2, z }, { x: 0.5, z: 0 }, 0.34, venue.colliders, KB_DECK_HEIGHT);
    expect(fromDeck.x).toBeLessThan(-4.9);
    // Walking straight at the landing (off the stair) is a step too tall; the stair itself is climbable
    expect(groundHeightAt(venue, KB_MIN_X + 0.5, KB_LANDING.maxZ - 0.5, 0) - 0).toBeGreaterThan(0.22);
    expect(groundHeightAt(venue, (KB_LOWER_STAIR.minX + KB_LOWER_STAIR.maxX) / 2, treads[0].bounds.maxZ - 0.1, 0)).toBeCloseTo(KB_LOWER_STAIR.rise, 5);
  });

  it("builds the 2/F stair from the landing as ten abutting 0.2m treads rising toward -X, ending flush with the deck", () => {
    const treads = venue.platforms
      .filter(
        (p) =>
          p.bounds.minZ === KB_UPPER_STAIR.minZ &&
          p.bounds.maxZ === KB_UPPER_STAIR.maxZ &&
          p.height <= KB_DECK_HEIGHT &&
          p.height > KB_STAGE_HEIGHT,
      )
      .sort((a, b) => a.height - b.height);
    expect(treads).toHaveLength(KB_UPPER_STAIR.steps);
    treads.forEach((tread, i) => {
      expect(tread.height).toBeCloseTo(KB_STAGE_HEIGHT + KB_UPPER_STAIR.rise * (i + 1), 5);
      expect(tread.height - (treads[i - 1]?.height ?? KB_STAGE_HEIGHT)).toBeLessThanOrEqual(0.22);
      if (i > 0) expect(tread.bounds.maxX).toBeCloseTo(treads[i - 1].bounds.minX, 5);
    });
    expect(treads[0].bounds.maxX).toBeCloseTo(KB_UPPER_STAIR.startX, 5);
    expect(treads[treads.length - 1].height).toBeCloseTo(KB_DECK_HEIGHT, 5);
    expect(treads[treads.length - 1].bounds.maxZ).toBeCloseTo(KB_DECK_MIN_Z, 5);
    const deck = venue.platforms.find((p) => p.height === KB_DECK_HEIGHT && p.bounds.minZ === KB_DECK_MIN_Z);
    expect(deck).toBeDefined();
  });

  it("puts a 3.0m deck over the vestibule while keeping the vestibule floor walkable", () => {
    const x = (KB_VESTIBULE.minX + KB_VESTIBULE.maxX) / 2;
    const z = (KB_VESTIBULE.minZ + KB_VESTIBULE.maxZ) / 2;
    expect(groundHeightAt(venue, x, z, 0)).toBe(0);
    expect(groundHeightAt(venue, x, z, KB_DECK_HEIGHT)).toBe(KB_DECK_HEIGHT);
    expect(KB_DECK_HEIGHT).toBeGreaterThan(OVERHEAD_CLEARANCE);
  });

  it("spawns inside the vestibule, inside bounds and clear of every collider", () => {
    const { x, z } = venue.spawn;
    expect(inside(x, z, KB_VESTIBULE)).toBe(true);
    expect(inside(x, z, venue.bounds)).toBe(true);
    const radius = 0.34;
    for (const c of venue.colliders) {
      const overlaps = x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ;
      expect(overlaps, JSON.stringify(c)).toBe(false);
    }
  });

  it("opens the vestibule doorway (+X face) and the backstage curtain gap on 1/F, but walls both off on 2/F", () => {
    const doorwayZ = (KB_DOORWAY.minZ + KB_DOORWAY.maxZ) / 2;
    const doorwayWalls = venue.colliders.filter(
      (c) => c.minX <= KB_VESTIBULE.maxX && c.maxX >= KB_VESTIBULE.maxX && c.minZ < doorwayZ && c.maxZ > doorwayZ,
    );
    expect(doorwayWalls).toHaveLength(1);
    expect(doorwayWalls[0].minY).toBe(KB_DECK_HEIGHT);
    const gapZ = (KB_BACKSTAGE_GAP.minZ + KB_BACKSTAGE_GAP.maxZ) / 2;
    const gapWalls = venue.colliders.filter(
      (c) => c.minX <= KB_PARTITION_X && c.maxX >= KB_PARTITION_X && c.minZ < gapZ && c.maxZ > gapZ,
    );
    expect(gapWalls).toHaveLength(1);
    expect(gapWalls[0].minY).toBe(KB_DECK_HEIGHT);
  });

  it("walls the 2/F off from the hall: the partition is full height and only the corridor-to-glass-room wall is capped", () => {
    const partitionWalls = venue.colliders.filter(
      (c) => c.minX <= KB_PARTITION_X && c.maxX >= KB_PARTITION_X && c.maxX - c.minX < 0.3 && c.minZ >= KB_STAGE_FRONT_Z,
    );
    expect(partitionWalls.length).toBeGreaterThanOrEqual(3);
    for (const c of partitionWalls) expect(c.maxY).toBeUndefined();
    // Walls along the vestibule's -Z face (excludes the outer shell wall outside bounds and the thin partition end)
    const vestibuleFace = venue.colliders.filter(
      (c) =>
        c.minZ < KB_VESTIBULE.minZ &&
        c.maxZ > KB_VESTIBULE.minZ &&
        c.minX >= venue.bounds.minX &&
        c.maxX <= KB_VESTIBULE.maxX + 0.1 &&
        c.maxX - c.minX >= 0.3,
    );
    expect(vestibuleFace).toHaveLength(2);
    const corridorSide = vestibuleFace.find((c) => c.maxX <= KB_PARTITION_X);
    const hallSide = vestibuleFace.find((c) => c.minX >= KB_PARTITION_X);
    expect(corridorSide?.maxY).toBe(KB_DECK_HEIGHT);
    expect(hallSide?.maxY).toBeUndefined();
  });

  it("positions the audience on the floor in front of the walkway", () => {
    expect(venue.show.audiencePoints).toHaveLength(15);
    for (const [x, y, z] of venue.show.audiencePoints) {
      expect(y).toBe(0);
      expect(z).toBeGreaterThan(venue.crowdBarrier.maxZ);
      expect(x).toBeGreaterThan(KB_PARTITION_X);
    }
  });
});
