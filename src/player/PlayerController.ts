import * as THREE from "three";
import {
  applyPersonPose,
  createPersonPose,
  resetPersonPose,
} from "../animation/personPose";
import type { VenueDefinition } from "../config/venue";
import { moveCircleWithCollisions, type Aabb2 } from "../core/collision";
import { groundHeightAt, isOnSeat, seatFacingAt } from "../core/venueGround";
import type { PersonRig } from "../scene/createCharacter";
import { createSheepMount, type SheepMount } from "../scene/createSheepMount";
import { LiftController } from "./LiftController";
import { applySheepGallop, SheepRideAction, writeRidePose } from "./SheepRideAction";
import { writeSitPose } from "./SitPose";
import {
  createJumpPointPose,
  JumpPointAction,
  writeJumpPointPose,
} from "./JumpPointAction";
import { BeatAction } from "./BeatAction";
import {
  createMoshJointPose,
  MoshAction,
  writeMoshJointPose,
} from "./MoshAction";
import {
  createTwoStepPose,
  getTwoStepMovementScale,
  type TwoStepPose,
  TwoStepAction,
  writeTwoStepPose,
} from "./TwoStepAction";
import {
  DEFAULT_GAME_SETTINGS,
  normalizeGameSettings,
  type GameSettings,
} from "./gameSettings";
import {
  DEFAULT_PENLIGHT_STATE,
  getDynamicArmPose,
  getDynamicStickPose,
  getPenlightColor,
  normalizePenlightState,
  PENLIGHT_STICK_IDLE,
  PENLIGHT_STICK_POINT,
  stickPoseFor,
  type PenlightPose,
  type PenlightState,
  type PenlightStickPose,
} from "./penlight";

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
  y: number;
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
  // Continuous windmill: overhead (π) → forward (π/2) → under/back. Right arm leads by π.
  const leftArm = Math.PI - progress * Math.PI * 2;
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
    y: 0,
    z: 0,
    movementX: 0,
    movementZ: 0,
    forwardX: 0,
    forwardZ: -1,
  };
  private yaw: number;
  private walkTime = 0;
  private verticalVelocity = 0;
  private grounded = true;
  private readonly mosh = new MoshAction();
  private readonly moshJointPose = createMoshJointPose();
  private readonly twoStep = new TwoStepAction();
  private readonly twoStepPose = createTwoStepPose();
  private readonly personPose = createPersonPose();
  private readonly jumpPoint = new JumpPointAction();
  private readonly jumpPointPose = createJumpPointPose();
  private settings: GameSettings = { ...DEFAULT_GAME_SETTINGS };
  private penlightState: PenlightState = { ...DEFAULT_PENLIGHT_STATE };
  private wiperPhase = 0;
  private readonly beat = new BeatAction();
  private readonly ride = new SheepRideAction();
  private readonly mount: SheepMount = createSheepMount();

  constructor(
    private readonly rig: PersonRig,
    private venue: VenueDefinition,
    private colliders: readonly Aabb2[],
  ) {
    this.group = rig.group;
    this.mount.group.visible = false;
    this.group.add(this.mount.group);
    this.lift = new LiftController(venue.spawn.y, rig);
    this.position.set(venue.spawn.x, venue.spawn.y, venue.spawn.z);
    this.yaw = venue.spawn.yaw;
    this.applyPenlightVisuals();
    this.syncTransform();
  }

  setVenue(venue: VenueDefinition, colliders: readonly Aabb2[]): void {
    this.venue = venue;
    this.colliders = colliders;
  }

  teleportTo(x: number, y: number, z: number, yaw: number): void {
    this.setRideActive(false);
    this.setLiftActive(false);
    this.mosh.cancel();
    this.twoStep.release();
    this.jumpPoint.cancel();
    this.cancelBeat();
    this.position.set(x, y, z);
    this.yaw = yaw;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.syncTransform();
  }

  update(dt: number, input: MovementInput, cameraYaw: number, enabled: boolean): void {
    const wasGrounded = this.grounded;
    const startingGroundHeight = this.groundHeight;
    const inputStrength = Math.min(1, Math.hypot(input.x, input.y));
    const isMoving = enabled && inputStrength > 0.08;
    this.audienceImpact.movementX = 0;
    this.audienceImpact.movementZ = 0;

    if (isMoving) {
      const movement = calculateWorldMovement(input, cameraYaw);
      this.audienceImpact.movementX = movement.x;
      this.audienceImpact.movementZ = movement.z;
      const formationActive = this.lift.isSupporting;
      const riding = this.ride.isActive;
      const collisionRadius = formationActive ? 0.92 : riding ? 0.45 : 0.34;
      const boundaryPadding = formationActive ? 0.92 : riding ? 0.45 : 0.35;
      const speedMultiplier = riding
        ? this.settings.liftSpeed
        : this.twoStepAnimating
        ? getTwoStepMovementScale(this.twoStep.progress) * this.settings.twoStepSpeed
        : this.twoStep.isActive || this.jumpPoint.isActive || this.jumpPoint.held
          ? this.settings.walkSpeed
        : formationActive
          ? this.settings.liftSpeed
          : this.mosh.isActive
            ? this.settings.moshSpeed
            : this.settings.walkSpeed;
      const distance = 3.2 * speedMultiplier * dt * inputStrength;
      const next = moveCircleWithCollisions(
        this.position,
        { x: movement.x * distance, z: movement.z * distance },
        collisionRadius,
        this.colliders,
        formationActive ? startingGroundHeight : this.position.y,
      );
      const nextX = THREE.MathUtils.clamp(
        next.x,
        this.venue.bounds.minX + boundaryPadding,
        this.venue.bounds.maxX - boundaryPadding,
      );
      const nextZ = THREE.MathUtils.clamp(
        next.z,
        this.venue.bounds.minZ + boundaryPadding,
        this.venue.bounds.maxZ - boundaryPadding,
      );
      const nextGroundHeight = groundHeightAt(this.venue, nextX, nextZ, this.position.y);
      const stepDelta = nextGroundHeight - startingGroundHeight;
      const canStep = !formationActive && Math.abs(stepDelta) <= 0.22;
      if (
        (this.grounded || formationActive) &&
        !canStep &&
        Math.abs(stepDelta) > 0.001
      ) {
        this.audienceImpact.movementX = 0;
        this.audienceImpact.movementZ = 0;
      } else if (
        !this.grounded &&
        nextGroundHeight > startingGroundHeight &&
        this.position.y < nextGroundHeight
      ) {
        this.audienceImpact.movementX = 0;
        this.audienceImpact.movementZ = 0;
      } else {
        this.position.x = nextX;
        this.position.z = nextZ;
      }
      const targetYaw = Math.atan2(-movement.x, -movement.z);
      this.yaw = dampAngle(this.yaw, targetYaw, 1 - Math.exp(-dt * 15));
      this.walkTime += dt * 9;
    }

    if (this.lift.isSupporting) {
      this.verticalVelocity = 0;
      this.lift.update(dt, this.position, this.yaw, isMoving, this.groundHeight);
      if (!this.lift.isSupporting) this.grounded = true;
    } else if (!this.grounded) {
      const previousY = this.position.y;
      this.verticalVelocity -= 14 * dt;
      this.position.y += this.verticalVelocity * dt;
      const landingHeight = this.groundHeight;
      if (
        this.verticalVelocity <= 0 &&
        previousY >= landingHeight &&
        this.position.y <= landingHeight
      ) {
        this.position.y = landingHeight;
        this.verticalVelocity = 0;
        this.grounded = true;
      }
    } else {
      // Step up or down immediately to match ground height when grounded
      this.position.y = this.groundHeight;
    }

    if (!wasGrounded && this.grounded) this.jumpPoint.onLanded();
    if (!this.grounded) this.jumpPoint.updateAirborne(dt);
    if (this.grounded && this.jumpPoint.updateGrounded(dt)) this.beginJump();
    this.mosh.update(dt);
    if (this.twoStepAnimating) this.twoStep.update(dt);
    this.beat.update(dt, this.settings.beatSpeed);
    this.syncBeatPenlightPose();
    if (this.ride.isActive) {
      this.ride.update(dt, isMoving);
      applySheepGallop(this.ride.phase, this.ride.gait, this.mount);
    }
    this.animate(isMoving, dt);
    if (this.lift.isSupporting) this.lift.applyPlayerPose();
    this.syncTransform();
    this.audienceImpact.mode = this.lift.isActive
      ? "lift"
      : this.mosh.isActive
        ? "mosh"
        : null;
    this.audienceImpact.x = this.position.x;
    this.audienceImpact.y = this.position.y;
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
    this.verticalVelocity = 6.8 * this.settings.jumpScale;
    this.grounded = false;
    return true;
  }

  get moshActive(): boolean {
    return this.mosh.isActive;
  }

  get moshHeld(): boolean {
    return this.mosh.isHeld;
  }

  get moshWindmillTurns(): number {
    return this.mosh.windmillTurns;
  }

  get gameSettings(): Readonly<GameSettings> {
    return this.settings;
  }

  setGameSettings(settings: GameSettings): void {
    this.settings = normalizeGameSettings(settings);
  }

  get penlight(): Readonly<PenlightState> {
    return this.penlightState;
  }

  setPenlightState(state: PenlightState): void {
    const normalized = normalizePenlightState(state);
    // Non-beat pose writes cancel hold-to-beat; beat writes come from startBeat.
    if (normalized.pose !== "beat") this.beat.cancel();
    this.penlightState = normalized;
    this.applyPenlightVisuals();
  }

  setPenlightColor(colorId: string): void {
    // Color picks must not cancel an in-progress hold-to-beat.
    this.penlightState = normalizePenlightState({ ...this.penlightState, colorId });
    this.applyPenlightVisuals();
  }

  /** Toggle cheer pose; passing the active pose clears it back to idle. Beat uses startBeat. */
  togglePenlightPose(pose: Exclude<PenlightPose, "idle">): PenlightPose {
    if (pose === "beat") {
      if (this.beat.isActive) {
        this.cancelBeat();
        return this.penlightState.pose;
      }
      this.startBeat();
      return "beat";
    }
    this.beat.cancel();
    const next = this.penlightState.pose === pose ? "idle" : pose;
    this.setPenlightState({ ...this.penlightState, pose: next });
    return next;
  }

  get beatActive(): boolean {
    return this.beat.isActive;
  }

  get beatHeld(): boolean {
    return this.beat.isHeld;
  }

  startBeat(): void {
    this.beat.start();
    this.penlightState = { ...this.penlightState, pose: "beat" };
    this.applyPenlightStickTransform();
  }

  releaseBeat(): void {
    this.beat.release();
  }

  cancelBeat(): void {
    this.beat.cancel();
    if (this.penlightState.pose === "beat") {
      this.penlightState = { ...this.penlightState, pose: "idle" };
      this.applyPenlightStickTransform();
    }
  }

  private syncBeatPenlightPose(): void {
    if (this.beat.isActive) {
      if (this.penlightState.pose !== "beat") {
        this.penlightState = { ...this.penlightState, pose: "beat" };
      }
      return;
    }
    if (this.penlightState.pose === "beat") {
      this.penlightState = { ...this.penlightState, pose: "idle" };
      this.applyPenlightStickTransform();
    }
  }

  private get penlightAnimPhase(): number {
    if (this.penlightState.pose === "wiper") return this.wiperPhase;
    if (this.beat.isActive || this.penlightState.pose === "beat") return this.beat.phase;
    return 0;
  }

  get penlightPoseActive(): boolean {
    return this.penlightState.pose !== "idle" && !this.penlightSuppressed;
  }

  private get penlightSuppressed(): boolean {
    return (
      this.ride.isActive ||
      this.mosh.isActive ||
      this.twoStep.isActive ||
      this.lift.isSupporting ||
      this.jumpPoint.isActive ||
      this.jumpPoint.held
    );
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

  get twoStepPhase(): number {
    return this.twoStep.progress;
  }

  get twoStepPoseState(): Readonly<TwoStepPose> {
    return this.twoStepPose;
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

  get groundHeight(): number {
    return groundHeightAt(this.venue, this.position.x, this.position.z, this.position.y);
  }

  setLiftActive(active: boolean): void {
    if (active) {
      this.setRideActive(false);
      this.mosh.cancel();
      this.twoStep.release();
      this.jumpPoint.cancel();
      this.cancelBeat();
      this.verticalVelocity = 0;
      this.grounded = false;
    }
    this.lift.setActive(active);
  }

  get rideActive(): boolean {
    return this.ride.isActive;
  }

  /** FT Special: mount or dismount the plush sheep. Mounting cancels every other pit action. */
  setRideActive(active: boolean): void {
    if (active === this.ride.isActive) return;
    if (active) {
      this.mosh.cancel();
      this.twoStep.release();
      this.jumpPoint.cancel();
      this.cancelBeat();
      if (this.lift.isActive) this.lift.setActive(false);
      this.ride.start();
      this.mount.group.visible = true;
      return;
    }
    this.ride.stop();
    applySheepGallop(0, 0, this.mount);
    this.mount.group.visible = false;
  }

  startMosh(): void {
    this.setRideActive(false);
    this.twoStep.release();
    this.jumpPoint.cancel();
    this.cancelBeat();
    if (this.lift.isSupporting) return;
    this.mosh.start();
  }

  releaseMosh(): void {
    this.mosh.release();
  }

  startTwoStep(): void {
    this.setRideActive(false);
    this.mosh.cancel();
    this.jumpPoint.cancel();
    this.cancelBeat();
    if (this.lift.isActive) this.lift.setActive(false);
    this.twoStep.start();
  }

  releaseTwoStep(): void {
    this.twoStep.release();
  }

  startJumpPoint(): boolean {
    this.setRideActive(false);
    this.mosh.cancel();
    this.twoStep.release();
    this.cancelBeat();
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

  /** Debug teleport. `fromY` picks the level when platforms overlap (e.g. 2/F deck over a vestibule). */
  debugPlaceOnGround(x: number, z: number, fromY = this.position.y): void {
    this.position.x = x;
    this.position.z = z;
    this.position.y = groundHeightAt(this.venue, x, z, fromY);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.syncTransform();
  }

  debugSetTwoStepPhase(progress: number): void {
    this.twoStep.debugSetProgress(progress);
    writeTwoStepPose(this.twoStep.progress, this.twoStepPose);
  }

  debugSetMoshPhase(progress: number): void {
    this.twoStep.release();
    this.jumpPoint.cancel();
    this.mosh.debugSetProgress(progress);
  }

  private animate(isMoving: boolean, dt: number): void {
    if (this.penlightState.pose === "wiper") {
      this.wiperPhase += dt * Math.PI * 2 * (1.0 * this.settings.wiperSpeed);
    }
    // Always refresh stick grip/pose so actions never leave the shaft hidden or stale.
    this.applyPenlightStickTransform();

    const walkSwing = isMoving ? Math.sin(this.walkTime) * 0.55 : 0;
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
    const blend = 1 - Math.exp(-dt * 18);
    if (twoStepActive) {
      this.applyTwoStepPose(blend);
      return;
    }
    this.clearV2TwoStepChannels(blend);
    // Riding wins over every other pose, including airborne, so jumps carry the seat along.
    if (this.ride.isActive) {
      this.applyRidePose(blend);
      return;
    }
    if (jumpPointPoseActive) {
      this.applyJumpPointPose(blend);
      return;
    }
    if (!this.grounded && !this.lift.isSupporting) {
      this.applyAirbornePose(blend);
      if (!moshActive) return;
    }
    if (moshActive) {
      writeMoshJointPose(this.mosh.windmillTurns, this.moshJointPose);
      this.applyMoshPose(blend);
      return;
    }
    if (!moshActive && !jumpPointPoseActive && this.grounded) {
      if (!isMoving && isOnSeat(this.venue, this.position.x, this.position.z, this.position.y)) {
        const facing = seatFacingAt(this.venue, this.position.x, this.position.z, this.position.y);
        if (facing !== undefined) this.yaw = dampAngle(this.yaw, facing, 1 - Math.exp(-dt * 10));
        this.applySitPose(blend);
        return;
      }
      this.applyWalkPose(walkSwing, isMoving, blend);
      return;
    }
  }

  /** Resolve stick local pose from action priority (lift/jump-point > cheer > idle). */
  private resolveStickPose(): PenlightStickPose {
    if (this.lift.isSupporting || this.jumpPoint.isActive || this.jumpPoint.held) {
      return PENLIGHT_STICK_POINT;
    }
    if (this.beat.isActive || this.penlightState.pose === "beat") {
      return getDynamicStickPose(
        "beat",
        this.penlightAnimPhase,
        this.beat.isFirstCycle,
        this.beat.isHeld,
      );
    }
    if (this.penlightState.pose === "wiper" && !this.penlightSuppressed) {
      return getDynamicStickPose("wiper", this.penlightAnimPhase);
    }
    if (
      (this.penlightState.pose === "raise" || this.penlightState.pose === "point") &&
      !this.penlightSuppressed
    ) {
      return stickPoseFor(this.penlightState.pose);
    }
    return PENLIGHT_STICK_IDLE;
  }

  private applyPenlightStickTransform(): void {
    const stick = this.rig.glowStick;
    if (!stick) return;
    stick.visible = true;
    const stickPose = this.resolveStickPose();
    stick.position.set(stickPose.position.x, stickPose.position.y, stickPose.position.z);
    stick.rotation.set(stickPose.rotation.x, stickPose.rotation.y, stickPose.rotation.z);
  }

  private applyPenlightVisuals(): void {
    const stick = this.rig.glowStick;
    if (!stick) return;
    const color = getPenlightColor(this.penlightState.colorId);
    const material = stick.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.color.setHex(color.hex);
      material.emissive.setHex(color.hex);
      material.emissiveIntensity = 2.35;
      material.needsUpdate = true;
    }
    this.applyPenlightStickTransform();
  }

  private overlayPenlightArm(target: ReturnType<typeof createPersonPose>): void {
    if (!this.penlightPoseActive) return;
    const arm = getDynamicArmPose(this.penlightState.pose, this.penlightAnimPhase);
    if (!arm) return;
    target.rightShoulderX = arm.rightShoulderX;
    target.rightShoulderY = arm.rightShoulderY;
    target.rightShoulderZ = arm.rightShoulderZ;
    target.rightElbow = arm.rightElbow;
  }

  private applyTwoStepPose(blend: number): void {
    const source = this.twoStepPose;
    const target = this.personPose;
    resetPersonPose(target);
    target.bodyY = source.bodyY;
    target.bodyPositionX = source.bodyPositionX;
    target.pelvisY = source.pelvisY;
    target.pelvisTwist = source.bodyYaw;
    target.pelvisZ = source.bodyZ;
    target.chestX = source.chestX;
    target.leftShoulderX = source.leftArmX;
    target.rightShoulderX = source.rightArmX;
    target.leftShoulderZ = source.leftArmZ;
    target.rightShoulderZ = source.rightArmZ;
    target.leftElbow = source.leftElbow;
    target.rightElbow = source.rightElbow;
    target.leftHipX = source.leftLegX;
    target.rightHipX = source.rightLegX;
    target.leftHipZ = source.leftLegZ;
    target.rightHipZ = source.rightLegZ;
    target.leftKnee = source.leftKnee;
    target.rightKnee = source.rightKnee;
    target.leftAnkleX = source.leftAnkleX;
    target.rightAnkleX = source.rightAnkleX;
    target.leftAnkleZ = source.leftAnkleZ;
    target.rightAnkleZ = source.rightAnkleZ;
    applyPersonPose(this.rig, target, blend);
  }

  private applyWalkPose(walkSwing: number, moving: boolean, blend: number): void {
    const target = this.personPose;
    resetPersonPose(target);
    if (moving) {
      const phase = Math.sin(this.walkTime);
      target.bodyY = Math.abs(phase) * 0.035;
      target.pelvisTwist = phase * -0.08;
      target.chestX = -0.035;
      target.chestY = phase * 0.06;
      target.leftHipX = walkSwing;
      target.rightHipX = -walkSwing;
      target.leftKnee = 0.1 + Math.max(0, phase) * 0.45;
      target.rightKnee = 0.1 + Math.max(0, -phase) * 0.45;
      target.leftAnkleX = target.leftKnee - target.leftHipX;
      target.rightAnkleX = target.rightKnee - target.rightHipX;
      target.leftShoulderX = -walkSwing * 0.65;
      target.rightShoulderX = walkSwing * 0.65;
      target.leftElbow = 0.18 + Math.max(0, -phase) * 0.16;
      target.rightElbow = 0.18 + Math.max(0, phase) * 0.16;
    }
    this.overlayPenlightArm(target);
    applyPersonPose(this.rig, target, blend);
  }

  private applyRidePose(blend: number): void {
    const target = this.personPose;
    resetPersonPose(target);
    writeRidePose(this.ride.phase, this.ride.gait, target);
    applyPersonPose(this.rig, target, blend);
  }

  private applySitPose(blend: number): void {
    const target = this.personPose;
    resetPersonPose(target);
    writeSitPose(target);
    this.overlayPenlightArm(target);
    applyPersonPose(this.rig, target, blend);
  }

  private applyAirbornePose(blend: number): void {
    const target = this.personPose;
    resetPersonPose(target);
    const kneeFlexion = this.verticalVelocity > 0 ? 0.42 : 0.55;
    target.leftHipX = kneeFlexion * 0.5;
    target.rightHipX = kneeFlexion * 0.5;
    target.leftKnee = kneeFlexion;
    target.rightKnee = kneeFlexion;
    target.leftAnkleX = kneeFlexion * 0.5;
    target.rightAnkleX = kneeFlexion * 0.5;
    this.overlayPenlightArm(target);
    applyPersonPose(this.rig, target, blend);
  }

  private applyJumpPointPose(blend: number): void {
    const source = this.jumpPointPose;
    const target = this.personPose;
    resetPersonPose(target);
    target.bodyY = source.bodyY;
    target.pelvisY = source.pelvisY;
    target.chestX = source.chestX;
    target.leftShoulderX = source.leftArmX;
    target.rightShoulderX = source.rightArmX;
    target.leftElbow = source.leftElbow;
    target.rightElbow = source.rightElbow;
    target.leftHipX = source.legX;
    target.rightHipX = source.legX;
    target.leftKnee = source.leftKnee;
    target.rightKnee = source.rightKnee;
    target.leftAnkleX = source.leftAnkleX;
    target.rightAnkleX = source.rightAnkleX;
    applyPersonPose(this.rig, target, blend);
  }

  private applyMoshPose(blend: number): void {
    const source = this.moshJointPose;
    const target = this.personPose;
    const step = Math.sin(this.mosh.progress * Math.PI * 2);
    resetPersonPose(target);
    target.bodyY = Math.abs(Math.sin(this.mosh.progress * Math.PI * 4)) * 0.025;
    target.chestX = -THREE.MathUtils.degToRad(15);
    target.leftShoulderX = source.leftShoulderX;
    target.rightShoulderX = source.rightShoulderX;
    target.leftShoulderZ = source.leftShoulderZ;
    target.rightShoulderZ = source.rightShoulderZ;
    target.leftElbow = source.leftElbow;
    target.rightElbow = source.rightElbow;
    target.leftHipX = step * 0.58;
    target.rightHipX = -step * 0.58;
    target.leftKnee = 0.1 + Math.max(0, step) * 0.24;
    target.rightKnee = 0.1 + Math.max(0, -step) * 0.24;
    target.leftAnkleX = target.leftKnee - target.leftHipX;
    target.rightAnkleX = target.rightKnee - target.rightHipX;
    applyPersonPose(this.rig, target, blend);
  }

  private clearV2TwoStepChannels(blend: number): void {
    this.rig.body.position.x = THREE.MathUtils.lerp(this.rig.body.position.x, 0, blend);
    this.rig.pelvis.position.y = THREE.MathUtils.lerp(
      this.rig.pelvis.position.y,
      this.rig.pelvisRestY,
      blend,
    );
    this.rig.pelvis.rotation.x = THREE.MathUtils.lerp(this.rig.pelvis.rotation.x, 0, blend);
    this.rig.pelvis.rotation.y = THREE.MathUtils.lerp(this.rig.pelvis.rotation.y, 0, blend);
    this.rig.pelvis.rotation.z = THREE.MathUtils.lerp(this.rig.pelvis.rotation.z, 0, blend);
    this.rig.chest.rotation.x = THREE.MathUtils.lerp(this.rig.chest.rotation.x, 0, blend);
    this.rig.chest.rotation.y = THREE.MathUtils.lerp(this.rig.chest.rotation.y, 0, blend);
    this.rig.chest.rotation.z = THREE.MathUtils.lerp(this.rig.chest.rotation.z, 0, blend);
    this.rig.leftKnee.rotation.x = THREE.MathUtils.lerp(this.rig.leftKnee.rotation.x, 0, blend);
    this.rig.rightKnee.rotation.x = THREE.MathUtils.lerp(this.rig.rightKnee.rotation.x, 0, blend);
    this.rig.leftFootPivot.rotation.x = THREE.MathUtils.lerp(
      this.rig.leftFootPivot.rotation.x,
      0,
      blend,
    );
    this.rig.leftFootPivot.rotation.z = THREE.MathUtils.lerp(
      this.rig.leftFootPivot.rotation.z,
      0,
      blend,
    );
    this.rig.rightFootPivot.rotation.x = THREE.MathUtils.lerp(
      this.rig.rightFootPivot.rotation.x,
      0,
      blend,
    );
    this.rig.rightFootPivot.rotation.z = THREE.MathUtils.lerp(
      this.rig.rightFootPivot.rotation.z,
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
