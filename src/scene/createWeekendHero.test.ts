import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applyPersonPose, createPersonPose } from "../animation/personPose";
import { GLOW_STICK_HEIGHT, GLOW_STICK_RADIUS } from "./createCharacter";
import {
  createWeekendHero,
  mixWeekendAudienceLook,
  WEEKEND_HAIRSTYLES,
} from "./createWeekendHero";
import { armPoseFor, getDynamicArmPose } from "../player/penlight";

function meshesNamed(root: THREE.Object3D, name: string): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name === name) found.push(child);
  });
  return found;
}

describe("createWeekendHero", () => {
  it("uses the studio chibi skeleton while keeping the V2 joint hierarchy", () => {
    const rig = createWeekendHero();

    expect(rig.rigVersion).toBe(2);
    expect(rig.pelvisRestY).toBeCloseTo(0.516, 5);
    expect(rig.pelvis.parent).toBe(rig.body);
    expect(rig.chest.parent).toBe(rig.pelvis);
    expect(rig.neck.parent).toBe(rig.chest);
    expect(rig.head.parent).toBe(rig.neck);
    expect(rig.pelvis.position.y).toBeCloseTo(0.516, 5);
    expect(rig.chest.position.y).toBeCloseTo(0.264, 5);
    expect(rig.leftHip.position.x).toBeCloseTo(-0.117, 5);
    expect(rig.rightHip.position.x).toBeCloseTo(0.117, 5);
    expect(rig.leftKnee.position.y).toBeCloseTo(-0.24, 5);
    expect(rig.leftAnkle.position.y).toBeCloseTo(-0.216, 5);
    expect(rig.leftShoulder.position.x).toBeCloseTo(-0.282, 5);
    expect(rig.leftElbow.position.y).toBeCloseTo(-0.216, 5);
    expect(rig.leftHand.position.y).toBeCloseTo(-0.231, 3);
    expect(rig.leftArm).toBe(rig.leftShoulder);
    expect(rig.leftForearm).toBe(rig.leftElbow);
    expect(rig.leftLeg).toBe(rig.leftHip);
    expect(rig.leftFoot.parent).toBe(rig.leftFootPivot);
  });

  it("wears the Little Weekend hoodie, jeans, and chunky sneakers", () => {
    const rig = createWeekendHero();

    expect(meshesNamed(rig.chest, "hoodie").length).toBeGreaterThan(0);
    expect(meshesNamed(rig.chest, "hoodie-hood").length).toBeGreaterThan(0);
    expect(meshesNamed(rig.chest, "hoodie-pocket").length).toBeGreaterThan(0);
    expect(meshesNamed(rig.group, "pants").length).toBeGreaterThanOrEqual(4);
    expect(meshesNamed(rig.group, "sneaker")).toHaveLength(2);
    expect(meshesNamed(rig.group, "sneaker-sole")).toHaveLength(2);
  });

  it("builds a chibi head with hair on top and the face on game-front -Z", () => {
    const rig = createWeekendHero();
    const descendants: THREE.Object3D[] = [];
    rig.head.traverse((child) => descendants.push(child));

    expect(descendants.some((child) => child.name === "hair-cap")).toBe(true);
    expect(descendants.filter((child) => child.name === "hair-fringe").length).toBeGreaterThanOrEqual(
      5,
    );
    expect(descendants.some((child) => child.name === "hair-clip")).toBe(true);
    expect(descendants.some((child) => child.name === "hair-tuft")).toBe(false);
    expect(descendants.filter((child) => child.name === "eye")).toHaveLength(2);
    expect(meshesNamed(rig.head, "face")).toHaveLength(0);

    const cap = descendants.find((child) => child.name === "hair-cap");
    const eye = descendants.find((child) => child.name === "eye");
    const hairBack = descendants.find((child) => child.name === "hair-back");
    expect(cap?.position.y).toBeGreaterThan(0);
    expect(eye?.position.z).toBeLessThan(0);
    expect(hairBack?.position.z).toBeGreaterThan(0);
  });

  it("keeps the glow stick in the right palm when enabled", () => {
    const rig = createWeekendHero({ glowStick: true });
    const geometry = rig.glowStick!.geometry as THREE.CylinderGeometry;

    expect(rig.glowStick).not.toBeNull();
    expect(rig.glowStick?.parent).toBe(rig.rightHand);
    expect(geometry.parameters.radiusTop).toBeCloseTo(GLOW_STICK_RADIUS, 5);
    expect(geometry.parameters.height).toBeCloseTo(GLOW_STICK_HEIGHT, 5);
  });

  it("stands with soles on the ground and a roughly three-head silhouette", () => {
    const rig = createWeekendHero();
    rig.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.group);
    rig.head.geometry.computeBoundingBox();
    const skullHeight = rig.head.geometry.boundingBox?.getSize(new THREE.Vector3()).y ?? 0;

    expect(Math.abs(box.min.y)).toBeLessThan(0.02);
    expect(box.max.y).toBeGreaterThan(1.35);
    expect(box.max.y).toBeLessThan(1.85);
    expect(box.max.y / skullHeight).toBeGreaterThan(2.3);
    expect(box.max.y / skullHeight).toBeLessThan(3.4);
  });

  it("keeps the studio pelvis height when the pose system runs", () => {
    const rig = createWeekendHero();
    applyPersonPose(rig, createPersonPose(), 1);

    expect(rig.pelvis.position.y).toBeCloseTo(0.516, 5);
    expect(rig.pelvis.position.y).not.toBeCloseTo(0.64, 2);
  });

  it("mixes studio hair and clothes for audience members", () => {
    const looks = Array.from({ length: 12 }, (_, index) => mixWeekendAudienceLook(index));
    const hairstyles = new Set(looks.map((look) => look.hairstyle));
    const hoodies = new Set(looks.map((look) => look.colors?.hoodie));

    expect(hairstyles.size).toBeGreaterThan(4);
    expect(hoodies.size).toBeGreaterThan(4);
    expect(looks.every((look) => WEEKEND_HAIRSTYLES.includes(look.hairstyle!))).toBe(true);
    expect(looks.every((look) => look.glowStick)).toBe(true);

    const ponytail = createWeekendHero({ hairstyle: "ponytail" });
    expect(meshesNamed(ponytail.head, "ponytail").length).toBeGreaterThan(0);
    expect(meshesNamed(ponytail.head, "hair-clip")).toHaveLength(0);
  });

  it("lets applyPersonPose rotate the existing arm joints", () => {
    const rig = createWeekendHero();
    const pose = createPersonPose();
    pose.leftShoulderX = Math.PI;
    applyPersonPose(rig, pose, 1);
    rig.group.updateMatrixWorld(true);

    expect(rig.leftShoulder.rotation.x).toBeCloseTo(Math.PI, 5);
    const hand = rig.leftHand.getWorldPosition(new THREE.Vector3());
    const shoulder = rig.leftShoulder.getWorldPosition(new THREE.Vector3());
    expect(hand.y).toBeGreaterThan(shoulder.y);
  });

  it("keeps raise and wiper hands close beside the skull without going through it", () => {
    const rig = createWeekendHero({ glowStick: true });
    const skull = { rx: 0.324, ry: 0.3, rz: 0.276 };

    const armClearance = () => {
      const headCenter = rig.head.getWorldPosition(new THREE.Vector3());
      const shoulder = rig.rightShoulder.getWorldPosition(new THREE.Vector3());
      const elbow = rig.rightElbow.getWorldPosition(new THREE.Vector3());
      const hand = rig.rightHand.getWorldPosition(new THREE.Vector3());
      const points = [shoulder, elbow, hand];
      for (let i = 1; i < 6; i += 1) {
        points.push(shoulder.clone().lerp(elbow, i / 6), elbow.clone().lerp(hand, i / 6));
      }
      const minScore = Math.min(
        ...points.map((point) =>
          Math.hypot(
            (point.x - headCenter.x) / skull.rx,
            (point.y - headCenter.y) / skull.ry,
            (point.z - headCenter.z) / skull.rz,
          ),
        ),
      );
      return { hand, headCenter, minScore };
    };

    const applyArm = (arm: { rightShoulderX: number; rightShoulderY: number; rightShoulderZ: number; rightElbow: number }) => {
      const pose = createPersonPose();
      pose.rightShoulderX = arm.rightShoulderX;
      pose.rightShoulderY = arm.rightShoulderY;
      pose.rightShoulderZ = arm.rightShoulderZ;
      pose.rightElbow = arm.rightElbow;
      applyPersonPose(rig, pose, 1);
      rig.group.updateMatrixWorld(true);
    };

    const raisePose = armPoseFor("raise")!;
    expect(raisePose.rightShoulderX).toBeLessThan(Math.PI);
    applyArm(raisePose);
    const raise = armClearance();
    expect(raise.minScore).toBeGreaterThan(1.08);
    expect(raise.hand.distanceTo(raise.headCenter)).toBeLessThan(0.55);

    for (const phase of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      applyArm(getDynamicArmPose("wiper", phase)!);
      const wiper = armClearance();
      expect(wiper.minScore, `wiper phase ${phase}`).toBeGreaterThan(1.08);
      expect(wiper.hand.distanceTo(wiper.headCenter), `wiper phase ${phase}`).toBeLessThan(0.58);
    }
  });
});
