#!/usr/bin/env python3
"""Confidence filter, short-gap interpolation, and light temporal smoothing."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from scipy.ndimage import gaussian_filter1d

from common import BODY25_NAMES, load_json, save_json, stage_dir


def _series(frames: list[dict[str, Any]], name: str, axis: str) -> np.ndarray:
    values = np.full(len(frames), np.nan, dtype=np.float64)
    for i, frame in enumerate(frames):
        point = frame["landmarks"][name]
        values[i] = point[axis]
    return values


def _conf(frames: list[dict[str, Any]], name: str) -> np.ndarray:
    return np.array([frame["landmarks"][name]["c"] for frame in frames], dtype=np.float64)


def _reject_low_confidence(values: np.ndarray, confidence: np.ndarray, min_c: float) -> np.ndarray:
    out = values.copy()
    out[confidence < min_c] = np.nan
    out[confidence <= 0] = np.nan
    return out


def _reject_outliers(values: np.ndarray, jump: float) -> np.ndarray:
    out = values.copy()
    valid = np.where(np.isfinite(out))[0]
    for k in range(1, len(valid) - 1):
        i_prev, i, i_next = valid[k - 1], valid[k], valid[k + 1]
        if i_next - i_prev > 3:
            continue
        prev, cur, nxt = out[i_prev], out[i], out[i_next]
        if abs(cur - prev) > jump and abs(nxt - prev) < jump * 0.55:
            out[i] = np.nan
    return out


def _interpolate_short_gaps(values: np.ndarray, max_gap: int) -> tuple[np.ndarray, list[tuple[int, int]]]:
    out = values.copy()
    long_gaps: list[tuple[int, int]] = []
    n = len(out)
    i = 0
    while i < n:
        if np.isfinite(out[i]):
            i += 1
            continue
        start = i
        while i < n and not np.isfinite(out[i]):
            i += 1
        end = i
        gap = end - start
        left = start - 1
        right = end if end < n and np.isfinite(out[end]) else -1
        if left >= 0 and right >= 0 and gap <= max_gap:
            for j in range(start, end):
                t = (j - left) / (right - left)
                out[j] = out[left] * (1 - t) + out[right] * t
        else:
            long_gaps.append((start, end))
    return out, long_gaps


def _smooth(values: np.ndarray, sigma: float) -> np.ndarray:
    if not np.isfinite(values).any():
        return values
    filled = values.copy()
    finite = np.isfinite(filled)
    if finite.sum() == 0:
        return values
    # Hold edges so the gaussian window does not pull toward zero.
    first = int(np.argmax(finite))
    last = int(len(filled) - 1 - np.argmax(finite[::-1]))
    filled[:first] = filled[first]
    filled[last + 1 :] = filled[last]
    idx = np.arange(len(filled))
    filled[~finite] = np.interp(idx[~finite], idx[finite], filled[finite])
    smoothed = gaussian_filter1d(filled, sigma=sigma, mode="nearest")
    smoothed[~np.isfinite(values)] = np.nan
    return smoothed


def clean_landmarks(job_dir: Path, combined_path: Path, config: dict[str, Any]) -> dict[str, Any]:
    payload = load_json(combined_path)
    frames = payload["frames"]
    min_c = float(config["openposeMinConfidence"])
    max_gap = int(config["interpMaxGapFrames"])
    uncertain_gap = int(config["uncertainGapFrames"])
    sigma = float(config["smoothSigmaFrames"])
    jump = float(config["outlierJumpPx"])

    cleaned_frames = []
    uncertain_spans: list[dict[str, Any]] = []

    arrays: dict[str, dict[str, np.ndarray]] = {}
    for name in BODY25_NAMES:
        confidence = _conf(frames, name)
        xs = _reject_outliers(_reject_low_confidence(_series(frames, name, "x"), confidence, min_c), jump)
        ys = _reject_outliers(_reject_low_confidence(_series(frames, name, "y"), confidence, min_c), jump)
        xs, gaps_x = _interpolate_short_gaps(xs, max_gap)
        ys, gaps_y = _interpolate_short_gaps(ys, max_gap)
        xs = _smooth(xs, sigma)
        ys = _smooth(ys, sigma)
        arrays[name] = {"x": xs, "y": ys, "c": confidence}
        for start, end in gaps_x + gaps_y:
            if end - start >= uncertain_gap:
                uncertain_spans.append(
                    {
                        "joint": name,
                        "startFrame": start,
                        "endFrame": end,
                        "startTime": frames[start]["timestamp"],
                        "endTime": frames[min(end, len(frames) - 1)]["timestamp"],
                        "reason": "long-occlusion-not-interpolated",
                    }
                )

    for i, frame in enumerate(frames):
        landmarks = {}
        missing = []
        for name in BODY25_NAMES:
            x = arrays[name]["x"][i]
            y = arrays[name]["y"][i]
            c = float(arrays[name]["c"][i])
            if not np.isfinite(x) or not np.isfinite(y):
                landmarks[name] = {"x": 0.0, "y": 0.0, "c": 0.0}
                missing.append(name)
            else:
                landmarks[name] = {"x": float(x), "y": float(y), "c": c}
        cleaned_frames.append(
            {
                "frameIndex": frame["frameIndex"],
                "timestamp": frame["timestamp"],
                "identity": frame["identity"],
                "detected": len(missing) < 20,
                "peopleCount": frame.get("peopleCount", 0),
                "landmarks": landmarks,
                "missing": missing,
            }
        )

    out = {
        "model": "BODY_25",
        "selectedIdentity": payload.get("selectedIdentity"),
        "coordinateSystem": payload.get("coordinateSystem"),
        "width": payload["width"],
        "height": payload["height"],
        "fps": payload["fps"],
        "minConfidence": min_c,
        "interpMaxGapFrames": max_gap,
        "smoothSigmaFrames": sigma,
        "frames": cleaned_frames,
        "uncertainSpans": uncertain_spans,
    }
    dest = stage_dir(job_dir, "04-cleaned") / "landmarks.cleaned.json"
    save_json(dest, out)
    print(f"cleaned {len(cleaned_frames)} frames, uncertainSpans={len(uncertain_spans)} -> {dest}")
    return out


if __name__ == "__main__":
    raise SystemExit("use orchestrator.py")
