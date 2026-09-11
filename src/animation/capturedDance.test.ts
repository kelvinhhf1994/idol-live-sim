import { describe, expect, it } from "vitest";
import { createPersonPose } from "./personPose";
import {
  parseDanceClip,
  sampleCapturedDance,
  type DanceClip,
} from "./capturedDance";
import fixture from "./fixtures/tiny-dance.animation.json";

describe("parseDanceClip", () => {
  it("accepts a valid schemaVersion 1 clip", () => {
    const clip = parseDanceClip(fixture);
    expect(clip.duration).toBe(1);
    expect(clip.timestamps).toHaveLength(3);
    expect(clip.poses).toHaveLength(3);
    expect(clip.captureMode).toBe("front-facing-2d");
  });

  it("rejects clips with mismatched timestamps and poses", () => {
    expect(() =>
      parseDanceClip({
        ...fixture,
        poses: fixture.poses.slice(0, 1),
      }),
    ).toThrow(/timestamps/);
  });
});

describe("sampleCapturedDance", () => {
  const clip = parseDanceClip(fixture) as DanceClip;

  it("returns the first keyframe at t=0", () => {
    const pose = createPersonPose();
    sampleCapturedDance(clip, 0, pose, { loop: true });
    expect(pose.leftShoulderX).toBeCloseTo(0.2);
    expect(pose.bodyPositionX).toBeCloseTo(0);
  });

  it("linearly interpolates between keyframes", () => {
    const pose = createPersonPose();
    sampleCapturedDance(clip, 0.25, pose, { loop: true });
    expect(pose.leftShoulderX).toBeCloseTo(0.7);
    expect(pose.bodyPositionX).toBeCloseTo(0.05);
  });

  it("wraps time when looping", () => {
    const atZero = createPersonPose();
    const wrapped = createPersonPose();
    sampleCapturedDance(clip, 0, atZero, { loop: true });
    sampleCapturedDance(clip, 1, wrapped, { loop: true });
    expect(wrapped.leftShoulderX).toBeCloseTo(atZero.leftShoulderX);
    expect(wrapped.bodyPositionX).toBeCloseTo(atZero.bodyPositionX);
  });

  it("clamps to the last keyframe when not looping past the end", () => {
    const pose = createPersonPose();
    sampleCapturedDance(clip, 5, pose, { loop: false });
    expect(pose.leftShoulderX).toBeCloseTo(0.2);
    expect(pose.rightFootX).toBeCloseTo(0.14);
  });

  it("fills unspecified channels from the neutral pose", () => {
    const pose = createPersonPose();
    sampleCapturedDance(clip, 0, pose, { loop: true });
    expect(pose.chestX).toBe(0);
    expect(pose.leftFootY).toBe(0);
  });
});
