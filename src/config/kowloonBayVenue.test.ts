import { describe, expect, it } from "vitest";
import { moveCircleWithCollisions } from "../core/collision";
import { OVERHEAD_CLEARANCE, groundHeightAt, isOnSeat, seatFacingAt } from "../core/venueGround";
import { formationPoints } from "../show/formation";
import { MAX_IDOL_COUNT } from "../show/idolMembers";
import {
  KB_ARCADE_FRIDGE,
  KB_BACKSTAGE_GAP,
  KB_BACK_WALL_Z,
  KB_CLAW_MACHINES,
  KB_DECK_HEIGHT,
  KB_DECK_MIN_Z,
  KB_DECK_RAIL,
  KB_DECK_RAIL_GAP,
  KB_DOORWAY,
  KB_FOH_CHAIRS,
  KB_LANDING,
  KB_LOWER_STAIR,
  KB_MAIMAI,
  KB_MIN_X,
  KB_PA_CX,
  KB_PA_DESK_Z,
  KB_PA_DOOR_GAP,
  KB_PARTITION_X,
  KB_REAR_WALL_Z,
  KB_SNACK_CABINET,
  KB_STAGE_FRONT_Z,
  KB_STAGE_HEIGHT,
  KB_STARLIGHT,
  KB_UPPER_STAIR,
  KB_VESTIBULE,
  KB_WALKWAY_FRONT_Z,
  KB_WALKWAY_HEIGHT,
  KB_WALKWAY_STEPS,
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
    expect(stageCollider?.maxY).toBeLessThanOrEqual(KB_WALKWAY_HEIGHT);
    expect(stageCollider?.maxY).toBeGreaterThan(0.9);
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
    // Walking straight at the landing (off the stair) is blocked; the stair itself is climbable tread by tread
    const atLanding = moveCircleWithCollisions({ x: KB_MIN_X + 0.5, z: KB_LANDING.maxZ + 0.6 }, { x: 0, z: -1.0 }, 0.34, venue.colliders, 0);
    expect(atLanding.z).toBeGreaterThan(KB_LANDING.maxZ);
    const stairX = (KB_LOWER_STAIR.minX + KB_LOWER_STAIR.maxX) / 2;
    expect(groundHeightAt(venue, stairX, treads[0].bounds.maxZ - 0.1, 0)).toBeCloseTo(KB_LOWER_STAIR.rise, 5);
    for (let i = 1; i < treads.length; i++) {
      const zMid = (treads[i].bounds.minZ + treads[i].bounds.maxZ) / 2;
      const from = treads[i - 1].height;
      const moved = moveCircleWithCollisions({ x: stairX, z: zMid + KB_LOWER_STAIR.tread }, { x: 0, z: -KB_LOWER_STAIR.tread }, 0.34, venue.colliders, from);
      expect(moved.z, `tread ${i}`).toBeCloseTo(zMid, 5);
      expect(groundHeightAt(venue, stairX, zMid, from) - from).toBeLessThanOrEqual(0.22);
    }
    // But a corridor-floor player cannot walk into the tall top treads
    const intoTop = moveCircleWithCollisions({ x: stairX, z: KB_LANDING.maxZ + 1.2 }, { x: 0, z: -0.8 }, 0.34, venue.colliders, 0);
    expect(groundHeightAt(venue, stairX, intoTop.z, 0)).toBeLessThanOrEqual(1.2);
  });

  it("lets a player climb the walkway end stairs onto the 1.3 walkway and then step up onto the stage", () => {
    const treads = venue.platforms
      .filter((p) => p.bounds.minX === 3.5 && p.bounds.maxX === 4.4)
      .sort((a, b) => a.height - b.height);
    expect(treads).toHaveLength(KB_WALKWAY_STEPS);
    treads.forEach((tread, i) => {
      expect(tread.height - (treads[i - 1]?.height ?? 0)).toBeLessThanOrEqual(0.22);
      if (i > 0) expect(tread.bounds.maxZ).toBeCloseTo(treads[i - 1].bounds.minZ, 5);
    });
    const top = treads[treads.length - 1];
    expect(top.height).toBe(KB_WALKWAY_HEIGHT);
    expect(top.bounds.minZ).toBe(KB_STAGE_FRONT_Z);
    // Tread by tread from the floor, including the top tread that abuts the stage collider
    for (let i = 0; i < treads.length; i++) {
      const zMid = (treads[i].bounds.minZ + treads[i].bounds.maxZ) / 2;
      const from = treads[i - 1]?.height ?? 0;
      const moved = moveCircleWithCollisions({ x: 3.95, z: zMid + 0.3 }, { x: 0, z: -0.3 }, 0.34, venue.colliders, from);
      expect(moved.z, `tread ${i}`).toBeCloseTo(zMid, 5);
      expect(groundHeightAt(venue, 3.95, zMid, from) - from).toBeLessThanOrEqual(0.22);
    }
    // Top tread -> walkway (sideways, -X) -> stage (-Z)
    const zOnTop = (top.bounds.minZ + top.bounds.maxZ) / 2;
    const ontoWalkway = moveCircleWithCollisions({ x: 3.95, z: zOnTop }, { x: -1.0, z: 0 }, 0.34, venue.colliders, KB_WALKWAY_HEIGHT);
    expect(ontoWalkway.x).toBeCloseTo(2.95, 5);
    expect(groundHeightAt(venue, ontoWalkway.x, zOnTop, KB_WALKWAY_HEIGHT)).toBe(KB_WALKWAY_HEIGHT);
    const ontoStage = moveCircleWithCollisions({ x: 0, z: zOnTop }, { x: 0, z: -0.6 }, 0.34, venue.colliders, KB_WALKWAY_HEIGHT);
    expect(ontoStage.z).toBeCloseTo(zOnTop - 0.6, 5);
    expect(groundHeightAt(venue, 0, ontoStage.z, KB_WALKWAY_HEIGHT)).toBe(KB_STAGE_HEIGHT);
    // A floor player is stopped by the walkway and the stage
    const floor = moveCircleWithCollisions({ x: 0, z: -6.5 }, { x: 0, z: -2.0 }, 0.34, venue.colliders, 0);
    expect(floor.z).toBeGreaterThanOrEqual(KB_WALKWAY_FRONT_Z);
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

  it("pushes the vestibule/glass room into the hall and parks the PA desk stage-left of it", () => {
    expect(KB_VESTIBULE.maxX - KB_PARTITION_X).toBeCloseTo(3, 5);
    const desk = venue.colliders.find((c) => c.minX === KB_PA_CX - 2.0 && c.maxX === KB_PA_CX + 2.0 && c.maxY === 1.2);
    expect(desk).toBeDefined();
    expect(desk!.minX).toBeGreaterThan(KB_VESTIBULE.maxX);
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

  it("furnishes 1/F with vanities and dressing rooms, and 2/F corridor with a lounge and arcade", () => {
    const vanities = venue.colliders.filter((c) => c.maxX < KB_PARTITION_X - 2 && (c.maxY ?? 99) <= 1.0 && (c.minZ ?? 0) < 0 && (c.maxZ ?? 0) < 0);
    expect(vanities.length).toBeGreaterThanOrEqual(4);

    const dressingWalls = venue.colliders.filter(
      (c) => c.maxY === KB_DECK_HEIGHT && c.minX > KB_MIN_X + 2 && c.maxX >= KB_PARTITION_X - 0.15 && c.maxX <= KB_PARTITION_X + 0.05,
    );
    expect(dressingWalls.length).toBeGreaterThanOrEqual(6);

    const upperArcade = venue.colliders.filter((c) => c.minY === KB_DECK_HEIGHT);
    expect(upperArcade.length).toBeGreaterThanOrEqual(5);

    const corridorWalk = moveCircleWithCollisions({ x: -6.5, z: 0.5 }, { x: 0, z: -6.5 }, 0.34, venue.colliders, 0);
    expect(corridorWalk.z).toBeLessThan(-5.5);

    const underMachines = moveCircleWithCollisions({ x: -7.7, z: -8.4 }, { x: 0, z: 0.4 }, 0.34, venue.colliders, 0);
    expect(underMachines.z).toBeCloseTo(-8.0, 5);

    const intoSofa = moveCircleWithCollisions({ x: -7.4, z: -1.0 }, { x: -1.4, z: 0 }, 0.34, venue.colliders, KB_DECK_HEIGHT);
    expect(intoSofa.x).toBeGreaterThan(-8.15);

    const intoRoom = moveCircleWithCollisions({ x: -6.2, z: -6.45 }, { x: 1.0, z: 0 }, 0.28, venue.colliders, 0);
    expect(intoRoom.x).toBeGreaterThan(-5.4);
    const throughBack = moveCircleWithCollisions({ x: -5.1, z: -6.45 }, { x: 0.8, z: 0 }, 0.28, venue.colliders, 0);
    expect(throughBack.x).toBeLessThan(-4.7);
  });

  it("packs the 2/F arcade row tightly and adds a drink fridge plus snack cabinet", () => {
    const arcade = [...KB_CLAW_MACHINES, KB_STARLIGHT, KB_MAIMAI, KB_ARCADE_FRIDGE, KB_SNACK_CABINET].sort((a, b) => a.minZ - b.minZ);
    expect(arcade).toHaveLength(6);
    for (let i = 1; i < arcade.length; i++) {
      const gap = arcade[i].minZ - arcade[i - 1].maxZ;
      expect(gap).toBeGreaterThan(0.04);
      expect(gap).toBeLessThanOrEqual(0.08);
    }
    for (const box of arcade) {
      expect(box.minY).toBe(KB_DECK_HEIGHT);
      expect(box.minX).toBeLessThan(KB_MIN_X + 0.3);
      expect(venue.colliders).toContainEqual(box);
    }

    const pastRow = moveCircleWithCollisions({ x: -6.4, z: -9.4 }, { x: 0, z: 6.5 }, 0.34, venue.colliders, KB_DECK_HEIGHT);
    expect(pastRow.z).toBeGreaterThan(-3.2);
  });

  it("keeps a 1.5-player-width aisle between the vestibule doorway and the PA desk", () => {
    const doorWallFace = KB_VESTIBULE.maxX + 0.1;
    const desk = venue.colliders.find((c) => c.maxY === 1.2 && c.minZ === KB_PA_DESK_Z - 0.4)!;
    expect(desk.minX - doorWallFace).toBeCloseTo(KB_PA_DOOR_GAP, 5);
    expect(KB_PA_DOOR_GAP).toBeGreaterThanOrEqual(0.34 * 2 * 1.5);
    // Nothing else of the PA assembly (barrier boards) pokes into that aisle
    const paParts = venue.colliders.filter((c) => c.maxY === 1.1 && c.minZ >= KB_PA_DESK_Z - 0.6 && c.minX > KB_VESTIBULE.maxX);
    expect(paParts).toHaveLength(2);
    for (const part of paParts) expect(part.minX).toBeGreaterThanOrEqual(desk.minX);
    // Stepping out of the doorway and walking down the aisle to the rear wall is unobstructed
    const aisleX = doorWallFace + KB_PA_DOOR_GAP / 2;
    const down = moveCircleWithCollisions({ x: aisleX, z: (KB_DOORWAY.minZ + KB_DOORWAY.maxZ) / 2 }, { x: 0, z: 1.0 }, 0.34, venue.colliders, 0);
    expect(down.z).toBeCloseTo((KB_DOORWAY.minZ + KB_DOORWAY.maxZ) / 2 + 1.0, 5);
  });

  it("marks a floor-level FOH chair behind each desk machine and leaves the -X end of the barrier open to reach them", () => {
    const seats = venue.platforms.filter((p) => p.seat && p.height === 0);
    expect(seats).toHaveLength(2);
    expect(seats.map((s) => (s.bounds.minX + s.bounds.maxX) / 2)).toEqual(KB_FOH_CHAIRS.map((c) => c.x));
    for (const seat of seats) {
      expect(seat.sitYaw).toBe(0); // Back to the rear wall, facing the stage
      expect(seat.bounds.maxZ).toBeLessThanOrEqual(KB_REAR_WALL_Z);
      expect(seat.bounds.minZ).toBeGreaterThan(KB_PA_DESK_Z + 0.4);
    }
    // Teleporting to the desk lands on a chair
    const mixerSpot = venue.teleports!.find((t) => t.id === "sound-mixer")!;
    expect(isOnSeat(venue, mixerSpot.x, mixerSpot.z, 0)).toBe(true);
    // A floor player walks in from the doorway aisle round the -X end of the desk, then slides +X behind it to the chairs
    const aisleZ = KB_FOH_CHAIRS[1].z;
    const gapX = KB_PA_CX - 2.0 - KB_PA_DOOR_GAP / 2; // Middle of the aisle between the vestibule wall and the desk
    const intoAisle = moveCircleWithCollisions({ x: gapX, z: KB_PA_DESK_Z - 1.2 }, { x: 0, z: aisleZ - (KB_PA_DESK_Z - 1.2) }, 0.34, venue.colliders, 0);
    expect(intoAisle.z).toBeCloseTo(aisleZ, 5);
    const toChair = moveCircleWithCollisions({ x: gapX, z: aisleZ }, { x: KB_FOH_CHAIRS[1].x - gapX, z: 0 }, 0.34, venue.colliders, 0);
    expect(toChair.x).toBeCloseTo(KB_FOH_CHAIRS[1].x, 5);
    expect(isOnSeat(venue, toChair.x, toChair.z, 0)).toBe(true);
    // The +X end is closed by the barrier board, right up to the rear wall
    const throughEnd = moveCircleWithCollisions({ x: KB_PA_CX + 2.8, z: aisleZ }, { x: -1.0, z: 0 }, 0.34, venue.colliders, 0);
    expect(throughEnd.x).toBeGreaterThan(KB_PA_CX + 2.4);
    // The front board still keeps the audience out along the desk
    const throughFront = moveCircleWithCollisions({ x: KB_PA_CX, z: KB_PA_DESK_Z - 1.2 }, { x: 0, z: 1.6 }, 0.34, venue.colliders, 0);
    expect(throughFront.z).toBeLessThan(KB_PA_DESK_Z - 0.6);
  });

  it("marks a glass-room sofa seat on the 2/F deck facing the stage", () => {
    const seat = venue.platforms.find((p) => p.seat && p.height === KB_DECK_HEIGHT && p.bounds.minZ > KB_VESTIBULE.minZ);
    expect(seat?.height).toBe(KB_DECK_HEIGHT);
    expect(seat?.sitYaw).toBe(0);
    expect(isOnSeat(venue, (seat!.bounds.minX + seat!.bounds.maxX) / 2, (seat!.bounds.minZ + seat!.bounds.maxZ) / 2, KB_DECK_HEIGHT)).toBe(true);
    expect(isOnSeat(venue, (seat!.bounds.minX + seat!.bounds.maxX) / 2, (seat!.bounds.minZ + seat!.bounds.maxZ) / 2, 0)).toBe(false);
  });

  it("uses an L-shaped lounge sofa with seats that face away from the backrests", () => {
    const seats = venue.platforms.filter((p) => p.seat && p.bounds.maxZ < KB_VESTIBULE.minZ);
    expect(seats).toHaveLength(2);
    const spanZ = Math.max(...seats.map((s) => s.bounds.maxZ)) - Math.min(...seats.map((s) => s.bounds.minZ));
    const spanX = Math.max(...seats.map((s) => s.bounds.maxX)) - Math.min(...seats.map((s) => s.bounds.minX));
    expect(spanZ).toBeGreaterThan(2.4);
    expect(spanX).toBeGreaterThan(1.4);
    const long = seats.reduce((a, b) => (a.bounds.maxZ - a.bounds.minZ > b.bounds.maxZ - b.bounds.minZ ? a : b));
    expect(long.sitYaw).toBeCloseTo(-Math.PI / 2, 5);
    expect(seatFacingAt(venue, (long.bounds.minX + long.bounds.maxX) / 2, (long.bounds.minZ + long.bounds.maxZ) / 2, KB_DECK_HEIGHT)).toBeCloseTo(-Math.PI / 2, 5);
  });

  it("opens the 2/F stairwell rail so a climber can step onto the deck", () => {
    expect(KB_DECK_RAIL_GAP.maxX - KB_DECK_RAIL_GAP.minX).toBeGreaterThan(1.0);
    const ontoDeck = moveCircleWithCollisions(
      { x: -7.55, z: KB_DECK_MIN_Z - 0.15 },
      { x: 0, z: 0.55 },
      0.34,
      venue.colliders,
      KB_DECK_HEIGHT,
    );
    expect(ontoDeck.z).toBeGreaterThan(KB_DECK_MIN_Z);
    const blocked = moveCircleWithCollisions(
      { x: (KB_DECK_RAIL.minX + KB_DECK_RAIL.maxX) / 2, z: KB_DECK_MIN_Z + 0.5 },
      { x: 0, z: -1.2 },
      0.34,
      venue.colliders,
      KB_DECK_HEIGHT,
    );
    expect(blocked.z).toBeGreaterThan(KB_DECK_MIN_Z - 0.2);
  });

  it("positions the audience on the floor in front of the walkway", () => {
    expect(venue.show.audiencePoints).toHaveLength(15);
    for (const [x, y, z] of venue.show.audiencePoints) {
      expect(y).toBe(0);
      expect(z).toBeGreaterThan(venue.crowdBarrier.maxZ);
      expect(x).toBeGreaterThan(KB_PARTITION_X);
    }
  });

  it("lists seven role teleports that land on walkable ground facing the job", () => {
    const spots = venue.teleports ?? [];
    expect(spots.map((spot) => spot.id)).toEqual([
      "stage",
      "audience",
      "sound-mixer",
      "lighting",
      "fridge",
      "glass-deck",
      "backstage",
    ]);

    const byId = Object.fromEntries(spots.map((spot) => [spot.id, spot]));
    const onGround = (id: string) => {
      const spot = byId[id];
      expect(groundHeightAt(venue, spot.x, spot.z, spot.y)).toBeCloseTo(spot.y, 5);
      return spot;
    };

    const stage = onGround("stage");
    expect(stage.label).toBe("台上");
    expect(inside(stage.x, stage.z, venue.platforms[0].bounds)).toBe(true);
    expect(stage.yaw).toBeCloseTo(Math.PI, 5);

    const audience = onGround("audience");
    expect(audience.label).toBe("觀眾");
    expect(audience.y).toBe(0);
    expect(audience.z).toBeGreaterThan(venue.crowdBarrier.maxZ);
    expect(audience.x).toBeGreaterThan(KB_PARTITION_X);
    expect(audience.yaw).toBeCloseTo(0, 5);

    const mixer = onGround("sound-mixer");
    expect(mixer.label).toBe("音控");
    expect(mixer.x).toBeCloseTo(KB_PA_CX - 0.8, 5);
    expect(mixer.z).toBeGreaterThan(3.4);
    expect(mixer.z).toBeLessThan(KB_REAR_WALL_Z - 0.3);
    expect(mixer.yaw).toBeCloseTo(0, 5);

    const lighting = onGround("lighting");
    expect(lighting.label).toBe("燈光控制");
    expect(lighting.x).toBeCloseTo(KB_PA_CX + 0.9, 5);
    expect(lighting.z).toBeCloseTo(mixer.z, 5);
    expect(lighting.yaw).toBeCloseTo(0, 5);

    const fridge = onGround("fridge");
    expect(fridge.label).toBe("雪櫃飲品");
    expect(fridge.x).toBeGreaterThan(4.5);
    expect(fridge.z).toBeLessThan(2.4);
    expect(fridge.yaw).toBeCloseTo(0, 5);

    const glass = onGround("glass-deck");
    expect(glass.label).toBe("2/F 玻璃望台");
    expect(inside(glass.x, glass.z, KB_VESTIBULE)).toBe(true);
    expect(glass.y).toBe(KB_DECK_HEIGHT);
    expect(glass.x).toBeGreaterThan(KB_PARTITION_X);
    expect(glass.z).toBeLessThan(2.2);
    expect(glass.yaw).toBeCloseTo(0, 5);

    const backstage = onGround("backstage");
    expect(backstage.label).toBe("1/F Backstage");
    expect(backstage.x).toBeLessThan(KB_PARTITION_X);
    expect(backstage.y).toBe(0);
    expect(backstage.z).toBeGreaterThan(KB_LANDING.maxZ);
    expect(backstage.yaw).toBeCloseTo(-Math.PI / 2, 5);
  });
});
