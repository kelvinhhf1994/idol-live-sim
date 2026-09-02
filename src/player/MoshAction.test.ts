import { describe, expect, it } from "vitest";
import { MoshAction } from "./MoshAction";

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
    expect(action.progress).toBeCloseTo(0.25);
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
});
