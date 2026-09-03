const cycleDuration = 0.65;

export interface MoshJointPose {
  leftShoulderX: number;
  rightShoulderX: number;
  leftShoulderZ: number;
  rightShoulderZ: number;
  leftElbow: number;
  rightElbow: number;
}

export function createMoshJointPose(): MoshJointPose {
  return {
    leftShoulderX: 0,
    rightShoulderX: 0,
    leftShoulderZ: -0.32,
    rightShoulderZ: 0.32,
    leftElbow: 0,
    rightElbow: 0,
  };
}

export function writeMoshJointPose(progress: number, pose: MoshJointPose): void {
  // Continuous unwrapped phase: overhead → forward (-Z) → under/back, never reverses.
  const leftShoulderX = Math.PI - progress * Math.PI * 2;
  const rightShoulderX = leftShoulderX + Math.PI;
  pose.leftShoulderX = leftShoulderX;
  pose.rightShoulderX = rightShoulderX;
  pose.leftShoulderZ = -0.32;
  pose.rightShoulderZ = 0.32;
  pose.leftElbow = elbowFlexionForShoulder(leftShoulderX);
  pose.rightElbow = elbowFlexionForShoulder(rightShoulderX);
}

function elbowFlexionForShoulder(shoulderX: number): number {
  // Extend near the forward strike (shoulderX ≈ π/2), bend near overhead/recovery.
  const forwardStrike = Math.max(0, Math.sin(shoulderX));
  return 0.95 - forwardStrike * 0.75;
}

export class MoshAction {
  private cycleElapsed = 0;
  private windmillElapsed = 0;
  private held = false;
  private active = false;
  private debugFrozen = false;

  get isActive(): boolean {
    return this.active;
  }

  get isHeld(): boolean {
    return this.held;
  }

  get progress(): number {
    return this.active ? this.cycleElapsed / cycleDuration : 0;
  }

  /** Unwrapped cycle count used for continuous windmill shoulder angles. */
  get windmillTurns(): number {
    return this.active ? this.windmillElapsed / cycleDuration : 0;
  }

  start(): void {
    this.held = true;
    if (this.active) return;
    this.active = true;
    this.cycleElapsed = 0;
    this.windmillElapsed = 0;
    this.debugFrozen = false;
  }

  release(): void {
    this.held = false;
  }

  cancel(): void {
    this.held = false;
    this.active = false;
    this.cycleElapsed = 0;
    this.windmillElapsed = 0;
    this.debugFrozen = false;
  }

  update(dt: number): void {
    if (!this.active) return;
    if (this.debugFrozen) return;
    this.cycleElapsed += dt;
    this.windmillElapsed += dt;

    while (this.cycleElapsed >= cycleDuration) {
      if (!this.held) {
        this.active = false;
        this.cycleElapsed = 0;
        this.windmillElapsed = 0;
        return;
      }
      this.cycleElapsed -= cycleDuration;
    }
  }

  debugSetProgress(progress: number): void {
    this.active = true;
    this.held = true;
    const normalized = ((progress % 1) + 1) % 1;
    this.cycleElapsed = normalized * cycleDuration;
    this.windmillElapsed = normalized * cycleDuration;
    this.debugFrozen = true;
  }
}
