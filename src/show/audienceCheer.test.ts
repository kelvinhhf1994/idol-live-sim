import { describe, expect, it } from "vitest";
import { createPersonPose } from "../animation/personPose";
import { PENLIGHT_STICK_IDLE } from "../player/penlight";
import { createWeekendHero, mixWeekendAudienceLook } from "../scene/createWeekendHero";
import {
  applyAudiencePenlight,
  cheerStyleFor,
  writeAudienceCheerPose,
} from "./audienceCheer";

describe("audienceCheer", () => {
  it("gives every crowd look a glow stick and a rotating cheer style", () => {
    const looks = Array.from({ length: 12 }, (_, index) => mixWeekendAudienceLook(index));
    expect(looks.every((look) => look.glowStick)).toBe(true);
    expect(new Set(looks.map((_, index) => cheerStyleFor(index)))).toEqual(
      new Set(["raise", "wiper", "beat"]),
    );
  });

  it("raises, wipes, or beats with the right arm while the legs keep bouncing", () => {
    const raise = createPersonPose();
    const wiperA = createPersonPose();
    const wiperB = createPersonPose();
    const beat = createPersonPose();
    writeAudienceCheerPose(0.4, 1, raise);
    writeAudienceCheerPose(0.2, 2, wiperA);
    writeAudienceCheerPose(0.7, 2, wiperB);
    writeAudienceCheerPose(0.15, 0, beat);

    expect(cheerStyleFor(1)).toBe("raise");
    expect(raise.rightShoulderX).toBeGreaterThan(2.2);
    expect(cheerStyleFor(2)).toBe("wiper");
    expect(Math.abs(wiperA.rightShoulderZ - wiperB.rightShoulderZ)).toBeGreaterThan(0.15);
    expect(cheerStyleFor(0)).toBe("beat");
    expect(beat.rightElbow).toBeGreaterThan(1.2);
    expect(raise.leftKnee + raise.rightKnee).toBeGreaterThan(0.2);
  });

  it("aims the glow stick with the cheer pose instead of the idle carry", () => {
    const rig = createWeekendHero({ glowStick: true });
    applyAudiencePenlight(rig, 0.3, 1);
    const stick = rig.glowStick!;
    expect(stick.visible).toBe(true);
    expect(Math.abs(stick.rotation.x)).toBeGreaterThan(
      Math.abs(PENLIGHT_STICK_IDLE.rotation.x) + 1,
    );
  });
});
