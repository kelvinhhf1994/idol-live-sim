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
    const loaded = normalizePenlightState(JSON.parse(raw) as unknown);
    // Beat is hold-to-play; never restore it as a latched pose.
    if (loaded.pose === "beat") return { colorId: loaded.colorId, pose: "idle" };
    return loaded;
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
    // Persist idle instead of beat so a refresh does not latch maeuchi.
    const toPersist =
      normalized.pose === "beat"
        ? { colorId: normalized.colorId, pose: "idle" as const }
        : normalized;
    storage.setItem(PENLIGHT_STORAGE_KEY, JSON.stringify(toPersist));
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

/**
 * Maeuchi / kizami beat joints (from demo video frame analysis).
 * Ready: upper arm tucked beside ribs, elbow deep-folded, stick nearly upright
 * with a slight forward lean. Peak: elbows stay planted ("固定手肘") while the
 * forearm snaps forward and the shaft tips toward the stage.
 */
export const BEAT_ARM_READY = {
  rightShoulderX: 0.16,
  rightShoulderY: 0.02,
  rightShoulderZ: -0.16,
  rightElbow: 2.0,
} as const;

/** Peak thrust deltas layered onto BEAT_ARM_READY via beatPulse. */
export const BEAT_ARM_THRUST = {
  rightShoulderX: 0.52,
  rightElbow: 0.7,
} as const;

/** Rest angle is vertical 90° (0 rad offset). */
export const BEAT_STICK_REST_LEAN = 0;

/** Peak thrust tip is forward 45° (-π/4 rad offset). */
export const BEAT_STICK_THRUST_TIP = -Math.PI / 4;

/**
 * Chest beat (maeuchi / kizami): shaft upright in front of the chest (vertical 90°).
 */
export const PENLIGHT_STICK_BEAT: PenlightStickPose = {
  position: { x: 0.01, y: 0.03, z: 0.025 },
  rotation: {
    x: -(BEAT_ARM_READY.rightShoulderX + BEAT_ARM_READY.rightElbow),
    y: 0.04,
    z: 0.08,
  },
};

