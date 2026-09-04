export interface Station {
  readonly id: string;
  readonly name: string;
  readonly enName: string;
  readonly code: string;
  readonly status: "active" | "coming-soon";
  readonly copy: string;
  readonly requiredClicks: number;
}

export const STATIONS: readonly Station[] = [
  {
    id: "neo-backstage",
    name: "NeoBackstage",
    enName: "NEON BACKSTAGE",
    code: "NBS",
    status: "active",
    copy: "走入現場，穿過人群，從你的角度感受舞台。",
    requiredClicks: 1,
  },
  {
    id: "ngau-tau-kok",
    name: "牛頭角",
    enName: "NGAU TAU KOK",
    code: "NTK",
    status: "coming-soon",
    copy: "即將推出",
    requiredClicks: 5,
  },
  {
    id: "kowloon-bay",
    name: "九龍灣",
    enName: "KOWLOON BAY",
    code: "KOB",
    status: "coming-soon",
    copy: "即將推出",
    requiredClicks: 5,
  },
  {
    id: "diamond-hill",
    name: "鑽石山",
    enName: "DIAMOND HILL",
    code: "DIH",
    status: "coming-soon",
    copy: "即將推出",
    requiredClicks: 5,
  },
  {
    id: "mong-kok",
    name: "旺角",
    enName: "MONG KOK",
    code: "MOK",
    status: "coming-soon",
    copy: "即將推出",
    requiredClicks: 5,
  },
];

export interface StationSelectorStateOptions {
  readonly initialIndex?: number;
  readonly resetTimeoutMs?: number;
  readonly onEnter?: (station: Station) => void;
  readonly onStationChange?: (station: Station) => void;
  readonly onFeedbackChange?: (message: string) => void;
}

/**
 * Pure state manager for the station selector logic.
 * Handles station selection, snap calculations, and the 5-click easter egg entry.
 */
export class StationSelectorState {
  private currentIndex = 0;
  private clickCount = 0;
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly resetTimeoutMs: number;
  private readonly onEnter?: (station: Station) => void;
  private readonly onStationChange?: (station: Station) => void;
  private readonly onFeedbackChange?: (message: string) => void;

  constructor(options?: StationSelectorStateOptions) {
    this.currentIndex = options?.initialIndex ?? 0;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 2500;
    this.onEnter = options?.onEnter;
    this.onStationChange = options?.onStationChange;
    this.onFeedbackChange = options?.onFeedbackChange;
  }

  public getStations(): readonly Station[] {
    return STATIONS;
  }

  public getCurrentStation(): Station {
    return STATIONS[this.currentIndex];
  }

  public getCurrentStationIndex(): number {
    return this.currentIndex;
  }

  public getClickCount(): number {
    return this.clickCount;
  }

  public selectStationByIndex(index: number): boolean {
    if (index < 0 || index >= STATIONS.length) return false;
    if (this.currentIndex !== index) {
      this.currentIndex = index;
      this.resetClickCounter();
      this.onStationChange?.(this.getCurrentStation());
      return true;
    }
    return false;
  }

  public selectStationById(id: string): boolean {
    const index = STATIONS.findIndex((station) => station.id === id);
    if (index !== -1) {
      return this.selectStationByIndex(index);
    }
    return false;
  }

  public handleEnterClick(): { entered: boolean; remainingClicks: number; feedback: string } {
    const station = this.getCurrentStation();

    // Standard entry for ready stations
    if (station.requiredClicks <= 1) {
      this.resetClickCounter();
      this.onEnter?.(station);
      return { entered: true, remainingClicks: 0, feedback: "" };
    }

    this.clickCount += 1;
    this.armResetTimer();

    const remaining = station.requiredClicks - this.clickCount;
    if (remaining <= 0) {
      this.resetClickCounter();
      this.onEnter?.(station);
      return { entered: true, remainingClicks: 0, feedback: "解鎖成功！進入測試場館..." };
    }

    const feedback = `即將推出（連按 5 下解鎖，尚餘 ${remaining} 次）`;
    this.onFeedbackChange?.(feedback);
    return { entered: false, remainingClicks: remaining, feedback };
  }

  public resetClickCounter(): void {
    this.clickCount = 0;
    if (this.clickTimer !== null) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    this.onFeedbackChange?.("");
  }

  private armResetTimer(): void {
    if (this.clickTimer !== null) {
      clearTimeout(this.clickTimer);
    }
    this.clickTimer = setTimeout(() => {
      this.clickCount = 0;
      this.onFeedbackChange?.("");
      this.clickTimer = null;
    }, this.resetTimeoutMs);
  }

