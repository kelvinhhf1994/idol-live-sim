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
  leftArmZ: number;
  rightArmZ: number;
  leftElbow: number;
  rightElbow: number;
  bodyY: number;
  /** Body pitch rotation — kept at 0; lean lives on chestX. */
  bodyX: number;
  /** Lateral hop displacement (character-local X). Negative = left, positive = right. */
  bodyPositionX: number;
  bodyZ: number;
  bodyYaw: number;
  pelvisY: number;
  chestX: number;
}

/**
 * Live-house 2-step keyed from Ice Cream Never Ground's 2025 tutorial
 * (ツーステのやり方、2025年版 — 片足でケンケン).
 *
 * True Two-Step is LEFT-LEFT / RIGHT-RIGHT (not L-R-L-R):
 *  0.00–0.25  Left hop 1 — plant→apex, right kick unfolds, body hops left
 *  0.25–0.50  Left hop 2 — ken-ken rebound, right heel-to-butt accent, stay left
 *  0.50–0.75  Right hop 1 — plant→apex, left kick unfolds, body hops right
 *  0.75–1.00  Right hop 2 — ken-ken rebound, left heel-to-butt accent, stay right
 *
 * One cycle has four clear hop→compress vertical pulses.
 * Arms: opposite pump with abduction past 90° on the kick peak.
 */
const keyframes: readonly TwoStepPose[] = [
  // 0.00 — Left hop1 plant / compress, body on left support
  // Support foot flat: legX - knee + ankleX ≈ 0
  // Deep free-leg tuck + deep support buffer (grounds feet while bodyY sinks).
  // Back arm (rightArmX) pumps deep behind (~-0.61…-1.20) vs forward arm contrast.
  frame(
    0.425, -0.1, 0, -0.14, 0.85, 0.9, 0.425, 0.28, 0, 0.12, 0.4, -0.61, -1.05, 0.72, 0.48, 0.7, -0.04,
    -0.01, -0.38, -0.22, -0.26, -0.26,
  ),
  // 0.125 — Left hop1 apex, right kick deeply flexed behind, high hop
  frame(
    0.16, -0.22, 0, -0.26, 0.3, 1.4, 0.15, 0.3, 0, 0.22, 0.62, -0.98, -1.45, 0.98, 0.35, 0.9, 0.175,
    0.02, -0.36, -0.28, -0.32, -0.28,
  ),
  // 0.25 — Left hop2 plant + right heel-to-butt accent (重音); back arm ~-1.20 rad (~69°)
  frame(
    0.425, -0.3, 0, -0.3, 0.85, 1.42, 0.425, 0.32, 0, 0.28, 0.78, -1.2, -1.72, 1.12, 0.28, 1.05, -0.04,
    -0.01, -0.4, -0.3, -0.38, -0.26,
  ),
  // 0.375 — Left hop2 apex (ken-ken), free leg easing for crossover
  frame(
    0.14, -0.16, 0, -0.18, 0.28, 0.85, 0.14, 0.22, 0, 0.14, 0.55, -0.83, -1.2, 0.85, 0.4, 0.75, 0.17,
    0.018, -0.34, -0.2, -0.22, -0.24,
  ),
  // 0.50 — Right hop1 plant / compress, body on right support
  frame(
    -0.1, 0.425, 0.14, 0, 0.9, 0.85, 0.28, 0.425, -0.12, 0, -0.61, 0.4, -0.72, 1.05, 0.7, 0.48, -0.04,
    -0.01, -0.38, 0.22, 0.26, 0.26,
  ),
  // 0.625 — Right hop1 apex, left kick deeply flexed, high hop
  frame(
    -0.22, 0.16, 0.26, 0, 1.4, 0.3, 0.3, 0.15, -0.22, 0, -0.98, 0.62, -0.98, 1.45, 0.9, 0.35, 0.175,
    0.02, -0.36, 0.28, 0.32, 0.28,
  ),
  // 0.75 — Right hop2 plant + left heel-to-butt accent
  frame(
    -0.3, 0.425, 0.3, 0, 1.42, 0.85, 0.32, 0.425, -0.28, 0, -1.2, 0.78, -1.12, 1.72, 1.05, 0.28, -0.04,
    -0.01, -0.4, 0.3, 0.38, 0.26,
  ),
  // 0.875 — Right hop2 apex, prep return to left
  frame(
    -0.16, 0.14, 0.18, 0, 0.85, 0.28, 0.22, 0.14, -0.14, 0, -0.83, 0.55, -0.85, 1.2, 0.75, 0.4, 0.17,
    0.018, -0.34, 0.2, 0.22, 0.24,
  ),
  // 1.00 — loop
  frame(
    0.425, -0.1, 0, -0.14, 0.85, 0.9, 0.425, 0.28, 0, 0.12, 0.4, -0.61, -1.05, 0.72, 0.48, 0.7, -0.04,
    -0.01, -0.38, -0.22, -0.26, -0.26,
  ),
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
    leftArmZ: 0,
    rightArmZ: 0,
    leftElbow: 0,
    rightElbow: 0,
    bodyY: 0,
    bodyX: 0,
    bodyPositionX: 0,
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
  // Four hop pulses per cycle (LLRR): trough on each plant, peak on each apex.
  // Cycle average stays ≈ 1.0× walk so stride distance matches ground contact.
  const pulse = Math.sin(progress * Math.PI * 4);
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
  leftArmZ: number,
  rightArmZ: number,
  leftElbow: number,
  rightElbow: number,
  bodyY: number,
  pelvisY: number,
  chestX: number,
  bodyZ: number,
  bodyYaw: number,
  bodyPositionX: number,
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
    leftArmZ,
    rightArmZ,
    leftElbow,
    rightElbow,
    bodyY,
    bodyX: 0,
    bodyPositionX,
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
