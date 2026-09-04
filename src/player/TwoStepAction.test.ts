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
  it("kicks the right heel back toward the glutes on left hop-2 accent", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.25, pose);

    // Left-foot ken-ken accent: thigh extended behind (negative hipX), knee deeply flexed.
    expect(pose.rightLegX).toBeLessThanOrEqual(-0.25);
    expect(pose.rightLegX).toBeGreaterThanOrEqual(-0.4);
    expect(pose.rightLegZ).toBeLessThanOrEqual(-0.25);
    expect(pose.rightLegZ).toBeGreaterThanOrEqual(-0.4);
    expect(pose.rightKnee).toBeGreaterThanOrEqual(1.3);
    expect(pose.rightKnee).toBeLessThanOrEqual(1.55);
    expect(pose.rightAnkleX).toBeGreaterThan(0.2);
    expect(pose.rightAnkleX).toBeLessThan(0.4);
    expect(Math.abs(pose.leftLegZ)).toBeLessThan(0.06);
    // Support leg stays springy and flat to the ground.
    expect(Math.abs(pose.leftLegX - pose.leftKnee + pose.leftAnkleX)).toBeLessThan(0.06);
    // Body hops onto the left support side.
    expect(pose.bodyPositionX).toBeLessThan(-0.2);
  });

  it("mirrors the butt-kick onto the left leg on right hop-2 accent", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.75, pose);

    expect(pose.leftLegX).toBeLessThanOrEqual(-0.25);
    expect(pose.leftLegX).toBeGreaterThanOrEqual(-0.4);
    expect(pose.leftLegZ).toBeGreaterThanOrEqual(0.25);
    expect(pose.leftLegZ).toBeLessThanOrEqual(0.4);
    expect(pose.leftKnee).toBeGreaterThanOrEqual(1.3);
    expect(pose.leftKnee).toBeLessThanOrEqual(1.55);
    expect(pose.leftAnkleX).toBeGreaterThan(0.2);
    expect(pose.leftAnkleX).toBeLessThan(0.4);
    expect(Math.abs(pose.rightLegZ)).toBeLessThan(0.06);
    expect(Math.abs(pose.rightLegX - pose.rightKnee + pose.rightAnkleX)).toBeLessThan(0.06);
    expect(pose.bodyPositionX).toBeGreaterThan(0.2);
  });

  it("stays on the left support for both left hops (LLRR, not LRLR)", () => {
    const hop1 = createTwoStepPose();
    const hop2 = createTwoStepPose();

    writeTwoStepPose(0.125, hop1);
    writeTwoStepPose(0.25, hop2);

    // Both early-cycle samples keep left foot planted and body on the left.
    expect(hop1.bodyPositionX).toBeLessThan(-0.2);
    expect(hop2.bodyPositionX).toBeLessThan(-0.2);
    expect(Math.abs(hop1.leftLegZ)).toBeLessThan(0.06);
    expect(Math.abs(hop2.leftLegZ)).toBeLessThan(0.06);
    // Free (right) leg stays deeply tucked — never a right-foot plant in the first half.
    expect(hop1.rightKnee).toBeGreaterThanOrEqual(1.35);
    expect(hop1.rightKnee).toBeLessThanOrEqual(1.45);
    expect(hop2.rightKnee).toBeGreaterThan(1.3);
    expect(hop1.rightLegX).toBeLessThan(-0.15);
    expect(hop2.rightLegX).toBeLessThan(-0.25);
  });

  it("tucks the free leg deep on hop-1 plant and buffers the support knee", () => {
    const leftPlant = createTwoStepPose();
    const rightPlant = createTwoStepPose();

    writeTwoStepPose(0, leftPlant);
    writeTwoStepPose(0.5, rightPlant);

    expect(leftPlant.rightKnee).toBeGreaterThanOrEqual(0.85);
    expect(leftPlant.rightKnee).toBeLessThanOrEqual(0.95);
    // Support knee deep enough to keep the foot grounded while bodyY sinks.
    expect(leftPlant.leftKnee).toBeGreaterThanOrEqual(0.8);
    expect(leftPlant.leftKnee).toBeLessThanOrEqual(0.9);
    expect(Math.abs(leftPlant.leftLegX - leftPlant.leftKnee + leftPlant.leftAnkleX)).toBeLessThan(
      0.06,
    );

    expect(rightPlant.leftKnee).toBeGreaterThanOrEqual(0.85);
    expect(rightPlant.leftKnee).toBeLessThanOrEqual(0.95);
    expect(rightPlant.rightKnee).toBeGreaterThanOrEqual(0.8);
    expect(rightPlant.rightKnee).toBeLessThanOrEqual(0.9);
  });

  it("lands on a bent support leg and compresses COG on each plant", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.25, pose);

    expect(pose.leftKnee).toBeGreaterThanOrEqual(0.8);
    expect(pose.leftKnee).toBeLessThanOrEqual(0.9);
    expect(Math.abs(pose.leftLegZ)).toBeLessThan(0.06);
    expect(pose.rightLegX).toBeLessThan(0);
    expect(pose.bodyY + pose.pelvisY).toBeLessThan(-0.04);
  });

  it("keeps a deep forward lean, big sway, lateral hop, and wide arm flares past 90°", () => {
    const pose = createTwoStepPose();

    writeTwoStepPose(0.25, pose);

    expect(pose.bodyX).toBe(0);
    expect(pose.bodyPositionX).toBeLessThan(-0.2);
    expect(pose.bodyPositionX).toBeGreaterThan(-0.35);
    // Full-play side view leans ~20–25°.
    expect(pose.chestX).toBeGreaterThanOrEqual(-0.45);
    expect(pose.chestX).toBeLessThanOrEqual(-0.35);
    expect(pose.bodyY).toBeGreaterThanOrEqual(-0.05);
    expect(pose.bodyY).toBeLessThanOrEqual(-0.03);
    expect(Math.abs(pose.bodyZ)).toBeGreaterThanOrEqual(0.25);
    expect(Math.abs(pose.bodyYaw)).toBeGreaterThanOrEqual(0.35);
    expect(pose.leftArmX).toBeGreaterThan(0.55);
    // Back arm pumps deep behind (~-1.15…-1.25) for strong opposite contrast.
    expect(pose.rightArmX).toBeLessThanOrEqual(-1.15);
    expect(pose.rightArmX).toBeGreaterThanOrEqual(-1.25);
    expect(pose.leftArmZ).toBeLessThan(-Math.PI / 2);
    expect(pose.rightArmZ).toBeGreaterThan(0.8);
    expect(pose.leftElbow).toBeGreaterThan(0.15);
    expect(pose.rightElbow).toBeGreaterThan(0.9);
  });

  it("throws the trailing arm far behind on both hop accents", () => {
    const leftHop = createTwoStepPose();
    const rightHop = createTwoStepPose();
    writeTwoStepPose(0.25, leftHop);
    writeTwoStepPose(0.75, rightHop);

    expect(leftHop.rightArmX).toBeCloseTo(-1.2, 5);
    expect(rightHop.leftArmX).toBeCloseTo(-1.2, 5);
    expect(leftHop.rightElbow).toBeGreaterThan(leftHop.leftElbow);
    expect(rightHop.leftElbow).toBeGreaterThan(rightHop.rightElbow);
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
      expect(mirrored.leftArmZ).toBeCloseTo(-first.rightArmZ);
      expect(mirrored.rightArmZ).toBeCloseTo(-first.leftArmZ);
      expect(mirrored.leftKnee).toBeCloseTo(first.rightKnee);
      expect(mirrored.rightKnee).toBeCloseTo(first.leftKnee);
      expect(mirrored.leftAnkleX).toBeCloseTo(first.rightAnkleX);
      expect(mirrored.rightAnkleX).toBeCloseTo(first.leftAnkleX);
      expect(mirrored.leftElbow).toBeCloseTo(first.rightElbow);
      expect(mirrored.rightElbow).toBeCloseTo(first.leftElbow);
      expect(mirrored.bodyZ).toBeCloseTo(-first.bodyZ);
      expect(mirrored.bodyYaw).toBeCloseTo(-first.bodyYaw);
      expect(mirrored.bodyX).toBeCloseTo(first.bodyX);
      expect(mirrored.bodyPositionX).toBeCloseTo(-first.bodyPositionX);
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
      [0.25, "left"],
      [0.5, "right"],
      [0.75, "right"],
    ] as const) {
      const contact = supportFootContact(progress, side);
      // Deep plant COG (bodyY + pelvisY) sinks ~4–5cm; keep both ends flat and near ground.
      expect(Math.abs(contact.toeY)).toBeLessThan(0.055);
      expect(Math.abs(contact.heelY)).toBeLessThan(0.055);
      expect(Math.abs(contact.toeY - contact.heelY)).toBeLessThan(0.01);
      expect(contact.horizontalDrift).toBeLessThan(0.035);
    }
  });

  it("rises at each hop apex and compresses on each plant (four pulses)", () => {
    const apex1 = createTwoStepPose();
    const plant2 = createTwoStepPose();
    const apex2 = createTwoStepPose();
    const plant3 = createTwoStepPose();

    writeTwoStepPose(0.125, apex1);
    writeTwoStepPose(0.25, plant2);
    writeTwoStepPose(0.375, apex2);
    writeTwoStepPose(0.5, plant3);

    expect(apex1.bodyY).toBeGreaterThanOrEqual(0.17);
    expect(apex1.bodyY).toBeLessThanOrEqual(0.18);
    expect(apex2.bodyY).toBeGreaterThanOrEqual(0.17);
    expect(apex2.bodyY).toBeLessThanOrEqual(0.18);
    expect(plant2.bodyY).toBeLessThanOrEqual(-0.035);
    expect(plant3.bodyY).toBeLessThanOrEqual(-0.035);

    const apex1Cog = apex1.bodyY + apex1.pelvisY;
    const plant2Cog = plant2.bodyY + plant2.pelvisY;
    const apex2Cog = apex2.bodyY + apex2.pelvisY;
    const plant3Cog = plant3.bodyY + plant3.pelvisY;

    expect(apex1Cog).toBeGreaterThan(0.15);
    expect(plant2Cog).toBeLessThanOrEqual(-0.045);
    expect(apex2Cog).toBeGreaterThan(0.15);
    expect(plant3Cog).toBeLessThanOrEqual(-0.045);
    // Hop→compress span must read as a clear bounce (>20cm).
    expect(apex1Cog - plant2Cog).toBeGreaterThan(0.2);
    expect(apex2Cog - plant3Cog).toBeGreaterThan(0.2);
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

  it("keeps hop apexes faster than plants across all four LLRR beats", () => {
    const plant1 = getTwoStepMovementScale(0);
    const hop1 = getTwoStepMovementScale(0.125);
    const plant2 = getTwoStepMovementScale(0.25);
    const hop2 = getTwoStepMovementScale(0.375);

    expect(plant1).toBeLessThan(0.35);
    expect(plant2).toBeLessThan(0.35);
    expect(hop1).toBeGreaterThan(1.7);
    expect(hop2).toBeGreaterThan(1.7);
    expect(hop1).toBeGreaterThan(plant1 * 4);
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
  rig.body.position.x = pose.bodyPositionX;
  rig.pelvis.position.y = 0.64 + pose.pelvisY;
  rig.group.updateMatrixWorld(true);
  neutralRig.body.position.x = pose.bodyPositionX;
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
