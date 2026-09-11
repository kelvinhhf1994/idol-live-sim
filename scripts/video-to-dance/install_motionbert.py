#!/usr/bin/env python3
"""Install MotionBERT pose-lift weights for full-3d on this machine (MPS/CPU)."""

from __future__ import annotations

import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENDOR = ROOT / "vendor" / "MotionBERT"
CKPT_DIR = ROOT / "models" / "motionbert"
CKPT = CKPT_DIR / "FT_MB_release_MB_ft_h36m.bin"
CKPT_URL = (
    "https://huggingface.co/walterzhu/MotionBERT/resolve/main/"
    "checkpoint/pose3d/FT_MB_release_MB_ft_h36m/best_epoch.bin"
)
REPO_URL = "https://github.com/Walter0807/MotionBERT.git"


def main() -> int:
    VENDOR.parent.mkdir(parents=True, exist_ok=True)
    if not (VENDOR / "lib" / "model" / "DSTformer.py").is_file():
        if VENDOR.exists():
            raise SystemExit(f"incomplete MotionBERT vendor at {VENDOR}")
        subprocess.check_call(["git", "clone", "--depth", "1", REPO_URL, str(VENDOR)])
    CKPT_DIR.mkdir(parents=True, exist_ok=True)
    if not CKPT.is_file():
        print(f"downloading {CKPT_URL}")
        try:
            urllib.request.urlretrieve(CKPT_URL, CKPT)
        except Exception as exc:
            print(f"urllib failed ({exc}); trying curl")
            subprocess.check_call(["curl", "-L", "--fail", "-o", str(CKPT), CKPT_URL])
    print(f"motionbert vendor={VENDOR} checkpoint={CKPT} bytes={CKPT.stat().st_size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
