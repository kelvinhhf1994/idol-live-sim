import * as THREE from "three";
import {
  applyPersonPose,
  createPersonPose,
  type PersonPose,
  resetPersonPose,
} from "../animation/personPose";
import type { VenueDefinition } from "../config/venue";
import type { AudienceImpactSource } from "../player/PlayerController";
import { createLowPolyPerson, type CharacterOptions, type PersonRig } from "../scene/createCharacter";
import { groundHeightAt } from "../core/venueGround";
import {
  createAudienceKnockbackState,
  stepAudienceKnockback,
  tryHitAudience,
  type AudienceKnockbackState,
} from "./audienceKnockback";

export interface DancePose {
  armSwing: number;
  oppositeArm: number;
  legSwing: number;
  bodyBounce: number;
  bodyTwist: number;
  headTurn: number;
  leftElbow: number;
  rightElbow: number;
  leftKnee: number;
  rightKnee: number;
  leftAnkle: number;
  rightAnkle: number;
}

interface Performer {
  rig: PersonRig;
  baseX: number;
  homeY: number;
  homeZ: number;
  index: number;
  knockback: AudienceKnockbackState;
  dancePose: DancePose;
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

const idolStyles: CharacterOptions[] = [
  { hairStyle: "twin", skirt: true, palette: { hair: 0x201828, top: 0xfff1f6, bottom: 0xff397d, accent: 0xd6ff3f } },
  { hairStyle: "bob", skirt: true, palette: { hair: 0x6a2d39, top: 0x201a2a, bottom: 0x8b5cf6, accent: 0xff397d } },
  { hairStyle: "ponytail", skirt: true, palette: { hair: 0x18141d, top: 0xd6ff3f, bottom: 0x25202e, accent: 0x8b5cf6 } },
  { hairStyle: "short", skirt: true, palette: { hair: 0xc45d73, top: 0xf5ecdf, bottom: 0x3f8cff, accent: 0xff397d } },
  { hairStyle: "twin", skirt: true, palette: { hair: 0x2a1b20, top: 0xff397d, bottom: 0x17121e, accent: 0xd6ff3f } },
];

export class ShowController {
  readonly group = new THREE.Group();
  private readonly performers: Performer[] = [];
  private readonly audience: AudienceMember[] = [];
  private readonly resolveGroundHeight = (x: number, z: number): number =>
    groundHeightAt(this.venue, x, z);

