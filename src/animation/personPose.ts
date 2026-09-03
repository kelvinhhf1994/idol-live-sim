import * as THREE from "three";
import type { PersonRig } from "../scene/createCharacter";

export interface PersonPose {
  bodyY: number;
  bodyX: number;
  bodyYaw: number;
  bodyZ: number;
  pelvisY: number;
  pelvisX: number;
  pelvisTwist: number;
  pelvisZ: number;
  chestX: number;
  chestY: number;
  chestZ: number;
  neckX: number;
  neckY: number;
  neckZ: number;
  leftShoulderX: number;
  leftShoulderY: number;
  leftShoulderZ: number;
  rightShoulderX: number;
  rightShoulderY: number;
  rightShoulderZ: number;
  leftElbow: number;
  rightElbow: number;
  leftHipX: number;
  leftHipY: number;
  leftHipZ: number;
  rightHipX: number;
  rightHipY: number;
  rightHipZ: number;
  leftKnee: number;
  rightKnee: number;
  leftAnkleX: number;
  leftAnkleZ: number;
  rightAnkleX: number;
  rightAnkleZ: number;
}

export type PersonPoseLayer = Partial<PersonPose>;

const neutralPose: Readonly<PersonPose> = {
  bodyY: 0,
  bodyX: 0,
  bodyYaw: 0,
  bodyZ: 0,
  pelvisY: 0,
  pelvisX: 0,
  pelvisTwist: 0,
  pelvisZ: 0,
  chestX: 0,
  chestY: 0,
  chestZ: 0,
  neckX: 0,
  neckY: 0,
  neckZ: 0,
  leftShoulderX: 0,
  leftShoulderY: 0,
  leftShoulderZ: 0.12,
  rightShoulderX: 0,
  rightShoulderY: 0,
  rightShoulderZ: -0.12,
  leftElbow: 0,
  rightElbow: 0,
  leftHipX: 0,
  leftHipY: 0,
  leftHipZ: 0,
  rightHipX: 0,
  rightHipY: 0,
  rightHipZ: 0,
  leftKnee: 0,
  rightKnee: 0,
  leftAnkleX: 0,
  leftAnkleZ: 0,
  rightAnkleX: 0,
  rightAnkleZ: 0,
};

export function createPersonPose(): PersonPose {
  return { ...neutralPose };
}

export function resetPersonPose(pose: PersonPose): void {
  Object.assign(pose, neutralPose);
}

export function applyPoseLayer(pose: PersonPose, layer: PersonPoseLayer): void {
  for (const key in layer) {
    const channel = key as keyof PersonPose;
    const value = layer[channel];
    if (value !== undefined) pose[channel] = value;
  }
}

export function clampPersonPose(pose: PersonPose): void {
  pose.bodyX = clamp(pose.bodyX, -1.5, 1.5);
  pose.bodyZ = clamp(pose.bodyZ, -1.5, 1.5);
  pose.pelvisX = clamp(pose.pelvisX, -0.65, 0.65);
  pose.pelvisTwist = clamp(pose.pelvisTwist, -0.8, 0.8);
  pose.pelvisZ = clamp(pose.pelvisZ, -0.55, 0.55);
  pose.chestX = clamp(pose.chestX, -0.75, 0.75);
  pose.chestY = clamp(pose.chestY, -0.9, 0.9);
  pose.chestZ = clamp(pose.chestZ, -0.7, 0.7);
  pose.neckX = clamp(pose.neckX, -0.55, 0.55);
  pose.neckY = clamp(pose.neckY, -0.9, 0.9);
  pose.neckZ = clamp(pose.neckZ, -0.45, 0.45);
  // Shoulder flexion drives multi-turn windmills; keep a wide limit only as a safety rail.
  pose.leftShoulderX = clamp(pose.leftShoulderX, -Math.PI * 8, Math.PI * 8);
  pose.rightShoulderX = clamp(pose.rightShoulderX, -Math.PI * 8, Math.PI * 8);
  pose.leftShoulderY = clamp(pose.leftShoulderY, -1.4, 1.4);
  pose.rightShoulderY = clamp(pose.rightShoulderY, -1.4, 1.4);
  pose.leftShoulderZ = clamp(pose.leftShoulderZ, -1.6, 1.6);
  pose.rightShoulderZ = clamp(pose.rightShoulderZ, -1.6, 1.6);
  pose.leftElbow = clamp(pose.leftElbow, 0, 2.4);
  pose.rightElbow = clamp(pose.rightElbow, 0, 2.4);
  pose.leftHipX = clamp(pose.leftHipX, -1.4, 1.4);
  pose.rightHipX = clamp(pose.rightHipX, -1.4, 1.4);
  pose.leftHipY = clamp(pose.leftHipY, -0.8, 0.8);
  pose.rightHipY = clamp(pose.rightHipY, -0.8, 0.8);
  pose.leftHipZ = clamp(pose.leftHipZ, -0.8, 0.8);
  pose.rightHipZ = clamp(pose.rightHipZ, -0.8, 0.8);
  pose.leftKnee = clamp(pose.leftKnee, 0, 2.35);
  pose.rightKnee = clamp(pose.rightKnee, 0, 2.35);
  pose.leftAnkleX = clamp(pose.leftAnkleX, -0.8, 0.8);
  pose.rightAnkleX = clamp(pose.rightAnkleX, -0.8, 0.8);
  pose.leftAnkleZ = clamp(pose.leftAnkleZ, -0.55, 0.55);
  pose.rightAnkleZ = clamp(pose.rightAnkleZ, -0.55, 0.55);
}

