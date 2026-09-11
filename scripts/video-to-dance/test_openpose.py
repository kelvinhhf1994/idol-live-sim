#!/usr/bin/env python3
"""Small BODY_25 extraction test. Do not claim OpenPose is ready without this."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from body25_runtime import DEFAULT_WEIGHTS, draw_bodypose, load_body25, people_to_openpose_json, resolve_device

VENDOR = ROOT / "vendor" / "openpose-pytorch"
OUT_DIR = ROOT / "tmp"
OVERLAY = OUT_DIR / "openpose_smoke_overlay.png"
JSON_OUT = OUT_DIR / "openpose_smoke.json"


def main() -> int:
    image_path = VENDOR / "demo.jpg"
    if not image_path.is_file():
        raise FileNotFoundError(f"missing test image: {image_path}")
    if not DEFAULT_WEIGHTS.is_file():
        raise FileNotFoundError(f"missing weights: {DEFAULT_WEIGHTS}")

    device = resolve_device()
    print(f"device={device}")
    print(f"weights={DEFAULT_WEIGHTS} ({DEFAULT_WEIGHTS.stat().st_size} bytes)")

    body = load_body25()
    image = cv2.imread(str(image_path))
    if image is None:
        raise RuntimeError(f"failed to read {image_path}")

    candidate, subset = body(image)
    payload = people_to_openpose_json(candidate, subset)
    people = payload["people"]
    if not people:
        raise RuntimeError("smoke test detected 0 people on demo.jpg")

    first = people[0]["pose_keypoints_2d"]
    if len(first) != 75:
        raise RuntimeError(f"expected 25*3 keypoints, got {len(first)}")

    named_hits = sum(1 for i in range(25) if first[i * 3 + 2] > 0)
    if named_hits < 8:
        raise RuntimeError(f"too few confident joints: {named_hits}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    overlay = draw_bodypose(image.copy(), candidate, subset, "body25")
    cv2.imwrite(str(OVERLAY), overlay)
    JSON_OUT.write_text(json.dumps(payload, indent=2) + "\n")

    print(f"people={len(people)}")
    print(f"confident_joints={named_hits}/25")
    print(f"overlay={OVERLAY}")
    print(f"json={JSON_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
