import * as THREE from "three";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDanceClip, sampleCapturedDance } from "../animation/capturedDance";
import { createPersonPose } from "../animation/personPose";
import { createChibiIdol } from "../scene/createChibiIdol";
import { applyIdolDancePose } from "./idolDance";
import { IDOL_MEMBERS } from "./idolMembers";

const clipPath = join(dirname(fileURLToPath(import.meta.url)), "../../public/motions/yukirinu-45s.animation.json");

describe("captured facing-camera clip", () => {
  const clip = parseDanceClip(JSON.parse(readFileSync(clipPath, "utf8")));

  it("keeps the face on character-forward through the dance", () => {
    const rig = createChibiIdol(IDOL_MEMBERS[0]!);
    const pose = createPersonPose();
    const headWorld = new THREE.Vector3();
    const eyeWorld = new THREE.Vector3();
    const headQuat = new THREE.Quaternion();
    const facing = new THREE.Vector3();

    for (const time of [8, 12, 16, 20, 24, 32]) {
      sampleCapturedDance(clip, time, pose, { loop: false });
      applyIdolDancePose(rig, pose);
      expect(rig.body.rotation.y).toBeCloseTo(pose.bodyYaw, 5);

      const eye = rig.head.getObjectByName("eye");
      expect(eye).toBeDefined();
      rig.head.getWorldPosition(headWorld);
      eye!.getWorldPosition(eyeWorld);
      rig.head.getWorldQuaternion(headQuat);
      facing.set(0, 0, 1).applyQuaternion(headQuat);
      expect(facing.y, `face stays mostly horizontal at ${time}s`).toBeLessThan(0.45);
      expect(eyeWorld.distanceTo(headWorld), `eyes stay on the head at ${time}s`).toBeGreaterThan(0.04);

      if (clip.captureMode === "front-facing-2d") {
        expect(pose.bodyYaw).toBe(0);
        expect(pose.chestY).toBe(0);
        expect(pose.pelvisTwist).toBe(0);
        expect(eyeWorld.z - headWorld.z, `face toward +Z at ${time}s`).toBeGreaterThan(0.05);
        expect(upperArmForward(rig, "left"), `left arm toward audience at ${time}s`).toBeGreaterThanOrEqual(0.1);
        expect(upperArmForward(rig, "right"), `right arm toward audience at ${time}s`).toBeGreaterThanOrEqual(0.1);
        expect(pose.leftFootX).toBeLessThan(-0.05);
        expect(pose.rightFootX).toBeGreaterThan(0.05);
        expect(pose.leftFootZ).toBeLessThanOrEqual(0.025);
        expect(pose.rightFootZ).toBeLessThanOrEqual(0.025);
      } else {
        expect(upperArmForward(rig, "left"), `left arm toward character front at ${time}s`).toBeGreaterThan(0);
        expect(upperArmForward(rig, "right"), `right arm toward character front at ${time}s`).toBeGreaterThan(0);
      }
    }
  });
});

const shoulderLocal = new THREE.Vector3();
const elbowLocal = new THREE.Vector3();

/** +Z component of the upper-arm direction in chest space (positive = elbow in front of the chest). */
function upperArmForward(rig: ReturnType<typeof createChibiIdol>, side: "left" | "right"): number {
  const shoulder = side === "left" ? rig.leftShoulder : rig.rightShoulder;
  const elbow = side === "left" ? rig.leftElbow : rig.rightElbow;
  rig.group.updateMatrixWorld(true);
  rig.chest.worldToLocal(shoulder.getWorldPosition(shoulderLocal));
  rig.chest.worldToLocal(elbow.getWorldPosition(elbowLocal));
  return elbowLocal.sub(shoulderLocal).normalize().z;
}
