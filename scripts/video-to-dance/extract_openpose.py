#!/usr/bin/env python3
"""Extract OpenPose BODY_25 landmarks and write an overlay video."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from body25_runtime import draw_bodypose, load_body25, people_to_openpose_json
from common import (
    BODY25_NAMES,
    BODY25_PAIRS,
    keypoints_to_named,
    run,
    save_json,
    stage_dir,
)

MIN_CENTER_CONF = 0.12


def _center(named: dict[str, dict[str, float]]) -> np.ndarray | None:
    for key in ("MidHip", "Neck", "Nose"):
        point = named[key]
        if point["c"] >= MIN_CENTER_CONF:
            return np.array([point["x"], point["y"]], dtype=np.float64)
    return None


def _score_person(named: dict[str, dict[str, float]]) -> float:
    keys = ("MidHip", "Neck", "LAnkle", "RAnkle", "LShoulder", "RShoulder")
    return float(sum(named[key]["c"] for key in keys))


def _track(
    people: list[dict[str, Any]],
    prev_center: np.ndarray | None,
    width: int,
    max_jump_frac: float,
) -> tuple[int | None, dict[str, dict[str, float]] | None, np.ndarray | None]:
    parsed = [keypoints_to_named(person["pose_keypoints_2d"]) for person in people]
    if not parsed:
        return None, None, prev_center

    if prev_center is None:
        best_i = max(range(len(parsed)), key=lambda i: _score_person(parsed[i]))
        return best_i, parsed[best_i], _center(parsed[best_i])

    limit = max(24.0, width * max_jump_frac)
    best_i = None
    best_d = limit
    for i, named in enumerate(parsed):
        center = _center(named)
        if center is None:
            continue
        dist = float(np.linalg.norm(center - prev_center))
        if dist < best_d:
            best_d = dist
            best_i = i
    if best_i is None:
        return None, None, prev_center
    return best_i, parsed[best_i], _center(parsed[best_i])


def _draw_selected(image: np.ndarray, named: dict[str, dict[str, float]]) -> None:
    for a, b in BODY25_PAIRS:
        pa, pb = named[a], named[b]
        if pa["c"] < 0.05 or pb["c"] < 0.05:
            continue
        cv2.line(
            image,
            (int(pa["x"]), int(pa["y"])),
            (int(pb["x"]), int(pb["y"])),
            (0, 220, 255),
            2,
            cv2.LINE_AA,
        )
    for name in BODY25_NAMES:
        point = named[name]
        if point["c"] < 0.05:
            continue
        cv2.circle(image, (int(point["x"]), int(point["y"])), 3, (0, 255, 180), -1, cv2.LINE_AA)


def extract_openpose(
    job_dir: Path,
    analysis_mp4: Path,
    analysis_meta: dict[str, Any],
    *,
    max_jump_frac: float,
    resume: bool,
    scale_search: list[float] | None = None,
) -> dict[str, Any]:
    out_dir = stage_dir(job_dir, "03-openpose")
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    overlay_path = out_dir / "overlay.mp4"
    combined_path = out_dir / "landmarks.combined.json"

    cap = cv2.VideoCapture(str(analysis_mp4))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {analysis_mp4}")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = float(analysis_meta.get("fps") or cap.get(cv2.CAP_PROP_FPS) or 30)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    body = load_body25()
    body.scale_search = list(scale_search or [0.5, 1.0, 1.5])
    print(f"openpose scales={body.scale_search} size={width}x{height} fps={fps:.2f}", flush=True)
    frames: list[dict[str, Any]] = []
    prev_center = None
    identity = "track-0"
    started = time.time()
    missing_frames = 0

    writer = cv2.VideoWriter(
        str(overlay_path.with_suffix(".avi")),
        cv2.VideoWriter_fourcc(*"MJPG"),
        fps,
        (width, height),
    )
    if not writer.isOpened():
        raise RuntimeError("failed to open overlay writer")

    frame_index = 0
    while True:
        ok, image = cap.read()
        if not ok:
            break
        raw_path = raw_dir / f"{frame_index:06d}.json"
        if resume and raw_path.is_file():
            payload = json.loads(raw_path.read_text())
            candidate = None
            subset = None
        else:
            candidate, subset = body(image)
            payload = people_to_openpose_json(candidate, subset)
            raw_path.write_text(json.dumps(payload) + "\n")

        people = payload.get("people") or []
        person_i, named, prev_center = _track(people, prev_center, width, max_jump_frac)
        timestamp = frame_index / fps
        if named is None:
            missing_frames += 1
            missing = list(BODY25_NAMES)
            landmarks: dict[str, dict[str, float]] = {
                name: {"x": 0.0, "y": 0.0, "c": 0.0} for name in BODY25_NAMES
            }
            detected = False
        else:
            landmarks = named
            missing = [name for name, point in named.items() if point["c"] <= 0]
            detected = True

        frames.append(
            {
                "frameIndex": frame_index,
                "timestamp": timestamp,
                "identity": identity,
                "detected": detected,
                "personIndex": person_i,
                "peopleCount": len(people),
                "landmarks": landmarks,
                "missing": missing,
            }
        )

        overlay = image.copy()
        if candidate is not None and subset is not None:
            overlay = draw_bodypose(overlay, candidate, subset, "body25")
        if named is not None:
            _draw_selected(overlay, named)
        label = f"{frame_index:04d}  {identity}  people={len(people)}"
        if not detected:
            label += "  LOST"
        cv2.putText(overlay, label, (16, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 3, cv2.LINE_AA)
        cv2.putText(overlay, label, (16, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 1, cv2.LINE_AA)
        writer.write(overlay)

        if frame_index % 10 == 0 or frame_index + 1 == total:
            elapsed = max(0.001, time.time() - started)
            rate = (frame_index + 1) / elapsed
            remain = (total - frame_index - 1) / rate if total and rate else 0
            print(
                f"openpose {frame_index + 1}/{total or '?'}  {rate:.2f} fps  eta={remain:.0f}s",
                flush=True,
            )
        frame_index += 1

    cap.release()
    writer.release()

    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(overlay_path.with_suffix(".avi")),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-an",
            str(overlay_path),
        ]
    )
    overlay_path.with_suffix(".avi").unlink(missing_ok=True)

    combined = {
        "model": "BODY_25",
        "runtime": "pytorch-body25",
        "selectedIdentity": identity,
        "coordinateSystem": {"x": "right", "y": "down", "origin": "image-top-left"},
        "width": width,
        "height": height,
        "fps": fps,
        "frameCount": len(frames),
        "missingFrames": missing_frames,
        "frames": frames,
    }
    save_json(combined_path, combined)
    print(f"wrote {combined_path} missing={missing_frames}/{len(frames)}")
    return combined


if __name__ == "__main__":
    raise SystemExit("use orchestrator.py")
