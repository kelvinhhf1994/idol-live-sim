import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { StationSelectorState, STATIONS, type Station } from "./StationSelector";

describe("StationSelectorState", () => {
  let onEnter: Mock<(station: Station) => void>;
  let onStationChange: Mock<(station: Station) => void>;
  let onFeedbackChange: Mock<(message: string) => void>;

  beforeEach(() => {
    onEnter = vi.fn<(station: Station) => void>();
    onStationChange = vi.fn<(station: Station) => void>();
    onFeedbackChange = vi.fn<(message: string) => void>();
  });

  it("defines exactly 5 stations in the specified order", () => {
    expect(STATIONS).toHaveLength(5);
    expect(STATIONS.map((s) => s.name)).toEqual([
      "NeoBackstage",
      "牛頭角",
      "九龍灣",
      "鑽石山",
      "旺角",
    ]);

    expect(STATIONS[0].status).toBe("active");
    expect(STATIONS[1].status).toBe("active");

    for (let i = 2; i < 5; i++) {
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

  it("never enters coming-soon stations, even after repeated clicks", () => {
    const state = new StationSelectorState({ onEnter, onStationChange, onFeedbackChange });

    state.selectStationById("kowloon-bay");
    expect(state.getCurrentStation().name).toBe("九龍灣");
    expect(onStationChange).toHaveBeenCalledWith(STATIONS[2]);

    for (let click = 0; click < 8; click += 1) {
      const result = state.handleEnterClick();
      expect(result.entered).toBe(false);
      expect(result.feedback).toBe("即將推出");
    }

    expect(onEnter).not.toHaveBeenCalled();
    expect(onFeedbackChange).toHaveBeenCalledWith("即將推出");
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
