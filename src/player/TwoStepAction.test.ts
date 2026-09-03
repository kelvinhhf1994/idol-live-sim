import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createLowPolyPerson } from "../scene/createCharacter";
import {
  createTwoStepPose,
  getTwoStepMovementScale,
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

  it("accumulates one complete cycle at 60 FPS", () => {
    const action = new TwoStepAction();
    action.start();

    for (let frame = 0; frame < 48; frame += 1) action.update(1 / 60);

    expect(action.progress).toBeCloseTo(0, 8);
  });
});

describe("writeTwoStepPose", () => {
  it("sweeps the right leg low and diagonally across at quarter-cycle", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.25, pose);

    expect(pose.rightLegX).toBeGreaterThanOrEqual(0.35);
    expect(pose.rightLegX).toBeLessThanOrEqual(0.55);
    expect(pose.rightLegZ).toBeLessThanOrEqual(-0.3);
    expect(pose.rightLegZ).toBeGreaterThanOrEqual(-0.42);
    expect(pose.rightKnee).toBeGreaterThanOrEqual(0.75);
    expect(pose.rightKnee).toBeLessThanOrEqual(1.05);
    expect(Math.abs(pose.rightLegX - pose.rightKnee + pose.rightAnkleX)).toBeLessThan(0.06);
    expect(Math.abs(pose.leftLegZ)).toBeLessThan(0.06);
  });

  it("mirrors the low crossover onto the left leg at three-quarter-cycle", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.75, pose);

    expect(pose.leftLegX).toBeGreaterThanOrEqual(0.35);
    expect(pose.leftLegX).toBeLessThanOrEqual(0.55);
    expect(pose.leftLegZ).toBeGreaterThanOrEqual(0.3);
    expect(pose.leftLegZ).toBeLessThanOrEqual(0.42);
    expect(pose.leftKnee).toBeGreaterThanOrEqual(0.75);
    expect(pose.leftKnee).toBeLessThanOrEqual(1.05);
    expect(Math.abs(pose.leftLegX - pose.leftKnee + pose.leftAnkleX)).toBeLessThan(0.06);
    expect(Math.abs(pose.rightLegZ)).toBeLessThan(0.06);
  });

  it("lands on a near-vertical support leg before transferring weight", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.375, pose);

    expect(pose.rightKnee).toBeGreaterThanOrEqual(0.35);
    expect(pose.rightKnee).toBeLessThanOrEqual(0.55);
    expect(pose.rightLegX).toBeCloseTo(pose.rightKnee / 2, 2);
    expect(Math.abs(pose.rightLegZ)).toBeLessThan(0.06);
    expect(pose.leftLegX).toBeGreaterThan(0);
    expect(pose.bodyY + pose.pelvisY).toBeLessThan(0);
  });

  it("keeps a forward lean, restrained bounce, and opposite arm counter-swing", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.25, pose);

    expect(pose.bodyX).toBe(0);
    expect(pose.chestX).toBeGreaterThanOrEqual(-0.28);
    expect(pose.chestX).toBeLessThanOrEqual(-0.18);
    expect(pose.bodyY).toBeGreaterThanOrEqual(0);
    expect(pose.bodyY).toBeLessThanOrEqual(0.05);
    expect(Math.abs(pose.bodyZ)).toBeLessThanOrEqual(0.05);
    expect(pose.leftArmX).toBeGreaterThan(0.35);
    expect(pose.rightArmX).toBeLessThan(-0.15);
    expect(pose.leftElbow).toBeGreaterThan(0.15);
    expect(pose.rightElbow).toBeGreaterThan(0.35);
  });

  it("is an exact left-right mirror half a cycle later", () => {
    const first = createTwoStepPose();
    const mirrored = createTwoStepPose();

    for (const progress of [0, 0.125, 0.25, 0.375]) {
      writeTwoStepPose(progress, first);
      writeTwoStepPose(progress + 0.5, mirrored);
      expect(mirrored.leftLegX).toBeCloseTo(first.rightLegX);
      expect(mirrored.rightLegX).toBeCloseTo(first.leftLegX);
      expect(mirrored.leftLegZ).toBeCloseTo(-first.rightLegZ);
      expect(mirrored.rightLegZ).toBeCloseTo(-first.leftLegZ);
      expect(mirrored.leftArmX).toBeCloseTo(first.rightArmX);
      expect(mirrored.rightArmX).toBeCloseTo(first.leftArmX);
      expect(mirrored.leftKnee).toBeCloseTo(first.rightKnee);
      expect(mirrored.rightKnee).toBeCloseTo(first.leftKnee);
      expect(mirrored.leftAnkleX).toBeCloseTo(first.rightAnkleX);
      expect(mirrored.rightAnkleX).toBeCloseTo(first.leftAnkleX);
      expect(mirrored.leftElbow).toBeCloseTo(first.rightElbow);
      expect(mirrored.rightElbow).toBeCloseTo(first.leftElbow);
      expect(mirrored.bodyZ).toBeCloseTo(-first.bodyZ);
      expect(mirrored.bodyX).toBeCloseTo(first.bodyX);
      expect(mirrored.bodyY).toBeCloseTo(first.bodyY);
    }
  });

  it("stays continuous across every keyframe and the cycle boundary", () => {
    const before = createTwoStepPose();
    const after = createTwoStepPose();

    for (let keyframe = 0; keyframe <= 8; keyframe += 1) {
      const progress = keyframe / 8;
      writeTwoStepPose(progress - 0.0001, before);
      writeTwoStepPose(progress + 0.0001, after);
      for (const key of Object.keys(before) as (keyof typeof before)[]) {
        expect(Math.abs(before[key] - after[key])).toBeLessThan(0.01);
      }
    }
  });

  it("keeps planted toe and heel grounded with less than 3.5cm drift", () => {
    for (const [progress, side] of [
      [0, "left"],
      [0.375, "right"],
      [0.5, "right"],
      [0.875, "left"],
    ] as const) {
      const contact = supportFootContact(progress, side);
      expect(Math.abs(contact.toeY)).toBeLessThan(0.012);
      expect(Math.abs(contact.heelY)).toBeLessThan(0.012);
      expect(contact.horizontalDrift).toBeLessThan(0.035);
    }
  });

  it("rises at hop apex and compresses on landing", () => {
    const apex = createTwoStepPose();
    const landing = createTwoStepPose();

    writeTwoStepPose(0.125, apex);
    writeTwoStepPose(0.375, landing);

    expect(apex.bodyY + apex.pelvisY).toBeGreaterThan(0.025);
    expect(landing.bodyY + landing.pelvisY).toBeLessThan(-0.005);
  });
});

