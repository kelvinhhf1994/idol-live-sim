import * as THREE from "three";
import type { VenueDefinition } from "../config/venue";
import { moveCircleWithCollisions, type Aabb2 } from "../core/collision";
import type { PersonRig } from "../scene/createCharacter";
import { LiftController } from "./LiftController";
import {
  createJumpPointPose,
  JumpPointAction,
  writeJumpPointPose,
} from "./JumpPointAction";
import { MoshAction } from "./MoshAction";
import {
  createTwoStepPose,
  TwoStepAction,
  writeTwoStepPose,
} from "./TwoStepAction";

export interface MovementInput {
  x: number;
  y: number;
}

export interface WorldMovement {
  x: number;
  z: number;
}

export interface AudienceImpactSource {
  mode: "mosh" | "lift" | null;
  x: number;
  z: number;
  movementX: number;
  movementZ: number;
  forwardX: number;
  forwardZ: number;
}

export interface MoshPose {
  leftArm: number;
  rightArm: number;
}

export function getMoshPose(progress: number): MoshPose {
  const leftArm = Math.PI / 2 - progress * Math.PI * 2;
  return {
    leftArm,
    rightArm: leftArm + Math.PI,
  };
}

export function calculateWorldMovement(input: MovementInput, cameraYaw: number): WorldMovement {
  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  const movement = {
    x: rightX * input.x + forwardX * -input.y,
    z: rightZ * input.x + forwardZ * -input.y,
  };
  const length = Math.hypot(movement.x, movement.z);

  if (length > 1) {
    movement.x /= length;
    movement.z /= length;
  }

  return movement;
}

export class PlayerController {
  readonly position = new THREE.Vector3();
  readonly group: THREE.Group;
  readonly lift: LiftController;
  readonly audienceImpact: AudienceImpactSource = {
    mode: null,
    x: 0,
    z: 0,
    movementX: 0,
    movementZ: 0,
    forwardX: 0,
    forwardZ: -1,
  };
  private yaw: number;
  private walkTime = 0;
  private moshStepTime = 0;
  private verticalVelocity = 0;
  private grounded = true;
  private readonly mosh = new MoshAction();
  private readonly twoStep = new TwoStepAction();
  private readonly twoStepPose = createTwoStepPose();
  private readonly jumpPoint = new JumpPointAction();
  private readonly jumpPointPose = createJumpPointPose();

  constructor(
    private readonly rig: PersonRig,
    private readonly venue: VenueDefinition,
    private readonly colliders: readonly Aabb2[],
  ) {
    this.group = rig.group;
    this.lift = new LiftController(venue.spawn.y, rig);
    this.position.set(venue.spawn.x, venue.spawn.y, venue.spawn.z);
    this.yaw = venue.spawn.yaw;
    this.syncTransform();
  }

