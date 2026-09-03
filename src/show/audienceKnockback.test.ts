import { describe, expect, it } from "vitest";
import {
  createAudienceKnockbackState,
  stepAudienceKnockback,
  tryHitAudience,
} from "./audienceKnockback";

const bounds = { minX: -9, maxX: 9, minZ: -16, maxZ: 22 };

describe("audience knockback", () => {
  it("uses a stronger lift impulse than mosh", () => {
    const mosh = createAudienceKnockbackState(0, 0, 0);
    const lift = createAudienceKnockbackState(1, 0, 0);

    tryHitAudience(mosh, "mosh", 0, -1, 0, -1);
    tryHitAudience(lift, "lift", 0, -1, 0, -1);

    expect(Math.hypot(lift.vx, lift.vz)).toBeGreaterThan(Math.hypot(mosh.vx, mosh.vz));
    expect(lift.vy).toBeGreaterThan(mosh.vy);
    expect(mosh.vz).toBeLessThan(0);
  });

  it("falls under gravity and lands without crossing venue bounds", () => {
    const state = createAudienceKnockbackState(0, 0, -15.8);
    tryHitAudience(state, "lift", 0, -1, 0, -1);
    const initialVy = state.vy;

    stepAudienceKnockback(state, 0.1, bounds);
    expect(state.vy).toBeLessThan(initialVy);

    for (let frame = 0; frame < 120; frame += 1) {
      stepAudienceKnockback(state, 1 / 60, bounds);
    }
    expect(state.y).toBe(0);
    expect(state.z).toBeGreaterThanOrEqual(bounds.minZ);
  });

  it("starts getting up about two seconds after a hit", () => {
    const state = createAudienceKnockbackState(0, 0, 0);
    tryHitAudience(state, "mosh", 1, 0, 0, -1);

    for (let frame = 0; frame < 121; frame += 1) {
      stepAudienceKnockback(state, 1 / 60, bounds);
    }

    expect(state.phase).toBe("getting-up");
  });

  it("returns home and becomes hittable again", () => {
    const state = createAudienceKnockbackState(0, 1, 2);
    tryHitAudience(state, "lift", -1, 0, 0, -1);

    for (let frame = 0; frame < 600 && state.phase !== "home"; frame += 1) {
      stepAudienceKnockback(state, 1 / 60, bounds);
    }

    expect(state.phase).toBe("home");
    expect(state.x).toBe(1);
    expect(state.z).toBe(2);
    expect(tryHitAudience(state, "mosh", 0, -1, 0, -1)).toBe(true);
  });

  it("returns exactly to an elevated home after landing on dynamic ground", () => {
    const state = createAudienceKnockbackState(2, 0, -12, 0.75);
    tryHitAudience(state, "lift", 0, 1, 0, 1);

    for (let frame = 0; frame < 600 && state.phase !== "home"; frame += 1) {
      stepAudienceKnockback(state, 1 / 60, bounds, (_x, z) => (z < -9.075 ? 0.75 : 0));
    }

    expect(state.phase).toBe("home");
    expect(state.x).toBe(0);
    expect(state.y).toBe(0.75);
    expect(state.z).toBe(-12);
  });

  it("cannot be hit again before returning home", () => {
    const state = createAudienceKnockbackState(0, 0, 0);

    expect(tryHitAudience(state, "mosh", 1, 0, 0, -1)).toBe(true);
    const velocity = state.vx;
    expect(tryHitAudience(state, "lift", -1, 0, 0, -1)).toBe(false);
    expect(state.vx).toBe(velocity);
  });

  it("assigns deterministic distinct limb phase offsets", () => {
    const first = createAudienceKnockbackState(3, 0, 0);
    const repeated = createAudienceKnockbackState(3, 0, 0);

    expect(first.limbPhases).toEqual(repeated.limbPhases);
    expect(new Set(first.limbPhases).size).toBe(4);
  });
});
