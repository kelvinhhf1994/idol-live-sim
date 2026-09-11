"""BODY_25 OpenPose runtime for Apple Silicon (MPS) or CPU.

Uses the official CMU BODY_25 architecture via the TracelessLe PyTorch port.
Weights are converted from pose_iter_584000.caffemodel. This is not MediaPipe.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parent
VENDOR = ROOT / "vendor" / "openpose-pytorch"
DEFAULT_WEIGHTS = ROOT / "models" / "body_pose_model_25.pth"

if str(VENDOR) not in sys.path:
    sys.path.insert(0, str(VENDOR))

from src.body import Body, resolve_torch_device  # noqa: E402
from src import util  # noqa: E402


def resolve_device() -> torch.device:
    return resolve_torch_device()


class Body25(Body):
    """BODY_25 detector. Hands/face stay off unless a later stage requests them."""

    def __init__(self, model_path: str | Path, device: torch.device | None = None):
        super().__init__(str(model_path), "body25")
        if device is not None and device != self.device:
            self.device = device
            self.model.to(device)


def people_to_openpose_json(candidate: np.ndarray, subset: np.ndarray) -> dict:
    """Convert vendor peaks to official OpenPose BODY_25 people JSON."""
    people = []
    if subset is None or len(subset) == 0:
        return {"version": 1.3, "people": []}

    for person in subset:
        keypoints = []
        for joint_index in range(25):
            peak_index = int(person[joint_index])
            if peak_index < 0 or candidate is None or len(candidate) == 0:
                keypoints.extend([0.0, 0.0, 0.0])
                continue
            x, y, score = candidate[peak_index][:3]
            keypoints.extend([float(x), float(y), float(score)])
        people.append(
            {
                "person_id": [-1],
                "pose_keypoints_2d": keypoints,
                "face_keypoints_2d": [],
                "hand_left_keypoints_2d": [],
                "hand_right_keypoints_2d": [],
            }
        )
    return {"version": 1.3, "people": people}


def load_body25(model_path: str | Path | None = None) -> Body25:
    path = Path(model_path) if model_path else DEFAULT_WEIGHTS
    if not path.is_file():
        raise FileNotFoundError(
            f"BODY_25 weights missing: {path}. Run scripts/video-to-dance/install_openpose.py"
        )
    return Body25(path)


# Keep util available for overlay tests.
draw_bodypose = util.draw_bodypose
