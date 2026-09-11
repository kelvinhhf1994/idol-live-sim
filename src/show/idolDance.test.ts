import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createPersonPose } from "../animation/personPose";
import { createChibiIdol } from "../scene/createChibiIdol";
import { applyIdolDancePose, IDOL_DANCE_CYCLE_SECONDS, writeIdolDancePose } from "./idolDance";
import { IDOL_MEMBERS } from "./idolMembers";

function writeAtCount(count: number, idolIndex = 0) {
  const pose = createPersonPose();
  writeIdolDancePose((count / 32) * IDOL_DANCE_CYCLE_SECONDS, idolIndex, pose);
  return pose;
}

describe("idolDance", () => {
  it("loops a 32-count phrase every sixteen seconds", () => {
    expect(IDOL_DANCE_CYCLE_SECONDS).toBe(16);
    const first = createPersonPose();
    const looped = createPersonPose();
    writeIdolDancePose(1.4, 0, first);
    writeIdolDancePose(1.4 + IDOL_DANCE_CYCLE_SECONDS, 0, looped);
    expect(looped).toEqual(first);
  });

  it("starts on a screen-right step with the trailing foot planted", () => {
    const pose = writeAtCount(0);
    expect(pose.bodyYaw).toBe(0);
    expect(pose.rightFootX).toBeGreaterThan(0.2);
    expect(pose.leftFootX).toBeCloseTo(-0.14, 2);
    expect(pose.leftShoulderX).toBeGreaterThan(pose.rightShoulderX);
  });

  it("holds a face-frame silhouette on count 8", () => {
    const pose = writeAtCount(7);
    expect(pose.leftShoulderX).toBeCloseTo(1.8, 1);
    expect(pose.rightShoulderX).toBeCloseTo(1.8, 1);
  });

  it("keeps body yaw at zero and counters the face toward the audience", () => {
    const pose = writeAtCount(12);
    expect(pose.bodyYaw).toBe(0);
    expect(pose.neckY).toBeCloseTo(-0.7 * (pose.pelvisTwist + pose.chestY), 5);
    expect(Math.abs(pose.neckY)).toBeLessThan(0.35);
    expect(Math.abs(pose.pelvisTwist)).toBeLessThan(0.2);
  });

  it("offsets neighbouring idols so the line is not robotic", () => {
    const first = createPersonPose();
    const fifth = createPersonPose();
    writeIdolDancePose(1, 0, first);
    writeIdolDancePose(1, 4, fifth);
    expect(fifth.leftShoulderX).not.toBeCloseTo(first.leftShoulderX);
    expect(Math.abs(fifth.bodyY - first.bodyY)).toBeLessThan(0.25);
  });

  it("bends arms forward, plants shoes, and keeps the face on +Z", () => {
    const rig = createChibiIdol(IDOL_MEMBERS[0]);
    const pose = writeAtCount(0);
    applyIdolDancePose(rig, pose);

    expect(rig.body.rotation.y).toBeCloseTo(pose.bodyYaw, 5);
    expect(rig.leftShoulder.rotation.x).toBeLessThan(-0.4);
    expect(rig.leftElbow.rotation.x).toBeLessThan(-0.4);
    expect(rig.rightElbow.rotation.x).toBeLessThan(0);

    rig.group.updateMatrixWorld(true);
    const eye = rig.head.getObjectByName("eye");
    expect(eye).toBeDefined();
    const headWorld = rig.head.getWorldPosition(new THREE.Vector3());
    const eyeWorld = eye!.getWorldPosition(new THREE.Vector3());
    expect(eyeWorld.z - headWorld.z).toBeGreaterThan(0.05);

    const leftShoe = new THREE.Vector3();
    const rightShoe = new THREE.Vector3();
    rig.leftFoot.getWorldPosition(leftShoe);
    rig.rightFoot.getWorldPosition(rightShoe);
    expect(leftShoe.y).toBeLessThan(0.12);
    expect(rightShoe.y).toBeLessThan(0.12);
    expect(rightShoe.x).toBeGreaterThan(leftShoe.x);
  });

  it("applies captured body yaw so a 3D turn rotates the torso", () => {
    const rig = createChibiIdol(IDOL_MEMBERS[0]);
    const pose = createPersonPose();
    pose.bodyYaw = 1.2;
    applyIdolDancePose(rig, pose);
    expect(rig.body.rotation.y).toBeCloseTo(1.2, 5);
  });

  it("raises hands toward the audience and does not fold shins into a K-pose", () => {
    const rig = createChibiIdol(IDOL_MEMBERS[0]);
    const pose = createPersonPose();
    pose.leftShoulderX = 0.7;
    pose.leftShoulderZ = -1.15;
    pose.rightShoulderX = 0.7;
    pose.rightShoulderZ = 1.15;
    pose.leftElbow = 0.4;
    pose.rightElbow = 0.4;
    pose.leftFootX = -0.16;
    pose.rightFootX = 0.16;
    applyIdolDancePose(rig, pose);

    const leftHand = new THREE.Vector3();
    const rightHand = new THREE.Vector3();
    const leftShoulder = new THREE.Vector3();
    const rightShoulder = new THREE.Vector3();
    rig.leftElbow.getWorldPosition(leftHand);
    rig.rightElbow.getWorldPosition(rightHand);
    rig.leftShoulder.getWorldPosition(leftShoulder);
    rig.rightShoulder.getWorldPosition(rightShoulder);
    expect(leftHand.z).toBeGreaterThan(leftShoulder.z);
    expect(rightHand.z).toBeGreaterThan(rightShoulder.z);

    const leftKnee = new THREE.Vector3();
    const rightKnee = new THREE.Vector3();
    const leftAnkle = new THREE.Vector3();
    const rightAnkle = new THREE.Vector3();
    rig.leftKnee.getWorldPosition(leftKnee);
    rig.rightKnee.getWorldPosition(rightKnee);
    rig.leftFootPivot.getWorldPosition(leftAnkle);
    rig.rightFootPivot.getWorldPosition(rightAnkle);
    expect(leftAnkle.z - leftKnee.z).toBeLessThan(0.12);
    expect(rightAnkle.z - rightKnee.z).toBeLessThan(0.12);
    expect(rightAnkle.x).toBeGreaterThan(leftAnkle.x);
  });
});
