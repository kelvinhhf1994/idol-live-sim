export const PENLIGHT_STORAGE_KEY = "livehouse_penlight";

/** Idle = default carry; raise/wiper/beat/point = cheer poses. */
export type PenlightPose = "idle" | "raise" | "point" | "wiper" | "beat";

export interface PenlightColor {
  id: string;
  label: string;
  hex: number;
}

/** Classic idol live penlight palette (12 curated colors). */
export const PENLIGHT_COLORS: readonly PenlightColor[] = [
  { id: "red", label: "紅", hex: 0xff2a3a },
  { id: "blue", label: "藍", hex: 0x2f6bff },
  { id: "white", label: "白", hex: 0xf5f7ff },
  { id: "orange", label: "橙", hex: 0xff7a1a },
  { id: "green", label: "綠", hex: 0x2ed67a },
  { id: "purple", label: "紫", hex: 0x8b4dff },
  { id: "pink", label: "粉紅", hex: 0xff4fa3 },
  { id: "yellow", label: "黃", hex: 0xffe14a },
  { id: "aqua", label: "水藍", hex: 0x3ad7ff },
  { id: "emerald", label: "翠綠", hex: 0x12c4a0 },
  { id: "violet", label: "紫羅蘭", hex: 0xb44dff },
  { id: "sakura", label: "櫻花粉", hex: 0xff9ec8 },
] as const;

export interface PenlightState {
  colorId: string;
  pose: PenlightPose;
}

export const DEFAULT_PENLIGHT_STATE: PenlightState = {
  colorId: "pink",
  pose: "idle",
};

export interface PenlightStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const VALID_POSES: readonly PenlightPose[] = ["idle", "raise", "point", "wiper", "beat"];

export function getPenlightColor(colorId: string): PenlightColor {
  return PENLIGHT_COLORS.find((color) => color.id === colorId) ?? PENLIGHT_COLORS[6]!;
}

export function normalizePenlightState(raw: unknown): PenlightState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PENLIGHT_STATE };
  const record = raw as Partial<PenlightState> & { grip?: string };
  const colorId =
    typeof record.colorId === "string" && PENLIGHT_COLORS.some((color) => color.id === record.colorId)
      ? record.colorId
      : DEFAULT_PENLIGHT_STATE.colorId;
  // Migrate legacy grip field: "point" → point pose, otherwise idle.
  let pose: PenlightPose = "idle";
  if (typeof record.pose === "string" && VALID_POSES.includes(record.pose as PenlightPose)) {
    pose = record.pose as PenlightPose;
  } else if (record.grip === "point") {
    pose = "point";
  }
  return { colorId, pose };
}

export function loadPenlightState(storage?: PenlightStorageLike | null): PenlightState {
  if (!storage) return { ...DEFAULT_PENLIGHT_STATE };
  try {
    const raw = storage.getItem(PENLIGHT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PENLIGHT_STATE };
    return normalizePenlightState(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_PENLIGHT_STATE };
  }
}