  update(dt: number, input: MovementInput, cameraYaw: number, enabled: boolean): void {
    const wasGrounded = this.grounded;
    const inputStrength = Math.min(1, Math.hypot(input.x, input.y));
    const isMoving = enabled && inputStrength > 0.08;
    this.audienceImpact.movementX = 0;
    this.audienceImpact.movementZ = 0;

    if (isMoving) {
      const movement = calculateWorldMovement(input, cameraYaw);
      this.audienceImpact.movementX = movement.x;
      this.audienceImpact.movementZ = movement.z;
      const formationActive = this.lift.isSupporting;
      const collisionRadius = formationActive ? 0.92 : 0.34;
      const boundaryPadding = formationActive ? 0.92 : 0.35;
      const speedMultiplier =
        this.twoStep.isActive || this.jumpPoint.isActive || this.jumpPoint.held
        ? 1
        : formationActive
          ? 2
          : this.mosh.isActive
            ? 1.25
            : 1;
      const distance = 3.2 * speedMultiplier * dt * inputStrength;
      const next = moveCircleWithCollisions(
        this.position,
        { x: movement.x * distance, z: movement.z * distance },
        collisionRadius,
        this.colliders,
      );
      this.position.x = THREE.MathUtils.clamp(
        next.x,
        this.venue.bounds.minX + boundaryPadding,
        this.venue.bounds.maxX - boundaryPadding,
      );
      this.position.z = THREE.MathUtils.clamp(
        next.z,
        this.venue.bounds.minZ + boundaryPadding,
        this.venue.bounds.maxZ - boundaryPadding,
      );
      const targetYaw = Math.atan2(-movement.x, -movement.z);
      this.yaw = dampAngle(this.yaw, targetYaw, 1 - Math.exp(-dt * 15));
      this.walkTime += dt * 9;
    }

    if (this.lift.isSupporting) {
      this.verticalVelocity = 0;
      this.lift.update(dt, this.position, this.yaw, isMoving);
      if (!this.lift.isSupporting) this.grounded = true;
    } else if (!this.grounded) {
      this.verticalVelocity -= 14 * dt;
      this.position.y += this.verticalVelocity * dt;
      if (this.position.y <= this.venue.spawn.y) {
        this.position.y = this.venue.spawn.y;
        this.verticalVelocity = 0;
        this.grounded = true;
      }
    }

    if (!wasGrounded && this.grounded) this.jumpPoint.onLanded();
    if (!this.grounded) this.jumpPoint.updateAirborne(dt);
    if (this.grounded && this.jumpPoint.updateGrounded(dt)) this.beginJump();
    this.mosh.update(dt);
    if (this.twoStepAnimating) this.twoStep.update(dt);
    this.animate(isMoving, dt);
    if (this.lift.isSupporting) this.lift.applyPlayerPose();
    this.syncTransform();
    this.audienceImpact.mode = this.lift.isActive
      ? "lift"
      : this.mosh.isActive
        ? "mosh"
        : null;
    this.audienceImpact.x = this.position.x;
    this.audienceImpact.z = this.position.z;
    this.audienceImpact.forwardX = -Math.sin(this.yaw);
    this.audienceImpact.forwardZ = -Math.cos(this.yaw);
  }

  jump(): boolean {
    this.jumpPoint.cancel();
    return this.beginJump();
  }

  private beginJump(): boolean {
    if (!this.grounded || this.lift.isSupporting) return false;
    this.verticalVelocity = 5.2;
    this.grounded = false;
    return true;
  }

  get moshActive(): boolean {
    return this.mosh.isActive;
  }

  get liftActive(): boolean {
    return this.lift.isActive;
  }

  get twoStepActive(): boolean {
    return this.twoStep.isActive;
  }

  get twoStepAnimating(): boolean {
    return this.twoStep.isActive && this.grounded && !this.lift.isSupporting;
  }

  get jumpPointActive(): boolean {
    return this.jumpPoint.isActive;
  }

  get jumpPointHeld(): boolean {
    return this.jumpPoint.held;
  }

  get supporterVisible(): boolean {
    return this.lift.isVisible;
  }

  get supporterPositions(): readonly THREE.Vector3[] {
    return this.lift.supporterPositions;
  }

  setLiftActive(active: boolean): void {
    if (active) {
      this.mosh.cancel();
      this.twoStep.release();
      this.jumpPoint.cancel();
      this.verticalVelocity = 0;
      this.grounded = false;
    }
    this.lift.setActive(active);
  }

  startMosh(): void {
    this.twoStep.release();
    this.jumpPoint.cancel();
    if (this.lift.isSupporting) return;
    this.mosh.start();
  }

  releaseMosh(): void {
    this.mosh.release();
  }

  startTwoStep(): void {
    this.mosh.cancel();
    this.jumpPoint.cancel();
    if (this.lift.isActive) this.lift.setActive(false);
    this.twoStep.start();
  }

  releaseTwoStep(): void {
    this.twoStep.release();
  }

  startJumpPoint(): boolean {
    this.mosh.cancel();
    this.twoStep.release();
    if (this.lift.isActive) this.lift.setActive(false);
    const started = this.jumpPoint.press(this.grounded && !this.lift.isSupporting);
    if (started) this.beginJump();
    return started;
  }

