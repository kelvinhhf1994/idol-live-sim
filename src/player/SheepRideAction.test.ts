import { describe, expect, it } from "vitest";
import { createPersonPose } from "../animation/personPose";
import { createSheepMount } from "../scene/createSheepMount";
import { applySheepGallop, SheepRideAction, writeRidePose } from "./SheepRideAction";

describe("SheepRideAction", () => {
  it("only advances the gallop while moving", () => {
    const action = new SheepRideAction();
    action.start();

    action.update(0.3, false);
    expect(action.isActive).toBe(true);
    expect(action.phase).toBe(0);
    expect(action.gait).toBeLessThan(0.05);

    action.update(0.3, true);
    expect(action.phase).toBeGreaterThan(0);
    expect(action.gait).toBeGreaterThan(0.5);
  });

  it("does nothing while inactive and resets on stop", () => {
    const action = new SheepRideAction();
    action.update(1, true);
    expect(action.phase).toBe(0);

    action.start();
    action.update(1, true);
    action.stop();
    expect(action.isActive).toBe(false);
    expect(action.phase).toBe(0);
    expect(action.gait).toBe(0);
  });
});

describe("writeRidePose", () => {
  it("lifts the rider onto the seat and straddles the sheep", () => {
    const pose = createPersonPose();
    writeRidePose(0, 0, pose);

    expect(pose.bodyY).toBeGreaterThan(0.03);
    expect(pose.leftHipX).toBeGreaterThan(0.6);
    expect(pose.rightHipX).toBeGreaterThan(0.6);
    expect(pose.leftHipZ).toBeLessThan(-0.2);
    expect(pose.rightHipZ).toBeGreaterThan(0.2);
    expect(pose.leftKnee).toBeGreaterThan(0.8);
    expect(pose.rightKnee).toBeGreaterThan(0.8);
    expect(pose.leftShoulderX).toBeGreaterThan(0.5);
    expect(pose.rightShoulderX).toBeGreaterThan(0.5);
    expect(pose.chestX).toBeLessThan(0);
  });

  it("bounces with the gallop only while moving", () => {
    const still = createPersonPose();
    const galloping = createPersonPose();
    writeRidePose(0.25, 0, still);
    writeRidePose(0.25, 1, galloping);

    expect(galloping.bodyY).toBeGreaterThan(still.bodyY + 0.01);
  });
});

describe("applySheepGallop", () => {
  it("swings front and rear legs in anti-phase while moving, and rests when still", () => {
    const mount = createSheepMount();
    applySheepGallop(0.25, 1, mount);

    expect(mount.frontLeftLeg.rotation.x).toBeGreaterThan(0.2);
    expect(mount.frontRightLeg.rotation.x).toBeCloseTo(mount.frontLeftLeg.rotation.x, 5);
    expect(mount.rearLeftLeg.rotation.x).toBeLessThan(-0.2);
    expect(mount.group.position.y).toBeGreaterThan(0.01);

    applySheepGallop(0.25, 0, mount);
    expect(mount.frontLeftLeg.rotation.x).toBeCloseTo(0, 5);
    expect(mount.rearLeftLeg.rotation.x).toBeCloseTo(0, 5);
    expect(mount.group.position.y).toBeCloseTo(0, 5);
  });
});
