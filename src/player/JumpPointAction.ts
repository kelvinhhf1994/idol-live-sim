const repeatDelay = 0.12;

type JumpPointPhase = "idle" | "airborne" | "landing";

export interface JumpPointPose {
  rightArmX: number;
  leftArmX: number;
  bodyX: number;
  bodyY: number;
  legX: number;
  leftKnee: number;
  rightKnee: number;
  leftAnkleX: number;
  rightAnkleX: number;
  leftElbow: number;
  rightElbow: number;
  pelvisY: number;
  chestX: number;
}

export function createJumpPointPose(): JumpPointPose {
  return {
    rightArmX: 0,
    leftArmX: 0,
    bodyX: 0,
    bodyY: 0,
    legX: 0,
    leftKnee: 0,
    rightKnee: 0,
    leftAnkleX: 0,
    rightAnkleX: 0,
    leftElbow: 0,
    rightElbow: 0,
    pelvisY: 0,
    chestX: 0,
  };
}

export function writeJumpPointPose(
  extensionProgress: number,
  landing: boolean,
  pose: JumpPointPose,
): void {
  if (landing) {
    pose.rightArmX = 0.3;
    pose.leftArmX = 0;
    pose.bodyX = 0;
    pose.bodyY = -0.1;
    pose.legX = 0.4;
    pose.leftKnee = 0.8;
    pose.rightKnee = 0.8;
    pose.leftAnkleX = 0.4;
    pose.rightAnkleX = 0.4;
    pose.leftElbow = 0.25;
    pose.rightElbow = 0.35;
    pose.pelvisY = -0.02;
    pose.chestX = -0.05;
    return;
  }

  const progress = Math.min(1, Math.max(0, extensionProgress));
  const eased = 1 - (1 - progress) ** 3;
  pose.rightArmX = 2.2 * eased;
  pose.leftArmX = -0.72 * eased;
  pose.bodyY = 0.025 * eased;
  pose.legX = 0.19 * eased;
  pose.leftKnee = 0.38 * eased;
  pose.rightKnee = 0.38 * eased;
  pose.leftAnkleX = 0.19 * eased;
  pose.rightAnkleX = 0.19 * eased;
  pose.leftElbow = 0.45 * eased;
  pose.rightElbow = 0.28 * eased;
  pose.pelvisY = 0;
  pose.chestX = 0.1 * eased;
  pose.bodyX = 0;
}

export class JumpPointAction {
  private phase: JumpPointPhase = "idle";
  private phaseElapsed = 0;
  private isHeld = false;

  get held(): boolean {
    return this.isHeld;
  }

  get isActive(): boolean {
    return this.phase !== "idle";
  }

  get isPointing(): boolean {
    return this.phase === "airborne";
  }

  get isLanding(): boolean {
    return this.phase === "landing";
  }

  get extensionProgress(): number {
    return Math.min(1, this.phaseElapsed / 0.12);
  }

  press(canJump: boolean): boolean {
    this.isHeld = true;
    if (!canJump || this.phase !== "idle") return false;
    this.phase = "airborne";
    this.phaseElapsed = 0;
    return true;
  }

  release(): void {
    this.isHeld = false;
  }

  cancel(): void {
    this.isHeld = false;
    this.phase = "idle";
    this.phaseElapsed = 0;
  }

  updateAirborne(dt: number): void {
    if (this.phase === "airborne") this.phaseElapsed += dt;
  }

  onLanded(): void {
    if (this.phase !== "airborne" && !this.isHeld) return;
    this.phase = "landing";
    this.phaseElapsed = 0;
  }

  updateGrounded(dt: number): boolean {
    if (this.phase !== "landing") return false;
    this.phaseElapsed += dt;
    if (this.phaseElapsed < repeatDelay) return false;
    if (!this.isHeld) {
      this.phase = "idle";
      this.phaseElapsed = 0;
      return false;
    }
    this.phase = "airborne";
    this.phaseElapsed = 0;
    return true;
  }
}
