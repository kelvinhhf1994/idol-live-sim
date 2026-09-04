import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GENERIC_VENUE } from "../config/venue";
import { createLowPolyPerson, GLOW_STICK_HEIGHT } from "../scene/createCharacter";
import { calculateWorldMovement, getMoshPose, PlayerController } from "./PlayerController";
import { DEFAULT_GAME_SETTINGS } from "./gameSettings";
import { BEAT_ARM_READY, BEAT_ARM_THRUST } from "./penlight";

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

  it("cannot walk directly from the floor into the raised stage", () => {
    const player = new PlayerController(
      createLowPolyPerson(),
      GENERIC_VENUE,
      GENERIC_VENUE.colliders,
    );
    player.position.set(0, 0, -8.8);

    player.update(0.1, { x: 0, y: -1 }, 0, true);

    expect(player.position.z).toBe(-8.8);
    expect(player.position.y).toBe(0);
  });

  it("clears the front barrier and lands on the stage while descending", () => {
    const player = new PlayerController(
      createLowPolyPerson(),
      GENERIC_VENUE,
      GENERIC_VENUE.colliders,
    );
    player.position.set(0, 0, -6.8);
    expect(player.jump()).toBe(true);

    for (let frame = 0; frame < 120 && player.position.z > -9.5; frame += 1) {
      player.update(1 / 60, { x: 0, y: -1 }, 0, true);
    }
    for (let frame = 0; frame < 180 && player.position.y > 0.75; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }

    expect(player.position.z).toBeLessThan(-9.075);
    expect(player.position.y).toBe(0.75);
    expect(player.groundHeight).toBe(0.75);
  });

  it("falls to the venue floor after jumping out of stage bounds", () => {
    const player = new PlayerController(
      createLowPolyPerson(),
      GENERIC_VENUE,
      GENERIC_VENUE.colliders,
    );
    player.position.set(5.1, 0.75, -12.2);
    player.update(0, { x: 0, y: 0 }, 0, true);
    expect(player.jump()).toBe(true);

    for (let frame = 0; frame < 30; frame += 1) {
      player.update(1 / 60, { x: 1, y: 0 }, 0, true);
    }
    for (let frame = 0; frame < 180; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }

    expect(player.position.x).toBeGreaterThan(5.625);
    expect(player.position.y).toBe(0);
    expect(player.groundHeight).toBe(0);
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

  it("pulses two-step movement at 60 FPS while preserving ordinary cycle distance", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    const walkingPlayer = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    const frameDeltas: number[] = [];

    player.startTwoStep();
    for (let frame = 0; frame < 48; frame += 1) {
      const before = player.position.x;
      player.update(1 / 60, { x: 1, y: 0 }, 0, true);
      walkingPlayer.update(1 / 60, { x: 1, y: 0 }, 0, true);
      frameDeltas.push(player.position.x - before);
    }

    expect(player.twoStepActive).toBe(true);
    expect(player.position.x).toBeCloseTo(walkingPlayer.position.x);
    expect(Math.min(...frameDeltas)).toBeLessThan(0.02);
    expect(Math.max(...frameDeltas)).toBeGreaterThan(0.09);
    expect(player.audienceImpact.mode).toBeNull();
  });

  it("advances clearly during a 2s two-step hold with forward input", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    const walkingPlayer = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    player.debugPlaceOnGround(0, 5);
    walkingPlayer.debugPlaceOnGround(0, 5);
    const start = { x: player.position.x, z: player.position.z };

    player.startTwoStep();
    for (let frame = 0; frame < 120; frame += 1) {
      // y < 0 is forward (KeyW) in movement space
      player.update(1 / 60, { x: 0, y: -1 }, 0, true);
      walkingPlayer.update(1 / 60, { x: 0, y: -1 }, 0, true);
    }

    const twoStepDistance = Math.hypot(
      player.position.x - start.x,
      player.position.z - start.z,
    );
    const walkDistance = Math.hypot(
      walkingPlayer.position.x - start.x,
      walkingPlayer.position.z - start.z,
    );

    expect(player.twoStepActive).toBe(true);
    expect(twoStepDistance).toBeGreaterThan(5);
    expect(twoStepDistance / walkDistance).toBeGreaterThan(0.85);
    expect(twoStepDistance / walkDistance).toBeLessThan(1.15);
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

  it("uses deep knee flexion for the two-step butt-kick with back extension", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    player.debugSetTwoStepPhase(0.25);
    for (let frame = 0; frame < 30; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }
    rig.group.updateMatrixWorld(true);

    const rightFootDepth =
      rig.rightFoot.getWorldPosition(new THREE.Vector3()).z - player.position.z;
    // Heel kicked behind the body (character faces -Z).
    expect(rightFootDepth).toBeGreaterThan(0.2);
    expect(rig.rightHip.rotation.x).toBeLessThan(-0.25);
    expect(rig.rightHip.rotation.x).toBeGreaterThan(-0.4);
    expect(rig.rightKnee.rotation.x).toBeLessThan(-1.3);
    expect(rig.rightHip.rotation.z).toBeLessThan(-0.25);
    expect(rig.chest.rotation.x).toBeLessThan(-0.35);
    expect(Math.abs(rig.body.rotation.x)).toBeLessThan(0.01);
    // Lateral hop: body shifts onto the left support side.
    expect(rig.body.position.x).toBeLessThan(-0.2);
    expect(rig.leftShoulder.rotation.z).toBeLessThan(-Math.PI / 2);
    expect(rig.leftElbow.rotation.x).toBeGreaterThan(0.15);
    expect(rig.rightElbow.rotation.x).toBeGreaterThan(0.5);

    player.debugSetTwoStepPhase(0.75);
    for (let frame = 0; frame < 30; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }
    expect(rig.body.position.x).toBeGreaterThan(0.2);

    player.releaseTwoStep();
    for (let frame = 0; frame < 60; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }

    expect(Math.abs(rig.leftLeg.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.rightLeg.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.leftLeg.rotation.z)).toBeLessThan(0.01);
    expect(Math.abs(rig.rightLeg.rotation.z)).toBeLessThan(0.01);
    expect(Math.abs(rig.leftKnee.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.rightKnee.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.leftFootPivot.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.rightFootPivot.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.leftArm.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.rightArm.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.leftElbow.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.rightElbow.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.body.position.y)).toBeLessThan(0.01);
    expect(Math.abs(rig.body.position.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.body.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.body.rotation.y)).toBeLessThan(0.01);
    expect(Math.abs(rig.body.rotation.z)).toBeLessThan(0.01);
    expect(Math.abs(rig.chest.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.pelvis.position.y - 0.64)).toBeLessThan(0.01);
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

  it("keeps the glow stick in the stage-point pose during jump-point", () => {
    const rig = createLowPolyPerson({ glowStick: true });
    const player = new PlayerController(rig, GENERIC_VENUE, []);

    expect(player.startJumpPoint()).toBe(true);
    for (let i = 0; i < 12; i += 1) player.update(0.05, { x: 0, y: 0 }, 0, true);

    expect(player.jumpPointActive || player.jumpPointHeld).toBe(true);
    expect(rig.glowStick).not.toBeNull();
    expect(rig.glowStick!.visible).toBe(true);
    // PENLIGHT_STICK_POINT: flipped shaft so the tip tracks the forearm toward stage.
    expect(rig.glowStick!.rotation.x).toBeCloseTo(Math.PI, 5);
  });

  it("keeps the glow stick stage-pointed while lifted", () => {
    const rig = createLowPolyPerson({ glowStick: true });
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    player.setLiftActive(true);
    for (let i = 0; i < 60; i += 1) player.update(1 / 60, { x: 0, y: 0 }, 0, true);

    expect(player.liftActive).toBe(true);
    expect(rig.glowStick!.visible).toBe(true);
    expect(rig.glowStick!.rotation.x).toBeCloseTo(Math.PI, 5);
    expect(rig.rightArm.rotation.x).toBeCloseTo(Math.PI / 2 + Math.PI / 4, 5);
  });

  it("keeps ordinary jump separate from jump-point pose", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);

    expect(player.jump()).toBe(true);
    expect(player.jumpPointActive).toBe(false);
    expect(player.jumpPointHeld).toBe(false);
    player.update(0.2, { x: 0, y: 0 }, 0, true);
    expect(rig.leftKnee.rotation.x).toBeLessThan(-0.2);
    expect(rig.rightKnee.rotation.x).toBeLessThan(-0.2);
  });

  it("points with a bent right elbow and absorbs jump-point landing through both knees", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    const initialYaw = player.group.rotation.y;

    player.startJumpPoint();
    player.releaseJumpPoint();
    player.update(0.2, { x: 0, y: 0 }, Math.PI / 2, true);

    expect(rig.rightShoulder.rotation.x).toBeGreaterThan(Math.PI / 2);
    expect(rig.rightElbow.rotation.x).toBeGreaterThan(0.15);
    expect(rig.leftKnee.rotation.x).toBeLessThan(-0.2);
    expect(rig.rightKnee.rotation.x).toBeLessThan(-0.2);
    expect(rig.chest.rotation.x).toBeGreaterThan(0.04);
    expect(player.group.rotation.y).toBe(initialYaw);

    for (let frame = 0; frame < 180 && player.position.y > player.groundHeight; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }
    for (let frame = 0; frame < 4; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }
    expect(rig.leftKnee.rotation.x).toBeLessThan(-0.4);
    expect(rig.rightKnee.rotation.x).toBeLessThan(-0.4);
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

    player.debugSetMoshPhase(0.25);
    for (let frame = 0; frame < 30; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }
    rig.group.updateMatrixWorld(true);
    const startLeftDepth = rig.leftHand.getWorldPosition(new THREE.Vector3()).z - player.position.z;
    const startRightDepth = rig.rightHand.getWorldPosition(new THREE.Vector3()).z - player.position.z;

    expect(startLeftDepth).toBeLessThan(-0.05);
    expect(startRightDepth).toBeGreaterThan(0.05);

    const halfCycleRig = createLowPolyPerson();
    const halfCyclePlayer = new PlayerController(halfCycleRig, GENERIC_VENUE, []);
    halfCyclePlayer.debugSetMoshPhase(0.75);
    for (let frame = 0; frame < 30; frame += 1) {
      halfCyclePlayer.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }
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
    expect(start.leftArm).toBeCloseTo(Math.PI);
    expect(quarter.leftArm).toBeCloseTo(Math.PI / 2);
    expect(strike.leftArm).toBeLessThan(quarter.leftArm);
    expect(strike.leftArm).toBeGreaterThan(0);
    expect(Math.sin(strike.leftArm)).toBeGreaterThan(0.5);
  });

  it("leans forward 12 to 20 degrees during mosh and smoothly returns upright", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);

    player.startMosh();
    player.update(0.1, { x: 0, y: 0 }, 0, true);

    expect(Math.abs(rig.body.rotation.x)).toBeLessThan(0.01);
    expect(rig.chest.rotation.x).toBeLessThanOrEqual(THREE.MathUtils.degToRad(-12));
    expect(rig.chest.rotation.x).toBeGreaterThanOrEqual(THREE.MathUtils.degToRad(-20));
    expect(Math.abs(rig.leftLeg.rotation.x)).toBeGreaterThan(0.15);
    expect(rig.rightLeg.rotation.x).toBeCloseTo(-rig.leftLeg.rotation.x);
    expect(rig.leftKnee.rotation.x).toBeLessThan(-0.05);
    expect(rig.rightKnee.rotation.x).toBeLessThan(-0.05);
    expect(rig.leftShoulder.rotation.z).toBeLessThan(0);
    expect(rig.rightShoulder.rotation.z).toBeGreaterThan(0);

    player.releaseMosh();
    for (let frame = 0; frame < 60; frame += 1) {
      player.update(1 / 60, { x: 0, y: 0 }, 0, true);
    }

    expect(player.moshActive).toBe(false);
    expect(Math.abs(rig.chest.rotation.x)).toBeLessThan(0.01);
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

  it("walks with swing and support knee flexion plus flat-foot ankle compensation", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);

    player.update(0.1, { x: 0, y: -1 }, 0, true);

    expect(rig.leftHip.rotation.x).toBeGreaterThan(0.3);
    expect(rig.leftKnee.rotation.x).toBeLessThan(-0.15);
    expect(rig.leftKnee.rotation.x).toBeGreaterThan(-0.61);
    expect(rig.rightKnee.rotation.x).toBeLessThan(-0.05);
    expect(rig.rightKnee.rotation.x).toBeGreaterThan(-0.16);
    expect(
      Math.abs(
        rig.leftHip.rotation.x +
          rig.leftKnee.rotation.x +
          rig.leftFootPivot.rotation.x,
      ),
    ).toBeLessThan(0.08);
    expect(rig.leftElbow.rotation.x).toBeGreaterThan(0.1);
    expect(rig.rightElbow.rotation.x).toBeGreaterThan(0.1);
  });

  it("does not move through a nearby obstacle", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, [
      { minX: -1, maxX: 1, minZ: 19.5, maxZ: 19.7 },
    ]);

    player.update(0.1, { x: 0, y: -1 }, 0, true);

    expect(player.position.z).toBe(GENERIC_VENUE.spawn.z);
  });

  it("applies configurable movement and jump multipliers", () => {
    const boosted = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    const baseline = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
    boosted.setGameSettings({
      walkSpeed: 2,
      moshSpeed: 1.25,
      liftSpeed: 2,
      twoStepSpeed: 1,
      jumpScale: 2,
      wiperSpeed: 1,
      beatSpeed: 1,
    });

    boosted.update(0.1, { x: 1, y: 0 }, 0, true);
    baseline.update(0.1, { x: 1, y: 0 }, 0, true);
    expect(boosted.position.x - GENERIC_VENUE.spawn.x).toBeCloseTo(
      (baseline.position.x - GENERIC_VENUE.spawn.x) * 2,
    );

    expect(boosted.jump()).toBe(true);
    expect(baseline.jump()).toBe(true);
    boosted.update(0.05, { x: 0, y: 0 }, 0, true);
    baseline.update(0.05, { x: 0, y: 0 }, 0, true);
    expect(boosted.position.y).toBeGreaterThan(baseline.position.y);
  });

  it("keeps raise and point penlight poses while walking and suppresses them during mosh", () => {
    const rig = createLowPolyPerson({ glowStick: true });
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    expect(rig.glowStick).not.toBeNull();

    player.setPenlightColor("aqua");
    expect(player.penlight.colorId).toBe("aqua");
    const material = rig.glowStick!.material as THREE.MeshStandardMaterial;
    expect(material.emissive.getHex()).toBe(0x3ad7ff);

    player.togglePenlightPose("raise");
    expect(player.penlight.pose).toBe("raise");
    expect(player.penlightPoseActive).toBe(true);
    expect(Math.abs(rig.glowStick!.rotation.x)).toBeGreaterThan(2.5);

    player.update(0.1, { x: 1, y: 0 }, 0, true);
    expect(player.penlightPoseActive).toBe(true);
    // One frame while walking still blends toward the vertical target.
    expect(rig.rightShoulder.rotation.x).toBeGreaterThan(1.5);

    // After settling: straight vertical raise (~π on X); arm must not lean left via Z.
    for (let i = 0; i < 40; i += 1) player.update(0.05, { x: 0, y: 0 }, 0, true);
    expect(Math.abs(rig.rightShoulder.rotation.x - Math.PI)).toBeLessThan(0.1);
    expect(Math.abs(rig.rightShoulder.rotation.z)).toBeLessThan(0.08);
    expect(Math.abs(rig.rightShoulder.rotation.y)).toBeLessThan(0.08);
    expect(Math.abs(rig.rightElbow.rotation.x)).toBeLessThan(0.1);
    rig.group.updateMatrixWorld(true);
    const handWorld = rig.rightHand.getWorldPosition(new THREE.Vector3());
    const tipWorld = rig.glowStick!.localToWorld(new THREE.Vector3(0, GLOW_STICK_HEIGHT, 0));
    const hand = rig.group.worldToLocal(handWorld.clone());
    const tip = rig.group.worldToLocal(tipWorld.clone());
    // Tip above hand; stick tilt (not arm lean) provides left / forward bias.
    expect(tip.y).toBeGreaterThan(hand.y + 0.12);
    expect(tip.x).toBeLessThan(hand.x - 0.1);
    expect(-(tip.z - hand.z)).toBeGreaterThan(0.05);

    player.startMosh();
    player.update(0.05, { x: 0, y: 0 }, 0, true);
    expect(player.penlightPoseActive).toBe(false);
    expect(player.penlight.pose).toBe("raise");

    player.releaseMosh();
    for (let i = 0; i < 20; i += 1) player.update(0.05, { x: 0, y: 0 }, 0, true);
    expect(player.moshActive).toBe(false);
    expect(player.penlightPoseActive).toBe(true);

    player.togglePenlightPose("point");
    expect(player.penlight.pose).toBe("point");
    for (let i = 0; i < 60; i += 1) player.update(0.05, { x: 0, y: 0 }, 0, true);
    // Stage point: forward + 45° elevation (3π/4), no side lean while standing.
    const pointed = Math.atan2(
      Math.sin(rig.rightShoulder.rotation.x),
      Math.cos(rig.rightShoulder.rotation.x),
    );
    expect(Math.abs(pointed - (Math.PI * 3) / 4)).toBeLessThan(0.4);
    expect(Math.abs(rig.rightShoulder.rotation.z)).toBeLessThan(0.08);
    expect(Math.abs(rig.rightShoulder.rotation.y)).toBeLessThan(0.08);

    // Walking must keep the same 45° elevation toward the stage.
    for (let i = 0; i < 40; i += 1) player.update(0.05, { x: 1, y: 0 }, 0, true);
    const walkingPoint = Math.atan2(
      Math.sin(rig.rightShoulder.rotation.x),
      Math.cos(rig.rightShoulder.rotation.x),
    );
    expect(Math.abs(walkingPoint - (Math.PI * 3) / 4)).toBeLessThan(0.4);
  });

  it("grips the penlight at the bottom handle in idle raise and point", () => {
    const rig = createLowPolyPerson({ glowStick: true });
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    for (const pose of ["idle", "raise", "point"] as const) {
      player.setPenlightState({ colorId: "pink", pose });
      for (let i = 0; i < 30; i += 1) player.update(0.05, { x: 0, y: 0 }, 0, true);
      rig.group.updateMatrixWorld(true);
      const hand = rig.rightHand.getWorldPosition(new THREE.Vector3());
      const bottom = rig.glowStick!.localToWorld(new THREE.Vector3(0, 0, 0));
      const tip = rig.glowStick!.localToWorld(new THREE.Vector3(0, GLOW_STICK_HEIGHT, 0));
      expect(hand.distanceTo(bottom), `${pose} grip`).toBeLessThan(0.08);
      expect(hand.distanceTo(tip), `${pose} tip`).toBeGreaterThan(0.35);
    }
  });

  it("animates wiper and beat cheer poses and scales with speed settings", () => {
    const rig = createLowPolyPerson({ glowStick: true });
    const player = new PlayerController(rig, GENERIC_VENUE, []);

    player.togglePenlightPose("wiper");
    expect(player.penlight.pose).toBe("wiper");
    for (let i = 0; i < 40; i += 1) player.update(0.05, { x: 0, y: 0 }, 0, true);
    expect(player.penlightPoseActive).toBe(true);
    expect(rig.rightShoulder.rotation.x).toBeGreaterThan(2.2);
    const zSamples: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      player.update(0.05, { x: 0, y: 0 }, 0, true);
      zSamples.push(rig.rightShoulder.rotation.z);
    }
    expect(Math.max(...zSamples) - Math.min(...zSamples)).toBeGreaterThan(0.3);

    player.startBeat();
    expect(player.penlight.pose).toBe("beat");
    expect(player.beatActive).toBe(true);
    expect(player.beatHeld).toBe(true);

    // Sample one full slow cycle: elbow flexes between ready (~2.0) and peak thrust (~0.7).
    const elbowSamples: number[] = [];
    const shoulderXSamples: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      player.update(0.05, { x: 0, y: 0 }, 0, true);
      elbowSamples.push(rig.rightElbow.rotation.x);
      shoulderXSamples.push(rig.rightShoulder.rotation.x);
      // Chest-front kizami: upper arm stays down beside the ribs throughout.
      expect(rig.rightShoulder.rotation.x).toBeLessThan(Math.PI / 2);
      expect(Math.abs(rig.rightShoulder.rotation.z)).toBeLessThan(0.25);
    }
    const minElbow = Math.min(...elbowSamples);
    const maxElbow = Math.max(...elbowSamples);
    expect(minElbow).toBeLessThan(BEAT_ARM_READY.rightElbow - 0.4);
    expect(minElbow).toBeGreaterThan(BEAT_ARM_THRUST.rightElbow - 0.15);
    expect(maxElbow).toBeGreaterThan(BEAT_ARM_READY.rightElbow - 0.35);
    expect(Math.min(...shoulderXSamples)).toBeGreaterThan(0.1);

    // Stick pitch offset in character space: reaches forward 45° (-π/4) and retracts back to 100° (+10°).
    const armX = rig.rightShoulder.rotation.x + rig.rightElbow.rotation.x;
    expect(Math.abs(rig.glowStick!.rotation.x + armX)).toBeLessThan(1.15);

    // Retraction is animated: after peak, elbow climbs back toward ready without sudden jumps.
    const retractRig = createLowPolyPerson({ glowStick: true });
    const retractPlayer = new PlayerController(retractRig, GENERIC_VENUE, []);
    retractPlayer.startBeat();
    // Advance into the hold/peak window (~0.30 cycle at BEAT_CYCLE_RATE 0.85 ≈ 0.35s).
    for (let i = 0; i < 8; i += 1) retractPlayer.update(0.05, { x: 0, y: 0 }, 0, true);
    const peakElbow = retractRig.rightElbow.rotation.x;
    expect(peakElbow).toBeLessThan(1.2);
    const peakStickPitch =
      retractRig.glowStick!.rotation.x +
      retractRig.rightShoulder.rotation.x +
      retractRig.rightElbow.rotation.x;
    expect(peakStickPitch).toBeLessThan(-0.5); // forward tilted toward -π/4 (-0.785 rad, 45°)

    const retractElbows: number[] = [peakElbow];
    const retractStickPitches: number[] = [peakStickPitch];
    for (let i = 0; i < 16; i += 1) {
      retractPlayer.update(0.05, { x: 0, y: 0 }, 0, true);
      retractElbows.push(retractRig.rightElbow.rotation.x);
      retractStickPitches.push(
        retractRig.glowStick!.rotation.x +
          retractRig.rightShoulder.rotation.x +
          retractRig.rightElbow.rotation.x,
      );
    }
    // Overall climb toward ready pose across the slow retract window.
    expect(retractElbows[retractElbows.length - 1]!).toBeGreaterThan(peakElbow + 0.3);
    // No abrupt snaps: consecutive samples change by less than a hard jump.
    for (let i = 1; i < retractElbows.length; i += 1) {
      expect(Math.abs(retractElbows[i]! - retractElbows[i - 1]!)).toBeLessThan(0.35);
    }
    // During the retract window (around phase 0.85), stick tilts back toward +10° (+0.175 rad, 100°)
    expect(Math.max(...retractStickPitches)).toBeGreaterThan(0.12);

    const slow = createLowPolyPerson({ glowStick: true });
    const fast = createLowPolyPerson({ glowStick: true });
    const slowPlayer = new PlayerController(slow, GENERIC_VENUE, []);
    const fastPlayer = new PlayerController(fast, GENERIC_VENUE, []);
    slowPlayer.setGameSettings({ ...DEFAULT_GAME_SETTINGS, beatSpeed: 0.5 });
    fastPlayer.setGameSettings({ ...DEFAULT_GAME_SETTINGS, beatSpeed: 2.5 });
    slowPlayer.startBeat();
    fastPlayer.startBeat();
    for (let i = 0; i < 20; i += 1) {
      slowPlayer.update(0.05, { x: 0, y: 0 }, 0, true);
      fastPlayer.update(0.05, { x: 0, y: 0 }, 0, true);
    }
    // Faster beat reaches a deeper thrust earlier in the same wall-clock window.
    expect(fast.rightElbow.rotation.x).not.toBeCloseTo(slow.rightElbow.rotation.x, 2);
  });

  it("taps one beat cycle on release and keeps beating while held", () => {
    const player = new PlayerController(createLowPolyPerson({ glowStick: true }), GENERIC_VENUE, []);

    player.startBeat();
    expect(player.beatActive).toBe(true);
    player.releaseBeat();
    expect(player.beatHeld).toBe(false);
    expect(player.beatActive).toBe(true);
    expect(player.penlight.pose).toBe("beat");

    // Default speed: one cycle ≈ 1.18s.
    for (let i = 0; i < 22; i += 1) player.update(0.05, { x: 0, y: 0 }, 0, true);
    expect(player.beatActive).toBe(true);
    player.update(0.15, { x: 0, y: 0 }, 0, true);
    expect(player.beatActive).toBe(false);
    expect(player.penlight.pose).toBe("idle");

    player.startBeat();
    for (let i = 0; i < 40; i += 1) player.update(0.05, { x: 0, y: 0 }, 0, true);
    expect(player.beatActive).toBe(true);
    expect(player.penlight.pose).toBe("beat");
    player.releaseBeat();
    for (let i = 0; i < 30; i += 1) player.update(0.05, { x: 0, y: 0 }, 0, true);
    expect(player.beatActive).toBe(false);
    expect(player.penlight.pose).toBe("idle");
  });
});