export function savePenlightState(
  state: PenlightState,
  storage?: PenlightStorageLike | null,
): PenlightState {
  const normalized = normalizePenlightState(state);
  if (!storage) return normalized;
  try {
    storage.setItem(PENLIGHT_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore quota / private-mode failures; in-memory state still applies.
  }
  return normalized;
}

/**
 * Apply a palette pick then dismiss the penlight dialog.
 * Pose / cheer controls live on the HUD and keep their own toggles.
 */
export function handlePenlightColorSelect(actions: {
  apply: () => void;
  persist: () => void;
  sync: () => void;
  dismiss: () => void;
}): void {
  actions.apply();
  actions.persist();
  actions.sync();
  actions.dismiss();
}

export interface PenlightStickPose {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

/** Default carry: upright / slightly angled; mesh pivot is the bottom handle. */
export const PENLIGHT_STICK_IDLE: PenlightStickPose = {
  position: { x: 0.02, y: 0.02, z: -0.01 },
  rotation: { x: 0.15, y: 0.05, z: 0.08 },
};

/**
 * Raised cheer: flip the bottom-pivoted shaft so the tip leans slightly upper-left
 * while the arm itself stays straight vertical.
 */
export const PENLIGHT_STICK_RAISE: PenlightStickPose = {
  position: { x: -0.01, y: 0.02, z: 0 },
  rotation: { x: Math.PI, y: -0.3, z: 0.4 },
};

/**
 * Stage point: flip the bottom-pivoted shaft so the tip tracks the forearm.
 * Arm elevation (45° up) aims the tip forward-up toward the stage idols.
 */
export const PENLIGHT_STICK_POINT: PenlightStickPose = {
  position: { x: 0.02, y: 0.02, z: -0.02 },
  rotation: { x: Math.PI, y: 0, z: 0.08 },
};

/** Static stick pose lookup (wiper/beat map to their phase-0 bases). */
export function stickPoseFor(pose: PenlightPose): PenlightStickPose {
  if (pose === "raise" || pose === "wiper") return PENLIGHT_STICK_RAISE;
  if (pose === "point" || pose === "beat") return PENLIGHT_STICK_POINT;
  return PENLIGHT_STICK_IDLE;
}

/** Right-arm joint targets applied while a cheer pose is active. */
export interface PenlightArmPose {
  rightShoulderX: number;
  rightShoulderY: number;
  rightShoulderZ: number;
  rightElbow: number;
}

export const PENLIGHT_ARM_RAISE: PenlightArmPose = {
  // Hang (-Y) → rotate X by π → arm points straight world +Y; no Y/Z lean.
  rightShoulderX: Math.PI,
  rightShoulderY: 0,
  rightShoulderZ: 0,
  rightElbow: 0,
};

/** Hang (-Y) → X=π/2 is horizontal forward (-Z); +π/4 lifts 45° toward stage. */
export const PENLIGHT_POINT_ELEVATION = Math.PI / 4;

export const PENLIGHT_ARM_POINT: PenlightArmPose = {
  // Forward-up at 45° elevation; no Y/Z shoulder lean for a clean stage point.
  rightShoulderX: Math.PI / 2 + PENLIGHT_POINT_ELEVATION,
  rightShoulderY: 0,
  rightShoulderZ: 0,
  rightElbow: 0,
};

/** Asymmetric thrust / bounce envelope for maeuchi (forward beat). */
export function beatPulse(phase: number): number {
  const u = phase - Math.floor(phase);
  if (u < 0.28) {
    return 1 - Math.pow(1 - u / 0.28, 3);
  }
  return 1 - Math.pow((u - 0.28) / 0.72, 2);
}

/**
 * Dynamic arm pose for cheer animations.
 * Phase is radians for wiper (sin cycle) and cycle count for beat (fractional pulse).
 */
export function getDynamicArmPose(pose: PenlightPose, phase: number): PenlightArmPose | null {
  if (pose === "raise") return PENLIGHT_ARM_RAISE;
  if (pose === "point") return PENLIGHT_ARM_POINT;
  if (pose === "wiper") {
    // Overhead wiper: nearly upright with a wide Z swing from the shoulder.
    return {
      rightShoulderX: 2.85 + Math.sin(2 * phase) * 0.06,
      rightShoulderY: Math.sin(phase) * 0.05,
      rightShoulderZ: -0.12 + Math.sin(phase) * 0.45,
      rightElbow: 0.12 + Math.abs(Math.sin(phase)) * 0.08,
    };
  }
  if (pose === "beat") {
    // Maeuchi: chest-to-forehead thrust with elastic bounce-back.
    const pulse = beatPulse(phase);
    return {
      rightShoulderX: Math.PI / 2 + 0.35 + pulse * 0.28,
      rightShoulderY: 0.04,
      rightShoulderZ: -0.08,
      rightElbow: 0.55 + (0.18 - 0.55) * pulse,
    };
  }
  return null;
}

/** Dynamic stick pose; lag / snap accents follow the arm cycle. */
export function getDynamicStickPose(pose: PenlightPose, phase: number): PenlightStickPose {
  if (pose === "wiper") {
    const base = PENLIGHT_STICK_RAISE;
    return {
      position: { ...base.position },
      rotation: {
        x: base.rotation.x,
        y: base.rotation.y,
        z: base.rotation.z + Math.sin(phase) * 0.15,
      },
    };
  }
  if (pose === "beat") {
    const pulse = beatPulse(phase);
    const base = PENLIGHT_STICK_POINT;
    return {
      position: { ...base.position },
      rotation: {
        x: base.rotation.x + pulse * 0.15,
        y: base.rotation.y,
        z: base.rotation.z,
      },
    };
  }
  return stickPoseFor(pose);
}

/** Static arm pose (phase 0) for wiper/beat compatibility. */
export function armPoseFor(pose: PenlightPose): PenlightArmPose | null {
  return getDynamicArmPose(pose, 0);
}
