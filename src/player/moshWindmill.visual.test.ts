import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createLowPolyPerson } from "../scene/createCharacter";
import { applyPersonPose, createPersonPose, resetPersonPose } from "../animation/personPose";
import { createMoshJointPose, writeMoshJointPose } from "./MoshAction";

function handLocal(rig: ReturnType<typeof createLowPolyPerson>, side: "left" | "right") {
  const hand = side === "left" ? rig.leftHand : rig.rightHand;
  const shoulder = side === "left" ? rig.leftShoulder : rig.rightShoulder;
  const handWorld = hand.getWorldPosition(new THREE.Vector3());
  const shoulderWorld = shoulder.getWorldPosition(new THREE.Vector3());
  return handWorld.sub(shoulderWorld);
}

function applyMosh(rig: ReturnType<typeof createLowPolyPerson>, progress: number) {
  const source = createMoshJointPose();
  const target = createPersonPose();
  writeMoshJointPose(progress, source);
  resetPersonPose(target);
  target.chestX = -THREE.MathUtils.degToRad(15);
  target.leftShoulderX = source.leftShoulderX;
  target.rightShoulderX = source.rightShoulderX;
  target.leftShoulderZ = source.leftShoulderZ;
  target.rightShoulderZ = source.rightShoulderZ;
  target.leftElbow = source.leftElbow;
  target.rightElbow = source.rightElbow;
  applyPersonPose(rig, target, 1);
  rig.group.updateMatrixWorld(true);
  return source;
}

describe("mosh windmill geometry", () => {
  it("raises a hand above the shoulder and later drives it toward local -Z front", () => {
    const rig = createLowPolyPerson();

    applyMosh(rig, 0);
    const leftStart = handLocal(rig, "left");
    expect(leftStart.y).toBeGreaterThan(0.25);

    applyMosh(rig, 0.125);
    const leftDrop = handLocal(rig, "left");
    expect(leftDrop.z).toBeLessThan(-0.15);
    expect(leftDrop.y).toBeGreaterThan(0.25);

    applyMosh(rig, 0.25);
    const leftStrike = handLocal(rig, "left");
    expect(leftStrike.z).toBeLessThan(-0.4);
    expect(leftStrike.y).toBeLessThan(leftStart.y - 0.2);

    applyMosh(rig, 0.5);
    const leftHalf = handLocal(rig, "left");
    const rightHalf = handLocal(rig, "right");
    expect(leftHalf.y).toBeLessThan(-0.25);
    expect(rightHalf.y).toBeGreaterThan(0.25);
  });

  it("keeps opposite arms on opposite halves of the circle", () => {
    const rig = createLowPolyPerson();
    for (const phase of [0, 0.125, 0.25, 0.375]) {
      const source = applyMosh(rig, phase);
      expect(Math.abs(source.rightShoulderX - source.leftShoulderX)).toBeCloseTo(Math.PI, 5);
      const left = handLocal(rig, "left");
      const right = handLocal(rig, "right");
      const forwardCluster =
        left.z < -0.05 && right.z < -0.05 && Math.abs(left.y) < 0.2 && Math.abs(right.y) < 0.2;
      expect(forwardCluster).toBe(false);
    }
  });
});
