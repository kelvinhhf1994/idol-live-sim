const cycleDuration = 0.8;

export interface TwoStepPose {
  leftLegX: number;
  rightLegX: number;
  leftLegZ: number;
  rightLegZ: number;
  leftKnee: number;
  rightKnee: number;
  leftAnkleX: number;
  rightAnkleX: number;
  leftAnkleZ: number;
  rightAnkleZ: number;
  leftArmX: number;
  rightArmX: number;
  leftElbow: number;
  rightElbow: number;
  bodyY: number;
  bodyX: number;
  bodyZ: number;
  bodyYaw: number;
  pelvisY: number;
  chestX: number;
}

const keyframes: readonly TwoStepPose[] = [
  frame(0.14, 0.18, 0, -0.08, 0.28, 0.36, 0.14, 0.18, 0, 0.08, 0.2, -0.14, 0.35, 0.5, 0, -0.0057, -0.24, -0.035, -0.03),
  frame(0.08, 0.3, 0, -0.2, 0.16, 0.62, 0.08, 0.32, 0, 0.2, 0.34, -0.22, 0.28, 0.58, 0.04, 0, -0.2, -0.025, -0.06),
  frame(0.16, 0.55, 0, -0.36, 0.32, 0.78, 0.16, 0.23, 0, 0.36, 0.48, -0.28, 0.24, 0.65, 0, -0.0074, -0.22, -0.01, -0.08),
  frame(0.3, 0.22, 0.08, 0, 0.6, 0.44, 0.3, 0.22, -0.08, 0, 0.28, -0.16, 0.48, 0.34, 0, -0.014, -0.27, 0.035, 0.04),
  frame(0.18, 0.14, 0.08, 0, 0.36, 0.28, 0.18, 0.14, -0.08, 0, -0.14, 0.2, 0.5, 0.35, 0, -0.0057, -0.24, 0.035, 0.03),
  frame(0.3, 0.08, 0.2, 0, 0.62, 0.16, 0.32, 0.08, -0.2, 0, -0.22, 0.34, 0.58, 0.28, 0.04, 0, -0.2, 0.025, 0.06),
  frame(0.55, 0.16, 0.36, 0, 0.78, 0.32, 0.23, 0.16, -0.36, 0, -0.28, 0.48, 0.65, 0.24, 0, -0.0074, -0.22, 0.01, 0.08),
  frame(0.22, 0.3, 0, -0.08, 0.44, 0.6, 0.22, 0.3, 0, 0.08, -0.16, 0.28, 0.34, 0.48, 0, -0.014, -0.27, -0.035, -0.04),
  frame(0.14, 0.18, 0, -0.08, 0.28, 0.36, 0.14, 0.18, 0, 0.08, 0.2, -0.14, 0.35, 0.5, 0, -0.0057, -0.24, -0.035, -0.03),
];

const poseChannels = Object.keys(keyframes[0]) as (keyof TwoStepPose)[];

export function createTwoStepPose(): TwoStepPose {
  return {
    leftLegX: 0,
    rightLegX: 0,
    leftLegZ: 0,
    rightLegZ: 0,
    leftKnee: 0,
    rightKnee: 0,
    leftAnkleX: 0,
    rightAnkleX: 0,
    leftAnkleZ: 0,
    rightAnkleZ: 0,
    leftArmX: 0,
    rightArmX: 0,
    leftElbow: 0,
    rightElbow: 0,
    bodyY: 0,
    bodyX: 0,
    bodyZ: 0,
    bodyYaw: 0,
    pelvisY: 0,
    chestX: 0,
  };
}

export function writeTwoStepPose(progress: number, pose: TwoStepPose): void {
  const normalized = ((progress % 1) + 1) % 1;
  const keyframePosition = normalized * 8;
  const index = Math.floor(keyframePosition);
  const local = keyframePosition - index;
  const blend = local * local * (3 - 2 * local);
  const from = keyframes[index];
  const to = keyframes[index + 1];

  for (const channel of poseChannels) {
    pose[channel] = interpolate(from[channel], to[channel], blend);
  }
}

export function getTwoStepMovementScale(progress: number): number {
  // Trough on plant phases, peak on crossover/transfer. Cycle average stays ≈ 1.0× walk.
  const pulse = Math.sin(progress * Math.PI * 2);
  return 0.2 + 1.6 * pulse * pulse;
}

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function frame(
  leftLegX: number,
  rightLegX: number,
  leftLegZ: number,
  rightLegZ: number,
  leftKnee: number,
  rightKnee: number,
  leftAnkleX: number,
  rightAnkleX: number,
  leftAnkleZ: number,
  rightAnkleZ: number,
  leftArmX: number,
  rightArmX: number,
  leftElbow: number,
  rightElbow: number,
  bodyY: number,
  pelvisY: number,
  chestX: number,
  bodyZ: number,
  bodyYaw: number,
): TwoStepPose {
  return {
    leftLegX,
    rightLegX,
    leftLegZ,
    rightLegZ,
    leftKnee,
    rightKnee,
    leftAnkleX,
    rightAnkleX,
    leftAnkleZ,
    rightAnkleZ,
    leftArmX,
    rightArmX,
    leftElbow,
    rightElbow,
    bodyY,
    bodyX: 0,
    bodyZ,
    bodyYaw,
    pelvisY,
    chestX,
  };
}

export class TwoStepAction {
  private active = false;
  private elapsed = 0;
  private debugFrozen = false;

  get isActive(): boolean {
    return this.active;
  }

  get progress(): number {
    return this.active ? (this.elapsed % cycleDuration) / cycleDuration : 0;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.elapsed = 0;
    this.debugFrozen = false;
  }

  release(): void {
    this.active = false;
    this.elapsed = 0;
    this.debugFrozen = false;
  }

  update(dt: number): void {
    if (this.active && !this.debugFrozen) this.elapsed += dt;
  }

  debugSetProgress(progress: number): void {
    this.active = true;
    this.elapsed = (((progress % 1) + 1) % 1) * cycleDuration;
    this.debugFrozen = true;
  }
}