  /**
   * Helper to find the station closest to the center line during horizontal scroll.
   */
  public static calculateSnapIndex(
    itemCenters: readonly number[],
    trackCenter: number,
  ): number {
    if (itemCenters.length === 0) return 0;
    let closestIndex = 0;
    let minDiff = Infinity;
    for (let i = 0; i < itemCenters.length; i++) {
      const diff = Math.abs(itemCenters[i] - trackCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    return closestIndex;
  }

  public dispose(): void {
    this.resetClickCounter();
  }
}

export interface StationSelectorUIElements {
  readonly track: HTMLElement;
  readonly titleElement: HTMLElement;
  readonly copyElement: HTMLElement;
  readonly statusBadge: HTMLElement;
  readonly enterButton: HTMLButtonElement;
  readonly feedbackElement: HTMLElement;
}

/**
 * DOM binding layer connecting StationSelectorState to UI elements.
 */
export class StationSelector {
  public readonly state: StationSelectorState;
  private readonly elements: StationSelectorUIElements;
  private readonly stationButtons: HTMLButtonElement[] = [];
  private isUserScrolling = false;
  private scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    elements: StationSelectorUIElements,
    options: {
      onEnter: (station: Station) => void;
      resetTimeoutMs?: number;
    },
  ) {
    this.elements = elements;
    this.state = new StationSelectorState({
      onEnter: options.onEnter,
      resetTimeoutMs: options.resetTimeoutMs,
      onStationChange: () => this.syncUI(false),
      onFeedbackChange: (msg) => this.updateFeedback(msg),
    });

    this.renderTrackNodes();
    this.bindEvents();
    this.syncUI(false);
  }

  public getCurrentStation(): Station {
    return this.state.getCurrentStation();
  }

  public selectStationByIndex(index: number, shouldScroll = true): void {
    this.state.selectStationByIndex(index);
    this.syncUI(shouldScroll);
  }

  public selectStationById(id: string, shouldScroll = true): void {
    this.state.selectStationById(id);
    this.syncUI(shouldScroll);
  }

  public handleEnterClick(): { entered: boolean; remainingClicks: number; feedback: string } {
    return this.state.handleEnterClick();
  }

  private updateFeedback(message: string): void {
    this.elements.feedbackElement.textContent = message;
    if (message) {
      this.elements.feedbackElement.classList.add("enter-feedback--visible");
    } else {
      this.elements.feedbackElement.classList.remove("enter-feedback--visible");
    }
  }

  private renderTrackNodes(): void {
    this.elements.track.innerHTML = "";
    this.stationButtons.length = 0;

    STATIONS.forEach((station, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "metro-station";
      button.dataset.stationId = station.id;
      button.dataset.index = String(index);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", index === 0 ? "true" : "false");
      button.setAttribute("aria-label", `${station.name} (${station.enName})`);

      // MTR-style circular station connector node and label
      button.innerHTML = `
        <div class="metro-station__node">
          <span class="metro-station__circle">
            <span class="metro-station__dot"></span>
          </span>
          <span class="metro-station__code">${station.code}</span>
        </div>
        <div class="metro-station__label">
          <span class="metro-station__name">${station.name}</span>
          <span class="metro-station__status">${station.status === "active" ? "OPEN" : "SOON"}</span>
        </div>
      `;

      button.addEventListener("click", () => {
        this.selectStationByIndex(index, true);
      });

      this.elements.track.appendChild(button);
      this.stationButtons.push(button);
    });
  }

  private bindEvents(): void {
    // Snap-to-center on scroll
    this.elements.track.addEventListener(
      "scroll",
      () => {
        if (this.isUserScrolling) return;

        if (this.scrollDebounceTimer !== null) {
          clearTimeout(this.scrollDebounceTimer);
        }

        this.scrollDebounceTimer = setTimeout(() => {
          this.handleScrollSnap();
        }, 50);
      },
      { passive: true },
    );

    // Keyboard support
    this.elements.track.addEventListener("keydown", (e: KeyboardEvent) => {
      const currentIdx = this.state.getCurrentStationIndex();
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this.selectStationByIndex(Math.min(currentIdx + 1, STATIONS.length - 1), true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.selectStationByIndex(Math.max(currentIdx - 1, 0), true);
      } else if (e.key === "Home") {
        e.preventDefault();
        this.selectStationByIndex(0, true);
      } else if (e.key === "End") {
        e.preventDefault();
        this.selectStationByIndex(STATIONS.length - 1, true);
      }
    });
  }

  private handleScrollSnap(): void {
    const trackRect = this.elements.track.getBoundingClientRect();
    if (trackRect.width === 0) return;

    const trackCenter = trackRect.left + trackRect.width / 2;
    const centers = this.stationButtons.map((btn) => {
      const rect = btn.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });

    const closestIndex = StationSelectorState.calculateSnapIndex(centers, trackCenter);
    if (closestIndex !== this.state.getCurrentStationIndex()) {
      this.state.selectStationByIndex(closestIndex);
      this.syncUI(false);
    }
  }

  private syncUI(shouldScroll: boolean): void {
    const station = this.state.getCurrentStation();
    const currentIdx = this.state.getCurrentStationIndex();

    this.stationButtons.forEach((btn, index) => {
      const isActive = index === currentIdx;
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.classList.toggle("metro-station--active", isActive);
    });

    if (station.id === "neo-backstage") {
      this.elements.titleElement.innerHTML = `NEON<br />BACKSTAGE`;
    } else {
      this.elements.titleElement.innerHTML = `${station.name}<br /><span class="entry-card__sub-title">${station.enName}</span>`;
    }

    this.elements.copyElement.textContent = station.copy;

    if (station.status === "active") {
      this.elements.statusBadge.textContent = "現正開放 · LIVE";
      this.elements.statusBadge.className = "station-badge station-badge--active";
    } else {
      this.elements.statusBadge.textContent = "即將推出 · COMING SOON";
      this.elements.statusBadge.className = "station-badge station-badge--soon";
    }

    if (station.id === "neo-backstage") {
      this.elements.enterButton.textContent = "進入場館";
      this.elements.enterButton.classList.remove("primary-button--soon");
    } else {
      this.elements.enterButton.textContent = "進入場館";
      this.elements.enterButton.classList.add("primary-button--soon");
    }

    if (shouldScroll) {
      const targetBtn = this.stationButtons[currentIdx];
      if (targetBtn) {
        this.isUserScrolling = true;
        targetBtn.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
        setTimeout(() => {
          this.isUserScrolling = false;
        }, 350);
      }
    }
  }

  public dispose(): void {
    this.state.dispose();
    if (this.scrollDebounceTimer !== null) {
      clearTimeout(this.scrollDebounceTimer);
    }
  }
}
