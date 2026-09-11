import {
  createPersonPose,
  resetPersonPose,
  type PersonPose,
} from "./personPose";

export type CaptureMode = "front-facing-2d" | "full-3d";

export interface DanceClip {
  schemaVersion: 1;
  duration: number;
  targetRig: "person-rig-chibi-idol";
  captureMode: CaptureMode;
  rootMotionMode: "in-place";
  timestamps: number[];
  poses: Array<Partial<PersonPose>>;
}

export interface SampleCapturedDanceOptions {
  loop?: boolean;
}

const POSE_KEYS = Object.keys(createPersonPose()) as Array<keyof PersonPose>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wrap(time: number, period: number): number {
  if (period <= 0) return 0;
  return ((time % period) + period) % period;
}

/** Validates and normalizes a DanceClip payload from JSON. */
export function parseDanceClip(raw: unknown): DanceClip {
  if (!isRecord(raw)) throw new Error("DanceClip must be an object");
  if (raw.schemaVersion !== 1) throw new Error("DanceClip schemaVersion must be 1");
  if (typeof raw.duration !== "number" || !(raw.duration > 0)) {
    throw new Error("DanceClip duration must be a positive number");
  }
  if (raw.targetRig !== "person-rig-chibi-idol") {
    throw new Error('DanceClip targetRig must be "person-rig-chibi-idol"');
  }
  if (raw.captureMode !== "front-facing-2d" && raw.captureMode !== "full-3d") {
    throw new Error('DanceClip captureMode must be "front-facing-2d" or "full-3d"');
  }
  if (raw.rootMotionMode !== "in-place") {
    throw new Error('DanceClip rootMotionMode must be "in-place"');
  }
  if (!Array.isArray(raw.timestamps) || !Array.isArray(raw.poses)) {
    throw new Error("DanceClip timestamps and poses must be arrays");
  }
  if (raw.timestamps.length === 0 || raw.timestamps.length !== raw.poses.length) {
    throw new Error("DanceClip timestamps and poses must have the same non-zero length");
  }
  for (const t of raw.timestamps) {
    if (typeof t !== "number" || !Number.isFinite(t)) {
      throw new Error("DanceClip timestamps must be finite numbers");
    }
  }
  for (const pose of raw.poses) {
    if (!isRecord(pose)) throw new Error("DanceClip poses must be objects");
  }

  return {
    schemaVersion: 1,
    duration: raw.duration,
    targetRig: "person-rig-chibi-idol",
    captureMode: raw.captureMode,
    rootMotionMode: "in-place",
    timestamps: raw.timestamps as number[],
    poses: raw.poses as Array<Partial<PersonPose>>,
  };
}

/**
 * Samples a captured dance clip into `out` at `time` seconds.
 * Unspecified channels stay at the neutral pose. Looping wraps by clip.duration.
 */
export function sampleCapturedDance(
  clip: DanceClip,
  time: number,
  out: PersonPose,
  options: SampleCapturedDanceOptions = {},
): void {
  const loop = options.loop ?? true;
  resetPersonPose(out);

  const { timestamps, poses, duration } = clip;
  if (timestamps.length === 0) return;

  let t = time;
  if (loop) t = wrap(time, duration);
  else t = Math.max(0, Math.min(duration, time));

  if (t <= timestamps[0]! || timestamps.length === 1) {
    applyPartial(out, poses[0]!);
    return;
  }

  const lastIndex = timestamps.length - 1;
  if (t >= timestamps[lastIndex]!) {
    applyPartial(out, poses[lastIndex]!);
    return;
  }

  let i = 0;
  while (i < lastIndex && timestamps[i + 1]! < t) i += 1;

  const t0 = timestamps[i]!;
  const t1 = timestamps[i + 1]!;
  const a = poses[i]!;
  const b = poses[i + 1]!;
  const span = t1 - t0;
  const u = span > 0 ? (t - t0) / span : 0;

  for (const key of POSE_KEYS) {
    const va = a[key];
    const vb = b[key];
    if (va === undefined && vb === undefined) continue;
    const left = va ?? out[key];
    const right = vb ?? out[key];
    out[key] = left + (right - left) * u;
  }
}

function applyPartial(out: PersonPose, partial: Partial<PersonPose>): void {
  for (const key of POSE_KEYS) {
    const value = partial[key];
    if (value !== undefined) out[key] = value;
  }
}
