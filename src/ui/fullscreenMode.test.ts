import { describe, expect, it } from "vitest";
import { getFullscreenPresentation } from "./fullscreenMode";

describe("getFullscreenPresentation", () => {
  it("offers native fullscreen when supported", () => {
    expect(
      getFullscreenPresentation({
        nativeActive: false,
        standalone: false,
        nativeSupported: true,
      }),
    ).toEqual({ active: false, label: "全螢幕", action: "enter" });
  });

  it("offers exit while native fullscreen is active", () => {
    expect(
      getFullscreenPresentation({
        nativeActive: true,
        standalone: false,
        nativeSupported: true,
      }),
    ).toEqual({ active: true, label: "退出全螢幕", action: "exit" });
  });

  it("shows guidance when fullscreen is unsupported", () => {
    expect(
      getFullscreenPresentation({
        nativeActive: false,
        standalone: false,
        nativeSupported: false,
      }),
    ).toEqual({ active: false, label: "全螢幕", action: "guide" });
  });

  it("treats standalone display mode as active without guidance", () => {
    expect(
      getFullscreenPresentation({
        nativeActive: false,
        standalone: true,
        nativeSupported: false,
      }),
    ).toEqual({ active: true, label: "退出全螢幕", action: "none" });
  });
});