describe("getTwoStepMovementScale", () => {
  it("pulses movement around planted phases while averaging normal speed", () => {
    const samples = Array.from({ length: 48 }, (_, frame) =>
      getTwoStepMovementScale(frame / 48),
    );
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;

    expect(Math.min(...samples)).toBeLessThan(0.3);
    expect(Math.max(...samples)).toBeGreaterThan(1.7);
    expect(average).toBeCloseTo(1, 8);
  });

  it("keeps hop and crossover transfer faster than plant and landing", () => {
    const plant = getTwoStepMovementScale(0);
    const hop = getTwoStepMovementScale(0.125);
    const crossover = getTwoStepMovementScale(0.25);
    const landing = getTwoStepMovementScale(0.375);

    expect(plant).toBeLessThan(0.35);
    expect(landing).toBeLessThanOrEqual(1.05);
    expect(crossover).toBeGreaterThan(1.7);
    expect(hop).toBeGreaterThan(0.9);
    expect(crossover).toBeGreaterThan(plant * 4);
  });
});

function supportFootContact(progress: number, side: "left" | "right") {
  const rig = createLowPolyPerson();
  const neutralRig = createLowPolyPerson();
  const pose = createTwoStepPose();
  writeTwoStepPose(progress, pose);
  rig.leftLeg.rotation.set(pose.leftLegX, 0, pose.leftLegZ);
  rig.rightLeg.rotation.set(pose.rightLegX, 0, pose.rightLegZ);
  rig.leftKnee.rotation.x = -pose.leftKnee;
  rig.rightKnee.rotation.x = -pose.rightKnee;
  rig.leftFootPivot.rotation.set(pose.leftAnkleX, 0, pose.leftAnkleZ);
  rig.rightFootPivot.rotation.set(pose.rightAnkleX, 0, pose.rightAnkleZ);
  rig.body.position.y = pose.bodyY;
  rig.pelvis.position.y = 0.64 + pose.pelvisY;
  rig.group.updateMatrixWorld(true);
  neutralRig.group.updateMatrixWorld(true);
  const foot = side === "left" ? rig.leftFoot : rig.rightFoot;
  const neutralFoot = side === "left" ? neutralRig.leftFoot : neutralRig.rightFoot;
  const toe = foot.localToWorld(new THREE.Vector3(0, -0.06, -0.14));
  const heel = foot.localToWorld(new THREE.Vector3(0, -0.06, 0.14));
  const center = foot.getWorldPosition(new THREE.Vector3());
  const neutralCenter = neutralFoot.getWorldPosition(new THREE.Vector3());
  return {
    toeY: toe.y,
    heelY: heel.y,
    horizontalDrift: Math.hypot(center.x - neutralCenter.x, center.z - neutralCenter.z),
  };
}
