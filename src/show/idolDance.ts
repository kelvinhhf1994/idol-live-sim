import * as THREE from "three";
import { resetPersonPose, type PersonPose } from "../animation/personPose";
import type { PersonRig } from "../scene/createCharacter";

export const IDOL_DANCE_BPM = 120;
export const IDOL_DANCE_COUNTS = 32;
export const IDOL_DANCE_CYCLE_SECONDS = (IDOL_DANCE_COUNTS * 60) / IDOL_DANCE_BPM;
const STAGGER_SECONDS = 0.08;

const THIGH = 0.43;
const SHIN = 0.4;
const SHOE = 0.08;

type ArmPose = Pick<
  PersonPose,
  | "leftShoulderX"
  | "leftShoulderZ"
  | "leftElbow"
  | "rightShoulderX"
  | "rightShoulderZ"
  | "rightElbow"
>;

type DanceFrame = Pick<
  PersonPose,
  | "leftShoulderX"
  | "leftShoulderZ"
  | "leftElbow"
  | "rightShoulderX"
  | "rightShoulderZ"
  | "rightElbow"
  | "bodyY"
  | "bodyPositionX"
  | "bodyYaw"
  | "pelvisTwist"
  | "chestX"
  | "chestY"
  | "chestZ"
  | "neckX"
  | "leftFootX"
  | "leftFootY"
  | "leftFootZ"
  | "rightFootX"
  | "rightFootY"
  | "rightFootZ"
>;

const FRAME_KEYS: readonly (keyof DanceFrame)[] = [
  "leftShoulderX",
  "leftShoulderZ",
  "leftElbow",
  "rightShoulderX",
  "rightShoulderZ",
  "rightElbow",
  "bodyY",
  "bodyPositionX",
  "bodyYaw",
  "pelvisTwist",
  "chestX",
  "chestY",
  "chestZ",
  "neckX",
  "leftFootX",
  "leftFootY",
  "leftFootZ",
  "rightFootX",
  "rightFootY",
  "rightFootZ",
];

function arms(
  leftShoulderX: number,
  leftShoulderZ: number,
  leftElbow: number,
  rightShoulderX: number,
  rightShoulderZ: number,
  rightElbow: number,
): ArmPose {
  return {
    leftShoulderX,
    leftShoulderZ,
    leftElbow,
    rightShoulderX,
    rightShoulderZ,
    rightElbow,
  };
}

const A = {
  ready: arms(0.18, -0.16, 0.4, 0.18, 0.16, 0.4),
  stepR: arms(1.05, -0.25, 1.25, 0.3, 0.9, 0.35),
  stepL: arms(0.3, -0.9, 0.35, 1.05, 0.25, 1.25),
  chest: arms(1.25, -0.18, 1.3, 1.25, 0.18, 1.3),
  frame: arms(1.8, -0.24, 1.05, 1.8, 0.24, 1.05),
  open: arms(0, -1.45, 0.2, 0, 1.45, 0.2),
  v: arms(0, -2.42, 0.16, 0, 2.42, 0.16),
  diagL: arms(0, -2.32, 0.16, 1.25, 0.28, 1.3),
  diagR: arms(1.25, -0.28, 1.3, 0, 2.32, 0.16),
  point: arms(1.5, -0.08, 0.12, 1.15, 0.35, 1.35),
};

const BASE: DanceFrame = {
  ...A.ready,
  bodyY: 0,
  bodyPositionX: 0,
  bodyYaw: 0,
  pelvisTwist: 0,
  chestX: 0.025,
  chestY: 0,
  chestZ: 0,
  neckX: -0.02,
  leftFootX: -0.14,
  leftFootY: 0,
  leftFootZ: 0,
  rightFootX: 0.14,
  rightFootY: 0,
  rightFootZ: 0,
};

function poseOf(armPose: ArmPose, extra: Partial<DanceFrame> = {}): DanceFrame {
  return { ...BASE, ...armPose, ...extra };
}

