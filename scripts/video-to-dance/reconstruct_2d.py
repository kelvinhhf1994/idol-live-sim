#!/usr/bin/env python3
"""Constrained front-facing 2D reconstruction. Depth is approximate."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from common import load_json, named_to_xy, save_json, stage_dir


def _xy(frame: dict[str, Any], name: str, min_c: float) -> np.ndarray | None:
    point = named_to_xy(frame["landmarks"], name, min_c)
    if point is None:
        return None
    return np.array(point, dtype=np.float64)


def _first(*points: np.ndarray | None) -> np.ndarray | None:
    for point in points:
        if point is not None:
            return point
    return None


def _median_length(frames: list[dict[str, Any]], a: str, b: str, min_c: float) -> float | None:
    lengths = []
    for frame in frames:
        pa, pb = _xy(frame, a, min_c), _xy(frame, b, min_c)
        if pa is None or pb is None:
            continue
        lengths.append(float(np.linalg.norm(pb - pa)))
    if len(lengths) < 8:
        return None
    return float(np.median(lengths))


def _moving_average(values: np.ndarray, window: int) -> np.ndarray:
    if window <= 1:
        return values.copy()
    kernel = np.ones(window) / window
    pad = window // 2
    filled = values.copy()
    finite = np.isfinite(filled)
    if finite.any():
        filled[~finite] = np.interp(
            np.flatnonzero(~finite),
            np.flatnonzero(finite),
            filled[finite],
        )
    padded = np.pad(filled, (pad, pad), mode="edge")
    return np.convolve(padded, kernel, mode="valid")[: len(values)]


def reconstruct_2d(job_dir: Path, cleaned_path: Path, config: dict[str, Any]) -> dict[str, Any]:
    cleaned = load_json(cleaned_path)
    frames = cleaned["frames"]
    min_c = float(config["openposeMinConfidence"])
    character = config["character"]
    fps = float(cleaned["fps"])

    shoulder_px = _median_length(frames, "LShoulder", "RShoulder", 0.25)
    torso_px = _median_length(frames, "MidHip", "Neck", 0.25)
    if shoulder_px and shoulder_px > 4:
        meters_per_px = float(character["shoulderWidth"]) / shoulder_px
        scale_source = "shoulderWidth"
    elif torso_px and torso_px > 4:
        meters_per_px = float(character["torsoHeight"]) / torso_px
        scale_source = "torsoHeight"
    else:
        raise RuntimeError("could not estimate meters-per-pixel from shoulders or torso")

    midhips = []
    for frame in frames:
        hip = _first(_xy(frame, "MidHip", min_c), _xy(frame, "Neck", min_c))
        midhips.append(hip)
    valid_hips = [p[1] for p in midhips if p is not None]
    standing_hip_y = float(np.percentile(valid_hips, 95)) if valid_hips else 0.0
    origin_samples = [p[0] for p in midhips[: max(1, int(fps))] if p is not None]
    origin_x = float(np.median(origin_samples)) if origin_samples else cleaned["width"] * 0.5

    hip_x_m = np.full(len(frames), np.nan)
    hip_y_m = np.full(len(frames), np.nan)
    for i, hip in enumerate(midhips):
        if hip is None:
            continue
        # Facing-camera photo: anatomical left is on the viewer's right (high image x).
        # Character left is -X. Negate image X so L→left and R→right stay anatomical.
        hip_x_m[i] = -(hip[0] - origin_x) * meters_per_px
        hip_y_m[i] = -(hip[1] - standing_hip_y) * meters_per_px
    window = max(3, int(float(config["inPlaceHipWindowSec"]) * fps))
    hip_x_slow = _moving_average(hip_x_m, window)

    out_frames = []
    uncertain: list[dict[str, Any]] = list(cleaned.get("uncertainSpans") or [])
    for i, frame in enumerate(frames):
        hip = midhips[i]
        joints: dict[str, list[float] | None] = {}
        missing = list(frame.get("missing") or [])
        confidence = {name: float(frame["landmarks"][name]["c"]) for name in frame["landmarks"]}
        if hip is None:
            uncertain.append(
                {
                    "joint": "MidHip",
                    "startTime": frame["timestamp"],
                    "endTime": frame["timestamp"],
                    "reason": "missing-root",
                }
            )
        for name, point in frame["landmarks"].items():
            if point["c"] <= 0 or name in missing:
                joints[name] = None
                continue
            # Pelvis-relative, y-up. Z stays 0 in this mode except later depth hacks.
            if hip is None:
                joints[name] = None
                continue
            joints[name] = [
                float(-(point["x"] - hip[0]) * meters_per_px),
                float(-(point["y"] - hip[1]) * meters_per_px),
                0.0,
            ]

        root_x = 0.0
        root_y = 0.0
        if np.isfinite(hip_x_m[i]):
            root_x = float(hip_x_m[i] - hip_x_slow[i])
        if np.isfinite(hip_y_m[i]):
            root_y = float(np.clip(hip_y_m[i], -0.08, 0.22))

        # Approximate reach-in-depth from foreshortened limbs. Conservative Z only.
        for side, shin_name in (("L", "LKnee"), ("R", "RKnee")):
            hip_j = joints.get(f"{side}Hip")
            knee = joints.get(f"{side}Knee")
            ankle = joints.get(f"{side}Ankle")
            if hip_j and knee and ankle:
                shin = float(np.linalg.norm(np.array(ankle) - np.array(knee)))
                if shin < float(character["shin"]) * 0.72:
                    ankle[2] = 0.07
                    uncertain.append(
                        {
                            "joint": f"{side}Ankle",
                            "startTime": frame["timestamp"],
                            "endTime": frame["timestamp"],
                            "reason": "foreshortened-shin-depth-approximate",
                        }
                    )

        image_points = {}
        for name in ("MidHip", "LAnkle", "RAnkle", "LHeel", "RHeel"):
            point = frame["landmarks"].get(name)
            if point and point["c"] > 0:
                image_points[name] = [float(point["x"]), float(point["y"]), float(point["c"])]

        out_frames.append(
            {
                "timestamp": frame["timestamp"],
                "frameIndex": frame["frameIndex"],
                "root": {"x": root_x, "y": root_y, "z": 0.0},
                "facingYaw": 0.0,
                "joints": joints,
                "image": image_points,
                "confidence": confidence,
                "missing": missing,
            }
        )

    payload = {
        "mode": "front-facing-2d",
        "units": "meters",
        "coordinateSystem": {
            "x": "right",
            "y": "up",
            "z": "forward-approximate",
            "space": "pelvis-relative-joints-plus-root",
        },
        "facing": "fixed +Z toward camera; large yaw is not estimated",
        "imageToCharacterX": "negated",
        "metersPerPixel": meters_per_px,
        "scaleSource": scale_source,
        "timestamps": [frame["timestamp"] for frame in out_frames],
        "frames": out_frames,
        "uncertainSpans": uncertain,
        "limitations": [
            "Forward/back arm reach and crossed limbs are approximate.",
            "Turns and body yaw are not reconstructed.",
            "Root Z is zero; in-place mode subtracts slow hip travel.",
        ],
    }
    dest = stage_dir(job_dir, "05-reconstructed") / "canonical.motion.json"
    save_json(dest, payload)
    print(f"reconstructed {len(out_frames)} frames m/px={meters_per_px:.5f} via {scale_source} -> {dest}")
    return payload


if __name__ == "__main__":
    raise SystemExit("use orchestrator.py")
