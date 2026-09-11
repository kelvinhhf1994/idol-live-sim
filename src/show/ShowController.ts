import * as THREE from "three";
import {
  applyPersonPose,
  createPersonPose,
  type PersonPose,
  resetPersonPose,
} from "../animation/personPose";
import type { VenueDefinition } from "../config/venue";
import type { AudienceImpactSource } from "../player/PlayerController";
import type { PersonRig } from "../scene/createCharacter";
import { createChibiIdol } from "../scene/createChibiIdol";
import { createWeekendHero, mixWeekendAudienceLook } from "../scene/createWeekendHero";
import { groundHeightAt } from "../core/venueGround";
import {
  createAudienceKnockbackState,
  stepAudienceKnockback,
  tryHitAudience,
  type AudienceKnockbackState,
} from "./audienceKnockback";
import { formationPoints, type PerformerLine } from "./formation";
import { applyAudiencePenlight, writeAudienceCheerPose } from "./audienceCheer";
import { applyIdolDancePose, writeIdolDancePose } from "./idolDance";
import { sampleCapturedDance, type DanceClip } from "../animation/capturedDance";
import { IDOL_MEMBERS, MAX_IDOL_COUNT } from "./idolMembers";

/** Atlas idols already face +Z, the audience side of every current stage. */
const PERFORMER_HOME_YAW = 0;

export interface ShowPerformance {
  clip: DanceClip;
  time: number;
  loop?: boolean;
}

interface Performer {
  rig: PersonRig;
  baseX: number;
  homeY: number;
  homeZ: number;
  index: number;
  knockback: AudienceKnockbackState;
  poseTarget: PersonPose;
}

interface AudienceMember {
  rig: PersonRig;
  variant: number;
  phase: number;
  homeY: number;
  knockback: AudienceKnockbackState;
  poseTarget: PersonPose;
}

interface KnockableProp {
  object: THREE.Object3D;
  homeYaw: number;
  knockback: AudienceKnockbackState;
}

export interface PropStatusSnapshot {
  knockedPropCount: number;
  returningPropCount: number;
}

export interface AudienceStatusSnapshot {
  knockedAudienceCount: number;
  returningAudienceCount: number;
  firstActiveAudience: {
    x: number;
    y: number;
    z: number;
    phase: AudienceKnockbackState["phase"];
  } | null;
}

export interface PerformerStatusSnapshot {
  knockedPerformerCount: number;
  returningPerformerCount: number;
  firstActivePerformer: {
    x: number;
    y: number;
    z: number;
    phase: AudienceKnockbackState["phase"];
  } | null;
}

export class ShowController {
  readonly group = new THREE.Group();
  private readonly performers: Performer[] = [];
  private readonly audience: AudienceMember[] = [];
  private readonly props: KnockableProp[] = [];
  private performerCount = 0;
  private performance: ShowPerformance | null = null;
  private readonly resolveGroundHeight = (x: number, z: number): number =>
    groundHeightAt(this.venue, x, z);

  constructor(
    private readonly performerLine: PerformerLine,
    audiencePoints: readonly THREE.Vector3[],
    private readonly stageLights: readonly THREE.SpotLight[],
    private readonly venue: Pick<
      VenueDefinition,
      "bounds" | "colliders" | "platforms" | "spawn"
    >,
    knockableProps: readonly THREE.Object3D[] = [],
    initialPerformerCount = MAX_IDOL_COUNT,
  ) {
    IDOL_MEMBERS.forEach((member, index) => {
      const rig = createChibiIdol(member);
      this.group.add(rig.group);
      this.performers.push({
        rig,
        baseX: 0,
        homeY: performerLine.y,
        homeZ: performerLine.z,
        index,
        knockback: createAudienceKnockbackState(index + 100, 0, performerLine.z, performerLine.y),
        poseTarget: createPersonPose(),
      });
    });
    this.setPerformerCount(initialPerformerCount);

    audiencePoints.slice(0, 12).forEach((point, index) => {
      const rig = createWeekendHero(mixWeekendAudienceLook(index));
      rig.group.position.copy(point);
      this.group.add(rig.group);
      this.audience.push({
        rig,
        variant: index % 3,
        phase: index * 0.63,
        homeY: point.y,
        knockback: createAudienceKnockbackState(index, point.x, point.z),
        poseTarget: createPersonPose(),
      });
    });

    knockableProps.forEach((object, index) => {
      this.props.push({
        object,
        homeYaw: object.rotation.y,
        knockback: createAudienceKnockbackState(
          index + 200,
          object.position.x,
          object.position.z,
          object.position.y,
        ),
      });
    });
  }

  /** Members on stage right now; the rest stay built but hidden and inert. */
  getPerformerCount(): number {
    return this.performerCount;
  }

