import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GENERIC_VENUE, NGAU_TAU_KOK_VENUE } from "../config/venue";
import type { DanceClip } from "../animation/capturedDance";
import type { PersonRig } from "../scene/createCharacter";
import type { AudienceKnockbackState } from "./audienceKnockback";
import { ShowController } from "./ShowController";

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
  performers: Array<{ rig: PersonRig; knockback: AudienceKnockbackState }>;
  audience: Array<{ rig: PersonRig; knockback: AudienceKnockbackState }>;
}

function internals(show: ShowController): ShowInternals {
  return show as unknown as ShowInternals;
}

describe("ShowController decorative prop impacts", () => {
  const performerLine = { y: 0, z: -8, spacing: 1 };

  it("knocks a decorative dummy inside the active lift impact range", () => {
    const prop = new THREE.Group();
    prop.position.set(0, 0, -0.8);
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE, [prop]);

    show.update(0.016, 0.016, {
      mode: "lift",
      x: 0,
      y: 0,
      z: 0,
      movementX: 0,
      movementZ: -1,
      forwardX: 0,
      forwardZ: -1,
    });

    expect(show.getPropStatus().knockedPropCount).toBe(1);
    expect(prop.position.z).not.toBeCloseTo(-0.8);
  });

  it("does not knock a decorative dummy outside the impact range", () => {
    const prop = new THREE.Group();
    prop.position.set(8, 0, 8);
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE, [prop]);

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

    expect(show.getPropStatus().knockedPropCount).toBe(0);
    expect(prop.position.z).toBeCloseTo(8);
  });
});

