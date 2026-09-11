#!/usr/bin/env python3
"""Lift cleaned OpenPose BODY_25 tracks to canonical 3D with MotionBERT.

This is a real monocular 3D estimator (temporal lift + torso facing), not a
2D depth hack. WHAM/GVHMR are not used: they need CUDA and SMPL licenses.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
import torch

from common import BODY25_NAMES, SCRIPT_DIR, load_json, save_json, stage_dir

VENDOR = SCRIPT_DIR / "vendor" / "MotionBERT"
CKPT = SCRIPT_DIR / "models" / "motionbert" / "FT_MB_release_MB_ft_h36m.bin"

H36M_FROM_BODY25 = (
    "MidHip",
    "RHip",
    "RKnee",
    "RAnkle",
    "LHip",
    "LKnee",
    "LAnkle",
    "Spine",
    "Neck",
    "Nose",
    "Head",
    "LShoulder",
    "LElbow",
    "LWrist",
    "RShoulder",
    "RElbow",
    "RWrist",
)

H36M_TO_BODY25 = {
    0: "MidHip",
    1: "RHip",
    2: "RKnee",
    3: "RAnkle",
    4: "LHip",
    5: "LKnee",
    6: "LAnkle",
    8: "Neck",
    9: "Nose",
    11: "LShoulder",
    12: "LElbow",
    13: "LWrist",
    14: "RShoulder",
    15: "RElbow",
    16: "RWrist",
}


def _ensure_vendor() -> None:
    if not (VENDOR / "lib" / "model" / "DSTformer.py").is_file() or not CKPT.is_file():
        raise SystemExit(
            "full-3d backend missing. Run: "
            "scripts/video-to-dance/.venv/bin/python scripts/video-to-dance/install_motionbert.py"
        )
    if str(VENDOR) not in sys.path:
        sys.path.insert(0, str(VENDOR))


def _body25_to_h36m(frames: list[dict[str, Any]], width: float, height: float) -> np.ndarray:
    motion = np.zeros((len(frames), 17, 3), dtype=np.float32)
    for i, frame in enumerate(frames):
        marks = frame.get("landmarks") or {}
        def xy(name: str) -> np.ndarray:
            point = marks.get(name) or {"x": 0.0, "y": 0.0, "c": 0.0}
            return np.array([point["x"], point["y"], point["c"]], dtype=np.float32)

        mid = xy("MidHip")
        neck = xy("Neck")
        nose = xy("Nose")
        leye, reye = xy("LEye"), xy("REye")
        head = nose.copy()
        if leye[2] > 0.1 and reye[2] > 0.1:
            head[:2] = 0.5 * (leye[:2] + reye[:2])
            head[2] = min(leye[2], reye[2])
        motion[i, 0] = mid
        motion[i, 1] = xy("RHip")
        motion[i, 2] = xy("RKnee")
        motion[i, 3] = xy("RAnkle")
        motion[i, 4] = xy("LHip")
        motion[i, 5] = xy("LKnee")
        motion[i, 6] = xy("LAnkle")
        motion[i, 7] = 0.5 * (neck + mid)
        motion[i, 8] = neck
        motion[i, 9] = nose
        motion[i, 10] = head
        motion[i, 11] = xy("LShoulder")
        motion[i, 12] = xy("LElbow")
        motion[i, 13] = xy("LWrist")
        motion[i, 14] = xy("RShoulder")
        motion[i, 15] = xy("RElbow")
        motion[i, 16] = xy("RWrist")
    # MotionBERT wild infer: normalize_screen_coordinates(X, w, h)
    motion[:, :, 0] = motion[:, :, 0] / width * 2.0 - 1.0
    motion[:, :, 1] = motion[:, :, 1] / width * 2.0 - height / width
    return motion


def _load_model(device: torch.device) -> torch.nn.Module:
    from lib.model.DSTformer import DSTformer

    model = DSTformer(
        dim_in=3,
        dim_out=3,
        dim_feat=512,
        dim_rep=512,
        depth=5,
        num_heads=8,
        mlp_ratio=2,
        num_joints=17,
        maxlen=243,
        att_fuse=True,
    )
    checkpoint = torch.load(CKPT, map_location="cpu", weights_only=False)
    state = checkpoint["model_pos"] if isinstance(checkpoint, dict) and "model_pos" in checkpoint else checkpoint
    cleaned = {key.replace("module.", ""): value for key, value in state.items()}
    model.load_state_dict(cleaned, strict=False)
    model.to(device)
    model.eval()
    return model


def _windows(length: int, clip_len: int = 243, stride: int = 81) -> list[tuple[int, int]]:
    if length <= clip_len:
        return [(0, length)]
    out = []
    start = 0
    while start + clip_len < length:
        out.append((start, start + clip_len))
        start += stride
    out.append((length - clip_len, length))
    return out


def _lift(motion2d: np.ndarray, device: torch.device) -> np.ndarray:
    model = _load_model(device)
    n = len(motion2d)
    acc = np.zeros((n, 17, 3), dtype=np.float64)
    weight = np.zeros(n, dtype=np.float64)
    with torch.no_grad():
        for start, end in _windows(n):
            chunk = motion2d[start:end]
            if len(chunk) < 243:
                pad = np.repeat(chunk[-1:], 243 - len(chunk), axis=0)
                chunk = np.concatenate([chunk, pad], axis=0)
            tensor = torch.from_numpy(chunk).unsqueeze(0).to(device)
            pred = model(tensor)[0, : end - start].detach().cpu().numpy()
            acc[start:end] += pred
            weight[start:end] += 1.0
    return (acc / np.maximum(weight[:, None, None], 1.0)).astype(np.float32)


def _facing_yaw(l_sh: np.ndarray, r_sh: np.ndarray) -> float:
    line = r_sh - l_sh
    facing = np.array([-line[2], 0.0, line[0]], dtype=np.float64)
    if float(np.linalg.norm(facing)) < 1e-6:
        return 0.0
    return float(math.atan2(facing[0], facing[2]))


def _unwrap(values: list[float]) -> list[float]:
    out: list[float] = []
    acc = 0.0
    prev = None
    for raw in values:
        if prev is None:
            acc = raw
        else:
            delta = raw - prev
            delta = (delta + math.pi) % (2.0 * math.pi) - math.pi
            acc += delta
        prev = raw
        out.append(acc)
    return out


def reconstruct_3d(job_dir: Path, cleaned_path: Path, config: dict[str, Any]) -> dict[str, Any]:
    _ensure_vendor()
    cleaned = load_json(cleaned_path)
    frames = cleaned["frames"]
    width = float(cleaned["width"])
    height = float(cleaned["height"])
    character = config["character"]
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    motion2d = _body25_to_h36m(frames, width, height)
    lifted = _lift(motion2d, device)

    # MotionBERT H36M: x-right, y-up, z-away-from-camera. Flip Z so +Z faces audience.
    # Negate X so anatomical left maps to character -X.
    lifted[:, :, 0] *= -1.0
    lifted[:, :, 2] *= -1.0

    shoulder = np.linalg.norm(lifted[:, 11] - lifted[:, 14], axis=1)
    valid = shoulder[shoulder > 1e-4]
    src = float(np.median(valid)) if len(valid) else 1.0
    meters = float(character["shoulderWidth"]) / max(src, 1e-4)
    lifted *= meters

    yaws = []
    out_frames = []
    uncertain: list[dict[str, Any]] = list(cleaned.get("uncertainSpans") or [])
    for i, frame in enumerate(frames):
        joints: dict[str, list[float] | None] = {name: None for name in BODY25_NAMES}
        for h36m_i, name in H36M_TO_BODY25.items():
            point = lifted[i, h36m_i]
            joints[name] = [float(point[0] - lifted[i, 0, 0]), float(point[1] - lifted[i, 0, 1]), float(point[2] - lifted[i, 0, 2])]
        l_sh = np.array(joints["LShoulder"] or [0.0, 0.0, 0.0])
        r_sh = np.array(joints["RShoulder"] or [0.0, 0.0, 0.0])
        yaw = _facing_yaw(l_sh, r_sh)
        yaws.append(yaw)
        confidence = {name: float((frame.get("landmarks") or {}).get(name, {}).get("c") or 0.0) for name in BODY25_NAMES}
        out_frames.append(
            {
                "timestamp": frame["timestamp"],
                "frameIndex": frame["frameIndex"],
                "root": {
                    "x": float(lifted[i, 0, 0]),
                    "y": float(np.clip(lifted[i, 0, 1], -0.08, 0.22)),
                    "z": float(lifted[i, 0, 2]),
                },
                "facingYaw": yaw,
                "joints": joints,
                "confidence": confidence,
                "missing": list(frame.get("missing") or []),
            }
        )
    unwrapped = _unwrap(yaws)
    hip_x = np.array([frame["root"]["x"] for frame in out_frames])
    window = max(3, int(float(config["inPlaceHipWindowSec"]) * float(cleaned["fps"])))
    kernel = np.ones(window) / window
    hip_x_slow = np.convolve(np.pad(hip_x, (window // 2, window // 2), mode="edge"), kernel, mode="valid")[: len(hip_x)]
    for i, frame in enumerate(out_frames):
        frame["facingYaw"] = float(unwrapped[i])
        frame["root"]["x"] = float(hip_x[i] - hip_x_slow[i])
        frame["root"]["z"] = 0.0

    payload = {
        "mode": "full-3d",
        "backend": "motionbert-h36m",
        "units": "meters",
        "coordinateSystem": {
            "x": "right",
            "y": "up",
            "z": "forward-toward-audience",
            "space": "pelvis-relative-joints-plus-root",
        },
        "facing": "estimated from 3D shoulder line; yaw is unwrapped",
        "metersPerPixel": None,
        "scaleSource": "shoulderWidth-from-motionbert",
        "timestamps": [frame["timestamp"] for frame in out_frames],
        "frames": out_frames,
        "uncertainSpans": uncertain,
        "limitations": [
            "MotionBERT lifts OpenPose 2D; hidden limbs and exact mesh twist are approximate.",
            "Root Z is removed in in-place mode; facing yaw is kept.",
            "WHAM/GVHMR were not available (no CUDA / SMPL license).",
        ],
    }
    dest = stage_dir(job_dir, "05-reconstructed") / "canonical.motion.json"
    save_json(dest, payload)
    print(f"reconstructed-3d {len(out_frames)} frames via MotionBERT -> {dest}")
    return payload


def main() -> int:
    print("use orchestrator.py --mode full-3d", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
