#!/usr/bin/env python3
"""Detect tools needed by the video-to-dance pipeline."""

from __future__ import annotations

import json
import platform
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "openpose_install.json"
VENV_PYTHON = ROOT / ".venv" / "bin" / "python"


def version(command: list[str]) -> str | None:
    if command and not Path(command[0]).is_file() and shutil.which(command[0]) is None:
        return None
    try:
        out = subprocess.check_output(command, text=True, stderr=subprocess.STDOUT)
        return out.strip().splitlines()[0]
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        return None


def memory_bytes() -> int | None:
    try:
        out = subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True)
        return int(out.strip())
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
        return None


def collect_environment() -> dict:
    yt = version(["yt-dlp", "--version"])
    if yt is None:
        yt = version(["python3", "-m", "yt_dlp", "--version"])
    if yt is None and VENV_PYTHON.is_file():
        yt = version([str(VENV_PYTHON), "-m", "yt_dlp", "--version"])

    torch_info = None
    if VENV_PYTHON.is_file():
        try:
            torch_info = subprocess.check_output(
                [
                    str(VENV_PYTHON),
                    "-c",
                    "import torch; print(torch.__version__, int(torch.backends.mps.is_available()), int(torch.cuda.is_available()))",
                ],
                text=True,
            ).strip()
        except subprocess.CalledProcessError:
            torch_info = "error"

    return {
        "os": f"{platform.system()} {platform.mac_ver()[0]} {platform.machine()}",
        "python": platform.python_version(),
        "venvPython": str(VENV_PYTHON) if VENV_PYTHON.is_file() else None,
        "node": version(["node", "--version"]),
        "npm": version(["npm", "--version"]),
        "ffmpeg": version(["ffmpeg", "-version"]),
        "ffprobe": version(["ffprobe", "-version"]),
        "yt_dlp": yt,
        "uv": version(["uv", "--version"]),
        "cuda": shutil.which("nvcc") is not None,
        "openposeCpp": shutil.which("OpenPoseDemo") is not None,
        "openposeBody25": MANIFEST.is_file(),
        "openposeManifest": str(MANIFEST) if MANIFEST.is_file() else None,
        "torch": torch_info,
        "unifiedMemoryBytes": memory_bytes(),
        "gpuNote": "Apple Silicon MPS if available; no CUDA assumed",
    }


def main() -> None:
    print(json.dumps(collect_environment(), indent=2))


if __name__ == "__main__":
    main()