describe("ShowController audience impacts", () => {
  it("knocks an audience member inside the active forward impact range", () => {
    const show = new ShowController(
      { y: 0, z: -5, spacing: 1 },
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
  const performers = { y: 0.75, z: -5, spacing: 1.45 };
  const audience = Array.from(
    { length: 14 },
    (_, index) => new THREE.Vector3((index % 7) - 3, 0, Math.floor(index / 7)),
  );

  it("keeps twelve idols and exactly twelve runtime audience rigs", () => {
    const show = new ShowController(performers, audience, [], GENERIC_VENUE);

    expect(internals(show).performers).toHaveLength(12);
    expect(show.getPerformerCount()).toBe(12);
    expect(internals(show).audience).toHaveLength(12);
    expect(
      [...internals(show).performers, ...internals(show).audience].every(
        (character) => character.rig.rigVersion === 2,
      ),
    ).toBe(true);
    expect(
      internals(show).audience.every((member) =>
        member.rig.group.getObjectByName("hoodie"),
      ),
    ).toBe(true);
    expect(
      internals(show).audience.every((member) => member.rig.glowStick !== null),
    ).toBe(true);
    const audienceHair = new Set(
      internals(show).audience.map((member) => {
        if (member.rig.head.getObjectByName("ponytail")) return "ponytail";
        if (member.rig.head.getObjectByName("hair-bun")) return "double-bun";
        if (member.rig.head.getObjectByName("hair-tuft")) return "tuft";
        if (member.rig.head.getObjectByName("curl")) return "curly";
        if (member.rig.head.getObjectByName("hair-clip")) return "bob-or-long";
        return "other";
      }),
    );
    expect(audienceHair.size).toBeGreaterThan(3);
  });

  it("keeps idols facing the audience in every live house", () => {
    const lines = [
      GENERIC_VENUE.show.performerLine,
      NGAU_TAU_KOK_VENUE.show.performerLine,
    ];

    for (const line of lines) {
      const show = new ShowController(line, [], [], GENERIC_VENUE);
      show.setPerformerCount(12);
      for (const elapsed of [0.17, 6, 14]) {
        show.update(elapsed, 1 / 60, noImpact);

        for (const member of internals(show).performers) {
          const rig = member.rig;
          expect(rig.group.rotation.y).toBeCloseTo(0, 5);
          expect(rig.body.rotation.y).toBeCloseTo(0, 5);
          rig.group.updateMatrixWorld(true);
          const eye = rig.head.getObjectByName("eye");
          expect(eye).toBeDefined();
          const headWorld = rig.head.getWorldPosition(new THREE.Vector3());
          const eyeWorld = eye!.getWorldPosition(new THREE.Vector3());
          expect(eyeWorld.z - headWorld.z).toBeGreaterThan(0.04);
          expect(headWorld.z).toBeLessThan(0);
        }
      }
    }
  });

  it("dances idols through shoulders, elbows, hips, knees, and ankles", () => {
    const show = new ShowController(performers, audience, [], GENERIC_VENUE);
    show.update(0.17, 1 / 60, noImpact);
    const rig = internals(show).performers[0].rig;

    expect(rig.leftShoulder.rotation.x).toBeLessThan(-0.1);
    expect(rig.leftElbow.rotation.x).toBeLessThan(-0.1);
    expect(rig.rightElbow.rotation.x).toBeLessThan(0);
    expect(Math.abs(rig.leftHip.rotation.x)).toBeGreaterThan(0.05);
    expect(rig.leftKnee.rotation.x).toBeGreaterThan(0.05);
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
  // A one-idol line parks the only performer at stage centre, inside the impact cone.
  const performerLine = { y: 0.75, z: -0.8, spacing: 1.45 };
  const oneIdol = 1;
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
    const moshShow = new ShowController(performerLine, [], [], GENERIC_VENUE, [], oneIdol);
    const liftShow = new ShowController(performerLine, [], [], GENERIC_VENUE, [], oneIdol);

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
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE, [], oneIdol);

    show.update(0.1, 0.1, { ...impact, mode: null });

    expect(show.getPerformerStatus().knockedPerformerCount).toBe(0);
  });

  it("returns a performer exactly home before allowing another hit", () => {
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE, [], 5);
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

describe("ShowController idol line-up size", () => {
  const performerLine = { y: 0.75, z: -12, spacing: 1.45 };

  it("hides the members beyond the chosen count and re-centres the rest", () => {
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE);

    show.setPerformerCount(3);

    const performers = internals(show).performers;
    expect(show.getPerformerCount()).toBe(3);
    expect(performers.map((performer) => performer.rig.group.visible)).toEqual([
      true,
      true,
      true,
      ...Array.from({ length: 9 }, () => false),
    ]);
    const xs = performers.slice(0, 3).map((performer) => performer.rig.group.position.x);
    expect(xs).toEqual([-1.45, 0, 1.45]);
  });

  it("clamps the count to a single idol at minimum and the full roster at maximum", () => {
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE);

    show.setPerformerCount(0);
    expect(show.getPerformerCount()).toBe(1);
    expect(internals(show).performers[0].rig.group.position.x).toBe(0);

    show.setPerformerCount(99);
    expect(show.getPerformerCount()).toBe(12);
  });

  it("leaves hidden members out of dancing and knockback", () => {
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE, [], 2);
    const hidden = internals(show).performers[6];

    for (let count = 0; count < 12; count += 1) {
      expect(show.triggerPerformerKnockback("mosh")).toBe(count < 2);
    }
    show.update(0.17, 1 / 60, noImpact);
    expect(hidden.knockback.phase).toBe("home");
    expect(hidden.rig.leftElbow.rotation.x).toBe(0);
  });
});

describe("ShowController song performance", () => {
  const performerLine = { y: 0.75, z: -8, spacing: 0.95 };
  const clip: DanceClip = {
    schemaVersion: 1,
    duration: 1,
    targetRig: "person-rig-chibi-idol",
    captureMode: "front-facing-2d",
    rootMotionMode: "in-place",
    timestamps: [0, 0.5, 1],
    poses: [
      { leftShoulderX: 0.2, rightShoulderX: 0.2, leftElbow: 0.4, bodyPositionX: 0 },
      { leftShoulderX: 1.5, rightShoulderX: 0.3, leftElbow: 1.2, bodyPositionX: 0.1 },
      { leftShoulderX: 0.2, rightShoulderX: 0.2, leftElbow: 0.4, bodyPositionX: 0 },
    ],
  };

  it("plays the captured clip for all on-stage idols without stagger", () => {
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE, [], 3);
    show.setPerformance({ clip, time: 0.25, loop: true });
    show.update(99, 1 / 60, noImpact);

    const [a, b] = internals(show).performers;
    expect(a.rig.leftShoulder.rotation.x).toBeCloseTo(b.rig.leftShoulder.rotation.x, 5);
    expect(a.rig.leftShoulder.rotation.x).toBeLessThan(-0.6);
  });

  it("freezes on the song time while paused (still captured, not procedural)", () => {
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE, [], 1);
    show.setPerformance({ clip, time: 0.25, loop: true });
    show.update(0, 1 / 60, noImpact);
    const frozen = internals(show).performers[0].rig.leftShoulder.rotation.x;

    show.setPerformance({ clip, time: 0.25, loop: true });
    show.update(10, 1 / 60, noImpact);
    expect(internals(show).performers[0].rig.leftShoulder.rotation.x).toBeCloseTo(frozen, 5);
  });

  it("returns to procedural dance after clearing performance", () => {
    const show = new ShowController(performerLine, [], [], GENERIC_VENUE, [], 1);
    show.setPerformance({ clip, time: 0.25, loop: true });
    show.update(0, 1 / 60, noImpact);
    const captured = internals(show).performers[0].rig.leftShoulder.rotation.x;

    show.setPerformance(null);
    show.update(0.17, 1 / 60, noImpact);
    expect(internals(show).performers[0].rig.leftShoulder.rotation.x).not.toBeCloseTo(
      captured,
      2,
    );
  });
});
