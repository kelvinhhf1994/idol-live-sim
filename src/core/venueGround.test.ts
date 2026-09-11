import { describe, expect, it } from "vitest";
import { GENERIC_VENUE } from "../config/venue";
import type { VenueDefinition } from "../config/venue";
import { groundHeightAt, isOnSeat, seatFacingAt } from "./venueGround";

// Two overlapping platforms at the same XZ: a stair tread at 2.8 and a 2/F deck at 3.0
const twoLevel: Pick<VenueDefinition, "platforms" | "spawn"> = {
  spawn: { x: 0, y: 0, z: 0, yaw: 0 },
  platforms: [
    { bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }, height: 3.0 },
    { bounds: { minX: -1, maxX: 1, minZ: 2, maxZ: 3 }, height: 2.8 },
    { bounds: { minX: 4, maxX: 5, minZ: -1, maxZ: 1 }, height: 0.7 },
  ],
};

describe("groundHeightAt", () => {
  it("returns the visual stage top inside stage bounds", () => {
    expect(groundHeightAt(GENERIC_VENUE, 0, -12.2)).toBe(0.75);
    expect(groundHeightAt(GENERIC_VENUE, 5.5, -14.95)).toBe(0.75);
  });

  it("returns venue floor height outside stage bounds", () => {
    expect(groundHeightAt(GENERIC_VENUE, 0, -8.9)).toBe(0);
    expect(groundHeightAt(GENERIC_VENUE, 5.8, -12.2)).toBe(0);
  });
});

describe("groundHeightAt with a player height", () => {
  it("treats a deck far overhead as a ceiling for a ground-floor player", () => {
    expect(groundHeightAt(twoLevel, 0, 0, 0)).toBe(0);
  });

  it("returns the deck for a player already standing on it", () => {
    expect(groundHeightAt(twoLevel, 0, 0, 3.0)).toBe(3.0);
  });

  it("returns the deck for a player one tread below it", () => {
    expect(groundHeightAt(twoLevel, 0, 0, 2.8)).toBe(3.0);
  });

  it("still reports a knee-high stage as ground so the step logic can block it", () => {
    expect(groundHeightAt(twoLevel, 4.5, 0, 0)).toBe(0.7);
  });

  it("keeps the legacy highest-platform behaviour when no height is given", () => {
    expect(groundHeightAt(twoLevel, 0, 0)).toBe(3.0);
  });
});

describe("isOnSeat", () => {
  const seated = {
    platforms: [
      { bounds: { minX: -2, maxX: 2, minZ: 0, maxZ: 1 }, height: 3.0, seat: true },
      { bounds: { minX: -2, maxX: 2, minZ: 0, maxZ: 1 }, height: 0 },
    ],
  };

  it("is true on a seat platform at the matching floor", () => {
    expect(isOnSeat(seated, 0, 0.4, 3.0)).toBe(true);
  });

  it("is false on the same XZ from the floor below", () => {
    expect(isOnSeat(seated, 0, 0.4, 0)).toBe(false);
  });
});

describe("seatFacingAt", () => {
  const seated = {
    platforms: [{ bounds: { minX: -2, maxX: 2, minZ: 0, maxZ: 1 }, height: 3.0, seat: true, sitYaw: Math.PI }],
  };

  it("returns the seat yaw on the matching floor", () => {
    expect(seatFacingAt(seated, 0, 0.4, 3.0)).toBe(Math.PI);
  });

  it("is undefined off the seat", () => {
    expect(seatFacingAt(seated, 0, 0.4, 0)).toBeUndefined();
  });
});
