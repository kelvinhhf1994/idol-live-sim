import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { TwoBoneIKSolver } from "./twoBoneIK";

function createChain(upperLength = 0.29, lowerLength = 0.3) {
  const parent = new THREE.Group();
  parent.position.set(0.3, 0.7, -0.2);
  parent.rotation.y = 0.35;
  const root = new THREE.Group();
  const mid = new THREE.Group();
  const end = new THREE.Group();
  mid.position.y = -upperLength;
  end.position.y = -lowerLength;
  root.add(mid);
  mid.add(end);
  parent.add(root);
  parent.updateMatrixWorld(true);
  return { parent, root, mid, end, upperLength, lowerLength };
}

describe("TwoBoneIKSolver", () => {
  it("reaches an arm endpoint within five millimeters", () => {
    const chain = createChain();
    const solver = new TwoBoneIKSolver();
    const rootWorld = chain.root.getWorldPosition(new THREE.Vector3());
    const target = rootWorld.clone().add(new THREE.Vector3(0.2, -0.42, -0.18));
    const pole = rootWorld.clone().add(new THREE.Vector3(-1, 0, 0));

    const result = solver.solve(chain, target, pole);
    chain.parent.updateMatrixWorld(true);

    expect(chain.end.getWorldPosition(new THREE.Vector3()).distanceTo(target)).toBeLessThan(0.005);
    expect(result.clamped).toBe(false);
  });

  it("clamps unreachable targets to the available reach", () => {
    const chain = createChain(0.29, 0.29);
    const solver = new TwoBoneIKSolver();
    const rootWorld = chain.root.getWorldPosition(new THREE.Vector3());
    const target = rootWorld.clone().add(new THREE.Vector3(0, -2, 0));
    const pole = rootWorld.clone().add(new THREE.Vector3(0, 0, 1));

    const result = solver.solve(chain, target, pole);
    chain.parent.updateMatrixWorld(true);
    const distance = chain.end.getWorldPosition(new THREE.Vector3()).distanceTo(rootWorld);

    expect(distance).toBeCloseTo(0.579, 3);
    expect(result.clamped).toBe(true);
    expect(result.targetDistance).toBeCloseTo(2);
  });

  it("uses opposite pole points for opposite elbow and knee planes", () => {
    const positiveChain = createChain();
    const negativeChain = createChain();
    const solver = new TwoBoneIKSolver();
    const positiveRoot = positiveChain.root.getWorldPosition(new THREE.Vector3());
    const negativeRoot = negativeChain.root.getWorldPosition(new THREE.Vector3());
    const positiveTarget = positiveRoot.clone().add(new THREE.Vector3(0, -0.45, -0.1));
    const negativeTarget = negativeRoot.clone().add(new THREE.Vector3(0, -0.45, -0.1));

    solver.solve(
      positiveChain,
      positiveTarget,
      positiveRoot.clone().add(new THREE.Vector3(1, 0, 0)),
    );
    positiveChain.parent.updateMatrixWorld(true);
    const positiveMidX = positiveChain.mid.getWorldPosition(new THREE.Vector3()).x - positiveRoot.x;
    solver.solve(
      negativeChain,
      negativeTarget,
      negativeRoot.clone().add(new THREE.Vector3(-1, 0, 0)),
    );
    negativeChain.parent.updateMatrixWorld(true);
    const negativeMidX = negativeChain.mid.getWorldPosition(new THREE.Vector3()).x - negativeRoot.x;

    expect(positiveMidX).toBeGreaterThan(0.02);
    expect(negativeMidX).toBeLessThan(-0.02);
  });

  it("reuses its result object across updates", () => {
    const chain = createChain();
    const solver = new TwoBoneIKSolver();
    const root = chain.root.getWorldPosition(new THREE.Vector3());
    const pole = root.clone().add(new THREE.Vector3(1, 0, 0));

    const first = solver.solve(chain, root.clone().add(new THREE.Vector3(0, -0.4, -0.1)), pole);
    const second = solver.solve(chain, root.clone().add(new THREE.Vector3(0, -0.42, -0.08)), pole);

    expect(second).toBe(first);
  });
});