  constructor(
    performerPoints: readonly THREE.Vector3[],
    audiencePoints: readonly THREE.Vector3[],
    private readonly stageLights: readonly THREE.SpotLight[],
    private readonly venue: Pick<
      VenueDefinition,
      "bounds" | "colliders" | "platforms" | "spawn"
    >,
  ) {
    if (performerPoints.length < idolStyles.length) {
      throw new Error("The venue must provide five performer points");
    }

    idolStyles.forEach((style, index) => {
      const rig = createLowPolyPerson({ ...style, scale: 0.96 });
      rig.group.position.copy(performerPoints[index]);
      rig.group.rotation.y = Math.PI;
      this.group.add(rig.group);
      this.performers.push({
        rig,
        baseX: rig.group.position.x,
        homeY: rig.group.position.y,
        homeZ: rig.group.position.z,
        index,
        knockback: createAudienceKnockbackState(
          index + 100,
          rig.group.position.x,
          rig.group.position.z,
          rig.group.position.y,
        ),
        dancePose: createDancePose(),
        poseTarget: createPersonPose(),
      });
    });

    const audiencePalettes = [
      { top: 0x35303f, bottom: 0x17141d, accent: 0xd6ff3f },
      { top: 0x6b3651, bottom: 0x19151e, accent: 0xff397d },
      { top: 0x234652, bottom: 0x17141d, accent: 0x3f8cff },
    ];
    audiencePoints.slice(0, 12).forEach((point, index) => {
      const rig = createLowPolyPerson({
        scale: 0.9 + (index % 3) * 0.035,
        hairStyle: index % 2 === 0 ? "short" : "bob",
        glowStick: index % 3 !== 0,
        palette: audiencePalettes[index % audiencePalettes.length],
      });
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
  }

  update(elapsed: number, dt: number, impact: AudienceImpactSource): void {
    this.performers.forEach((performer) => this.updatePerformer(performer, elapsed, dt, impact));
    this.audience.forEach((member) => this.updateAudience(member, elapsed, dt, impact));
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
    for (const performer of this.performers) {
      const { knockback } = performer;
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

  triggerAudienceKnockback(mode: "mosh" | "lift"): boolean {
    const member = this.audience.find((candidate) => candidate.knockback.phase === "home");
    if (!member) return false;
    return tryHitAudience(member.knockback, mode, 0, -1, 0, -1);
  }

  triggerPerformerKnockback(mode: "mosh" | "lift"): boolean {
    const performer = this.performers.find((candidate) => candidate.knockback.phase === "home");
    if (!performer) return false;
    return tryHitAudience(performer.knockback, mode, 0, 1, 0, 1);
  }

  setReducedCrowd(reduced: boolean): void {
    this.audience.forEach((member, index) => {
      member.rig.group.visible = !reduced || index < 8;
    });
  }

  private animatePerformer(performer: Performer, elapsed: number): void {
    writeDancePose(elapsed, performer.index, performer.dancePose);
    const source = performer.dancePose;
    const target = performer.poseTarget;
    resetPersonPose(target);
    target.bodyY = source.bodyBounce;
    target.pelvisTwist = source.bodyTwist;
    target.neckY = source.headTurn;
    target.leftShoulderX = source.armSwing;
    target.rightShoulderX = source.oppositeArm;
    target.leftShoulderZ = -0.12 - Math.max(0, source.oppositeArm) * 0.5;
    target.rightShoulderZ = 0.12 + Math.max(0, source.armSwing) * 0.5;
    target.leftElbow = source.leftElbow;
    target.rightElbow = source.rightElbow;
    target.leftHipX = source.legSwing;
    target.rightHipX = -source.legSwing;
    target.leftKnee = source.leftKnee;
    target.rightKnee = source.rightKnee;
    target.leftAnkleX = source.leftAnkle;
    target.rightAnkleX = source.rightAnkle;
    applyPersonPose(performer.rig, target, 1);
    performer.rig.group.position.x =
      performer.baseX + Math.sin(elapsed * Math.PI + performer.index * 0.4) * 0.12;
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
      performer.rig.group.rotation.y = Math.PI;
      this.animatePerformer(performer, elapsed);
      return;
    }

    stepAudienceKnockback(state, dt, this.venue.bounds, this.resolveGroundHeight);
    performer.rig.group.position.set(state.x, state.y, state.z);
    this.animateKnockedCharacter(performer.rig, state, performer.poseTarget);
  }

  private animateAudience(member: AudienceMember, elapsed: number): void {
    const phase = elapsed * (2.2 + member.variant * 0.16) + member.phase;
    const sway = Math.sin(phase) * 0.18;
    const step = Math.sin(phase * 0.75);
    const target = member.poseTarget;
    resetPersonPose(target);
    target.bodyY =
      member.variant === 2 ? Math.max(0, Math.sin(phase * 0.5)) * 0.08 : 0;
    target.chestZ = sway * 0.24;
    target.leftShoulderX = sway;
    target.leftShoulderZ = 0.12;
    target.rightShoulderX = member.variant === 0 ? -1.8 + sway * 0.3 : -sway;
    target.rightShoulderZ = member.variant === 0 ? 0.55 : 0.12;
    target.leftElbow = 0.16 + Math.max(0, step) * 0.18;
    target.rightElbow = 0.16 + Math.max(0, -step) * 0.18;
    target.leftHipX = step * 0.2;
    target.rightHipX = -step * 0.2;
    target.leftKnee = 0.1 + Math.max(0, step) * 0.22;
    target.rightKnee = 0.1 + Math.max(0, -step) * 0.22;
    target.leftAnkleX = target.leftKnee - target.leftHipX;
    target.rightAnkleX = target.rightKnee - target.rightHipX;
    applyPersonPose(member.rig, target, 1);
  }

  private updateAudience(
    member: AudienceMember,
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
      this.animateAudience(member, elapsed);
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

export function getDancePose(time: number, idolIndex: number): DancePose {
  const pose = createDancePose();
  writeDancePose(time, idolIndex, pose);
  return pose;
}

function createDancePose(): DancePose {
  return {
    armSwing: 0,
    oppositeArm: 0,
    legSwing: 0,
    bodyBounce: 0,
    bodyTwist: 0,
    headTurn: 0,
    leftElbow: 0,
    rightElbow: 0,
    leftKnee: 0,
    rightKnee: 0,
    leftAnkle: 0,
    rightAnkle: 0,
  };
}

function writeDancePose(time: number, idolIndex: number, pose: DancePose): void {
  const microseconds = Math.round((time + idolIndex * 0.018) * 1_000_000);
  const phase = ((microseconds % 4_000_000) / 4_000_000) * Math.PI * 2;
  const beat = phase * 4;
  const step = Math.sin(beat);
  pose.armSwing = step * 0.72 - 0.35;
  pose.oppositeArm = -step * 0.72 - 0.35;
  pose.legSwing = step * 0.2;
  pose.bodyBounce = Math.abs(step) * 0.08;
  pose.bodyTwist = Math.sin(phase * 2) * 0.16;
  pose.headTurn = Math.sin(phase) * 0.16;
  pose.leftElbow = 0.2 + Math.max(0, step) * 0.32;
  pose.rightElbow = 0.2 + Math.max(0, -step) * 0.32;
  pose.leftKnee = 0.1 + Math.max(0, step) * 0.32;
  pose.rightKnee = 0.1 + Math.max(0, -step) * 0.32;
  pose.leftAnkle = pose.leftKnee - pose.legSwing;
  pose.rightAnkle = pose.rightKnee + pose.legSwing;
}
