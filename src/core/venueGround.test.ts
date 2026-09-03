import { describe, expect, it } from "vitest";
import { GENERIC_VENUE } from "../config/venue";
import { groundHeightAt } from "./venueGround";

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