  releaseJumpPoint(): void {
    this.jumpPoint.release();
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  private animate(isMoving: boolean, dt: number): void {
    const walkSwing = isMoving ? Math.sin(this.walkTime) * 0.55 : 0;
    const moshPose = getMoshPose(this.mosh.progress);
    const moshActive = this.mosh.isActive && !this.lift.isSupporting;
    const twoStepActive = this.twoStepAnimating;
    const jumpPointPointing = this.jumpPoint.isPointing && !this.grounded;
    const jumpPointLanding = this.jumpPoint.isLanding && this.grounded;
    const jumpPointPoseActive = jumpPointPointing || jumpPointLanding;
    if (twoStepActive) writeTwoStepPose(this.twoStep.progress, this.twoStepPose);
    if (jumpPointPoseActive) {
      writeJumpPointPose(
        this.jumpPoint.extensionProgress,
        jumpPointLanding,
        this.jumpPointPose,
      );
    }
    if (moshActive) this.moshStepTime += dt * 22;
    const legSwing = moshActive ? Math.sin(this.moshStepTime) * 0.58 : walkSwing;
    const leftLegTarget = jumpPointPoseActive
      ? this.jumpPointPose.legX
      : twoStepActive
        ? this.twoStepPose.leftLegX
        : legSwing;
    const rightLegTarget = jumpPointPoseActive
      ? this.jumpPointPose.legX
      : twoStepActive
        ? this.twoStepPose.rightLegX
        : -legSwing;
    const leftArmTarget = jumpPointPoseActive
      ? this.jumpPointPose.leftArmX
      : moshActive
      ? moshPose.leftArm
      : twoStepActive
        ? this.twoStepPose.leftArmX
        : -walkSwing * 0.65;
    const rightArmTarget = jumpPointPoseActive
      ? this.jumpPointPose.rightArmX
      : moshActive
      ? moshPose.rightArm
      : twoStepActive
        ? this.twoStepPose.rightArmX
        : walkSwing * 0.65;
    const blend = 1 - Math.exp(-dt * 18);
    this.rig.leftLeg.rotation.x = THREE.MathUtils.lerp(
      this.rig.leftLeg.rotation.x,
      leftLegTarget,
      blend,
    );
    this.rig.rightLeg.rotation.x = THREE.MathUtils.lerp(
      this.rig.rightLeg.rotation.x,
      rightLegTarget,
      blend,
    );
    this.rig.leftLeg.rotation.z = THREE.MathUtils.lerp(
      this.rig.leftLeg.rotation.z,
      twoStepActive ? this.twoStepPose.leftLegZ : 0,
      blend,
    );
    this.rig.rightLeg.rotation.z = THREE.MathUtils.lerp(
      this.rig.rightLeg.rotation.z,
      twoStepActive ? this.twoStepPose.rightLegZ : 0,
      blend,
    );
    this.rig.leftArm.rotation.x = dampAngle(this.rig.leftArm.rotation.x, leftArmTarget, blend);
    this.rig.rightArm.rotation.x = dampAngle(this.rig.rightArm.rotation.x, rightArmTarget, blend);
    this.rig.leftArm.rotation.z = THREE.MathUtils.lerp(
      this.rig.leftArm.rotation.z,
      0.12,
      blend,
    );
    this.rig.rightArm.rotation.z = THREE.MathUtils.lerp(
      this.rig.rightArm.rotation.z,
      -0.12,
      blend,
    );
    this.rig.leftForearm.rotation.x = THREE.MathUtils.lerp(
      this.rig.leftForearm.rotation.x,
      moshActive ? 0.34 : 0,
      blend,
    );
    this.rig.rightForearm.rotation.x = THREE.MathUtils.lerp(
      this.rig.rightForearm.rotation.x,
      moshActive ? 0.34 : 0,
      blend,
    );
    const bob = moshActive
      ? Math.abs(Math.sin(this.moshStepTime * 2)) * 0.025
      : jumpPointPoseActive
        ? this.jumpPointPose.bodyY
      : twoStepActive
        ? this.twoStepPose.bodyY
      : isMoving
        ? Math.abs(Math.sin(this.walkTime)) * 0.035
        : 0;
    this.rig.body.position.y = THREE.MathUtils.lerp(this.rig.body.position.y, bob, blend);
    this.rig.body.rotation.x = THREE.MathUtils.lerp(
      this.rig.body.rotation.x,
      jumpPointPoseActive
        ? this.jumpPointPose.bodyX
        : moshActive
          ? -THREE.MathUtils.degToRad(15)
          : 0,
      blend,
    );
    this.rig.body.rotation.z = THREE.MathUtils.lerp(
      this.rig.body.rotation.z,
      twoStepActive ? this.twoStepPose.bodyZ : 0,
      blend,
    );
    this.rig.head.rotation.x = THREE.MathUtils.lerp(
      this.rig.head.rotation.x,
      0,
      blend,
    );
  }

  private syncTransform(): void {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }
}

function dampAngle(current: number, target: number, amount: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}
