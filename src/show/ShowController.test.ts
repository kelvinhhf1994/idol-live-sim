import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GENERIC_VENUE } from "../config/venue";
import type { PersonRig } from "../scene/createCharacter";
import type { AudienceKnockbackState } from "./audienceKnockback";
import { getDancePose, ShowController } from "./ShowController";

const noImpact = {
  mode: null,
  x: 0,
  y: 0,
  z: 0,
  movementX: 0,
  movementZ: 0,
  forwardX: 0,
  forwardZ: -1,
} as const;

interface ShowInternals {
  performers: Array<{ rig: PersonRig }>;
  audience: Array<{ rig: PersonRig; knockback: AudienceKnockbackState }>;
}

function internals(show: ShowController): ShowInternals {
  return show as unknown as ShowInternals;
}

describe("getDancePose", () => {
  it("repeats after one four-second phrase", () => {
    expect(getDancePose(0.7, 0)).toEqual(getDancePose(4.7, 0));
  });

  it("adds a small phase offset between idols", () => {
    const first = getDancePose(1, 0);
    const fifth = getDancePose(1, 4);

    expect(fifth.armSwing).not.toBeCloseTo(first.armSwing);
    expect(Math.abs(fifth.bodyBounce - first.bodyBounce)).toBeLessThan(0.2);
  });
});

describe("ShowController audience impacts", () => {
  it("knocks an audience member inside the active forward impact range", () => {
    const performers = Array.from({ length: 5 }, (_, index) => new THREE.Vector3(index, 0, -5));
    const show = new ShowController(
      performers,
      [new THREE.Vector3(0, 0, -0.8)],
      [],
      GENERIC_VENUE,
    );

    show.update(0.016, 0.016, {
      mode: "mosh",
      x: 0,
      y: 0,
      z: 0,
      movementX: 0,
      movementZ: -1,
      forwardX: 0,
      forwardZ: -1,
    });

    expect(show.getAudienceStatus().knockedAudienceCount).toBe(1);
  });
});

describe("ShowController V2 joint animation", () => {
  const performers = Array.from(
    { length: 5 },
    (_, index) => new THREE.Vector3(index - 2, 0.75, -5),
  );
  const audience = Array.from(
    { length: 14 },
    (_, index) => new THREE.Vector3((index % 7) - 3, 0, Math.floor(index / 7)),
  );

  it("keeps five idols and exactly twelve runtime audience rigs", () => {
    const show = new ShowController(performers, audience, [], GENERIC_VENUE);

    expect(internals(show).performers).toHaveLength(5);
    expect(internals(show).audience).toHaveLength(12);
    expect(
      [...internals(show).performers, ...internals(show).audience].every(
        (character) => character.rig.rigVersion === 2,
      ),
    ).toBe(true);
  });

  it("dances idols through shoulders, elbows, hips, knees, and ankles", () => {
    const show = new ShowController(performers, audience, [], GENERIC_VENUE);
    show.update(0.17, 1 / 60, noImpact);
    const rig = internals(show).performers[0].rig;

    expect(Math.abs(rig.leftShoulder.rotation.x)).toBeGreaterThan(0.1);
    expect(rig.leftElbow.rotation.x).toBeGreaterThan(0.1);
    expect(rig.rightElbow.rotation.x).toBeGreaterThan(0.1);
    expect(Math.abs(rig.leftHip.rotation.x)).toBeGreaterThan(0.05);
    expect(rig.leftKnee.rotation.x).toBeLessThan(-0.05);
    expect(Math.abs(rig.leftFootPivot.rotation.x)).toBeGreaterThan(0.03);
    expect(Math.abs(rig.body.rotation.y)).toBeLessThan(0.001);
    expect(Math.abs(rig.pelvis.rotation.y)).toBeGreaterThan(0.01);
  });

  it("gives every audience variant elbow, knee, and ankle motion", () => {
    const show = new ShowController(performers, audience, [], GENERIC_VENUE);
    show.update(0.43, 1 / 60, noImpact);

    for (const member of internals(show).audience) {
      expect(member.rig.leftElbow.rotation.x).toBeGreaterThan(0.05);
      expect(member.rig.rightElbow.rotation.x).toBeGreaterThan(0.05);
      expect(
        Math.abs(member.rig.leftKnee.rotation.x) +
          Math.abs(member.rig.rightKnee.rotation.x),
      ).toBeGreaterThan(0.08);
      expect(
        Math.abs(member.rig.leftFootPivot.rotation.x) +
          Math.abs(member.rig.rightFootPivot.rotation.x),
      ).toBeGreaterThan(0.04);
    }
  });

  it("holds a fixed soft down pose and kneels during get-up", () => {
    const show = new ShowController(performers, audience, [], GENERIC_VENUE);
    show.triggerAudienceKnockback("mosh");
    const member = internals(show).audience[0];
    member.knockback.phase = "down";
    member.knockback.elapsed = 0.4;
    member.knockback.phaseElapsed = 0.2;
    show.update(0, 0, noImpact);
    const first = [
      member.rig.leftShoulder.rotation.x,
      member.rig.rightElbow.rotation.x,
      member.rig.leftHip.rotation.x,
      member.rig.rightKnee.rotation.x,
    ];

    member.knockback.elapsed = 1.2;
    show.update(1, 0, noImpact);
    expect([
      member.rig.leftShoulder.rotation.x,
      member.rig.rightElbow.rotation.x,
      member.rig.leftHip.rotation.x,
      member.rig.rightKnee.rotation.x,
    ]).toEqual(first);

    member.knockback.phase = "getting-up";
    member.knockback.phaseElapsed = 0.15;
    show.update(1.1, 0, noImpact);
    expect(member.rig.leftKnee.rotation.x).toBeLessThan(-0.7);
    expect(member.rig.rightKnee.rotation.x).toBeLessThan(-0.7);
    expect(Math.abs(member.rig.body.rotation.x)).toBeLessThan(0.01);
  });

  it("returns with bent-knee running and restores the exact home show pose", () => {
    const show = new ShowController(performers, audience, [], GENERIC_VENUE);
    const fresh = new ShowController(performers, audience, [], GENERIC_VENUE);
    show.triggerAudienceKnockback("lift");
    const member = internals(show).audience[0];
    member.knockback.phase = "returning";
    member.knockback.x = member.knockback.homeX + 1;
    member.knockback.z = member.knockback.homeZ;
    member.knockback.phaseElapsed = 0.2;
    show.update(0.5, 1 / 60, noImpact);
    expect(member.rig.leftKnee.rotation.x).toBeLessThan(-0.05);
    expect(member.rig.rightKnee.rotation.x).toBeLessThan(-0.05);
    expect(member.rig.chest.rotation.x).toBeLessThan(-0.05);

    member.knockback.phase = "home";
    show.update(1, 0, noImpact);
    fresh.update(1, 0, noImpact);
    const restored = member.rig;
    const expected = internals(fresh).audience[0].rig;
    expect(restored.leftShoulder.rotation.toArray()).toEqual(
      expected.leftShoulder.rotation.toArray(),
    );
    expect(restored.rightElbow.rotation.toArray()).toEqual(
      expected.rightElbow.rotation.toArray(),
    );
    expect(restored.leftKnee.rotation.toArray()).toEqual(
      expected.leftKnee.rotation.toArray(),
    );
    expect(restored.chest.rotation.toArray()).toEqual(expected.chest.rotation.toArray());
  });
});

