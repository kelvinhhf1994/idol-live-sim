import { describe, expect, it } from "vitest";
import {
  createTwoStepPose,
  TwoStepAction,
  writeTwoStepPose,
} from "./TwoStepAction";

describe("TwoStepAction", () => {
  it("is active only while held", () => {
    const action = new TwoStepAction();

    action.start();
    expect(action.isActive).toBe(true);
    action.release();
    expect(action.isActive).toBe(false);
  });

  it("does not latch after a tap", () => {
    const action = new TwoStepAction();

    action.start();
    action.release();
    action.update(1);

    expect(action.isActive).toBe(false);
    expect(action.progress).toBe(0);
  });
});

describe("writeTwoStepPose", () => {
  it("performs left step, right kick, right step, then left kick", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.125, pose);
    expect(Math.abs(pose.leftLegZ)).toBeGreaterThan(0.2);
    expect(Math.abs(pose.rightLegZ)).toBeLessThan(0.01);
    expect(pose.leftLegX).toBeLessThan(0.3);
    expect(pose.rightLegX).toBeLessThan(0.3);

    writeTwoStepPose(0.375, pose);
    expect(pose.rightLegX).toBeGreaterThan(0.8);
    expect(pose.leftLegX).toBeLessThan(0.3);

    writeTwoStepPose(0.625, pose);
    expect(Math.abs(pose.rightLegZ)).toBeGreaterThan(0.2);
    expect(Math.abs(pose.leftLegZ)).toBeLessThan(0.01);

    writeTwoStepPose(0.875, pose);
    expect(pose.leftLegX).toBeGreaterThan(0.8);
    expect(pose.rightLegX).toBeLessThan(0.3);
  });

  it("counter-swings the arms without kicking both legs together", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.375, pose);
    expect(pose.leftArmX).toBeGreaterThan(0.4);
    expect(pose.rightArmX).toBeLessThan(-0.2);
    expect(Math.min(pose.leftLegX, pose.rightLegX)).toBeLessThan(0.3);

    writeTwoStepPose(0.875, pose);
    expect(pose.rightArmX).toBeGreaterThan(0.4);
    expect(pose.leftArmX).toBeLessThan(-0.2);
    expect(Math.min(pose.leftLegX, pose.rightLegX)).toBeLessThan(0.3);
  });
});
