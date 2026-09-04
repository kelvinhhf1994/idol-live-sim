import { describe, expect, it } from "vitest";
import { createLowPolyPerson } from "../scene/createCharacter";
import {
  applyPersonPose,
  applyPoseLayer,
  clampPersonPose,
  createPersonPose,
  resetPersonPose,
  resetRigPose,
} from "./personPose";

describe("person pose target", () => {
  it("falls through missing higher-priority channels to the lower layer", () => {
    const pose = createPersonPose();
    resetPersonPose(pose);
    applyPoseLayer(pose, { leftHipX: 0.42, rightHipX: -0.42, chestX: -0.08 });
    applyPoseLayer(pose, { leftShoulderX: 1.1 });

    expect(pose.leftHipX).toBe(0.42);
    expect(pose.rightHipX).toBe(-0.42);
    expect(pose.chestX).toBe(-0.08);
    expect(pose.leftShoulderX).toBe(1.1);
    expect(pose.rightShoulderX).toBe(0);
  });

  it("starts every frame from the complete neutral target", () => {
    const pose = createPersonPose();
    applyPoseLayer(pose, { leftKnee: 1.2, bodyY: 0.3, chestZ: 0.2 });

    resetPersonPose(pose);

    expect(pose.leftKnee).toBe(0);
    expect(pose.bodyY).toBe(0);
    expect(pose.chestZ).toBe(0);
    expect(pose.leftShoulderZ).toBeCloseTo(0.12);
    expect(pose.rightShoulderZ).toBeCloseTo(-0.12);
  });

  it("clamps hinge channels without Euler wrapping or reverse knees", () => {
    const pose = createPersonPose();
    pose.leftElbow = 3;
    pose.rightElbow = -1;
    pose.leftKnee = 4;
    pose.rightKnee = -0.5;
    pose.leftAnkleX = 2;
    pose.rightAnkleZ = -2;

    clampPersonPose(pose);

    expect(pose.leftElbow).toBe(2.4);
    expect(pose.rightElbow).toBe(0);
    expect(pose.leftKnee).toBe(2.35);
    expect(pose.rightKnee).toBe(0);
    expect(pose.leftAnkleX).toBe(0.8);
    expect(pose.rightAnkleZ).toBe(-0.55);
  });

  it("applies torso lean above the pelvis instead of rotating from the ground", () => {
    const rig = createLowPolyPerson();
    const pose = createPersonPose();
    pose.chestX = -0.24;
    pose.pelvisY = 0.03;
    pose.leftKnee = 0.4;
    pose.leftAnkleX = -0.2;

    applyPersonPose(rig, pose, 1);

    expect(rig.body.rotation.x).toBe(0);
    expect(rig.chest.rotation.x).toBeCloseTo(-0.24);
    expect(rig.pelvis.position.y).toBeCloseTo(0.67);
    expect(rig.leftKnee.rotation.x).toBeCloseTo(-0.4);
    expect(rig.leftFootPivot.rotation.x).toBeCloseTo(-0.2);
  });

  it("applies lateral bodyPositionX onto body.position.x", () => {
    const rig = createLowPolyPerson();
    const pose = createPersonPose();
    pose.bodyPositionX = -0.26;

    applyPersonPose(rig, pose, 1);

    expect(rig.body.position.x).toBeCloseTo(-0.26);
    expect(rig.body.rotation.x).toBe(0);
  });

  it("resets every animated joint immediately to neutral", () => {
    const rig = createLowPolyPerson();
    rig.body.position.y = 0.4;
    rig.chest.rotation.set(0.3, -0.2, 0.1);
    rig.leftShoulder.rotation.set(1, 0.4, -0.7);
    rig.rightElbow.rotation.x = 1.4;
    rig.leftHip.rotation.x = 0.9;
    rig.rightKnee.rotation.x = -1.1;
    rig.leftFootPivot.rotation.z = 0.4;

    resetRigPose(rig);

    expect(rig.body.position.y).toBe(0);
    expect(rig.chest.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(rig.leftShoulder.rotation.x).toBe(0);
    expect(rig.leftShoulder.rotation.z).toBeCloseTo(0.12);
    expect(rig.rightElbow.rotation.x).toBe(0);
    expect(rig.leftHip.rotation.x).toBe(0);
    expect(rig.rightKnee.rotation.x).toBe(0);
    expect(rig.leftFootPivot.rotation.z).toBe(0);
  });
});
