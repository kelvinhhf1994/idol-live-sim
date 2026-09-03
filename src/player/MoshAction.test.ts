import { describe, expect, it } from "vitest";
import {
  createMoshJointPose,
  MoshAction,
  writeMoshJointPose,
} from "./MoshAction";

describe("MoshAction", () => {
  it("advances through one 0.65 second windmill cycle after a tap", () => {
    const action = new MoshAction();

    action.start();
    action.release();
    action.update(0.1625);
    expect(action.progress).toBeCloseTo(0.25);

    action.update(0.4874);
    expect(action.isActive).toBe(true);

    action.update(0.0002);
    expect(action.isActive).toBe(false);
  });

  it("continues across multiple cycles while held", () => {
    const action = new MoshAction();

    action.start();
    action.update(1.4625);

    expect(action.isActive).toBe(true);
    expect(action.isHeld).toBe(true);
    expect(action.progress).toBeCloseTo(0.25);
  });

  it("keeps held true and advances unwrapped windmill turns across 2–3 cycles", () => {
    const action = new MoshAction();
    action.start();

    action.update(0.65);
    expect(action.isActive).toBe(true);
    expect(action.isHeld).toBe(true);
    expect(action.windmillTurns).toBeCloseTo(1, 5);

    action.update(0.65);
    expect(action.isActive).toBe(true);
    expect(action.isHeld).toBe(true);
    expect(action.windmillTurns).toBeCloseTo(2, 5);

    action.update(0.325);
    expect(action.isActive).toBe(true);
    expect(action.isHeld).toBe(true);
    expect(action.windmillTurns).toBeCloseTo(2.5, 5);

    const mid = createMoshJointPose();
    const later = createMoshJointPose();
    writeMoshJointPose(action.windmillTurns, mid);
    action.update(0.2);
    writeMoshJointPose(action.windmillTurns, later);
    expect(later.leftShoulderX).toBeLessThan(mid.leftShoulderX - 0.5);

    action.release();
    expect(action.isHeld).toBe(false);
    expect(action.isActive).toBe(true);
    action.update(0.5);
    expect(action.isActive).toBe(false);
  });

  it("finishes the current cycle after release", () => {
    const action = new MoshAction();

    action.start();
    action.update(0.8);
    action.release();
    action.update(0.49);
    expect(action.isActive).toBe(true);

    action.update(0.02);
    expect(action.isActive).toBe(false);
  });

  it("stops immediately when cancelled by another action", () => {
    const action = new MoshAction();

    action.start();
    action.cancel();

    expect(action.isActive).toBe(false);
    expect(action.progress).toBe(0);
  });

  it("freezes a deterministic DEV visual phase", () => {
    const action = new MoshAction();

    action.debugSetProgress(0.375);
    action.update(1);

    expect(action.isActive).toBe(true);
    expect(action.progress).toBeCloseTo(0.375);
  });
});

describe("writeMoshJointPose", () => {
  it("moves from overhead into a forward strike with elbow extension", () => {
    const overhead = createMoshJointPose();
    const strike = createMoshJointPose();

    writeMoshJointPose(0, overhead);
    writeMoshJointPose(0.25, strike);

    expect(overhead.leftShoulderX).toBeCloseTo(Math.PI, 5);
    expect(overhead.leftElbow).toBeGreaterThan(0.7);
    expect(strike.leftShoulderX).toBeCloseTo(Math.PI / 2, 5);
    expect(strike.leftElbow).toBeLessThan(0.35);
  });

  it("keeps the arms half a cycle apart with outward shoulder abduction", () => {
    const first = createMoshJointPose();
    const mirrored = createMoshJointPose();

    for (const phase of [0, 0.125, 0.25, 0.375]) {
      writeMoshJointPose(phase, first);
      writeMoshJointPose(phase + 0.5, mirrored);
      expect(wrappedDelta(mirrored.leftShoulderX, first.rightShoulderX)).toBeCloseTo(0, 5);
      expect(wrappedDelta(mirrored.rightShoulderX, first.leftShoulderX)).toBeCloseTo(0, 5);
      expect(mirrored.leftElbow).toBeCloseTo(first.rightElbow);
      expect(mirrored.rightElbow).toBeCloseTo(first.leftElbow);
    }

    expect(first.leftShoulderZ).toBeLessThan(0);
    expect(first.rightShoulderZ).toBeGreaterThan(0);
  });

  it("sweeps a continuous windmill through overhead and forward, not a forward-back swing", () => {
    const samples = Array.from({ length: 17 }, (_, index) => {
      const pose = createMoshJointPose();
      writeMoshJointPose(index / 16, pose);
      return pose.leftShoulderX;
    });

    for (let index = 1; index < samples.length - 1; index += 1) {
      expect(samples[index]).toBeLessThan(samples[index - 1] - 0.2);
    }

    expect(samples[0]).toBeGreaterThan(2.8);
    expect(samples[4]).toBeCloseTo(Math.PI / 2, 1);
    expect(Math.min(...samples.slice(0, -1))).toBeLessThan(-1.4);
    expect(samples[0] - samples[8]).toBeCloseTo(Math.PI, 5);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(5);

    const right = createMoshJointPose();
    writeMoshJointPose(0, right);
    expect(right.rightShoulderX - samples[0]).toBeCloseTo(Math.PI, 5);
  });
});

function wrappedDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
