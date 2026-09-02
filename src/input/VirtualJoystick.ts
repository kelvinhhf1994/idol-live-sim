export interface JoystickValue {
  x: number;
  y: number;
}

export class VirtualJoystick {
  private readonly output: JoystickValue = { x: 0, y: 0 };
  private activePointer: number | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly knob: HTMLElement,
  ) {
    root.addEventListener("pointerdown", this.handlePointerDown);
    root.addEventListener("pointermove", this.handlePointerMove);
    root.addEventListener("pointerup", this.handlePointerEnd);
    root.addEventListener("pointercancel", this.handlePointerEnd);
    root.addEventListener("lostpointercapture", this.handleLostCapture);
    window.addEventListener("blur", this.reset);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  get value(): Readonly<JoystickValue> {
    return this.output;
  }

  dispose(): void {
    this.root.removeEventListener("pointerdown", this.handlePointerDown);
    this.root.removeEventListener("pointermove", this.handlePointerMove);
    this.root.removeEventListener("pointerup", this.handlePointerEnd);
    this.root.removeEventListener("pointercancel", this.handlePointerEnd);
    this.root.removeEventListener("lostpointercapture", this.handleLostCapture);
    window.removeEventListener("blur", this.reset);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.activePointer !== null) return;
    this.activePointer = event.pointerId;
    try {
      this.root.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic touch tests do not create a browser-managed active pointer.
    }
    this.updateFromPointer(event);
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return;
    this.updateFromPointer(event);
    event.preventDefault();
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return;
    if (this.root.hasPointerCapture(event.pointerId)) {
      try {
        this.root.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }
    }
    this.reset();
  };

  private readonly handleLostCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointer) this.reset();
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.reset();
  };

  private readonly reset = (): void => {
    this.activePointer = null;
    this.output.x = 0;
    this.output.y = 0;
    this.knob.style.transform = "translate3d(0, 0, 0)";
  };

  private updateFromPointer(event: PointerEvent): void {
    const bounds = this.root.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const radius = bounds.width * 0.32;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;

    this.output.x = x / radius;
    this.output.y = y / radius;
    this.knob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}
