import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { KB_DECK_HEIGHT, KB_HALL_CEILING, KOWLOON_BAY_VENUE } from "../../config/venue";
import { createVenue } from "../createVenue";

function collectNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((child) => {
    if (child.name) names.push(child.name);
  });
  return names;
}

describe("createVenue for Kowloon Bay", () => {
  it("creates a VenueBuild with the hall shell, stage and truss walkway", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);

    expect(build.group.name).toBe("kowloon-bay-live-house-01");
    expect(build.colliders).toHaveLength(KOWLOON_BAY_VENUE.colliders.length);
    expect(build.audiencePoints).toHaveLength(15);
    expect(build.stageLights.length).toBeGreaterThanOrEqual(4);

    const names = collectNames(build.group);
    for (const expected of [
      "plank-floor",
      "ceiling",
      "curtain-back",
      "acoustic-wall",
      "air-con",
      "main-stage",
      "tape-mark",
      "truss-walkway",
      "walkway-plate",
      "wedge-monitor",
      "walkway-stairs-left",
      "walkway-stairs-right",
    ]) {
      expect(names, expected).toContain(expected);
    }
  });

  it("hangs the ceiling at the tall hall height", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const ceiling = build.group.getObjectByName("ceiling")!;
    expect(ceiling.position.y).toBeGreaterThanOrEqual(KB_HALL_CEILING);
    expect(KB_HALL_CEILING).toBeGreaterThan(KB_DECK_HEIGHT + 3);
  });
});