  /** Re-centres the line so any 1..MAX_IDOL_COUNT subset keeps the stage mid-point. */
  setPerformerCount(count: number): void {
    const next = Math.max(1, Math.min(MAX_IDOL_COUNT, Math.round(count)));
    this.performerCount = next;
    const points = formationPoints(this.performerLine, next);
    this.performers.forEach((performer, index) => {
      const onStage = index < next;
      performer.rig.group.visible = onStage;
      if (!onStage) return;

      const point = points[index];
      performer.baseX = point.x;
      performer.homeY = point.y;
      performer.homeZ = point.z;
      performer.knockback = createAudienceKnockbackState(index + 100, point.x, point.z, point.y);
      performer.rig.group.position.copy(point);
      performer.rig.group.rotation.y = PERFORMER_HOME_YAW;
    });
  }

  /**
   * When set, on-stage idols sample the captured clip at `time` (no stagger).
   * Pass null to restore the procedural dance cycle.
   */
  setPerformance(performance: ShowPerformance | null): void {
    this.performance = performance;
  }

  getPerformance(): ShowPerformance | null {
    return this.performance;
  }

  update(elapsed: number, dt: number, impact: AudienceImpactSource): void {
    this.forEachPerformerOnStage((performer) =>
      this.updatePerformer(performer, elapsed, dt, impact),
    );
    this.audience.forEach((member, index) =>
      this.updateAudience(member, index, elapsed, dt, impact),
    );
    this.props.forEach((prop) => this.updateProp(prop, dt, impact));
    this.stageLights.forEach((light, index) => {
      light.intensity = 33 + Math.sin(elapsed * 2.1 + index * 1.7) * 7;
    });
  }

  getAudienceStatus(): AudienceStatusSnapshot {
    let knockedAudienceCount = 0;
    let returningAudienceCount = 0;
    let firstActiveAudience: AudienceStatusSnapshot["firstActiveAudience"] = null;
    for (const member of this.audience) {
      const { knockback } = member;
      if (knockback.phase === "home") continue;
      if (knockback.phase === "returning") returningAudienceCount += 1;
      else knockedAudienceCount += 1;
      if (!firstActiveAudience) {
        firstActiveAudience = {
          x: knockback.x,
          y: knockback.y,
          z: knockback.z,
          phase: knockback.phase,
        };
      }
    }
    return { knockedAudienceCount, returningAudienceCount, firstActiveAudience };
  }

  getPerformerStatus(): PerformerStatusSnapshot {
    let knockedPerformerCount = 0;
    let returningPerformerCount = 0;
    let firstActivePerformer: PerformerStatusSnapshot["firstActivePerformer"] = null;
    for (let index = 0; index < this.performerCount; index += 1) {
      const { knockback } = this.performers[index];
      if (knockback.phase === "home") continue;
      if (knockback.phase === "returning") returningPerformerCount += 1;
      else knockedPerformerCount += 1;
      if (!firstActivePerformer) {
        firstActivePerformer = {
          x: knockback.x,
          y: knockback.y,
          z: knockback.z,
          phase: knockback.phase,
        };
      }
    }
    return { knockedPerformerCount, returningPerformerCount, firstActivePerformer };
  }

  getPropStatus(): PropStatusSnapshot {
    let knockedPropCount = 0;
    let returningPropCount = 0;
    for (const prop of this.props) {
      if (prop.knockback.phase === "home") continue;
      if (prop.knockback.phase === "returning") returningPropCount += 1;
      else knockedPropCount += 1;
    }
    return { knockedPropCount, returningPropCount };
  }

  triggerAudienceKnockback(mode: "mosh" | "lift"): boolean {
    const member = this.audience.find((candidate) => candidate.knockback.phase === "home");
    if (!member) return false;
    return tryHitAudience(member.knockback, mode, 0, -1, 0, -1);
  }

  triggerPerformerKnockback(mode: "mosh" | "lift"): boolean {
    const performer = this.performers
      .slice(0, this.performerCount)
      .find((candidate) => candidate.knockback.phase === "home");
    if (!performer) return false;
    return tryHitAudience(performer.knockback, mode, 0, 1, 0, 1);
  }

  setReducedCrowd(reduced: boolean): void {
    this.audience.forEach((member, index) => {
      member.rig.group.visible = !reduced || index < 8;
    });
  }

  setPerformerOutlines(visible: boolean): void {
    this.performers.forEach((performer) => {
      performer.rig.outlines.forEach((shell) => (shell.visible = visible));
    });
  }

  private forEachPerformerOnStage(visit: (performer: Performer) => void): void {
    for (let index = 0; index < this.performerCount; index += 1) visit(this.performers[index]);
  }