export function applyPersonPose(rig: PersonRig, pose: PersonPose, blend: number): void {
  clampPersonPose(pose);
  const amount = clamp(blend, 0, 1);
  rig.body.position.y = mix(rig.body.position.y, pose.bodyY, amount);
  setRotation(rig.body, pose.bodyX, pose.bodyYaw, pose.bodyZ, amount);
  rig.pelvis.position.y = mix(rig.pelvis.position.y, 0.64 + pose.pelvisY, amount);
  setRotation(rig.pelvis, pose.pelvisX, pose.pelvisTwist, pose.pelvisZ, amount);
  setRotation(rig.chest, pose.chestX, pose.chestY, pose.chestZ, amount);
  setRotation(rig.neck, pose.neckX, pose.neckY, pose.neckZ, amount);
  setRotation(
    rig.leftShoulder,
    pose.leftShoulderX,
    pose.leftShoulderY,
    pose.leftShoulderZ,
    amount,
  );
  setRotation(
    rig.rightShoulder,
    pose.rightShoulderX,
    pose.rightShoulderY,
    pose.rightShoulderZ,
    amount,
  );
  rig.leftElbow.rotation.x = mix(rig.leftElbow.rotation.x, pose.leftElbow, amount);
  rig.rightElbow.rotation.x = mix(rig.rightElbow.rotation.x, pose.rightElbow, amount);
  setRotation(rig.leftHip, pose.leftHipX, pose.leftHipY, pose.leftHipZ, amount);
  setRotation(rig.rightHip, pose.rightHipX, pose.rightHipY, pose.rightHipZ, amount);
  rig.leftKnee.rotation.x = mix(rig.leftKnee.rotation.x, -pose.leftKnee, amount);
  rig.rightKnee.rotation.x = mix(rig.rightKnee.rotation.x, -pose.rightKnee, amount);
  rig.leftFootPivot.rotation.x = mix(rig.leftFootPivot.rotation.x, pose.leftAnkleX, amount);
  rig.leftFootPivot.rotation.z = mix(rig.leftFootPivot.rotation.z, pose.leftAnkleZ, amount);
  rig.rightFootPivot.rotation.x = mix(rig.rightFootPivot.rotation.x, pose.rightAnkleX, amount);
  rig.rightFootPivot.rotation.z = mix(rig.rightFootPivot.rotation.z, pose.rightAnkleZ, amount);
}

export function resetRigPose(rig: PersonRig): void {
  applyPersonPose(rig, neutralPose as PersonPose, 1);
  rig.body.position.x = 0;
  rig.body.position.z = 0;
  rig.pelvis.position.x = 0;
  rig.pelvis.position.z = 0;
  rig.leftElbow.rotation.y = 0;
  rig.leftElbow.rotation.z = 0;
  rig.rightElbow.rotation.y = 0;
  rig.rightElbow.rotation.z = 0;
}

function setRotation(
  joint: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  amount: number,
): void {
  // Angular mix keeps continuous windmills from reversing across ±π wraps.
  joint.rotation.x = mixAngle(joint.rotation.x, x, amount);
  joint.rotation.y = mixAngle(joint.rotation.y, y, amount);
  joint.rotation.z = mixAngle(joint.rotation.z, z, amount);
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function mixAngle(from: number, to: number, amount: number): number {
  if (amount <= 0) return from;
  if (amount >= 1) return to;
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