describe("ShowController performer impacts", () => {
  const performerPoints = [
    new THREE.Vector3(0, 0.75, -0.8),
    new THREE.Vector3(2, 0.75, -3),
    new THREE.Vector3(3, 0.75, -3),
    new THREE.Vector3(4, 0.75, -3),
    new THREE.Vector3(-4, 0.75, -3),
  ];
  const impact = {
    mode: "mosh" as const,
    x: 0,
    y: 0.75,
    z: 0,
    movementX: 0,
    movementZ: -1,
    forwardX: 0,
    forwardZ: -1,
  };

  it("lets mosh and lift hit performers, with a stronger lift impulse", () => {
    const moshShow = new ShowController(performerPoints, [], [], GENERIC_VENUE);
    const liftShow = new ShowController(performerPoints, [], [], GENERIC_VENUE);

    moshShow.update(0.1, 0.1, impact);
    liftShow.update(0.1, 0.1, { ...impact, mode: "lift" });

    const mosh = moshShow.getPerformerStatus().firstActivePerformer;
    const lift = liftShow.getPerformerStatus().firstActivePerformer;
    expect(moshShow.getPerformerStatus().knockedPerformerCount).toBe(1);
    expect(liftShow.getPerformerStatus().knockedPerformerCount).toBe(1);
    expect(Math.abs((lift?.z ?? 0) + 0.8)).toBeGreaterThan(Math.abs((mosh?.z ?? 0) + 0.8));
    expect(lift?.y).toBeGreaterThan(mosh?.y ?? 0);
  });

  it("does not hit performers without a mosh or lift impact mode", () => {
    const show = new ShowController(performerPoints, [], [], GENERIC_VENUE);

    show.update(0.1, 0.1, { ...impact, mode: null });

    expect(show.getPerformerStatus().knockedPerformerCount).toBe(0);
  });

  it("returns a performer exactly home before allowing another hit", () => {
    const show = new ShowController(performerPoints, [], [], GENERIC_VENUE);
    expect(show.triggerPerformerKnockback("lift")).toBe(true);
    expect(show.triggerPerformerKnockback("mosh")).toBe(true);

    for (let frame = 0; frame < 600; frame += 1) {
      show.update(frame / 60, 1 / 60, { ...impact, mode: null });
    }

    expect(show.getPerformerStatus().knockedPerformerCount).toBe(0);
    expect(show.getPerformerStatus().returningPerformerCount).toBe(0);
    expect(show.triggerPerformerKnockback("mosh")).toBe(true);
  });
});