  private animatePerformer(performer: Performer, elapsed: number): void {
    if (this.performance) {
      sampleCapturedDance(
        this.performance.clip,
        this.performance.time,
        performer.poseTarget,
        { loop: this.performance.loop ?? true },
      );
    } else {
      writeIdolDancePose(elapsed, performer.index, performer.poseTarget);
    }
    applyIdolDancePose(performer.rig, performer.poseTarget);
    performer.rig.group.position.x = performer.baseX;
  }

  private updatePerformer(
    performer: Performer,
    elapsed: number,
    dt: number,
    impact: AudienceImpactSource,
  ): void {
    const state = performer.knockback;
    if (impact.mode && state.phase === "home" && this.isCharacterInImpactRange(state, impact)) {
      tryHitAudience(
        state,
        impact.mode,
        impact.movementX,
        impact.movementZ,
        impact.forwardX,
        impact.forwardZ,
      );
    }
    if (state.phase === "home") {
      performer.rig.group.position.y = performer.homeY;
      performer.rig.group.position.z = performer.homeZ;
      performer.rig.group.rotation.y = PERFORMER_HOME_YAW;
      this.animatePerformer(performer, elapsed);
      return;
    }

    stepAudienceKnockback(state, dt, this.venue.bounds, this.resolveGroundHeight);
    performer.rig.group.position.set(state.x, state.y, state.z);
    this.animateKnockedCharacter(performer.rig, state, performer.poseTarget);
  }

  private animateAudience(member: AudienceMember, elapsed: number, index: number): void {
    writeAudienceCheerPose(elapsed + member.phase, index, member.poseTarget);
    applyPersonPose(member.rig, member.poseTarget, 1);
    applyAudiencePenlight(member.rig, elapsed + member.phase, index);
  }

  private updateAudience(
    member: AudienceMember,
    index: number,
    elapsed: number,
    dt: number,
    impact: AudienceImpactSource,
  ): void {
    const state = member.knockback;
    if (impact.mode && state.phase === "home" && this.isCharacterInImpactRange(state, impact)) {
      tryHitAudience(
        state,
        impact.mode,
        impact.movementX,
        impact.movementZ,
        impact.forwardX,
        impact.forwardZ,
      );
    }

    if (state.phase === "home") {
      member.rig.group.position.set(state.homeX, member.homeY, state.homeZ);
      member.rig.group.rotation.y = 0;
      this.animateAudience(member, elapsed, index);
      return;
    }

    const previousX = state.x;
    const previousZ = state.z;
    stepAudienceKnockback(state, dt, this.venue.bounds, this.resolveGroundHeight);
    if (this.intersectsCollider(state.x, state.z)) {
      state.x = previousX;
      state.z = previousZ;
      state.vx = 0;
      state.vz = 0;
    }
    member.rig.group.position.set(state.x, state.y, state.z);
    this.animateKnockedCharacter(member.rig, state, member.poseTarget);
  }

  private updateProp(prop: KnockableProp, dt: number, impact: AudienceImpactSource): void {
    const state = prop.knockback;
    if (impact.mode && state.phase === "home" && this.isCharacterInImpactRange(state, impact)) {
      tryHitAudience(
        state,
        impact.mode,
        impact.movementX,
        impact.movementZ,
        impact.forwardX,
        impact.forwardZ,
      );
    }

    if (state.phase === "home") {
      prop.object.position.set(state.homeX, state.homeY, state.homeZ);
      prop.object.rotation.set(0, prop.homeYaw, 0);
      return;
    }

    stepAudienceKnockback(state, dt, this.venue.bounds, this.resolveGroundHeight);
    prop.object.position.set(state.x, state.y, state.z);
    if (state.phase === "airborne") {
      prop.object.rotation.x = Math.min(1.1, state.elapsed * 2.4);
      prop.object.rotation.z = Math.sin(state.elapsed * 9) * 0.35;
    } else if (state.phase === "returning") {
      const dx = state.homeX - state.x;
      const dz = state.homeZ - state.z;
      prop.object.rotation.y = Math.atan2(-dx, -dz);
      prop.object.rotation.x *= 0.7;
      prop.object.rotation.z *= 0.7;
    }
  }

  private isCharacterInImpactRange(
    state: AudienceKnockbackState,
    impact: AudienceImpactSource,
  ): boolean {
    if (Math.abs(state.y - impact.y) > 1.6) return false;
    let directionX = impact.movementX;
    let directionZ = impact.movementZ;
    let length = Math.hypot(directionX, directionZ);
    if (length < 0.05) {
      directionX = impact.forwardX;
      directionZ = impact.forwardZ;
      length = Math.hypot(directionX, directionZ);
    }
    if (length < 0.001) return false;
    directionX /= length;
    directionZ /= length;

    const dx = state.x - impact.x;
    const dz = state.z - impact.z;
    const ahead = dx * directionX + dz * directionZ;
    const side = Math.abs(dx * -directionZ + dz * directionX);
    return impact.mode === "lift"
      ? ahead >= -0.45 && ahead <= 1.55 && side <= 1.15
      : ahead >= -0.2 && ahead <= 1.05 && side <= 0.72;
  }

