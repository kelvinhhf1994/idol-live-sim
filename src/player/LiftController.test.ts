import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GENERIC_VENUE } from "../config/venue";
import { createLowPolyPerson } from "../scene/createCharacter";
import { PlayerController } from "./PlayerController";

function createPlayer(): PlayerController {
  return new PlayerController(createLowPolyPerson(), GENERIC_VENUE, []);
}

function updateFrames(player: PlayerController, count = 180): void {
  for (let frame = 0; frame < count; frame += 1) {
    player.update(1 / 60, { x: 0, y: 0 }, 0, true);
  }
}

describe("player lift", () => {
  it("raises the player and shows both supporters when activated", () => {
    const player = createPlayer();

    player.setLiftActive(true);
    updateFrames(player);

    expect(player.liftActive).toBe(true);
    expect(player.supporterVisible).toBe(true);
    expect(player.supporterPositions).toHaveLength(2);
    expect(player.position.y).toBeCloseTo(GENERIC_VENUE.spawn.y + 1.15, 2);
  });

  it("keeps the two supporters in a tight side-by-side formation", () => {
    const player = createPlayer();
    player.setLiftActive(true);
    updateFrames(player);

    const [left, right] = player.supporterPositions;

    expect(right.x - left.x).toBeGreaterThanOrEqual(0.65);
    expect(right.x - left.x).toBeLessThanOrEqual(0.85);
  });

  it("places both hands of each supporter against the assigned foot", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    player.setLiftActive(true);
    updateFrames(player);
    player.group.updateMatrixWorld(true);
    player.lift.group.updateMatrixWorld(true);

    const leftFoot = rig.leftFoot.getWorldPosition(new THREE.Vector3());
    const rightFoot = rig.rightFoot.getWorldPosition(new THREE.Vector3());
    const [leftSupporter, rightSupporter] = player.lift.supporters;

    expect(leftSupporter.leftHand.getWorldPosition(new THREE.Vector3()).distanceTo(leftFoot)).toBeLessThan(0.14);
    expect(leftSupporter.rightHand.getWorldPosition(new THREE.Vector3()).distanceTo(leftFoot)).toBeLessThan(0.14);
    expect(rightSupporter.leftHand.getWorldPosition(new THREE.Vector3()).distanceTo(rightFoot)).toBeLessThan(0.14);
    expect(rightSupporter.rightHand.getWorldPosition(new THREE.Vector3()).distanceTo(rightFoot)).toBeLessThan(0.14);
  });

  it("rejects jumping while lift is active", () => {
    const player = createPlayer();

    player.setLiftActive(true);

    expect(player.jump()).toBe(false);
  });

  it("cancels an active mosh when lift starts", () => {
    const player = createPlayer();
    player.startMosh();

    player.setLiftActive(true);

    expect(player.moshActive).toBe(false);
  });

  it("rejects a new mosh while the formation is supporting the player", () => {
    const player = createPlayer();
    player.setLiftActive(true);

    player.startMosh();

    expect(player.moshActive).toBe(false);
  });

  it("returns the player to the venue floor and hides supporters when deactivated", () => {
    const player = createPlayer();
    player.setLiftActive(true);
    updateFrames(player);

    player.setLiftActive(false);
    updateFrames(player);

    expect(player.liftActive).toBe(false);
    expect(player.position.y).toBe(GENERIC_VENUE.spawn.y);
    expect(player.supporterVisible).toBe(false);
  });

  it("moves the full formation at exactly 2.00 times ordinary speed", () => {
    const player = createPlayer();
    player.setLiftActive(true);
    updateFrames(player);
    const initialPlayerZ = player.position.z;
    const initialSupporterZ = player.supporterPositions.map((position) => position.z);

    player.update(0.1, { x: 0, y: -1 }, 0, true);

    const playerDelta = player.position.z - initialPlayerZ;
    expect(playerDelta).toBeCloseTo(-0.64, 5);
    player.supporterPositions.forEach((position, index) => {
      expect(position.z - initialSupporterZ[index]).toBeCloseTo(playerDelta, 5);
    });
  });

  it("does not cross a wall at 30 FPS while moving at lift speed", () => {
    const player = new PlayerController(createLowPolyPerson(), GENERIC_VENUE, [
      { minX: -1, maxX: 1, minZ: 18.8, maxZ: 19 },
    ]);
    player.setLiftActive(true);
    updateFrames(player);

    player.update(1 / 30, { x: 0, y: -1 }, 0, true);

    expect(player.position.z).toBe(GENERIC_VENUE.spawn.z);
  });

  it("keeps the lifted player upright with fixed legs while moving", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    player.setLiftActive(true);
    updateFrames(player);

    player.update(0.1, { x: 0, y: -1 }, 0, true);

    expect(rig.body.rotation.x).toBeCloseTo(0);
    expect(rig.leftLeg.rotation.x).toBeCloseTo(0);
    expect(rig.rightLeg.rotation.x).toBeCloseTo(0);
    expect(rig.leftArm.rotation.x).toBeGreaterThan(1.3);
    expect(Math.abs(rig.rightArm.rotation.z)).toBeGreaterThan(1);
  });

  it("keeps supporter arms fixed while their legs run", () => {
    const playerRig = createLowPolyPerson();
    const player = new PlayerController(playerRig, GENERIC_VENUE, []);
    player.setLiftActive(true);
    updateFrames(player);
    const initialArms = player.lift.supporters.map((rig) => [
      rig.leftArm.rotation.x,
      rig.leftArm.rotation.z,
      rig.rightArm.rotation.x,
      rig.rightArm.rotation.z,
    ]);

    player.update(0.1, { x: 0, y: -1 }, 0, true);

    player.lift.supporters.forEach((rig, index) => {
      expect([
        rig.leftArm.rotation.x,
        rig.leftArm.rotation.z,
        rig.rightArm.rotation.x,
        rig.rightArm.rotation.z,
      ]).toEqual(initialArms[index]);
      expect(Math.abs(rig.leftLeg.rotation.x)).toBeGreaterThan(0.3);
      expect(rig.rightLeg.rotation.x).toBeCloseTo(-rig.leftLeg.rotation.x);
      expect(rig.body.rotation.x).toBeLessThan(-0.05);
    });
    player.group.updateMatrixWorld(true);
    player.lift.group.updateMatrixWorld(true);
    const leftFoot = playerRig.leftFoot.getWorldPosition(new THREE.Vector3());
    const rightFoot = playerRig.rightFoot.getWorldPosition(new THREE.Vector3());
    const [leftSupporter, rightSupporter] = player.lift.supporters;
    expect(leftSupporter.leftHand.getWorldPosition(new THREE.Vector3()).distanceTo(leftFoot)).toBeLessThan(0.18);
    expect(leftSupporter.rightHand.getWorldPosition(new THREE.Vector3()).distanceTo(leftFoot)).toBeLessThan(0.18);
    expect(rightSupporter.leftHand.getWorldPosition(new THREE.Vector3()).distanceTo(rightFoot)).toBeLessThan(0.18);
    expect(rightSupporter.rightHand.getWorldPosition(new THREE.Vector3()).distanceTo(rightFoot)).toBeLessThan(0.18);
  });

  it("restores ordinary player limb animation after landing", () => {
    const rig = createLowPolyPerson();
    const player = new PlayerController(rig, GENERIC_VENUE, []);
    player.setLiftActive(true);
    updateFrames(player);
    player.setLiftActive(false);
    updateFrames(player);

    player.update(0.1, { x: 0, y: -1 }, 0, true);

    expect(Math.abs(rig.leftLeg.rotation.x)).toBeGreaterThan(0.1);
    expect(rig.leftArm.rotation.x).toBeLessThan(1);
  });
});