const HOOK: readonly DanceFrame[] = [
  poseOf(A.stepR, {
    bodyPositionX: 0.09,
    leftFootX: -0.14,
    rightFootX: 0.29,
    chestZ: -0.045,
    pelvisTwist: -0.06,
  }),
  poseOf(A.frame, {
    bodyPositionX: 0.13,
    leftFootX: 0,
    rightFootX: 0.29,
    chestZ: -0.025,
  }),
  poseOf(A.stepL, {
    bodyPositionX: -0.02,
    bodyY: -0.025,
    leftFootX: -0.29,
    rightFootX: 0.29,
    chestZ: 0.045,
    pelvisTwist: 0.06,
  }),
  poseOf(A.frame, {
    bodyPositionX: -0.13,
    leftFootX: -0.29,
    rightFootX: 0,
    chestZ: 0.025,
  }),
  poseOf(A.diagR, {
    bodyPositionX: -0.06,
    bodyY: -0.02,
    leftFootX: -0.24,
    rightFootX: 0.24,
    chestY: -0.1,
  }),
  poseOf(A.chest, {
    bodyY: -0.018,
    leftFootX: -0.16,
    rightFootX: 0.16,
    chestX: 0.055,
  }),
  poseOf(A.v, {
    leftFootX: -0.22,
    rightFootX: 0.22,
    chestX: -0.025,
  }),
  poseOf(A.frame),
];

const FEATURE: readonly DanceFrame[] = [
  poseOf(A.diagL, {
    bodyPositionX: -0.07,
    bodyY: -0.02,
    leftFootX: -0.22,
    rightFootX: 0.22,
    chestY: 0.12,
  }),
  poseOf(A.diagR, {
    bodyPositionX: 0.07,
    bodyY: -0.02,
    leftFootX: -0.22,
    rightFootX: 0.22,
    chestY: -0.12,
  }),
  poseOf(A.point, {
    bodyPositionX: 0.06,
    leftFootX: -0.12,
    leftFootZ: 0.11,
    rightFootX: 0.22,
  }),
  poseOf(A.chest, {
    bodyY: -0.02,
    leftFootX: -0.18,
    rightFootX: 0.18,
  }),
  poseOf(A.open, {
    leftFootX: -0.18,
    rightFootX: 0.18,
    pelvisTwist: -0.1,
    chestY: -0.12,
    chestZ: -0.035,
  }),
  poseOf(A.open, {
    leftFootX: -0.18,
    rightFootX: 0.18,
    pelvisTwist: 0.1,
    chestY: 0.12,
    chestZ: 0.035,
  }),
  poseOf(A.frame, {
    bodyPositionX: -0.06,
    bodyY: -0.01,
    leftFootX: -0.17,
    rightFootX: 0.11,
    rightFootY: 0.12,
    rightFootZ: 0.09,
    chestZ: 0.035,
  }),
  poseOf(A.frame),
];

const FINISH: readonly DanceFrame[] = [
  poseOf(A.diagR, {
    bodyY: -0.02,
    leftFootX: -0.23,
    rightFootX: 0.23,
    chestY: -0.1,
  }),
  poseOf(A.diagL, {
    bodyY: -0.02,
    leftFootX: -0.23,
    rightFootX: 0.23,
    chestY: 0.1,
  }),
  poseOf(A.chest, { bodyY: -0.025 }),
  poseOf(A.open),
  poseOf(A.v, { leftFootX: -0.2, rightFootX: 0.2 }),
  poseOf(A.frame),
  poseOf(A.diagR, {
    bodyPositionX: -0.04,
    leftFootX: -0.2,
    rightFootX: 0.2,
    chestY: -0.1,
  }),
  poseOf(A.diagR, {
    bodyPositionX: -0.04,
    leftFootX: -0.2,
    rightFootX: 0.2,
    chestY: -0.1,
  }),
];

