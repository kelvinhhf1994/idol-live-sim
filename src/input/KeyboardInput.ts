export interface MovementValue {
  x: number;
  y: number;
}

export interface KeyDownResult {
  jump: boolean;
  preventDefault: boolean;
}

const movementCodes = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

export class KeyboardInputState {
  private readonly pressed = new Set<string>();

  get value(): Readonly<MovementValue> {
    const x = Number(this.pressed.has("KeyD")) - Number(this.pressed.has("KeyA"));
    const y = Number(this.pressed.has("KeyS")) - Number(this.pressed.has("KeyW"));
    return normalizeMovement({ x, y });
  }

  keyDown(code: string, repeat = false): KeyDownResult {
    if (movementCodes.has(code)) {
      this.pressed.add(code);
      return { jump: false, preventDefault: false };
    }
    if (code !== "Space") return { jump: false, preventDefault: false };

    const jump = !repeat && !this.pressed.has(code);
    this.pressed.add(code);
    return { jump, preventDefault: true };
  }

  keyUp(code: string): void {
    this.pressed.delete(code);
  }

  reset(): void {
    this.pressed.clear();
  }
}

export class KeyboardInput {
  private readonly state = new KeyboardInputState();

  constructor(private readonly onJump: () => void) {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.reset);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  get value(): Readonly<MovementValue> {
    return this.state.value;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.reset);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.state.reset();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const result = this.state.keyDown(event.code, event.repeat);
    if (result.preventDefault) event.preventDefault();
    if (result.jump) this.onJump();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.state.keyUp(event.code);
    if (event.code === "Space") event.preventDefault();
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.reset();
  };

  private readonly reset = (): void => {
    this.state.reset();
  };
}

export function combineMovementInputs(...inputs: readonly MovementValue[]): MovementValue {
  return normalizeMovement(
    inputs.reduce(
      (combined, input) => ({ x: combined.x + input.x, y: combined.y + input.y }),
      { x: 0, y: 0 },
    ),
  );
}

function normalizeMovement(movement: MovementValue): MovementValue {
  const length = Math.hypot(movement.x, movement.y);
  if (length <= 1) return movement;
  return { x: movement.x / length, y: movement.y / length };
}
