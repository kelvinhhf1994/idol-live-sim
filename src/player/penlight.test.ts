import { describe, expect, it } from "vitest";
import {
  armPoseFor,
  BEAT_ARM_READY,
  BEAT_ARM_THRUST,
  BEAT_ATTACK,
  BEAT_HOLD,
  BEAT_RETRACT_END,
  BEAT_ANGLE_VERTICAL,
  BEAT_ANGLE_PEAK,
  BEAT_ANGLE_RETRACT,
  beatPitchOffsetForDeg,
  beatPulse,
  getBeatStickAngleDeg,
  DEFAULT_PENLIGHT_STATE,
  getDynamicArmPose,
  getDynamicStickPose,
  getPenlightColor,
  handlePenlightColorSelect,
  loadPenlightState,
  normalizePenlightState,
  PENLIGHT_COLORS,
  PENLIGHT_STICK_RAISE,
  PENLIGHT_STORAGE_KEY,
  savePenlightState,
  stickPoseFor,
} from "./penlight";

function memoryStorage(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return {
    getItem: (key: string) => (key in data ? data[key]! : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    data,
  };
}

describe("penlight", () => {
  it("exposes twelve curated idol-live colors", () => {
    expect(PENLIGHT_COLORS).toHaveLength(12);
    expect(new Set(PENLIGHT_COLORS.map((color) => color.id)).size).toBe(12);
  });

  it("resolves color hex values for known ids", () => {
    expect(getPenlightColor("aqua").hex).toBe(0x3ad7ff);
    expect(getPenlightColor("missing").id).toBe(DEFAULT_PENLIGHT_STATE.colorId);
  });

  it("tilts the raised stick left and aims the point stick along the forearm", () => {
    const idle = stickPoseFor("idle");
    const raise = stickPoseFor("raise");
    const point = stickPoseFor("point");
    // Raise flips the bottom-pivoted shaft (~π) so the tip can lean upper-left.
    expect(Math.abs(raise.rotation.x)).toBeGreaterThan(2.5);
    expect(raise.rotation.z).toBeGreaterThan(idle.rotation.z);
    // Point stick flips (~π) so the tip tracks the 45°-elevated forearm.
    expect(Math.abs(point.rotation.x)).toBeCloseTo(Math.PI, 5);
  });

  it("provides distinct raise and stage-point arm poses", () => {
    const raise = armPoseFor("raise");
    const point = armPoseFor("point");
    expect(raise).not.toBeNull();
    expect(point).not.toBeNull();
    // Raise: hang (-Y) rotated by π on X → straight world +Y, no leftward lean.
    expect(raise!.rightShoulderX).toBeCloseTo(Math.PI, 5);
    expect(raise!.rightShoulderY).toBeCloseTo(0, 5);
    expect(raise!.rightShoulderZ).toBeCloseTo(0, 5);
    expect(raise!.rightElbow).toBeCloseTo(0, 5);
    // Point: horizontal forward (π/2) + 45° elevation → 3π/4, no side lean.
    expect(point!.rightShoulderX).toBeCloseTo((Math.PI * 3) / 4, 5);
    expect(point!.rightShoulderY).toBeCloseTo(0, 5);
    expect(point!.rightShoulderZ).toBeCloseTo(0, 5);
    expect(point!.rightElbow).toBeCloseTo(0, 5);
    expect(armPoseFor("idle")).toBeNull();
  });

  it("sweeps the wiper arm left-right from an overhead pivot", () => {
    const left = getDynamicArmPose("wiper", -Math.PI / 2)!;
    const right = getDynamicArmPose("wiper", Math.PI / 2)!;
    const mid = getDynamicArmPose("wiper", 0)!;
    expect(mid.rightShoulderX).toBeCloseTo(2.85, 5);
    expect(left.rightShoulderZ).toBeLessThan(mid.rightShoulderZ);
    expect(right.rightShoulderZ).toBeGreaterThan(mid.rightShoulderZ);
    expect(armPoseFor("wiper")!.rightShoulderZ).toBeCloseTo(mid.rightShoulderZ, 5);

    const stick = getDynamicStickPose("wiper", Math.PI / 2);
    expect(stick.rotation.z).toBeCloseTo(PENLIGHT_STICK_RAISE.rotation.z + 0.15, 5);
  });

  it("beats with fast-forward, brief peak hold, then slow-return envelope", () => {
    expect(beatPulse(0)).toBeCloseTo(0, 5);
    // Peak at the end of the sharp attack window.
    expect(beatPulse(BEAT_ATTACK)).toBeCloseTo(1, 5);
    // Hold plateau keeps full extension ("稍為停一下").
    expect(beatPulse(BEAT_ATTACK + BEAT_HOLD * 0.5)).toBeCloseTo(1, 5);
    // Mid-return (midpoint of 0.30 to 0.85 retract is 0.575) smoothly reaches half extension.
    expect(beatPulse(0.575)).toBeCloseTo(0.5, 5);
    expect(beatPulse(0.95)).toBeLessThan(0.05);
    expect(beatPulse(1)).toBeCloseTo(0, 5);
    // Snappy attack reaches near-peak early in the snap window.
    expect(beatPulse(BEAT_ATTACK * 0.75)).toBeGreaterThan(0.85);
  });

  it("animates the stick trajectory: vertical 90° -> forward 45° -> retract to 100°", () => {
    // First strike: starts vertical 90°.
    expect(getBeatStickAngleDeg(0, true, false)).toBeCloseTo(BEAT_ANGLE_VERTICAL, 5);
    // Peak thrust: reaches forward 45°.
    expect(getBeatStickAngleDeg(BEAT_ATTACK, true, false)).toBeCloseTo(BEAT_ANGLE_PEAK, 5);
    // Peak hold window: maintains 45°.
    expect(getBeatStickAngleDeg(BEAT_ATTACK + BEAT_HOLD * 0.5, true, false)).toBeCloseTo(BEAT_ANGLE_PEAK, 5);
    // Retract window: smoothly reaches 100° at BEAT_RETRACT_END (~0.85).
    expect(getBeatStickAngleDeg(BEAT_RETRACT_END, true, false)).toBeCloseTo(BEAT_ANGLE_RETRACT, 5);
    // Released single tap: smoothly returns to vertical 90° at phase 1.0.
    expect(getBeatStickAngleDeg(1.0, true, false)).toBeCloseTo(BEAT_ANGLE_VERTICAL, 5);

    // Repeated beats while held: strike from 100° cocked position to 45° and back to 100°.
    expect(getBeatStickAngleDeg(0, false, true)).toBeCloseTo(BEAT_ANGLE_RETRACT, 5);
    expect(getBeatStickAngleDeg(BEAT_ATTACK, false, true)).toBeCloseTo(BEAT_ANGLE_PEAK, 5);
    expect(getBeatStickAngleDeg(BEAT_RETRACT_END, false, true)).toBeCloseTo(BEAT_ANGLE_RETRACT, 5);
    expect(getBeatStickAngleDeg(1.0, false, true)).toBeCloseTo(BEAT_ANGLE_RETRACT, 5);

    // Pitch offsets in character space (forward is -Z):
    expect(beatPitchOffsetForDeg(90)).toBeCloseTo(0, 5);
    expect(beatPitchOffsetForDeg(45)).toBeCloseTo(-Math.PI / 4, 5);
    expect(beatPitchOffsetForDeg(100)).toBeCloseTo((10 * Math.PI) / 180, 5);
  });

  it("beats the stick at chest with a dropped upper arm and deep elbow fold", () => {
    const ready = getDynamicArmPose("beat", 0)!;
    const peak = getDynamicArmPose("beat", BEAT_ATTACK)!;

    // Upper arm stays down (not raised overhead / above π/2).
    expect(ready.rightShoulderX).toBeLessThan(Math.PI / 2);
    expect(peak.rightShoulderX).toBeLessThan(Math.PI / 2);
    expect(ready.rightShoulderX).toBeCloseTo(BEAT_ARM_READY.rightShoulderX, 5);
    expect(peak.rightShoulderX).toBeCloseTo(
      BEAT_ARM_READY.rightShoulderX + BEAT_ARM_THRUST.rightShoulderX,
      5,
    );
    expect(ready.rightShoulderY).toBeCloseTo(BEAT_ARM_READY.rightShoulderY, 5);
    expect(peak.rightShoulderY).toBeCloseTo(BEAT_ARM_READY.rightShoulderY, 5);
    // Elbows stay planted beside the ribs ("固定手肘").
    expect(ready.rightShoulderZ).toBeCloseTo(BEAT_ARM_READY.rightShoulderZ, 5);
    expect(peak.rightShoulderZ).toBeCloseTo(BEAT_ARM_READY.rightShoulderZ, 5);
    // Deep elbow fold (> right angle) keeps the stick in front of the chest;
    // strike opens the forearm forward then slowly folds back.
    expect(ready.rightElbow).toBeGreaterThan(Math.PI / 2);
    expect(ready.rightElbow).toBeCloseTo(BEAT_ARM_READY.rightElbow, 5);
    expect(peak.rightElbow).toBeCloseTo(BEAT_ARM_THRUST.rightElbow, 5);
    expect(peak.rightElbow).toBeLessThan(ready.rightElbow);

    const stickReady = getDynamicStickPose("beat", 0, true, false);
    const stickPeak = getDynamicStickPose("beat", BEAT_ATTACK, true, false);
    const stickRetract = getDynamicStickPose("beat", BEAT_RETRACT_END, true, false);

    // Rest: shaft vertical 90° (character-space pitch offset = 0).
    expect(stickReady.rotation.x).toBeCloseTo(
      -(ready.rightShoulderX + ready.rightElbow),
      5,
    );
    // Peak: shaft tips forward 45° (character-space pitch offset = -π/4).
    expect(stickPeak.rotation.x).toBeCloseTo(
      -(peak.rightShoulderX + peak.rightElbow) - Math.PI / 4,
      5,
    );
    // Retract: shaft tilts back to 100° (character-space pitch offset = +10°).
    expect(stickRetract.rotation.x).toBeCloseTo(
      -(ready.rightShoulderX + ready.rightElbow) + (10 * Math.PI) / 180,
      5,
    );
    expect(stickPoseFor("beat")).toEqual(stickReady);
  });

  it("persists color and pose to storage", () => {
    const storage = memoryStorage();
    const saved = savePenlightState({ colorId: "emerald", pose: "raise" }, storage);
    expect(saved).toEqual({ colorId: "emerald", pose: "raise" });
    expect(JSON.parse(storage.data[PENLIGHT_STORAGE_KEY]!)).toEqual(saved);
    expect(loadPenlightState(storage)).toEqual(saved);

    const wiper = savePenlightState({ colorId: "aqua", pose: "wiper" }, storage);
    expect(wiper.pose).toBe("wiper");
    expect(loadPenlightState(storage).pose).toBe("wiper");
  });

  it("migrates legacy grip=point and rejects corrupt payloads", () => {
    expect(normalizePenlightState({ colorId: "blue", grip: "point" })).toEqual({
      colorId: "blue",
      pose: "point",
    });
    const storage = memoryStorage({ [PENLIGHT_STORAGE_KEY]: "{not-json" });
    expect(loadPenlightState(storage)).toEqual(DEFAULT_PENLIGHT_STATE);
  });

  it("hides the penlight panel after a color swatch is selected", () => {
    const panel = { hidden: false };
    let appliedColor = "";
    let persisted = false;
    let synced = false;

    handlePenlightColorSelect({
      apply: () => {
        appliedColor = "aqua";
      },
      persist: () => {
        persisted = true;
      },
      sync: () => {
        synced = true;
      },
      dismiss: () => {
        panel.hidden = true;
      },
    });

    expect(appliedColor).toBe("aqua");
    expect(persisted).toBe(true);
    expect(synced).toBe(true);
    expect(panel.hidden).toBe(true);
  });
});
