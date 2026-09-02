import { describe, expect, it } from "vitest";
import { combineMovementInputs, KeyboardInputState } from "./KeyboardInput";

describe("KeyboardInputState", () => {
  it("maps WASD to normalized movement", () => {
    const input = new KeyboardInputState();

    input.keyDown("KeyW");
    input.keyDown("KeyD");

    expect(input.value.x).toBeCloseTo(Math.SQRT1_2);
    expect(input.value.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it("releases keys and clears movement state", () => {
    const input = new KeyboardInputState();

    input.keyDown("KeyW");
    input.keyUp("KeyW");
    input.keyDown("KeyA");
    input.reset();

    expect(input.value).toEqual({ x: 0, y: 0 });
  });

  it("requests one jump and prevents Space defaults", () => {
    const input = new KeyboardInputState();

    expect(input.keyDown("Space", false)).toEqual({ jump: true, preventDefault: true });
    expect(input.keyDown("Space", true)).toEqual({ jump: false, preventDefault: true });
    expect(input.keyDown("Space", false)).toEqual({ jump: false, preventDefault: true });
    input.keyUp("Space");
    expect(input.keyDown("Space", false)).toEqual({ jump: true, preventDefault: true });
  });
});

describe("combineMovementInputs", () => {
  it("normalizes combined joystick and keyboard input", () => {
    const movement = combineMovementInputs({ x: 0.8, y: -0.4 }, { x: 1, y: -1 });

    expect(Math.hypot(movement.x, movement.y)).toBeCloseTo(1);
    expect(movement.x).toBeGreaterThan(0);
    expect(movement.y).toBeLessThan(0);
  });
});
