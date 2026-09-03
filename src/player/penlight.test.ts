import { describe, expect, it } from "vitest";
import {
  armPoseFor,
  beatPulse,
  DEFAULT_PENLIGHT_STATE,
  getDynamicArmPose,
  getDynamicStickPose,
  getPenlightColor,
  handlePenlightColorSelect,
  loadPenlightState,
  normalizePenlightState,
  PENLIGHT_COLORS,
  PENLIGHT_STICK_POINT,
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

  it("thrusts the beat arm forward then bounces back on the pulse envelope", () => {
    expect(beatPulse(0)).toBeCloseTo(0, 5);
    expect(beatPulse(0.28)).toBeCloseTo(1, 5);
    expect(beatPulse(1)).toBeCloseTo(0, 5);

    const cocked = getDynamicArmPose("beat", 0)!;
    const peak = getDynamicArmPose("beat", 0.28)!;
    expect(peak.rightShoulderX).toBeGreaterThan(cocked.rightShoulderX);
    expect(peak.rightElbow).toBeLessThan(cocked.rightElbow);
    expect(peak.rightShoulderY).toBeCloseTo(0.04, 5);
    expect(peak.rightShoulderZ).toBeCloseTo(-0.08, 5);

    const stick = getDynamicStickPose("beat", 0.28);
    expect(stick.rotation.x).toBeCloseTo(PENLIGHT_STICK_POINT.rotation.x + 0.15, 5);
    expect(stickPoseFor("beat")).toEqual(PENLIGHT_STICK_POINT);
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
