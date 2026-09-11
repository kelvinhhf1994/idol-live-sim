"""Shared paths, BODY_25 names, and resume helpers for the video-to-dance pipeline."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parent.parent
VENV_PYTHON = SCRIPT_DIR / ".venv" / "bin" / "python"
DEFAULT_CONFIG = SCRIPT_DIR / "video_to_dance_config.json"
DEFAULT_RIG = SCRIPT_DIR / "rig-mapping.json"
JOBS_ROOT = REPO / "tmp" / "video-to-dance"

BODY25_NAMES: tuple[str, ...] = (
    "Nose",
    "Neck",
    "RShoulder",
    "RElbow",
    "RWrist",
    "LShoulder",
    "LElbow",
    "LWrist",
    "MidHip",
    "RHip",
    "RKnee",
    "RAnkle",
    "LHip",
    "LKnee",
    "LAnkle",
    "REye",
    "LEye",
    "REar",
    "LEar",
    "LBigToe",
    "LSmallToe",
    "LHeel",
    "RBigToe",
    "RSmallToe",
    "RHeel",
)

BODY25_INDEX = {name: i for i, name in enumerate(BODY25_NAMES)}

BODY25_PAIRS: tuple[tuple[str, str], ...] = (
    ("Neck", "MidHip"),
    ("Neck", "RShoulder"),
    ("Neck", "LShoulder"),
    ("RShoulder", "RElbow"),
    ("RElbow", "RWrist"),
    ("LShoulder", "LElbow"),
    ("LElbow", "LWrist"),
    ("MidHip", "RHip"),
    ("RHip", "RKnee"),
    ("RKnee", "RAnkle"),
    ("MidHip", "LHip"),
    ("LHip", "LKnee"),
    ("LKnee", "LAnkle"),
    ("Neck", "Nose"),
    ("LAnkle", "LBigToe"),
    ("LAnkle", "LHeel"),
    ("RAnkle", "RBigToe"),
    ("RAnkle", "RHeel"),
)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")


def load_config(path: Path | None = None) -> dict[str, Any]:
    return load_json(path or DEFAULT_CONFIG)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def run(command: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(command))
    return subprocess.run(command, check=True, text=True, **kwargs)


def keypoints_to_named(flat: list[float]) -> dict[str, dict[str, float]]:
    named: dict[str, dict[str, float]] = {}
    for index, name in enumerate(BODY25_NAMES):
        x, y, confidence = flat[index * 3 : index * 3 + 3]
        named[name] = {"x": float(x), "y": float(y), "c": float(confidence)}
    return named


def named_to_xy(named: dict[str, dict[str, float]], name: str, min_c: float) -> tuple[float, float] | None:
    point = named.get(name)
    if point is None or point["c"] < min_c:
        return None
    return point["x"], point["y"]


def stage_dir(job_dir: Path, name: str) -> Path:
    path = job_dir / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_manifest(job_dir: Path, stage: str, payload: dict[str, Any]) -> None:
    save_json(stage_dir(job_dir, stage) / "manifest.json", payload)


def read_manifest(job_dir: Path, stage: str) -> dict[str, Any] | None:
    path = job_dir / stage / "manifest.json"
    if not path.is_file():
        return None
    return load_json(path)


def can_resume(job_dir: Path, stage: str, inputs: dict[str, Any]) -> bool:
    manifest = read_manifest(job_dir, stage)
    if not manifest or not manifest.get("ok"):
        return False
    return manifest.get("inputs") == inputs
