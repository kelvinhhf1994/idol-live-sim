import type { PersonPose } from "../animation/personPose";

/** Idle sit: knees together, pelvis dropped onto a sofa cushion, facing forward. */
export function writeSitPose(pose: PersonPose): void {
  pose.bodyX = 0.12;
  pose.chestX = -0.08;
  pose.leftHipX = 1.15;
  pose.rightHipX = 1.15;
  pose.leftKnee = 1.42;
  pose.rightKnee = 1.42;
  pose.leftAnkleX = 0.18;
  pose.rightAnkleX = 0.18;
  pose.leftShoulderX = 0.12;
  pose.rightShoulderX = 0.12;
  pose.leftElbow = 0.35;
  pose.rightElbow = 0.35;
}