/** Static stick pose lookup (wiper/beat map to their phase-0 bases). */
export function stickPoseFor(pose: PenlightPose): PenlightStickPose {
  if (pose === "raise" || pose === "wiper") return PENLIGHT_STICK_RAISE;
  if (pose === "point") return PENLIGHT_STICK_POINT;
  if (pose === "beat") return PENLIGHT_STICK_BEAT;
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

/** Fast snap window as a fraction of one beat cycle (~0.24s at default tempo). */
export const BEAT_ATTACK = 0.2;
/** Brief hold at peak ("稍為停一下才回後", ~0.12s at default tempo). */
export const BEAT_HOLD = 0.1;
/** Point where the slow retract reaches 100° (~0.85 cycle ≈ 1.0s at default tempo). */
export const BEAT_RETRACT_END = 0.85;

/**
 * Angles in degrees relative to horizontal ground (90° = vertical up, 45° = forward-up, 100° = tilted back 10°).
 */
export const BEAT_ANGLE_VERTICAL = 90;
export const BEAT_ANGLE_PEAK = 45;
export const BEAT_ANGLE_RETRACT = 100;

/**
 * Trajectory for the stick pitch angle:
 * - Starts at vertical 90° on the first cycle (or 100° on repeated beats).
 * - Fast snap forward to 45°.
 * - Holds at 45° briefly.
 * - Smoothly retracts back to 100°.
 * - If single tap released, gently relaxes from 100° back to vertical 90°.
 */
export function getBeatStickAngleDeg(
  phase: number,
  isFirstCycle = true,
  isHeld = false,
): number {
  const startDeg = isFirstCycle ? BEAT_ANGLE_VERTICAL : BEAT_ANGLE_RETRACT;
  const peakDeg = BEAT_ANGLE_PEAK;
  const cockedDeg = BEAT_ANGLE_RETRACT;
  const endDeg = isHeld ? BEAT_ANGLE_RETRACT : BEAT_ANGLE_VERTICAL;

  const u = phase - Math.floor(phase);
  if (u < BEAT_ATTACK) {
    const t = u / BEAT_ATTACK;
    const ease = 1 - Math.pow(1 - t, 3);
    return startDeg + (peakDeg - startDeg) * ease;
  }
  if (u < BEAT_ATTACK + BEAT_HOLD) {
    return peakDeg;
  }
  if (u < BEAT_RETRACT_END) {
    const t = (u - (BEAT_ATTACK + BEAT_HOLD)) / (BEAT_RETRACT_END - (BEAT_ATTACK + BEAT_HOLD));
    const ease = 0.5 * (1 - Math.cos(t * Math.PI));
    return peakDeg + (cockedDeg - peakDeg) * ease;
  }
  const t = (u - BEAT_RETRACT_END) / (1.0 - BEAT_RETRACT_END);
  const ease = 0.5 * (1 - Math.cos(t * Math.PI));
  return cockedDeg + (endDeg - cockedDeg) * ease;
}

/**
 * Character-space pitch offset around +X for a target stick angle in degrees.
 * 90° (vertical) -> 0 rad
 * 45° (forward) -> -45° (-π/4 rad)
 * 100° (backward) -> +10° (+10*π/180 rad)
 */
export function beatPitchOffsetForDeg(deg: number): number {
  return ((deg - 90) * Math.PI) / 180;
}

/**
 * Asymmetric thrust envelope for maeuchi arm extension.
 * Fast attack (~20%) snaps to peak, brief hold (~10%), slow smooth cosine retract to ready pose.
 */
export function beatPulse(phase: number): number {
  const u = phase - Math.floor(phase);
  if (u < BEAT_ATTACK) {
    // Cubic ease-out: explosive push reaches 1.0 by the attack end.
    return 1 - Math.pow(1 - u / BEAT_ATTACK, 3);
  }
  if (u < BEAT_ATTACK + BEAT_HOLD) {
    return 1;
  }
  if (u < BEAT_RETRACT_END) {
    const t = (u - (BEAT_ATTACK + BEAT_HOLD)) / (BEAT_RETRACT_END - (BEAT_ATTACK + BEAT_HOLD));
    return 0.5 * (1 + Math.cos(t * Math.PI));
  }
  return 0;
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
    // Fixed-elbow kizami: upper arm stays planted beside the ribs; pulse opens
    // the forearm forward then slowly folds back to the ready pose.
    const pulse = beatPulse(phase);
    return {
      rightShoulderX: BEAT_ARM_READY.rightShoulderX + pulse * BEAT_ARM_THRUST.rightShoulderX,
      rightShoulderY: BEAT_ARM_READY.rightShoulderY,
      rightShoulderZ: BEAT_ARM_READY.rightShoulderZ,
      rightElbow:
        BEAT_ARM_READY.rightElbow +
        (BEAT_ARM_THRUST.rightElbow - BEAT_ARM_READY.rightElbow) * pulse,
    };
  }
  return null;
}

/**
 * Local stick X that cancels shoulder+elbow fold so the shaft points world +Y.
 * Forward tap adds a positive snap that springs back with the pulse envelope.
 */
export function beatStickUprightX(rightShoulderX: number, rightElbow: number): number {
  return -(rightShoulderX + rightElbow);
}

/** Dynamic stick pose; lag / snap accents follow the arm cycle. */
export function getDynamicStickPose(
  pose: PenlightPose,
  phase: number,
  isFirstCycle: boolean = true,
  isHeld: boolean = false,
): PenlightStickPose {
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
    const arm = getDynamicArmPose("beat", phase)!;
    const uprightX = beatStickUprightX(arm.rightShoulderX, arm.rightElbow);
    const angleDeg = getBeatStickAngleDeg(phase, isFirstCycle, isHeld);
    const pitchOffset = beatPitchOffsetForDeg(angleDeg);
    const base = PENLIGHT_STICK_BEAT;
    return {
      position: {
        x: base.position.x,
        // Drop + forward reach as the forearm snaps out and thrusts forward.
        y: base.position.y - pulse * 0.015,
        z: base.position.z + pulse * 0.045,
      },
      rotation: {
        // Exact angle matching user spec: 90° vertical -> 45° forward -> 100° retract
        x: uprightX + pitchOffset,
        y: base.rotation.y,
        z: base.rotation.z - pulse * 0.06,
      },
    };
  }
  return stickPoseFor(pose);
}

/** Static arm pose (phase 0) for wiper/beat compatibility. */
export function armPoseFor(pose: PenlightPose): PenlightArmPose | null {
  return getDynamicArmPose(pose, 0);
}
