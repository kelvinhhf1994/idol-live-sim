#!/usr/bin/env python3
"""Install the Apple Silicon BODY_25 OpenPose runtime.

This is not the official CMU C++ OpenPoseDemo. It loads BODY_25 weights
converted from pose_iter_584000.caffemodel into a PyTorch port.
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
VENV = ROOT / ".venv"
VENDOR = ROOT / "vendor" / "openpose-pytorch"
MODELS = ROOT / "models"
WEIGHTS = MODELS / "body_pose_model_25.pth"
WEIGHTS_URL = (
    "https://huggingface.co/hohs/openpose135-weights/resolve/main/body_pose_model_25.pth"
)
VENDOR_URL = "https://github.com/TracelessLe/OpenPose.PyTorch.git"
MANIFEST = ROOT / "openpose_install.json"


def run(command: list[str], **kwargs) -> None:
    print("+", " ".join(command))
    subprocess.check_call(command, **kwargs)


def venv_python() -> Path:
    return VENV / "bin" / "python"


def ensure_venv() -> None:
    if venv_python().is_file():
        print(f"venv exists: {VENV}")
        return
    uv = shutil.which("uv")
    if uv:
        run([uv, "venv", str(VENV)])
        return
    run([sys.executable, "-m", "venv", str(VENV)])


def ensure_python_deps() -> None:
    uv = shutil.which("uv")
    packages = [
        "torch",
        "torchvision",
        "numpy",
        "scipy",
        "matplotlib",
        "opencv-python-headless",
    ]
    if uv:
        run([uv, "pip", "install", "--python", str(venv_python()), *packages])
        return
    py = str(venv_python())
    run([py, "-m", "ensurepip", "--upgrade"])
    run([py, "-m", "pip", "install", "--upgrade", "pip"])
    run([py, "-m", "pip", "install", *packages])


def ensure_vendor() -> None:
    if not (VENDOR / "src" / "body.py").is_file():
        VENDOR.parent.mkdir(parents=True, exist_ok=True)
        run(["git", "clone", "--depth", "1", VENDOR_URL, str(VENDOR)])
    else:
        print(f"vendor exists: {VENDOR}")
    from apply_vendor_patches import apply

    apply()


def ensure_weights() -> None:
    MODELS.mkdir(parents=True, exist_ok=True)
    if WEIGHTS.is_file() and WEIGHTS.stat().st_size > 50_000_000:
        print(f"weights exist: {WEIGHTS} ({WEIGHTS.stat().st_size} bytes)")
        return
    print(f"Downloading BODY_25 weights (~200MB) from {WEIGHTS_URL}")
    tmp = WEIGHTS.with_suffix(".pth.partial")
    run(
        [
            "curl",
            "-L",
            "--fail",
            "--retry",
            "3",
            "-o",
            str(tmp),
            WEIGHTS_URL,
        ]
    )
    tmp.replace(WEIGHTS)
    print(f"saved {WEIGHTS} ({WEIGHTS.stat().st_size} bytes)")


def write_manifest(device: str, smoke_ok: bool) -> None:
    py = str(venv_python())
    versions = subprocess.check_output(
        [
            py,
            "-c",
            "import torch,cv2,sys; print(sys.version.split()[0]); print(torch.__version__); "
            "print(cv2.__version__); print(torch.backends.mps.is_available())",
        ],
        text=True,
    ).strip().splitlines()
    manifest = {
        "runtime": "pytorch-body25",
        "notOfficialCppOpenPose": True,
        "source": "CMU pose_iter_584000.caffemodel via TracelessLe/OpenPose.PyTorch",
        "weights": str(WEIGHTS),
        "weightsBytes": WEIGHTS.stat().st_size,
        "vendor": str(VENDOR),
        "python": versions[0],
        "torch": versions[1],
        "opencv": versions[2],
        "mpsAvailable": versions[3] == "True",
        "device": device,
        "os": f"{platform.system()} {platform.mac_ver()[0]} {platform.machine()}",
        "smokeTestPassed": smoke_ok,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {MANIFEST}")


def main() -> int:
    print("Installing BODY_25 OpenPose runtime (PyTorch + MPS/CPU)")
    print(f"OS: {platform.system()} {platform.mac_ver()[0]} {platform.machine()}")
    ensure_venv()
    ensure_python_deps()
    ensure_vendor()
    ensure_weights()
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)
    run([str(venv_python()), str(ROOT / "test_openpose.py")], env=env)
    device = subprocess.check_output(
        [
            str(venv_python()),
            "-c",
            "from body25_runtime import resolve_device; print(resolve_device())",
        ],
        text=True,
        env=env,
    ).strip()
    write_manifest(device, smoke_ok=True)
    print("OpenPose BODY_25 smoke test passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
