const cycleDuration = 0.8;

export interface TwoStepPose {
  leftLegX: number;
  rightLegX: number;
  leftLegZ: number;
  rightLegZ: number;
  leftArmX: number;
  rightArmX: number;
  bodyY: number;
  bodyZ: number;
}

export function createTwoStepPose(): TwoStepPose {
  return {
    leftLegX: 0,
    rightLegX: 0,
    leftLegZ: 0,
    rightLegZ: 0,
    leftArmX: 0,
    rightArmX: 0,
    bodyY: 0,
    bodyZ: 0,
  };
}

export function writeTwoStepPose(progress: number, pose: TwoStepPose): void {
  pose.leftLegX = 0;
  pose.rightLegX = 0;
  pose.leftLegZ = 0;
  pose.rightLegZ = 0;
  pose.leftArmX = 0;
  pose.rightArmX = 0;

  const beatPosition = ((progress % 1) + 1) % 1 * 4;
  const beat = Math.floor(beatPosition);
  const pulse = Math.sin((beatPosition - beat) * Math.PI);

  if (beat === 0) {
    pose.leftLegZ = -0.3 * pulse;
    pose.leftLegX = 0.16 * pulse;
    pose.rightArmX = 0.42 * pulse;
    pose.leftArmX = -0.24 * pulse;
    pose.bodyZ = 0.13 * pulse;
  } else if (beat === 1) {
    pose.rightLegX = 1.05 * pulse;
    pose.leftArmX = 0.72 * pulse;
    pose.rightArmX = -0.38 * pulse;
    pose.bodyZ = -0.1 * pulse;
  } else if (beat === 2) {
    pose.rightLegZ = 0.3 * pulse;
    pose.rightLegX = 0.16 * pulse;
    pose.leftArmX = 0.42 * pulse;
    pose.rightArmX = -0.24 * pulse;
    pose.bodyZ = -0.13 * pulse;
  } else {
    pose.leftLegX = 1.05 * pulse;
    pose.rightArmX = 0.72 * pulse;
    pose.leftArmX = -0.38 * pulse;
    pose.bodyZ = 0.1 * pulse;
  }

  pose.bodyY = -0.055 + Math.abs(Math.sin(progress * Math.PI * 4)) * 0.018;
}

export class TwoStepAction {
  private active = false;
  private elapsed = 0;

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
  }

  release(): void {
    this.active = false;
    this.elapsed = 0;
  }

  update(dt: number): void {
    if (this.active) this.elapsed += dt;
  }
}
