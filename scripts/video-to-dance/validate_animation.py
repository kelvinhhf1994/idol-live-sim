#!/usr/bin/env python3
"""Automated checks for the exported PersonPose dance clip."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

from arm_retarget import FORWARD_MIN, shoulder_direction
from common import load_json, save_json, stage_dir

REQUIRED_POSE = (
    "bodyY",
    "bodyPositionX",
    "bodyYaw",
    "leftShoulderX",
    "leftShoulderY",
    "leftShoulderZ",
    "rightShoulderX",
    "rightShoulderY",
    "rightShoulderZ",
    "leftElbow",
    "rightElbow",
    "leftFootX",
    "leftFootY",
    "leftFootZ",
    "rightFootX",
    "rightFootY",
    "rightFootZ",
)


def _finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(float(value))


def validate_animation(
    job_dir: Path,
    clip_path: Path,
    rig_path: Path,
    character: dict[str, Any],
) -> dict[str, Any]:
    clip = load_json(clip_path)
    rig = load_json(rig_path)
    errors: list[str] = []
    warnings: list[str] = []

    if clip.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if clip.get("targetRig") != "person-rig-chibi-idol":
        errors.append("targetRig must be person-rig-chibi-idol")
    if clip.get("rootMotionMode") not in {"in-place", "stage-travel"}:
        errors.append("rootMotionMode missing")
    if clip.get("quaternionOrder") != ["x", "y", "z", "w"]:
        warnings.append("quaternionOrder should be [x,y,z,w]")

    timestamps = clip.get("timestamps") or []
    poses = clip.get("poses") or []
    if not timestamps or len(timestamps) != len(poses):
        errors.append("timestamps and poses length mismatch")
    if any(not _finite(t) for t in timestamps):
        errors.append("non-finite timestamps")
    if timestamps != sorted(timestamps):
        errors.append("timestamps are not monotonic")
    duration = clip.get("duration")
    if not _finite(duration) or duration <= 0:
        errors.append("duration must be positive")
    elif timestamps and timestamps[-1] > duration + 1e-3:
        errors.append("last timestamp exceeds duration")

    thigh = float(character["thigh"])
    shin = float(character["shin"])
    reach = thigh + shin - 0.02
    back_arms = 0
    turned_body = 0
    k_feet = 0
    facing_camera = clip.get("captureMode") == "front-facing-2d"
    for i, pose in enumerate(poses):
        for key in REQUIRED_POSE:
            if key not in pose or not _finite(pose[key]):
                errors.append(f"pose[{i}].{key} missing or non-finite")
                break
        if "bodyPositionX" in pose and abs(pose["bodyPositionX"]) > 0.5 + 1e-6:
            errors.append(f"pose[{i}].bodyPositionX outside clamp")
        if pose.get("leftElbow", 0) < -1e-6 or pose.get("rightElbow", 0) < -1e-6:
            errors.append(f"pose[{i}] elbow is negative")
        if facing_camera and any(
            shoulder_direction(
                pose.get(f"{side}ShoulderX", 0), pose.get(f"{side}ShoulderY", 0), pose.get(f"{side}ShoulderZ", 0)
            )[2]
            < FORWARD_MIN - 0.03
            for side in ("left", "right")
        ):
            back_arms += 1
        if facing_camera and (
            abs(pose.get("chestY", 0)) > 1e-6
            or abs(pose.get("pelvisTwist", 0)) > 1e-6
            or abs(pose.get("bodyYaw", 0)) > 1e-6
        ):
            turned_body += 1
        if facing_camera and (pose.get("leftFootX", 0) > -0.05 or pose.get("rightFootX", 0) < 0.05):
            k_feet += 1
        if facing_camera and (pose.get("leftFootZ", 0) > 0.025 or pose.get("rightFootZ", 0) > 0.025):
            k_feet += 1
        for side in ("left", "right"):
            x, y, z = pose[f"{side}FootX"], pose[f"{side}FootY"], pose[f"{side}FootZ"]
            if math.hypot(x, y + 0.08, z) > reach + 0.12:
                warnings.append(f"pose[{i}] {side} foot may be near IK reach limit")
    if back_arms:
        errors.append(f"{back_arms} frames fold an upper arm behind the chest (direction Z < {FORWARD_MIN})")
    if turned_body:
        errors.append(f"{turned_body} frames yaw the body away from the audience")
    if k_feet:
        errors.append(f"{k_feet} frames make a K-pose (crossed feet or shin-forward foot Z)")

    feet = clip.get("feet") or {}
    for side in ("left", "right"):
        contact = (feet.get(side) or {}).get("contact")
        if contact is not None and len(contact) != len(poses):
            errors.append(f"feet.{side}.contact length mismatch")

    if "bones" in clip and "root" in (clip.get("bones") or {}):
        errors.append("root track must not be duplicated inside bones")

    planted_both = 0
    if feet:
        left_c = (feet.get("left") or {}).get("contact") or []
        right_c = (feet.get("right") or {}).get("contact") or []
        planted_both = sum(1 for a, b in zip(left_c, right_c) if a and b)
        if left_c and planted_both == len(left_c):
            warnings.append("both feet locked for the entire clip")

    report = {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "frameCount": len(poses),
        "duration": duration,
        "bothFeetPlantedFrames": planted_both,
        "uncertainSpans": len((clip.get("quality") or {}).get("uncertainSpans") or []),
        "rig": rig.get("targetRig"),
        "applyPath": rig.get("applyPath"),
        "clip": str(clip_path),
    }
    out_dir = stage_dir(job_dir, "07-validation")
    save_json(out_dir / "quality.json", report)
    lines = [
        "# Dance validation",
        "",
        f"- ok: {report['ok']}",
        f"- frames: {report['frameCount']}",
        f"- duration: {duration}",
        f"- apply path: {report['applyPath']}",
        f"- uncertain spans: {report['uncertainSpans']}",
        "",
        "## Errors",
        *([f"- {item}" for item in errors] if errors else ["- none"]),
        "",
        "## Warnings",
        *([f"- {item}" for item in warnings] if warnings else ["- none"]),
        "",
        "## Known limits",
        "- front-facing-2d does not reconstruct turns or reliable depth.",
        "- Legs use plantFoot IK; hip/knee Euler tracks are zero by design.",
        "- Shoulders fit the observed upper-arm direction and elbow bend plane; Euler channels are unwrapped for continuity.",
        "- Front-facing-2d locks chest/pelvis yaw at 0 so body and face stay toward the audience.",
        "- Front-facing-2d keeps the upper arm in front of the chest (direction Z >= 0.18) and rejects K-poses.",
        "- full-3d keeps bodyYaw so the character can turn; 2D audience locks do not apply.",
        "- Title cards and other empty detections are not interpolated across long gaps.",
        "- Browser playback must be checked separately.",
        "",
    ]
    (out_dir / "quality-report.md").write_text("\n".join(lines))
    print(f"validation ok={report['ok']} errors={len(errors)} warnings={len(warnings)}")
    if errors:
        raise SystemExit("validation failed:\n" + "\n".join(errors))
    return report


if __name__ == "__main__":
    raise SystemExit("use orchestrator.py")
