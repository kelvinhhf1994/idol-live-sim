/** Base cycle rate (cycles per second) matching filmed wotagei maeuchi tempo (~1.18s per beat). */
export const BEAT_CYCLE_RATE = 0.85;

/**
 * Maeuchi / kizami beat: tap completes one cycle, hold repeats to the beat,
 * release finishes the current strike then returns to idle (Mosh-style held).
 */
export class BeatAction {
  private held = false;
  private active = false;
  private cyclePhase = 0;
  private cycleCount = 0;
  private debugFrozen = false;

  get isActive(): boolean {
    return this.active;
  }

  get isHeld(): boolean {
    return this.held;
  }

  get isFirstCycle(): boolean {
    return this.cycleCount === 0;
  }

  /** Fractional cycle count used by beatPulse / dynamic pose helpers. */
  get phase(): number {
    return this.active ? this.cyclePhase : 0;
  }

  start(): void {
    this.held = true;
    if (this.active) return;
    this.active = true;
    this.cyclePhase = 0;
    this.cycleCount = 0;
    this.debugFrozen = false;
  }

  release(): void {
    this.held = false;
  }

  cancel(): void {
    this.held = false;
    this.active = false;
    this.cyclePhase = 0;
    this.cycleCount = 0;
    this.debugFrozen = false;
  }

  /**
   * Advance the strike cycle. `speed` matches gameSettings.beatSpeed
   * (phase rate = BEAT_CYCLE_RATE * speed, so default ≈ 1.18s per tap).
   */
  update(dt: number, speed: number): void {
    if (!this.active || this.debugFrozen) return;
    this.cyclePhase += dt * (BEAT_CYCLE_RATE * speed);

    while (this.cyclePhase >= 1) {
      if (!this.held) {
        this.active = false;
        this.cyclePhase = 0;
        this.cycleCount = 0;
        return;
      }
      this.cyclePhase -= 1;
      this.cycleCount += 1;
    }
  }

  debugSetPhase(phase: number): void {
    this.active = true;
    this.held = true;
    this.cyclePhase = ((phase % 1) + 1) % 1;
    this.cycleCount = 0;
    this.debugFrozen = true;
  }
}
