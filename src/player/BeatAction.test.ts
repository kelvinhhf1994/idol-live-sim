import { describe, expect, it } from "vitest";
import { BeatAction, BEAT_CYCLE_RATE } from "./BeatAction";
import { BEAT_ATTACK, BEAT_HOLD, beatPulse } from "./penlight";

describe("BeatAction", () => {
  it("drives a fast-attack hold-then-slow-return pulse on the first strike", () => {
    const action = new BeatAction();
    action.start();
    // Default speed 1 → phase rate BEAT_CYCLE_RATE; attack peak at BEAT_ATTACK / BEAT_CYCLE_RATE seconds.
    action.update(BEAT_ATTACK / BEAT_CYCLE_RATE, 1);
    expect(action.phase).toBeCloseTo(BEAT_ATTACK, 2);
    expect(beatPulse(action.phase)).toBeCloseTo(1, 1);
    // Still at peak through the brief hold window.
    action.update(BEAT_HOLD / BEAT_CYCLE_RATE, 1);
    expect(beatPulse(action.phase)).toBeCloseTo(1, 1);
    // Later in the retract window, phase 0.575 reaches the exact half-return point.
    action.update((0.575 - action.phase) / BEAT_CYCLE_RATE, 1);
    expect(action.phase).toBeCloseTo(0.575, 2);
    expect(beatPulse(action.phase)).toBeCloseTo(0.5, 1);
  });

  it("plays one tap cycle then stops after release", () => {
    const action = new BeatAction();
    action.start();
    expect(action.isActive).toBe(true);
    expect(action.isHeld).toBe(true);

    action.release();
    expect(action.isHeld).toBe(false);
    expect(action.isActive).toBe(true);

    const cycleDuration = 1 / BEAT_CYCLE_RATE;
    action.update(cycleDuration - 0.02, 1);
    expect(action.isActive).toBe(true);
    action.update(0.04, 1);
    expect(action.isActive).toBe(false);
    expect(action.phase).toBe(0);
  });

  it("keeps repeating while held and tracks first vs subsequent cycles", () => {
    const action = new BeatAction();
    action.start();
    expect(action.isFirstCycle).toBe(true);

    action.update(0.6, 1);
    expect(action.isActive).toBe(true);
    expect(action.isHeld).toBe(true);
    expect(action.isFirstCycle).toBe(true);
    expect(action.phase).toBeGreaterThan(0);
    expect(action.phase).toBeLessThan(1);

    // Cross into cycle 2
    action.update(0.6, 1);
    expect(action.isActive).toBe(true);
    expect(action.isFirstCycle).toBe(false);
  });

  it("scales cycle rate with beatSpeed", () => {
    const slow = new BeatAction();
    const fast = new BeatAction();
    slow.start();
    fast.start();

    slow.update(0.1, 0.5);
    fast.update(0.1, 2.5);
    expect(fast.phase).toBeGreaterThan(slow.phase);
  });

  it("cancel clears immediately", () => {
    const action = new BeatAction();
    action.start();
    action.update(0.1, 1);
    action.cancel();
    expect(action.isActive).toBe(false);
    expect(action.isHeld).toBe(false);
    expect(action.phase).toBe(0);
  });
});
