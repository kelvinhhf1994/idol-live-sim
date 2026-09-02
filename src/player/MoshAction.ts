const cycleDuration = 0.65;

export class MoshAction {
  private elapsed = 0;
  private held = false;
  private active = false;

  get isActive(): boolean {
    return this.active;
  }

  get progress(): number {
    return this.active ? this.elapsed / cycleDuration : 0;
  }

  start(): void {
    this.held = true;
    if (this.active) return;
    this.active = true;
    this.elapsed = 0;
  }

  release(): void {
    this.held = false;
  }

  cancel(): void {
    this.held = false;
    this.active = false;
    this.elapsed = 0;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;

    while (this.elapsed >= cycleDuration) {
      if (!this.held) {
        this.active = false;
        this.elapsed = 0;
        return;
      }
      this.elapsed -= cycleDuration;
    }
  }
}
