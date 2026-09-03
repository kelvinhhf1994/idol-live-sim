import { describe, expect, it } from "vitest";
import {
  getNextVideoPanelState,
  getPlaybackPresentation,
  getSeekTarget,
} from "./youtubeMiniPlayer";

describe("getNextVideoPanelState", () => {
  it("opens hidden video expanded and toggles expanded video to mini", () => {
    expect(getNextVideoPanelState("hidden", "hud")).toBe("expanded");
    expect(getNextVideoPanelState("expanded", "hud")).toBe("minimized");
  });

  it("expands the same mini player from either expand control", () => {
    expect(getNextVideoPanelState("minimized", "hud")).toBe("expanded");
    expect(getNextVideoPanelState("minimized", "expand")).toBe("expanded");
  });

  it("only minimizes from the expanded header control", () => {
    expect(getNextVideoPanelState("expanded", "minimize")).toBe("minimized");
  });
});

describe("getPlaybackPresentation", () => {
  it("shows pause only while the player reports PLAYING", () => {
    expect(getPlaybackPresentation(1)).toEqual({
      disabled: false,
      icon: "❚❚",
      label: "暫停影片",
      pressed: true,
      state: "playing",
    });
  });

  it.each([-1, 0, 2, 3, 5])("shows play for non-playing state %s", (state) => {
    expect(getPlaybackPresentation(state)).toMatchObject({
      disabled: false,
      icon: "▶",
      label: "播放影片",
      pressed: false,
      state: "paused",
    });
  });

  it("disables controls until the API is ready", () => {
    expect(getPlaybackPresentation(null).disabled).toBe(true);
  });
});

describe("getSeekTarget", () => {
  it("clamps backward seeking at zero", () => {
    expect(getSeekTarget(6, -10)).toBe(0);
  });

  it("adds forward seconds without imposing a duration clamp", () => {
    expect(getSeekTarget(20, 10)).toBe(30);
  });
});
