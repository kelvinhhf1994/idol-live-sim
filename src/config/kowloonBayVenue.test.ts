import { describe, expect, it } from "vitest";
import { OVERHEAD_CLEARANCE, groundHeightAt } from "../core/venueGround";
import { formationPoints } from "../show/formation";
import { MAX_IDOL_COUNT } from "../show/idolMembers";
import {
  KB_BACKSTAGE_GAP,
  KB_BACK_WALL_Z,
  KB_DECK_HEIGHT,
  KB_DECK_MIN_Z,
  KB_DOORWAY,
  KB_PARTITION_X,
  KB_REAR_WALL_Z,
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
  it("is a 13m x 15m hall with a 9m stage against the back wall as platforms[0]", () => {
    expect(venue.id).toBe("kowloon-bay-live-house-01");
    expect(venue.scene).toEqual({ kind: "procedural", builderId: "kowloon-bay" });
    expect(venue.bounds.maxX - venue.bounds.minX).toBeCloseTo(13, 5);
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

  it("builds the 2/F stair as 15 abutting 0.2m treads that end flush with the deck", () => {
    const treads = venue.platforms
      .filter(
        (p) =>
          p.bounds.minX === KB_UPPER_STAIR.minX &&
          p.bounds.maxX === KB_UPPER_STAIR.maxX &&
          p.height <= KB_DECK_HEIGHT &&
          p.height > 0.19,
      )
      .sort((a, b) => a.height - b.height);
    expect(treads).toHaveLength(KB_UPPER_STAIR.steps);
    treads.forEach((tread, i) => {
      expect(tread.height).toBeCloseTo(KB_UPPER_STAIR.rise * (i + 1), 5);
      expect(tread.height - (treads[i - 1]?.height ?? 0)).toBeLessThanOrEqual(0.22);
      if (i > 0) expect(tread.bounds.minZ).toBeCloseTo(treads[i - 1].bounds.maxZ, 5);
    });
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

  it("leaves the vestibule doorway and the backstage curtain gap free of colliders", () => {
    const doorwayX = (KB_DOORWAY.minX + KB_DOORWAY.maxX) / 2;
    const doorwayBlockers = venue.colliders.filter(
      (c) => c.minZ <= KB_VESTIBULE.minZ && c.maxZ >= KB_VESTIBULE.minZ && c.minX < doorwayX && c.maxX > doorwayX,
    );
    expect(doorwayBlockers).toHaveLength(0);
    const gapZ = (KB_BACKSTAGE_GAP.minZ + KB_BACKSTAGE_GAP.maxZ) / 2;
    const gapBlockers = venue.colliders.filter(
      (c) => c.minX <= KB_PARTITION_X && c.maxX >= KB_PARTITION_X && c.minZ < gapZ && c.maxZ > gapZ,
    );
    expect(gapBlockers).toHaveLength(0);
  });

  it("caps every wall under the 2/F at deck height so the deck is walkable above them", () => {
    const underDeck = venue.colliders.filter(
      (c) =>
        c.maxX <= KB_PARTITION_X + 0.1 &&
        c.minX >= venue.bounds.minX &&
        c.minZ >= KB_DECK_MIN_Z &&
        c.maxX - c.minX < 0.3,
    );
    expect(underDeck.length).toBeGreaterThan(0);
    for (const c of underDeck) expect(c.maxY).toBe(KB_DECK_HEIGHT);
    // Walls crossing the vestibule's -Z face (the outer shell wall sits outside bounds and is excluded)
    const vestibuleFace = venue.colliders.filter(
      (c) =>
        c.minZ < KB_VESTIBULE.minZ &&
        c.maxZ > KB_VESTIBULE.minZ &&
        c.minX >= venue.bounds.minX &&
        c.maxX <= KB_VESTIBULE.maxX + 0.1,
    );
    expect(vestibuleFace.length).toBeGreaterThanOrEqual(2);
    for (const c of vestibuleFace) expect(c.maxY).toBe(KB_DECK_HEIGHT);
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
