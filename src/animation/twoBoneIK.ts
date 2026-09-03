import * as THREE from "three";

export interface TwoBoneIKChain {
  root: THREE.Object3D;
  mid: THREE.Object3D;
  end: THREE.Object3D;
  upperLength: number;
  lowerLength: number;
}

export interface TwoBoneIKResult {
  clamped: boolean;
  targetDistance: number;
  reachedDistance: number;
}

const down = new THREE.Vector3(0, -1, 0);

export class TwoBoneIKSolver {
  private readonly rootWorld = new THREE.Vector3();
  private readonly rootToTarget = new THREE.Vector3();
  private readonly poleDirection = new THREE.Vector3();
  private readonly temporary = new THREE.Vector3();
  private readonly elbowWorld = new THREE.Vector3();
  private readonly effectiveTarget = new THREE.Vector3();
  private readonly upperDirection = new THREE.Vector3();
  private readonly lowerDirection = new THREE.Vector3();
  private readonly desiredWorldQuaternion = new THREE.Quaternion();
  private readonly parentWorldQuaternion = new THREE.Quaternion();
  private readonly inverseParentQuaternion = new THREE.Quaternion();
  private readonly result: TwoBoneIKResult = {
    clamped: false,
    targetDistance: 0,
    reachedDistance: 0,
  };

  solve(
    chain: TwoBoneIKChain,
    targetWorld: THREE.Vector3,
    poleWorld: THREE.Vector3,
  ): TwoBoneIKResult {
    chain.root.parent?.updateMatrixWorld(true);
    chain.root.getWorldPosition(this.rootWorld);
    this.rootToTarget.subVectors(targetWorld, this.rootWorld);
    const targetDistance = this.rootToTarget.length();
    if (targetDistance < 1e-6) this.rootToTarget.set(0, -1, 0);
    else this.rootToTarget.multiplyScalar(1 / targetDistance);

    const minimumReach = Math.abs(chain.upperLength - chain.lowerLength) + 0.001;
    const maximumReach = chain.upperLength + chain.lowerLength - 0.001;
    const reachedDistance = THREE.MathUtils.clamp(
      targetDistance,
      minimumReach,
      maximumReach,
    );
    this.effectiveTarget
      .copy(this.rootToTarget)
      .multiplyScalar(reachedDistance)
      .add(this.rootWorld);

    this.poleDirection.subVectors(poleWorld, this.rootWorld);
    this.temporary
      .copy(this.rootToTarget)
      .multiplyScalar(this.poleDirection.dot(this.rootToTarget));
    this.poleDirection.sub(this.temporary);
    if (this.poleDirection.lengthSq() < 1e-8) {
      if (Math.abs(this.rootToTarget.x) < 0.9) this.poleDirection.set(1, 0, 0);
      else this.poleDirection.set(0, 0, 1);
      this.temporary
        .copy(this.rootToTarget)
        .multiplyScalar(this.poleDirection.dot(this.rootToTarget));
      this.poleDirection.sub(this.temporary);
    }
    this.poleDirection.normalize();

    const along =
      (reachedDistance * reachedDistance +
        chain.upperLength * chain.upperLength -
        chain.lowerLength * chain.lowerLength) /
      (2 * reachedDistance);
    const away = Math.sqrt(
      Math.max(0, chain.upperLength * chain.upperLength - along * along),
    );
    this.elbowWorld
      .copy(this.rootToTarget)
      .multiplyScalar(along)
      .addScaledVector(this.poleDirection, away)
      .add(this.rootWorld);

    this.upperDirection.subVectors(this.elbowWorld, this.rootWorld).normalize();
    this.desiredWorldQuaternion.setFromUnitVectors(down, this.upperDirection);
    chain.root.parent?.getWorldQuaternion(this.parentWorldQuaternion);
    this.inverseParentQuaternion.copy(this.parentWorldQuaternion).invert();
    chain.root.quaternion
      .copy(this.inverseParentQuaternion)
      .multiply(this.desiredWorldQuaternion);
    chain.root.parent?.updateMatrixWorld(true);

    chain.root.getWorldQuaternion(this.parentWorldQuaternion);
    this.lowerDirection.subVectors(this.effectiveTarget, this.elbowWorld).normalize();
    this.desiredWorldQuaternion.setFromUnitVectors(down, this.lowerDirection);
    this.inverseParentQuaternion.copy(this.parentWorldQuaternion).invert();
    chain.mid.quaternion
      .copy(this.inverseParentQuaternion)
      .multiply(this.desiredWorldQuaternion);
    chain.root.updateMatrixWorld(true);

    this.result.clamped = Math.abs(reachedDistance - targetDistance) > 1e-6;
    this.result.targetDistance = targetDistance;
    this.result.reachedDistance = reachedDistance;
    return this.result;
  }
}
