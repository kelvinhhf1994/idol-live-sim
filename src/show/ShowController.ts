import * as THREE from "three";
import type { VenueDefinition } from "../config/venue";
import type { AudienceImpactSource } from "../player/PlayerController";
import { createLowPolyPerson, type CharacterOptions, type PersonRig } from "../scene/createCharacter";
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
}

interface Performer {
  rig: PersonRig;
  baseX: number;
  index: number;
}

interface AudienceMember {
  rig: PersonRig;
  variant: number;
  phase: number;
  homeY: number;
  knockback: AudienceKnockbackState;
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

  constructor(
    performerPoints: readonly THREE.Vector3[],
    audiencePoints: readonly THREE.Vector3[],
    private readonly stageLights: readonly THREE.SpotLight[],
    private readonly venue: Pick<VenueDefinition, "bounds" | "colliders">,
  ) {
    if (performerPoints.length < idolStyles.length) {
      throw new Error("The venue must provide five performer points");
    }

    idolStyles.forEach((style, index) => {
      const rig = createLowPolyPerson({ ...style, scale: 0.96 });
      rig.group.position.copy(performerPoints[index]);
      rig.group.rotation.y = Math.PI;
      this.group.add(rig.group);
      this.performers.push({ rig, baseX: rig.group.position.x, index });
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
      });
    });
  }

  update(elapsed: number, dt: number, impact: AudienceImpactSource): void {
    this.performers.forEach((performer) => this.animatePerformer(performer, elapsed));
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
          y: member.homeY + knockback.y,
          z: knockback.z,
          phase: knockback.phase,
        };
      }
    }
    return { knockedAudienceCount, returningAudienceCount, firstActiveAudience };
  }

  triggerAudienceKnockback(mode: "mosh" | "lift"): boolean {
    const member = this.audience.find((candidate) => candidate.knockback.phase === "home");
    if (!member) return false;
    return tryHitAudience(member.knockback, mode, 0, -1, 0, -1);
  }

  setReducedCrowd(reduced: boolean): void {
    this.audience.forEach((member, index) => {
      member.rig.group.visible = !reduced || index < 8;
    });
  }

  private animatePerformer(performer: Performer, elapsed: number): void {
    const pose = getDancePose(elapsed, performer.index);
    const { rig } = performer;
    rig.leftArm.rotation.x = pose.armSwing;
    rig.rightArm.rotation.x = pose.oppositeArm;
    rig.leftArm.rotation.z = -0.12 - Math.max(0, pose.oppositeArm) * 0.5;
    rig.rightArm.rotation.z = 0.12 + Math.max(0, pose.armSwing) * 0.5;
    rig.leftLeg.rotation.x = pose.legSwing;
    rig.rightLeg.rotation.x = -pose.legSwing;
    rig.body.position.y = pose.bodyBounce;
    rig.body.rotation.y = pose.bodyTwist;
    rig.head.rotation.y = pose.headTurn;
    rig.group.position.x = performer.baseX + Math.sin(elapsed * Math.PI + performer.index * 0.4) * 0.12;
  }

  private animateAudience(member: AudienceMember, elapsed: number): void {
    const phase = elapsed * (2.2 + member.variant * 0.16) + member.phase;
    const sway = Math.sin(phase) * 0.18;
    member.rig.body.rotation.z = sway * 0.24;
    member.rig.body.position.y = member.variant === 2 ? Math.max(0, Math.sin(phase * 0.5)) * 0.08 : 0;
    member.rig.leftArm.rotation.x = sway;
    member.rig.rightArm.rotation.x = member.variant === 0 ? -1.8 + sway * 0.3 : -sway;
    member.rig.rightArm.rotation.z = member.variant === 0 ? 0.55 : 0.12;
  }

  private updateAudience(
    member: AudienceMember,
    elapsed: number,
    dt: number,
    impact: AudienceImpactSource,
  ): void {
    const state = member.knockback;
    if (impact.mode && state.phase === "home" && this.isAudienceInImpactRange(state, impact)) {
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
    stepAudienceKnockback(state, dt, this.venue.bounds);
    if (this.intersectsCollider(state.x, state.z)) {
      state.x = previousX;
      state.z = previousZ;
      state.vx = 0;
      state.vz = 0;
    }
    member.rig.group.position.set(state.x, member.homeY + state.y, state.z);
    this.animateKnockedAudience(member);
  }

  private isAudienceInImpactRange(
    state: AudienceKnockbackState,
    impact: AudienceImpactSource,
  ): boolean {
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

  private animateKnockedAudience(member: AudienceMember): void {
    const { rig, knockback: state } = member;
    if (state.phase === "returning") {
      const dx = state.homeX - state.x;
      const dz = state.homeZ - state.z;
      rig.group.rotation.y = Math.atan2(-dx, -dz);
      const run = state.phaseElapsed * 24;
      rig.body.rotation.x = -0.18;
      rig.body.rotation.z = Math.sin(run * 0.5) * 0.12;
      rig.body.position.y = Math.abs(Math.sin(run)) * 0.06;
      rig.leftLeg.rotation.x = Math.sin(run) * 0.85;
      rig.rightLeg.rotation.x = Math.sin(run + Math.PI) * 0.85;
      rig.leftArm.rotation.x = Math.sin(run + 1.1) * 0.75;
      rig.rightArm.rotation.x = Math.sin(run + Math.PI + 0.4) * 0.75;
      return;
    }

    const getUpProgress =
      state.phase === "getting-up" ? Math.min(1, state.phaseElapsed / 0.3) : 0;
    const fallDirection = state.vx >= 0 ? -1 : 1;
    rig.body.position.y = 0;
    rig.body.rotation.x = Math.sin(state.elapsed * 8) * 0.35 * (1 - getUpProgress);
    rig.body.rotation.z = fallDirection * 1.15 * (1 - getUpProgress);
    rig.leftArm.rotation.x = Math.sin(state.elapsed * 13 + state.limbPhases[0]) * 1.7;
    rig.rightArm.rotation.x = Math.sin(state.elapsed * 15 + state.limbPhases[1]) * 1.55;
    rig.leftLeg.rotation.x = Math.sin(state.elapsed * 11 + state.limbPhases[2]) * 1.4;
    rig.rightLeg.rotation.x = Math.sin(state.elapsed * 17 + state.limbPhases[3]) * 1.6;
  }
}

export function getDancePose(time: number, idolIndex: number): DancePose {
  const microseconds = Math.round((time + idolIndex * 0.018) * 1_000_000);
  const phase = ((microseconds % 4_000_000) / 4_000_000) * Math.PI * 2;
  const beat = phase * 4;

  return {
    armSwing: Math.sin(beat) * 0.72 - 0.35,
    oppositeArm: Math.sin(beat + Math.PI) * 0.72 - 0.35,
    legSwing: Math.sin(beat) * 0.2,
    bodyBounce: Math.abs(Math.sin(beat)) * 0.08,
    bodyTwist: Math.sin(phase * 2) * 0.16,
    headTurn: Math.sin(phase) * 0.16,
  };
}
