export const SETTINGS_STORAGE_KEY = "livehouse_settings";

export interface GameSettings {
  /** Ordinary walk/run multiplier. Default 1.0. */
  walkSpeed: number;
  /** Mosh movement multiplier. Default 1.25. */
  moshSpeed: number;
  /** Lift formation movement multiplier. Default 2.0. */
  liftSpeed: number;
  /** Two-step movement multiplier. Default 1.0. */
  twoStepSpeed: number;
  /** Jump / jump-point launch scale. Default 1.0. */
  jumpScale: number;
  /** Left-right wiper cheer cycle rate. Default 1.0. */
  wiperSpeed: number;
  /** Forward beat / maeuchi thrust cycle rate. Default 1.0. */
  beatSpeed: number;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  walkSpeed: 1,
  moshSpeed: 1.25,
  liftSpeed: 2,
  twoStepSpeed: 1,
  jumpScale: 1,
  wiperSpeed: 1,
  beatSpeed: 1,
};

export const GAME_SETTINGS_LIMITS = {
  walkSpeed: { min: 0.5, max: 2.5, step: 0.05 },
  moshSpeed: { min: 0.5, max: 2.5, step: 0.05 },
  liftSpeed: { min: 1, max: 3.5, step: 0.05 },
  twoStepSpeed: { min: 0.5, max: 2, step: 0.05 },
  jumpScale: { min: 0.5, max: 2.5, step: 0.05 },
  wiperSpeed: { min: 0.5, max: 2.5, step: 0.05 },
  beatSpeed: { min: 0.5, max: 2.5, step: 0.05 },
} as const;

export interface SettingsStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeGameSettings(raw: unknown): GameSettings {
  const source =
    raw && typeof raw === "object" ? (raw as Partial<Record<keyof GameSettings, unknown>>) : {};
  const next = { ...DEFAULT_GAME_SETTINGS };
  for (const key of Object.keys(DEFAULT_GAME_SETTINGS) as (keyof GameSettings)[]) {
    const limits = GAME_SETTINGS_LIMITS[key];
    const value = source[key];
    next[key] = clamp(
      typeof value === "number" ? value : DEFAULT_GAME_SETTINGS[key],
      limits.min,
      limits.max,
    );
  }
  return next;
}

export function loadGameSettings(storage?: SettingsStorageLike | null): GameSettings {
  if (!storage) return { ...DEFAULT_GAME_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GAME_SETTINGS };
    return normalizeGameSettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function saveGameSettings(
  settings: GameSettings,
  storage?: SettingsStorageLike | null,
): GameSettings {
  const normalized = normalizeGameSettings(settings);
  if (!storage) return normalized;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore persistence failures; runtime settings still apply.
  }
  return normalized;
}

export function resetGameSettings(storage?: SettingsStorageLike | null): GameSettings {
  return saveGameSettings({ ...DEFAULT_GAME_SETTINGS }, storage);
}
