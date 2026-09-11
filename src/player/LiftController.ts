import * as THREE from "three";
import { TwoBoneIKSolver, type TwoBoneIKChain } from "../animation/twoBoneIK";
import type { PersonRig } from "../scene/createCharacter";
import { createWeekendHero } from "../scene/createWeekendHero";

const liftHeight = 0.95;
const supporterOffset = 0.28;
/** Exponential approach rate while rising into lift height. */
const raiseRate = 6;
/** Faster descent so cancel lands in ~0.2s instead of ~1s. */
const lowerRate = 28;
/** Scale-down exit for lifter NPCs after cancel (seconds). */
const exitDuration = 0.2;
const softKnee = 0.3;
const softHip = softKnee * 0.5;
const softFootCenterY = 0.64 - Math.cos(softHip) * 0.58;

export class LiftController {
  readonly group = new THREE.Group();
  readonly supporters: readonly [PersonRig, PersonRig];
  private active = false;
  private visible = false;
  /** True while descending after cancel; keeps formation logic until grounded. */
  private settling = false;
  private exiting = false;
  private exitElapsed = 0;
  private walkTime = 0;
  private readonly armIK = new TwoBoneIKSolver();
  private readonly handTarget = new THREE.Vector3();
  private readonly elbowPole = new THREE.Vector3();
  private readonly armChains: readonly [
    TwoBoneIKChain,
    TwoBoneIKChain,
    TwoBoneIKChain,
    TwoBoneIKChain,
  ];

  constructor(
    private readonly groundY: number,
    private readonly playerRig: PersonRig,
  ) {
    const left = createWeekendHero({
      scale: this.playerRig.group.scale.x,
      hairstyle: "crop",
      colors: {
        hoodie: "#17263b",
        ribbing: "#10151f",
        pants: "#10151f",
        hair: "#18151a",
        hairLight: "#2a2428",
      },
    });
    const right = createWeekendHero({
      scale: this.playerRig.group.scale.x,
      hairstyle: "side-part",
      colors: {
        hoodie: "#302039",
        ribbing: "#17121c",
        pants: "#17121c",
        hair: "#2a1b17",
        hairLight: "#3d2a22",
      },
    });
    left.group.position.set(-supporterOffset, 0, 0.08);
    right.group.position.set(supporterOffset, 0, 0.08);
    this.supporters = [left, right];
    this.armChains = [
      createArmChain(left, "left"),
      createArmChain(left, "right"),
      createArmChain(right, "left"),
      createArmChain(right, "right"),
    ];
    this.group.add(left.group, right.group);
    this.group.visible = false;
  }

