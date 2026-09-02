import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GENERIC_VENUE } from "../config/venue";
import { createLowPolyPerson } from "../scene/createCharacter";
import { calculateWorldMovement, getMoshPose, PlayerController } from "./PlayerController";

describe("calculateWorldMovement", () => {
  it("moves forward relative to a zero-yaw camera", () => {
    const movement = calculateWorldMovement({ x: 0, y: -1 }, 0);

    expect(movement.x).toBeCloseTo(0);
    expect(movement.z).toBeCloseTo(-1);
  });

  it("rotates forward movement with camera yaw", () => {
    const movement = calculateWorldMovement({ x: 0, y: -1 }, Math.PI / 2);

    expect(movement.x).toBeCloseTo(-1);
    expect(movement.z).toBeCloseTo(0);
  });

  it("normalizes diagonal movement", () => {
    const movement = calculateWorldMovement({ x: 1, y: -1 }, 0);

    expect(Math.hypot(movement.x, movement.z)).toBeCloseTo(1);
  });
});

describe("PlayerController", () => {
  it("starts a jump from the venue floor", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    expect(player.jump()).toBe(true);
    player.update(0.1, { x: 0, y: 0 }, 0, true);

    expect(player.position.y).toBeGreaterThan(GENERIC_VENUE.spawn.y);
  });

  it("does not jump again while airborne", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    player.jump();
    player.update(0.1, { x: 0, y: 0 }, 0, true);

    expect(player.jump()).toBe(false);
  });

  it("lands back on the venue floor", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    player.jump();
    for (let frame = 0; frame < 180; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }

    expect(player.position.y).toBe(GENERIC_VENUE.spawn.y);
    expect(player.jump()).toBe(true);
  });

  it("continues horizontal movement while airborne", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    player.jump();
    player.update(0.1, { x: 1, y: 0 }, 0, true);

    expect(player.position.x).toBeGreaterThan(GENERIC_VENUE.spawn.x);
    expect(player.position.y).toBeGreaterThan(GENERIC_VENUE.spawn.y);
  });

  it("moves at 1.25 times ordinary speed while moshing", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    const walkingPlayer = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    player.startMosh();
    player.update(0.1, { x: 1, y: 0 }, 0, true);
    walkingPlayer.update(0.1, { x: 1, y: 0 }, 0, true);

    expect(player.moshActive).toBe(true);
    expect(player.position.x).toBeGreaterThan(GENERIC_VENUE.spawn.x);
    expect(player.position.x - GENERIC_VENUE.spawn.x).toBeCloseTo(
      (walkingPlayer.position.x - GENERIC_VENUE.spawn.x) * 1.25,
    );
  });

  it("moves at exactly ordinary speed while holding two-step", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    const walkingPlayer = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    player.startTwoStep();
    player.update(0.1, { x: 1, y: 0 }, 0, true);
    walkingPlayer.update(0.1, { x: 1, y: 0 }, 0, true);

    expect(player.twoStepActive).toBe(true);
    expect(player.position.x).toBeCloseTo(walkingPlayer.position.x);
    expect(player.audienceImpact.mode).toBeNull();
  });

  it("keeps two-step hold state during a jump and resumes its pose after landing", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    player.startTwoStep();
    player.update(0.1, { x: 0, y: 0 }, 0, true);

    expect(player.twoStepAnimating).toBe(true);
    expect(player.jump()).toBe(true);
    player.update(0.1, { x: 0, y: 0 }, 0, true);
    expect(player.twoStepActive).toBe(true);
    expect(player.twoStepAnimating).toBe(false);

    for (let frame = 0; frame < 180; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }

    expect(player.twoStepActive).toBe(true);
    expect(player.twoStepAnimating).toBe(true);
  });

  it("kicks toward negative Z and smoothly clears the pose after release", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    player.startTwoStep();
    player.update(0.3, { x: 0, y: 0 }, 0, true);
    rig.group.updateMatrixWorld(true);

    const rightFootDepth =
      rig.rightFoot.getWorldPosition(new THREE.Vector3()).z - player.position.z;
    expect(rightFootDepth).toBeLessThan(-0.25);

    player.releaseTwoStep();
    for (let frame = 0; frame < 60; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }

    expect(Math.abs(rig.leftLeg.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.rightLeg.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.leftLeg.rotation.z)).toBeLessThan(0.01);
    expect(Math.abs(rig.rightLeg.rotation.z)).toBeLessThan(0.01);
    expect(Math.abs(rig.leftArm.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.rightArm.rotation.x)).toBeLessThan(0.01);
  });

  it("keeps mosh, lift, and two-step mutually exclusive", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    player.startMosh();
    player.startTwoStep();
    expect(player.moshActive).toBe(false);
    expect(player.twoStepActive).toBe(true);

    player.startMosh();
    expect(player.moshActive).toBe(true);
    expect(player.twoStepActive).toBe(false);

    player.startTwoStep();
    player.setLiftActive(true);
    expect(player.twoStepActive).toBe(false);
    expect(player.liftActive).toBe(true);

    player.startTwoStep();
    expect(player.twoStepActive).toBe(true);
    expect(player.liftActive).toBe(false);
  });

  it("runs a released jump-point through landing without changing yaw or knockback mode", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    const initialYaw = player.group.rotation.y;

    expect(player.startJumpPoint()).toBe(true);
    player.releaseJumpPoint();
    expect(player.jumpPointActive).toBe(true);
    player.update(0.1, { x: 0, y: 0 }, Math.PI / 2, true);

    expect(player.position.y).toBeGreaterThan(GENERIC_VENUE.spawn.y);
    expect(player.group.rotation.y).toBe(initialYaw);
    expect(player.audienceImpact.mode).toBeNull();
    rig.group.updateMatrixWorld(true);
    const shoulder = rig.rightArm.getWorldPosition(new THREE.Vector3());
    const hand = rig.rightHand.getWorldPosition(new THREE.Vector3());
    expect(hand.z).toBeLessThan(shoulder.z);
    expect(hand.y).toBeGreaterThan(shoulder.y);

    for (let frame = 0; frame < 180; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }
    expect(player.jumpPointActive).toBe(false);
  });

  it("keeps ordinary jump separate from jump-point pose", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    expect(player.jump()).toBe(true);
    expect(player.jumpPointActive).toBe(false);
    expect(player.jumpPointHeld).toBe(false);
  });

  it("cancels jump-point when another action starts without forcing landing", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    player.startJumpPoint();
    player.update(0.05, { x: 0, y: 0 }, 0, true);
    const airborneY = player.position.y;

    player.startMosh();

    expect(player.jumpPointActive).toBe(false);
    expect(player.jumpPointHeld).toBe(false);
    expect(player.moshActive).toBe(true);
    expect(player.position.y).toBe(airborneY);
  });

  it("starts with opposite arm depths and swaps them after half a cycle", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);

    player.startMosh();
    player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    rig.group.updateMatrixWorld(true);
    const startLeftDepth = rig.leftHand.getWorldPosition(new THREE.Vector3()).z - player.position.z;
    const startRightDepth = rig.rightHand.getWorldPosition(new THREE.Vector3()).z - player.position.z;

    expect(startLeftDepth).toBeLessThan(-0.05);
    expect(startRightDepth).toBeGreaterThan(0.05);

    const halfCycleRig = createLowPolyPerson();
    const halfCyclePlayer = new PlayerController(halfCycleRig, GENERIC_VENUE, []);
    halfCyclePlayer.startMosh();
    halfCyclePlayer.update(0.325, { x: 0, y: 0 }, 0, true);
    halfCycleRig.group.updateMatrixWorld(true);
    const halfLeftDepth =
      halfCycleRig.leftHand.getWorldPosition(new THREE.Vector3()).z - halfCyclePlayer.position.z;
    const halfRightDepth =
      halfCycleRig.rightHand.getWorldPosition(new THREE.Vector3()).z - halfCyclePlayer.position.z;

    expect(halfLeftDepth).toBeGreaterThan(0.05);
    expect(halfRightDepth).toBeLessThan(-0.05);
  });

  it("moves each striking arm from overhead toward the character's negative-Z front", () => {
    const start = getMoshPose(0);
    const quarter = getMoshPose(0.25);
    const strike = getMoshPose(0.375);
    const half = getMoshPose(0.5);

    expect(start.rightArm - start.leftArm).toBeCloseTo(Math.PI);
    expect(half.leftArm).toBeCloseTo(start.rightArm - Math.PI * 2);
    expect(half.rightArm).toBeCloseTo(start.leftArm);
    expect(quarter.rightArm).toBeCloseTo(Math.PI);
    expect(strike.rightArm).toBeLessThan(quarter.rightArm);
    expect(strike.rightArm).toBeGreaterThan(Math.PI / 2);
    expect(Math.sin(strike.rightArm)).toBeGreaterThan(0);
  });

  it("leans forward 12 to 20 degrees during mosh and smoothly returns upright", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);

    player.startMosh();
    player.update(0.1, { x: 0, y: 0 }, 0, true);

    expect(rig.body.rotation.x).toBeLessThanOrEqual(THREE.MathUtils.degToRad(-12));
    expect(rig.body.rotation.x).toBeGreaterThanOrEqual(THREE.MathUtils.degToRad(-20));
    expect(Math.abs(rig.leftLeg.rotation.x)).toBeGreaterThan(0.15);
    expect(rig.rightLeg.rotation.x).toBeCloseTo(-rig.leftLeg.rotation.x);

    player.releaseMosh();
    for (let frame = 0; frame < 60; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }

    expect(player.moshActive).toBe(false);
    expect(Math.abs(rig.body.rotation.x)).toBeLessThan(0.01);
  });

  it("allows jumping during ordinary mosh", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    player.startMosh();

    expect(player.jump()).toBe(true);
    expect(player.moshActive).toBe(true);
  });

  it("updates the player position from touch movement input", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);

    player.update(0.1, { x: 0, y: -1 }, 0, true);

    expect(player.position.z).toBeLessThan(GENERIC_VENUE.spawn.z);
  });

  it("does not move through a nearby obstacle", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, [
      { minX: -1, maxX: 1, minZ: 19.5, maxZ: 19.7 },
    ]);

    player.update(0.1, { x: 0, y: -1 }, 0, true);

    expect(player.position.z).toBe(GENERIC_VENUE.spawn.z);
  });
});
