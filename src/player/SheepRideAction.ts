import type { PersonPose } from "../animation/personPose";
import { SHEEP_HEAD_TILT, type SheepMount } from "../scene/createSheepMount";

/** One gallop stride while moving. */
const cycleDuration = 0.42;
/** Body lift that puts the rider's pelvis on the 0.50 m seat. */
const RIDER_SEAT_LIFT = 0.08;

export class SheepRideAction {
  private active = false;
  private elapsed = 0;
  private gaitBlend = 0;

  get isActive(): boolean {
    return this.active;
  }

  /** Gallop phase 0..1; stays at 0 while standing still. */
  get phase(): number {
    return this.active ? (this.elapsed % cycleDuration) / cycleDuration : 0;
  }

  /** 0 = standing still, 1 = full gallop. Eases in and out. */
  get gait(): number {
    return this.gaitBlend;
  }

  start(): void {
    this.active = true;
    this.elapsed = 0;
    this.gaitBlend = 0;
  }

  stop(): void {
    this.active = false;
    this.elapsed = 0;
    this.gaitBlend = 0;
  }

  update(dt: number, moving: boolean): void {
    if (!this.active) return;
    if (moving) this.elapsed += dt;
    const target = moving ? 1 : 0;
    this.gaitBlend += (target - this.gaitBlend) * (1 - Math.exp(-dt * 10));
  }
}

/** Rider pose: seated astride, hands forward on the neck, bouncing with the gallop. */
export function writeRidePose(phase: number, gait: number, pose: PersonPose): void {
  const bounce = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.035 * gait;
  pose.bodyY = RIDER_SEAT_LIFT + bounce;
  pose.chestX = -0.2 - gait * 0.12;
  pose.leftHipX = 1.05;
  pose.rightHipX = 1.05;
  // Wide straddle so the knees clear the 0.60 m chubby body.
  pose.leftHipZ = -0.75;
  pose.rightHipZ = 0.75;
  pose.leftKnee = 1.35;
  pose.rightKnee = 1.35;
  pose.leftAnkleX = 0.3;
  pose.rightAnkleX = 0.3;
  pose.leftShoulderX = 0.95;
  pose.rightShoulderX = 0.95;
  pose.leftShoulderZ = 0.22;
  pose.rightShoulderZ = -0.22;
  pose.leftElbow = 0.55;
  pose.rightElbow = 0.55;
}

/** Front and rear leg pairs swing in anti-phase; the whole sheep bobs and nods. */
export function applySheepGallop(phase: number, gait: number, mount: SheepMount): void {
  const angle = phase * Math.PI * 2;
  const swing = Math.sin(angle) * 0.6 * gait;
  mount.frontLeftLeg.rotation.x = swing;
  mount.frontRightLeg.rotation.x = swing;
  mount.rearLeftLeg.rotation.x = -swing;
  mount.rearRightLeg.rotation.x = -swing;
  mount.group.position.y = Math.abs(Math.sin(angle)) * 0.04 * gait;
  mount.body.rotation.x = Math.sin(angle) * 0.07 * gait;
  mount.head.rotation.x = SHEEP_HEAD_TILT + Math.cos(angle) * 0.12 * gait;
}
