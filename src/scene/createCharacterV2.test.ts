import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createLowPolyPerson, GLOW_STICK_HEIGHT, GLOW_STICK_RADIUS } from "./createCharacter";

describe("createLowPolyPerson V2 joint rig", () => {
  it("builds the required nested pelvis, spine, arm, and leg hierarchy", () => {
    const rig = createLowPolyPerson();
    expect(rig.rigVersion).toBe(2);
    expect(rig.pelvis.parent).toBe(rig.body);
    expect(rig.chest.parent).toBe(rig.pelvis);
    expect(rig.neck.parent).toBe(rig.chest);
    expect(rig.head.parent).toBe(rig.neck);
    expect(rig.leftHip.parent).toBe(rig.pelvis);
    expect(rig.leftKnee.parent).toBe(rig.leftHip);
    expect(rig.leftAnkle.parent).toBe(rig.leftKnee);
    expect(rig.leftFootPivot.parent).toBe(rig.leftAnkle);
    expect(rig.leftShoulder.parent).toBe(rig.chest);
    expect(rig.leftElbow.parent).toBe(rig.leftShoulder);
  });

  it("preserves the V1 neutral total height within five millimeters", () => {
    const rig = createLowPolyPerson();
    const height = new THREE.Box3().setFromObject(rig.group).getSize(new THREE.Vector3()).y;

    expect(Math.abs(height - 1.8842844643074078)).toBeLessThan(0.005);
  });

  it("uses the approved local joint origins and segment lengths", () => {
    const rig = createLowPolyPerson();

    expect(rig.pelvis.position.toArray()).toEqual([0, 0.64, 0]);
    expect(rig.chest.position.toArray()).toEqual([0, 0.4, 0]);
    expect(rig.leftHip.position.toArray()).toEqual([-0.14, 0, 0.02]);
    expect(rig.rightHip.position.toArray()).toEqual([0.14, 0, 0.02]);
    expect(rig.leftKnee.position.y).toBe(-0.29);
    expect(rig.leftAnkle.position.y).toBe(-0.29);
    expect(rig.leftShoulder.position.toArray()).toEqual([-0.31, 0.21, 0]);
    expect(rig.leftElbow.position.y).toBe(-0.29);
    expect(rig.leftHand.position.y).toBe(-0.3);
  });

  it("preserves backward-compatible joint and mesh identities", () => {
    const rig = createLowPolyPerson({ glowStick: true });

    expect(rig.leftArm).toBe(rig.leftShoulder);
    expect(rig.rightArm).toBe(rig.rightShoulder);
    expect(rig.leftForearm).toBe(rig.leftElbow);
    expect(rig.rightForearm).toBe(rig.rightElbow);
    expect(rig.leftLeg).toBe(rig.leftHip);
    expect(rig.rightLeg).toBe(rig.rightHip);
    expect(rig.leftFoot.parent).toBe(rig.leftFootPivot);
    expect(rig.rightFoot.parent).toBe(rig.rightFootPivot);
    expect(rig.rightHand.children.some((child) => child.name === "glow-stick")).toBe(true);
    expect(rig.glowStick).not.toBeNull();
    expect(rig.glowStick?.parent).toBe(rig.rightHand);
  });

  it("builds a thicker bottom-pivoted glow stick gripped at the handle", () => {
    const rig = createLowPolyPerson({ glowStick: true });
    const geometry = rig.glowStick!.geometry as THREE.CylinderGeometry;
    expect(geometry.parameters.radiusTop).toBeCloseTo(GLOW_STICK_RADIUS, 5);
    expect(geometry.parameters.radiusTop).toBeGreaterThan(0.022);
    expect(geometry.parameters.height).toBeCloseTo(GLOW_STICK_HEIGHT, 5);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.y).toBeCloseTo(0, 5);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(GLOW_STICK_HEIGHT, 5);

    rig.group.updateMatrixWorld(true);
    const hand = rig.rightHand.getWorldPosition(new THREE.Vector3());
    const bottom = rig.glowStick!.localToWorld(new THREE.Vector3(0, 0, 0));
    const tip = rig.glowStick!.localToWorld(new THREE.Vector3(0, GLOW_STICK_HEIGHT, 0));
    expect(hand.distanceTo(bottom)).toBeLessThan(0.08);
    expect(hand.distanceTo(tip)).toBeGreaterThan(0.35);
  });

  it.each([
    ["player", {}],
    ["idol", { skirt: true, hairStyle: "twin" as const }],
    ["audience", { glowStick: true, scale: 0.9 }],
    ["supporter", { scale: 0.94, hairStyle: "short" as const }],
  ])("keeps neutral soles grounded for the %s role", (_role, options) => {
    const rig = createLowPolyPerson(options);
    rig.group.updateMatrixWorld(true);
    const leftSole = rig.leftFoot.localToWorld(new THREE.Vector3(0, -0.06, 0)).y;
    const rightSole = rig.rightFoot.localToWorld(new THREE.Vector3(0, -0.06, 0)).y;

    expect(Math.abs(leftSole)).toBeLessThan(0.001);
    expect(Math.abs(rightSole)).toBeLessThan(0.001);
  });

  it("keeps head details in the head subtree", () => {
    const rig = createLowPolyPerson({ hairStyle: "twin" });
    const descendants: THREE.Object3D[] = [];
    rig.head.traverse((child) => descendants.push(child));

    expect(descendants.filter((child) => child.name === "eye")).toHaveLength(2);
    expect(descendants.filter((child) => child.name.startsWith("hair"))).not.toHaveLength(0);
  });
});