const FRAMES: readonly DanceFrame[] = [...HOOK, ...FEATURE, ...HOOK, ...FINISH];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function ease(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function wrap(time: number, period: number): number {
  return ((time % period) + period) % period;
}

/** 32-count hook at 120 BPM. Phase is slightly staggered per idol. */
export function writeIdolDancePose(time: number, idolIndex: number, pose: PersonPose): void {
  resetPersonPose(pose);
  const local = wrap(time + idolIndex * STAGGER_SECONDS, IDOL_DANCE_CYCLE_SECONDS);
  const count = (local / IDOL_DANCE_CYCLE_SECONDS) * FRAMES.length;
  const index = Math.floor(count) % FRAMES.length;
  const fraction = count - Math.floor(count);
  const a = FRAMES[index]!;
  const b = FRAMES[(index + 1) % FRAMES.length]!;
  const u = ease(clamp01((fraction - 0.22) / 0.78));

  for (const key of FRAME_KEYS) {
    pose[key] = a[key] + (b[key] - a[key]) * u;
  }

  for (const side of ["left", "right"] as const) {
    const x = `${side}FootX` as const;
    const y = `${side}FootY` as const;
    const z = `${side}FootZ` as const;
    const travel = Math.hypot(b[x] - a[x], b[z] - a[z]);
    if (travel > 0.005) {
      pose[y] += Math.sin(Math.PI * u) * Math.min(0.055, 0.025 + travel * 0.08);
    }
  }

  if (count < 30) {
    const groove = Math.sin(Math.PI * count);
    pose.bodyY -= 0.009 * groove * groove;
  }

  pose.bodyYaw = 0;
  pose.neckY = -0.7 * (pose.pelvisTwist + pose.chestY);
  pose.neckZ = -0.6 * pose.chestZ;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const AUDIENCE_POLE = new THREE.Vector3(0, 0, 1);
const footTarget = new THREE.Vector3();
const hipHinge = new THREE.Vector3();
const hipLocalY = new THREE.Vector3();
const hipLocalZ = new THREE.Vector3();
const hipBasis = new THREE.Matrix4();
const hipOffsetQ = new THREE.Quaternion();
const parentRotation = new THREE.Quaternion();

/** Atlas idols face +Z. Negative shoulder/elbow X bends the arms toward character front.
 *  plantFoot uses a pelvis-local +Z pole so knees fold toward the facing, not a K-pose. */
export function applyIdolDancePose(rig: PersonRig, pose: PersonPose): void {
  rig.body.position.set(pose.bodyPositionX, pose.bodyY, 0);
  rig.body.rotation.set(pose.bodyX, pose.bodyYaw, pose.bodyZ);
  rig.pelvis.position.y = rig.pelvisRestY + pose.pelvisY;
  rig.pelvis.rotation.set(pose.pelvisX, pose.pelvisTwist, pose.pelvisZ);
  rig.chest.rotation.set(pose.chestX, pose.chestY, pose.chestZ);
  rig.neck.rotation.set(pose.neckX, pose.neckY, pose.neckZ);

  rig.leftShoulder.rotation.set(-pose.leftShoulderX, pose.leftShoulderY, pose.leftShoulderZ);
  rig.rightShoulder.rotation.set(-pose.rightShoulderX, pose.rightShoulderY, pose.rightShoulderZ);
  rig.leftElbow.rotation.set(-pose.leftElbow, 0, 0);
  rig.rightElbow.rotation.set(-pose.rightElbow, 0, 0);

  rig.group.updateMatrixWorld(true);
  plantFoot(rig, rig.leftHip, rig.leftKnee, rig.leftFootPivot, pose.leftFootX, pose.leftFootY, pose.leftFootZ);
  plantFoot(rig, rig.rightHip, rig.rightKnee, rig.rightFootPivot, pose.rightFootX, pose.rightFootY, pose.rightFootZ);
}

function plantFoot(
  rig: PersonRig,
  hip: THREE.Object3D,
  knee: THREE.Object3D,
  foot: THREE.Object3D,
  x: number,
  lift: number,
  z: number,
): void {
  footTarget.set(x, SHOE + lift, z);
  rig.group.localToWorld(footTarget);
  rig.pelvis.worldToLocal(footTarget);
  footTarget.sub(hip.position);

  const distance = THREE.MathUtils.clamp(
    footTarget.length(),
    Math.abs(THIGH - SHIN) + 0.0001,
    THIGH + SHIN - 0.0001,
  );
  const kneeAngle = Math.acos(
    THREE.MathUtils.clamp(
      (distance * distance - THIGH * THIGH - SHIN * SHIN) / (2 * THIGH * SHIN),
      -1,
      1,
    ),
  );
  const hipOffset = Math.atan2(SHIN * Math.sin(kneeAngle), THIGH + SHIN * Math.cos(kneeAngle));

  const toFoot = footTarget.normalize();
  hipHinge.crossVectors(AUDIENCE_POLE, toFoot);
  if (hipHinge.lengthSq() < 1e-8) {
    hipHinge.copy(X_AXIS);
  } else {
    hipHinge.normalize();
  }
  hipLocalY.copy(toFoot).negate();
  hipLocalZ.crossVectors(hipHinge, hipLocalY).normalize();
  hipLocalY.crossVectors(hipLocalZ, hipHinge).normalize();
  hipBasis.makeBasis(hipHinge, hipLocalY, hipLocalZ);
  hip.quaternion.setFromRotationMatrix(hipBasis);
  hip.quaternion.multiply(hipOffsetQ.setFromAxisAngle(X_AXIS, -hipOffset));
  hip.rotation.setFromQuaternion(hip.quaternion);
  knee.rotation.set(kneeAngle, 0, 0);

  parentRotation.copy(rig.body.quaternion).multiply(rig.pelvis.quaternion).multiply(hip.quaternion).multiply(knee.quaternion);
  foot.quaternion.copy(parentRotation.invert());
  foot.rotation.setFromQuaternion(foot.quaternion);
}
