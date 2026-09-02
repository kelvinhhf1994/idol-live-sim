export class JumpPointButton {
  private activePointer: number | null = null;

  constructor(
    private readonly root: HTMLButtonElement,
    private readonly onStart: () => void,
    private readonly onRelease: () => void,
  ) {
    root.setAttribute("aria-pressed", "false");
    root.addEventListener("pointerdown", this.handlePointerDown);
    root.addEventListener("pointerup", this.handlePointerEnd);
    root.addEventListener("pointercancel", this.handlePointerEnd);
    root.addEventListener("lostpointercapture", this.handleLostCapture);
    window.addEventListener("blur", this.release);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  dispose(): void {
    this.root.removeEventListener("pointerdown", this.handlePointerDown);
    this.root.removeEventListener("pointerup", this.handlePointerEnd);
    this.root.removeEventListener("pointercancel", this.handlePointerEnd);
    this.root.removeEventListener("lostpointercapture", this.handleLostCapture);
    window.removeEventListener("blur", this.release);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.release();
  }

  cancel(): void {
    this.release();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.activePointer !== null) return;
    this.activePointer = event.pointerId;
    try {
      this.root.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer tests do not create a browser-managed active pointer.
    }
    this.root.classList.add("is-active");
    this.root.setAttribute("aria-pressed", "true");
    this.onStart();
    event.preventDefault();
    event.stopPropagation();
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
    this.release();
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handleLostCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointer) this.release();
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.release();
  };

  private readonly release = (): void => {
    if (this.activePointer === null) return;
    this.activePointer = null;
    this.root.classList.remove("is-active");
    this.root.setAttribute("aria-pressed", "false");
    this.onRelease();
  };
}
