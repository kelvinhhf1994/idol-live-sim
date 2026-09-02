import * as THREE from "three";
import { createLowPolyPerson, type PersonRig } from "../scene/createCharacter";

const liftHeight = 1.15;
const supporterOffset = 0.38;
const upperArmLength = 0.29;
const forearmLength = 0.3;

export class LiftController {
  readonly group = new THREE.Group();
  readonly supporters: readonly [PersonRig, PersonRig];
  private active = false;
  private visible = false;
  private walkTime = 0;

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

  update(dt: number, playerPosition: THREE.Vector3, yaw: number, moving: boolean): void {
    const targetY = this.active ? this.groundY + liftHeight : this.groundY;
    playerPosition.y = THREE.MathUtils.lerp(playerPosition.y, targetY, 1 - Math.exp(-dt * 6));

    if (this.active && Math.abs(playerPosition.y - targetY) < 0.004) {
      playerPosition.y = targetY;
    }

    if (!this.active && Math.abs(playerPosition.y - this.groundY) < 0.004) {
      playerPosition.y = this.groundY;
      this.visible = false;
      this.group.visible = false;
    }

    this.group.position.set(playerPosition.x, this.groundY, playerPosition.z);
    this.group.rotation.y = yaw;
    this.poseSupporterHands(playerPosition.y);
    this.animateSupporters(dt, moving);
  }

  applyPlayerPose(): void {
    this.playerRig.body.position.y = 0;
    this.playerRig.body.rotation.x = 0;
    this.playerRig.body.rotation.z = 0;
    this.playerRig.leftLeg.rotation.x = 0;
    this.playerRig.rightLeg.rotation.x = 0;
    this.playerRig.leftArm.rotation.set(Math.PI / 2, 0, 0.12);
    this.playerRig.rightArm.rotation.set(0.12, 0, 1.35);
    this.playerRig.leftForearm.rotation.set(0, 0, 0);
    this.playerRig.rightForearm.rotation.set(0, 0, 0);
  }

  private poseSupporterHands(playerY: number): void {
    const footY = playerY + 0.06;
    this.poseBothHands(this.supporters[0], -0.14 + supporterOffset, footY);
    this.poseBothHands(this.supporters[1], 0.14 - supporterOffset, footY);
  }

  private poseBothHands(rig: PersonRig, footX: number, footY: number): void {
    this.poseArm(rig.leftArm, rig.leftForearm, footX, footY, -1);
    this.poseArm(rig.rightArm, rig.rightForearm, footX, footY, 1);
  }

  private poseArm(
    arm: THREE.Group,
    forearm: THREE.Group,
    targetX: number,
    targetY: number,
    bendDirection: number,
  ): void {
    const dx = targetX - arm.position.x;
    const dy = targetY - arm.position.y;
    const distance = THREE.MathUtils.clamp(
      Math.hypot(dx, dy),
      Math.abs(upperArmLength - forearmLength) + 0.001,
      upperArmLength + forearmLength - 0.001,
    );
    const elbowCosine = THREE.MathUtils.clamp(
      (distance * distance - upperArmLength ** 2 - forearmLength ** 2) /
        (2 * upperArmLength * forearmLength),
      -1,
      1,
    );
    const elbowAngle = Math.acos(elbowCosine) * bendDirection;
    const shoulderAngle =
      Math.atan2(dy, dx) -
      Math.atan2(
        forearmLength * Math.sin(elbowAngle),
        upperArmLength + forearmLength * Math.cos(elbowAngle),
      );
    arm.rotation.set(0, 0, shoulderAngle + Math.PI / 2);
    forearm.rotation.set(0, 0, elbowAngle);
  }

  private setArmDepth(rig: PersonRig): void {
    rig.leftArm.position.z = -0.075;
    rig.rightArm.position.z = -0.075;
  }

  private animateSupporters(dt: number, moving: boolean): void {
    if (moving) this.walkTime += dt * 22;
    const legSwing = moving ? Math.sin(this.walkTime) * 0.75 : 0;
    const blend = 1 - Math.exp(-dt * 16);

    this.supporters.forEach((rig) => {
      this.setArmDepth(rig);
      rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, legSwing, blend);
      rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, -legSwing, blend);
      rig.body.position.y = THREE.MathUtils.lerp(rig.body.position.y, 0, blend);
      rig.body.rotation.x = THREE.MathUtils.lerp(rig.body.rotation.x, moving ? -0.14 : 0, blend);
      rig.body.rotation.z = THREE.MathUtils.lerp(rig.body.rotation.z, 0, blend);
    });
  }
}
