import { describe, expect, it } from "vitest";
import {
  createJumpPointPose,
  JumpPointAction,
  writeJumpPointPose,
} from "./JumpPointAction";

describe("JumpPointAction", () => {
  it("completes one cycle after a quick tap without repeating", () => {
    const action = new JumpPointAction();

    expect(action.press(true)).toBe(true);
    action.release();
    expect(action.isActive).toBe(true);
    action.onLanded();
    expect(action.updateGrounded(0.2)).toBe(false);
    expect(action.isActive).toBe(false);
  });

  it("repeats only after landing and the beat delay while held", () => {
    const action = new JumpPointAction();

    expect(action.press(true)).toBe(true);
    expect(action.updateGrounded(1)).toBe(false);
    action.onLanded();
    expect(action.updateGrounded(0.05)).toBe(false);
    expect(action.updateGrounded(0.08)).toBe(true);
    expect(action.isPointing).toBe(true);
  });

  it("does not double jump when pressed while airborne", () => {
    const action = new JumpPointAction();

    expect(action.press(false)).toBe(false);
    expect(action.press(false)).toBe(false);
  });

  it("does not repeat after release", () => {
    const action = new JumpPointAction();

    action.press(true);
    action.release();
    action.onLanded();

    expect(action.updateGrounded(1)).toBe(false);
    expect(action.held).toBe(false);
  });
});

describe("writeJumpPointPose", () => {
  it("extends the right arm upward and toward local negative Z", () => {
    const pose = createJumpPointPose();

    writeJumpPointPose(0.4, false, pose);
    const partialExtension = pose.rightArmX;
    writeJumpPointPose(1, false, pose);

    expect(pose.rightArmX).toBeGreaterThan(partialExtension);
    expect(pose.rightArmX).toBeGreaterThan(Math.PI / 2);
    expect(Math.sin(pose.rightArmX)).toBeGreaterThan(0);
    expect(Math.cos(pose.rightArmX)).toBeLessThan(0);
    expect(pose.leftArmX).toBeLessThan(0);
    expect(pose.rightElbow).toBeGreaterThan(0.15);
    expect(pose.rightElbow).toBeLessThan(0.45);
    expect(pose.leftKnee).toBeGreaterThan(0.2);
    expect(pose.rightKnee).toBeGreaterThan(0.2);
    expect(pose.bodyX).toBe(0);
    expect(pose.chestX).toBeGreaterThan(0);
  });

  it("crouches and retracts the pointing arm on landing", () => {
    const pose = createJumpPointPose();

    writeJumpPointPose(1, true, pose);

    expect(pose.rightArmX).toBeLessThan(0.5);
    expect(pose.bodyY).toBeLessThan(0);
    expect(pose.leftKnee).toBeGreaterThan(0.65);
    expect(pose.rightKnee).toBeGreaterThan(0.65);
    expect(pose.pelvisY).toBeLessThan(0);
  });
});