  private intersectsCollider(x: number, z: number): boolean {
    for (const collider of this.venue.colliders) {
      if (
        x >= collider.minX - 0.22 &&
        x <= collider.maxX + 0.22 &&
        z >= collider.minZ - 0.22 &&
        z <= collider.maxZ + 0.22
      ) {
        return true;
      }
    }
    return false;
  }

  private animateKnockedCharacter(
    rig: PersonRig,
    state: AudienceKnockbackState,
    target: PersonPose,
  ): void {
    resetPersonPose(target);
    if (state.phase === "returning") {
      const dx = state.homeX - state.x;
      const dz = state.homeZ - state.z;
      rig.group.rotation.y = Math.atan2(-dx, -dz);
      const run = state.phaseElapsed * 24;
      const step = Math.sin(run);
      target.bodyY = Math.abs(step) * 0.06;
      target.chestX = -0.18;
      target.chestZ = Math.sin(run * 0.5) * 0.12;
      target.leftHipX = step * 0.85;
      target.rightHipX = -step * 0.85;
      target.leftKnee = 0.12 + Math.max(0, step) * 0.48;
      target.rightKnee = 0.12 + Math.max(0, -step) * 0.48;
      target.leftAnkleX = target.leftKnee - target.leftHipX;
      target.rightAnkleX = target.rightKnee - target.rightHipX;
      target.leftShoulderX = Math.sin(run + 1.1) * 0.75;
      target.rightShoulderX = Math.sin(run + Math.PI + 0.4) * 0.75;
      target.leftElbow = 0.2 + Math.max(0, -step) * 0.25;
      target.rightElbow = 0.2 + Math.max(0, step) * 0.25;
      applyPersonPose(rig, target, 1);
      return;
    }

    const fallDirection = state.vx >= 0 ? -1 : 1;
    if (state.phase === "getting-up") {
      const progress = Math.min(1, state.phaseElapsed / 0.3);
      const kneel = Math.sin(progress * Math.PI);
      target.bodyZ = fallDirection * 1.15 * (1 - progress);
      target.pelvisY = -0.04 * kneel;
      target.chestX = -0.2 * kneel;
      target.leftHipX = 0.6 * kneel;
      target.rightHipX = 0.6 * kneel;
      target.leftKnee = 1.25 * kneel;
      target.rightKnee = 1.25 * kneel;
      target.leftAnkleX = 0.65 * kneel;
      target.rightAnkleX = 0.65 * kneel;
      target.leftShoulderX = 0.45 * kneel;
      target.rightShoulderX = -0.35 * kneel;
      target.leftElbow = 0.65 * kneel;
      target.rightElbow = 0.65 * kneel;
      applyPersonPose(rig, target, 1);
      return;
    }

    if (state.phase === "down") {
      target.bodyX = 0.12;
      target.bodyZ = fallDirection * 1.15;
      target.leftShoulderX = 1.05;
      target.rightShoulderX = -0.72;
      target.leftElbow = 1.2;
      target.rightElbow = 0.82;
      target.leftHipX = 0.42;
      target.rightHipX = -0.28;
      target.leftKnee = 1.05;
      target.rightKnee = 0.78;
      target.leftAnkleX = 0.5;
      target.rightAnkleX = 0.36;
      applyPersonPose(rig, target, 1);
      return;
    }

    target.bodyX = Math.sin(state.elapsed * 8) * 0.35;
    target.bodyZ = fallDirection * 1.15;
    target.leftShoulderX =
      Math.sin(state.elapsed * 13 + state.limbPhases[0]) * 1.7;
    target.rightShoulderX =
      Math.sin(state.elapsed * 15 + state.limbPhases[1]) * 1.55;
    target.leftElbow =
      0.25 + Math.abs(Math.sin(state.elapsed * 17 + state.limbPhases[1])) * 1.45;
    target.rightElbow =
      0.25 + Math.abs(Math.sin(state.elapsed * 19 + state.limbPhases[0])) * 1.35;
    target.leftHipX = Math.sin(state.elapsed * 11 + state.limbPhases[2]) * 1.4;
    target.rightHipX = Math.sin(state.elapsed * 17 + state.limbPhases[3]) * 1.4;
    target.leftKnee =
      0.2 + Math.abs(Math.sin(state.elapsed * 13 + state.limbPhases[3])) * 1.35;
    target.rightKnee =
      0.2 + Math.abs(Math.sin(state.elapsed * 15 + state.limbPhases[2])) * 1.35;
    target.leftAnkleX = target.leftKnee - target.leftHipX;
    target.rightAnkleX = target.rightKnee - target.rightHipX;
    applyPersonPose(rig, target, 1);
  }
}
