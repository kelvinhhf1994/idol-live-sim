import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GENERIC_VENUE } from "../config/venue";
import { getDancePose, ShowController } from "./ShowController";

describe("getDancePose", () => {
  it("repeats after one four-second phrase", () => {
    expect(getDancePose(0.7, 0)).toEqual(getDancePose(4.7, 0));
  });

  it("adds a small phase offset between idols", () => {
    const first = getDancePose(1, 0);
    const fifth = getDancePose(1, 4);

    expect(fifth.armSwing).not.toBeCloseTo(first.armSwing);
    expect(Math.abs(fifth.bodyBounce - first.bodyBounce)).toBeLessThan(0.2);
  });
});

describe("ShowController audience impacts", () => {
  it("knocks an audience member inside the active forward impact range", () => {
    const performers = Array.from({ length: 5 }, (_, index) => new THREE.Vector3(index, 0, -5));
    const show = new ShowController(
      performers,
      [new THREE.Vector3(0, 0, -0.8)],
      [],
      GENERIC_VENUE,
    );

    show.update(0.016, 0.016, {
      mode: "mosh",
      x: 0,
      z: 0,
      movementX: 0,
      movementZ: -1,
      forwardX: 0,
      forwardZ: -1,
    });

    expect(show.getAudienceStatus().knockedAudienceCount).toBe(1);
  });
});