  get isActive(): boolean {
    return this.active;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  get isSupporting(): boolean {
    return this.active || this.visible || this.settling || this.exiting;
  }

  get supporterPositions(): readonly THREE.Vector3[] {
    this.group.updateMatrixWorld(true);
    return this.supporters.map((supporter) => supporter.group.getWorldPosition(new THREE.Vector3()));
  }

  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.visible = true;
      this.settling = false;
      this.exiting = false;
      this.exitElapsed = 0;
      this.group.visible = true;
      this.group.scale.setScalar(1);
    } else if (this.visible || this.exiting || this.settling) {
      // Begin a short scale-down exit; keep settling until the player reaches ground.
      this.settling = true;
      this.exiting = true;
      this.exitElapsed = 0;
    }
  }

  update(
    dt: number,
    playerPosition: THREE.Vector3,
    yaw: number,
    moving: boolean,
    groundY = this.groundY,
  ): void {
    const targetY = this.active ? groundY + liftHeight : groundY;
    const rate = this.active ? raiseRate : lowerRate;
    playerPosition.y = THREE.MathUtils.lerp(playerPosition.y, targetY, 1 - Math.exp(-dt * rate));

    if (this.active && Math.abs(playerPosition.y - targetY) < 0.004) {
      playerPosition.y = targetY;
    }

    if (this.exiting) {
      this.exitElapsed += dt;
      const t = Math.min(1, this.exitElapsed / exitDuration);
      this.group.scale.setScalar(1 - t);
      if (t >= 1) {
        this.hideSupporters();
      }
    }

    if (!this.active && Math.abs(playerPosition.y - groundY) < 0.004) {
      playerPosition.y = groundY;
      this.settling = false;
      if (this.visible || this.exiting) {
        this.hideSupporters();
      }
    }

    this.group.position.set(playerPosition.x, groundY, playerPosition.z);
    this.group.rotation.y = yaw;
    this.applyPlayerPose();
    if (this.visible) {
      this.animateSupporters(dt, moving);
      this.group.updateMatrixWorld(true);
      this.poseSupporterHands(playerPosition.y - groundY);
    }
  }

  private hideSupporters(): void {
    this.visible = false;
    this.exiting = false;
    this.exitElapsed = 0;
    this.group.visible = false;
    this.group.scale.setScalar(1);
  }

  applyPlayerPose(): void {
    this.playerRig.body.position.y = 0;
    this.playerRig.body.rotation.x = 0;
    this.playerRig.body.rotation.z = 0;
    this.playerRig.pelvis.position.y = this.playerRig.pelvisRestY;
    this.playerRig.chest.rotation.set(0, 0, 0);
    this.playerRig.leftLeg.rotation.set(softHip, 0, 0);
    this.playerRig.rightLeg.rotation.set(softHip, 0, 0);
    this.playerRig.leftKnee.rotation.set(-softKnee, 0, 0);
    this.playerRig.rightKnee.rotation.set(-softKnee, 0, 0);
    this.playerRig.leftFootPivot.rotation.set(softHip, 0, 0);
    this.playerRig.rightFootPivot.rotation.set(softHip, 0, 0);
    // Left abducts; right aims stage-forward-up at ~45° (π/2 + π/4).
    this.playerRig.leftArm.rotation.set(0.12, 0, -1.35);
    this.playerRig.rightArm.rotation.set(Math.PI / 2 + Math.PI / 4, 0, -0.12);
    this.playerRig.leftForearm.rotation.set(0, 0, 0);
    this.playerRig.rightForearm.rotation.set(0, 0, 0);
  }

  private poseSupporterHands(playerHeight: number): void {
    this.poseBothHands(this.supporters[0], -0.14, playerHeight, 0);
    this.poseBothHands(this.supporters[1], 0.14, playerHeight, 2);
  }

  private poseBothHands(
    rig: PersonRig,
    footX: number,
    playerHeight: number,
    chainIndex: number,
  ): void {
    this.handTarget.set(footX, playerHeight + softFootCenterY, -0.075);
    this.group.localToWorld(this.handTarget);
    this.poseArm(rig, this.armChains[chainIndex], -1);
    this.poseArm(rig, this.armChains[chainIndex + 1], 1);
  }

  private poseArm(
    rig: PersonRig,
    chain: TwoBoneIKChain,
    side: number,
  ): void {
    this.elbowPole.set(
      rig.group.position.x + side * 0.55,
      1,
      0.3,
    );
    this.group.localToWorld(this.elbowPole);
    this.armIK.solve(chain, this.handTarget, this.elbowPole);
  }

  private animateSupporters(dt: number, moving: boolean): void {
    if (moving) this.walkTime += dt * 22;
    const legSwing = moving ? Math.sin(this.walkTime) * 0.75 : 0;
    const blend = 1 - Math.exp(-dt * 16);

    this.supporters.forEach((rig) => {
      const leftKnee = moving ? 0.1 + Math.max(0, Math.sin(this.walkTime)) * 0.45 : 0.08;
      const rightKnee = moving ? 0.1 + Math.max(0, -Math.sin(this.walkTime)) * 0.45 : 0.08;
      rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, legSwing, blend);
      rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, -legSwing, blend);
      rig.leftKnee.rotation.x = THREE.MathUtils.lerp(rig.leftKnee.rotation.x, -leftKnee, blend);
      rig.rightKnee.rotation.x = THREE.MathUtils.lerp(rig.rightKnee.rotation.x, -rightKnee, blend);
      rig.leftFootPivot.rotation.x = THREE.MathUtils.lerp(
        rig.leftFootPivot.rotation.x,
        leftKnee - legSwing,
        blend,
      );
      rig.rightFootPivot.rotation.x = THREE.MathUtils.lerp(
        rig.rightFootPivot.rotation.x,
        rightKnee + legSwing,
        blend,
      );
      rig.body.position.y = THREE.MathUtils.lerp(rig.body.position.y, 0, blend);
      rig.body.rotation.x = THREE.MathUtils.lerp(rig.body.rotation.x, 0, blend);
      rig.body.rotation.z = THREE.MathUtils.lerp(rig.body.rotation.z, 0, blend);
      rig.chest.rotation.x = THREE.MathUtils.lerp(
        rig.chest.rotation.x,
        moving ? -0.14 : 0,
        blend,
      );
    });
  }
}

function createArmChain(rig: PersonRig, side: "left" | "right"): TwoBoneIKChain {
  const root = side === "left" ? rig.leftShoulder : rig.rightShoulder;
  const mid = side === "left" ? rig.leftElbow : rig.rightElbow;
  const end = side === "left" ? rig.leftHand : rig.rightHand;
  const scale = rig.group.scale.x;
  return {
    root,
    mid,
    end,
    upperLength: mid.position.length() * scale,
    lowerLength: end.position.length() * scale,
  };
}
