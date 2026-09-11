import * as THREE from "three";
import type { PersonPose } from "../animation/personPose";
import { resetPersonPose } from "../animation/personPose";
import {
  getDynamicArmPose,
  getDynamicStickPose,
  getPenlightColor,
  PENLIGHT_COLORS,
  type PenlightPose,
} from "../player/penlight";
import type { PersonRig } from "../scene/createCharacter";

export type AudienceCheerStyle = "raise" | "wiper" | "beat";

const CHEER_STYLES: readonly AudienceCheerStyle[] = ["beat", "raise", "wiper"];

export function cheerStyleFor(index: number): AudienceCheerStyle {
  return CHEER_STYLES[((index % CHEER_STYLES.length) + CHEER_STYLES.length) % CHEER_STYLES.length]!;
}

export function writeAudienceCheerPose(time: number, index: number, pose: PersonPose): void {
  resetPersonPose(pose);
  const style = cheerStyleFor(index);
  const bounce = Math.sin(time * (2.1 + (index % 3) * 0.15) + index * 0.4);
  const arm = getDynamicArmPose(style, cheerPhase(style, time, index));
  pose.bodyY = Math.max(0, bounce) * 0.06;
  pose.chestZ = bounce * 0.1;
  pose.neckY = bounce * 0.08;
  pose.leftShoulderX = -0.35 + bounce * 0.25;
  pose.leftShoulderZ = 0.28;
  pose.leftElbow = 0.22 + Math.max(0, bounce) * 0.2;
  if (arm) {
    pose.rightShoulderX = arm.rightShoulderX;
    pose.rightShoulderY = arm.rightShoulderY;
    pose.rightShoulderZ = arm.rightShoulderZ;
    pose.rightElbow = Math.max(0.16, arm.rightElbow);
  }
  pose.leftHipX = bounce * 0.12;
  pose.rightHipX = -bounce * 0.12;
  pose.leftKnee = 0.16 + Math.max(0, bounce) * 0.2;
  pose.rightKnee = 0.16 + Math.max(0, -bounce) * 0.2;
  pose.leftAnkleX = pose.leftKnee - pose.leftHipX;
  pose.rightAnkleX = pose.rightKnee - pose.rightHipX;
}

export function applyAudiencePenlight(rig: PersonRig, time: number, index: number): void {
  const stick = rig.glowStick;
  if (!stick) return;
  const style = cheerStyleFor(index);
  const stickPose = getDynamicStickPose(style, cheerPhase(style, time, index));
  stick.visible = true;
  stick.position.set(stickPose.position.x, stickPose.position.y, stickPose.position.z);
  stick.rotation.set(stickPose.rotation.x, stickPose.rotation.y, stickPose.rotation.z);
  const color = getPenlightColor(PENLIGHT_COLORS[index % PENLIGHT_COLORS.length]!.id);
  const material = stick.material;
  if (material instanceof THREE.MeshStandardMaterial) {
    material.color.setHex(color.hex);
    material.emissive.setHex(color.hex);
  }
}

function cheerPhase(style: PenlightPose, time: number, index: number): number {
  if (style === "wiper") return time * Math.PI * 2 + index * 0.35;
  if (style === "beat") return time * 0.33 + index * 0.11;
  return 0;
}
