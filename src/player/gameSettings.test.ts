import { describe, expect, it } from "vitest";
import {
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  normalizeGameSettings,
  resetGameSettings,
  saveGameSettings,
  SETTINGS_STORAGE_KEY,
} from "./gameSettings";

function memoryStorage(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return {
    getItem: (key: string) => (key in data ? data[key]! : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    data,
  };
}

describe("gameSettings", () => {
  it("clamps each setting into its approved range", () => {
    const normalized = normalizeGameSettings({
      walkSpeed: 9,
      moshSpeed: 0.1,
      liftSpeed: 0.2,
      twoStepSpeed: 4,
      jumpScale: -2,
      wiperSpeed: 9,
      beatSpeed: 0.1,
    });
    expect(normalized.walkSpeed).toBe(2.5);
    expect(normalized.moshSpeed).toBe(0.5);
    expect(normalized.liftSpeed).toBe(1);
    expect(normalized.twoStepSpeed).toBe(2);
    expect(normalized.jumpScale).toBe(0.5);
    expect(normalized.wiperSpeed).toBe(2.5);
    expect(normalized.beatSpeed).toBe(0.5);
  });

  it("persists settings and reloads them", () => {
    const storage = memoryStorage();
    const saved = saveGameSettings(
      {
        walkSpeed: 1.5,
        moshSpeed: 2,
        liftSpeed: 2.5,
        twoStepSpeed: 0.75,
        jumpScale: 1.25,
        wiperSpeed: 1.4,
        beatSpeed: 0.8,
      },
      storage,
    );
    expect(JSON.parse(storage.data[SETTINGS_STORAGE_KEY]!)).toEqual(saved);
    expect(loadGameSettings(storage)).toEqual(saved);
  });

  it("resets every value back to defaults", () => {
    const storage = memoryStorage();
    saveGameSettings({ ...DEFAULT_GAME_SETTINGS, walkSpeed: 2.2 }, storage);
    expect(resetGameSettings(storage)).toEqual(DEFAULT_GAME_SETTINGS);
    expect(loadGameSettings(storage)).toEqual(DEFAULT_GAME_SETTINGS);
  });

  it("uses defaults when storage is missing or corrupt", () => {
    expect(loadGameSettings(null)).toEqual(DEFAULT_GAME_SETTINGS);
    const storage = memoryStorage({ [SETTINGS_STORAGE_KEY]: "not-json" });
    expect(loadGameSettings(storage)).toEqual(DEFAULT_GAME_SETTINGS);
  });
});
