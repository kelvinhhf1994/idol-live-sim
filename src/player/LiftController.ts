import * as THREE from "three";
import { TwoBoneIKSolver, type TwoBoneIKChain } from "../animation/twoBoneIK";
import { createLowPolyPerson, type PersonRig } from "../scene/createCharacter";

const liftHeight = 1.15;
const supporterOffset = 0.38;
const softKnee = 0.3;
const softHip = softKnee * 0.5;
const softFootCenterY = 0.64 - Math.cos(softHip) * 0.58;

export class LiftController {
  readonly group = new THREE.Group();
  readonly supporters: readonly [PersonRig, PersonRig];
  private active = false;
  private visible = false;
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
    const left = createLowPolyPerson({
      hairStyle: "short",
      palette: { hair: 0x18151a, top: 0x17263b, bottom: 0x10151f, accent: 0x5b7592 },
    });
    const right = createLowPolyPerson({
      hairStyle: "short",
      palette: { hair: 0x2a1b17, top: 0x302039, bottom: 0x17121c, accent: 0x765380 },
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
    return this.active || this.visible;
  }

  get supporterPositions(): readonly THREE.Vector3[] {
    this.group.updateMatrixWorld(true);
    return this.supporters.map((supporter) => supporter.group.getWorldPosition(new THREE.Vector3()));
  }

  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.visible = true;
      this.group.visible = true;
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
    playerPosition.y = THREE.MathUtils.lerp(playerPosition.y, targetY, 1 - Math.exp(-dt * 6));

    if (this.active && Math.abs(playerPosition.y - targetY) < 0.004) {
      playerPosition.y = targetY;
    }

    if (!this.active && Math.abs(playerPosition.y - groundY) < 0.004) {
      playerPosition.y = groundY;
      this.visible = false;
      this.group.visible = false;
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

  applyPlayerPose(): void {
    this.playerRig.body.position.y = 0;
    this.playerRig.body.rotation.x = 0;
    this.playerRig.body.rotation.z = 0;
    this.playerRig.pelvis.position.y = 0.64;
    this.playerRig.chest.rotation.set(0, 0, 0);
    this.playerRig.leftLeg.rotation.set(softHip, 0, 0);
    this.playerRig.rightLeg.rotation.set(softHip, 0, 0);
    this.playerRig.leftKnee.rotation.set(-softKnee, 0, 0);
    this.playerRig.rightKnee.rotation.set(-softKnee, 0, 0);
    this.playerRig.leftFootPivot.rotation.set(softHip, 0, 0);
    this.playerRig.rightFootPivot.rotation.set(softHip, 0, 0);
    // Swap prior left/right cheer roles; mirror Z so abduction stays outward per side.
    this.playerRig.leftArm.rotation.set(0.12, 0, -1.35);
    this.playerRig.rightArm.rotation.set(Math.PI / 2, 0, -0.12);
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
  return {
    root: side === "left" ? rig.leftShoulder : rig.rightShoulder,
    mid: side === "left" ? rig.leftElbow : rig.rightElbow,
    end: side === "left" ? rig.leftHand : rig.rightHand,
    upperLength: 0.29,
    lowerLength: 0.3,
  };
}
