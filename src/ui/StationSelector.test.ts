import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from "vitest";
import { StationSelectorState, STATIONS, type Station } from "./StationSelector";

describe("StationSelectorState", () => {
  let onEnter: Mock<(station: Station) => void>;
  let onStationChange: Mock<(station: Station) => void>;
  let onFeedbackChange: Mock<(message: string) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    onEnter = vi.fn<(station: Station) => void>();
    onStationChange = vi.fn<(station: Station) => void>();
    onFeedbackChange = vi.fn<(message: string) => void>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defines exactly 5 stations in the specified order with correct click requirements", () => {
    expect(STATIONS).toHaveLength(5);
    expect(STATIONS.map((s) => s.name)).toEqual([
      "NeoBackstage",
      "牛頭角",
      "九龍灣",
      "鑽石山",
      "旺角",
    ]);

    expect(STATIONS[0].requiredClicks).toBe(1);
    expect(STATIONS[0].status).toBe("active");

    for (let i = 1; i < 5; i++) {
      expect(STATIONS[i].requiredClicks).toBe(5);
      expect(STATIONS[i].status).toBe("coming-soon");
      expect(STATIONS[i].copy).toBe("即將推出");
    }
  });

  it("initializes with NeoBackstage selected", () => {
    const state = new StationSelectorState({ onEnter, onStationChange, onFeedbackChange });
    expect(state.getCurrentStation().id).toBe("neo-backstage");
    expect(state.getCurrentStation().name).toBe("NeoBackstage");
    expect(state.getCurrentStationIndex()).toBe(0);
  });

  it("enters immediately on 1 click when NeoBackstage is selected", () => {
    const state = new StationSelectorState({ onEnter, onStationChange, onFeedbackChange });

    const result = state.handleEnterClick();
    expect(result.entered).toBe(true);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter).toHaveBeenCalledWith(STATIONS[0]);
  });

  it("requires exactly 5 clicks to enter unreleased stations", () => {
    const state = new StationSelectorState({ onEnter, onStationChange, onFeedbackChange });

    state.selectStationById("ngau-tau-kok");
    expect(state.getCurrentStation().name).toBe("牛頭角");
    expect(onStationChange).toHaveBeenCalledWith(STATIONS[1]);

    // Clicks 1 to 4 should not enter
    for (let click = 1; click <= 4; click++) {
      const result = state.handleEnterClick();
      expect(result.entered).toBe(false);
      expect(result.remainingClicks).toBe(5 - click);
      expect(onEnter).not.toHaveBeenCalled();
      expect(onFeedbackChange).toHaveBeenCalledWith(
        expect.stringContaining(`尚餘 ${5 - click} 次`),
      );
    }

    // 5th click enters
    const finalResult = state.handleEnterClick();
    expect(finalResult.entered).toBe(true);
    expect(finalResult.remainingClicks).toBe(0);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter).toHaveBeenCalledWith(STATIONS[1]);
  });

  it("resets click count when switching stations", () => {
    const state = new StationSelectorState({ onEnter, onStationChange, onFeedbackChange });

    state.selectStationById("kowloon-bay");
    state.handleEnterClick();
    state.handleEnterClick();
    expect(state.getClickCount()).toBe(2);

    // Switch station
    state.selectStationById("diamond-hill");
    expect(state.getClickCount()).toBe(0);
    expect(onFeedbackChange).toHaveBeenCalledWith("");
  });

  it("resets click count after timeout", () => {
    const state = new StationSelectorState({
      onEnter,
      onStationChange,
      onFeedbackChange,
      resetTimeoutMs: 2000,
    });

    state.selectStationById("mong-kok");
    state.handleEnterClick();
    state.handleEnterClick();
    state.handleEnterClick();
    expect(state.getClickCount()).toBe(3);

    vi.advanceTimersByTime(2100);
    expect(state.getClickCount()).toBe(0);
    expect(onFeedbackChange).toHaveBeenCalledWith("");
  });

  it("calculates snap index accurately based on track center", () => {
    const itemCenters = [50, 150, 250, 350, 450];

    expect(StationSelectorState.calculateSnapIndex(itemCenters, 40)).toBe(0);
    expect(StationSelectorState.calculateSnapIndex(itemCenters, 160)).toBe(1);
    expect(StationSelectorState.calculateSnapIndex(itemCenters, 245)).toBe(2);
    expect(StationSelectorState.calculateSnapIndex(itemCenters, 360)).toBe(3);
    expect(StationSelectorState.calculateSnapIndex(itemCenters, 500)).toBe(4);
  });
});
