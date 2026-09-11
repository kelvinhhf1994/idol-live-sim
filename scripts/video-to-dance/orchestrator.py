#!/usr/bin/env python3
"""Run the video-to-dance pipeline with resumable stage cache."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from acquire_video import acquire
from check_environment import collect_environment
from clean_landmarks import clean_landmarks
from common import (
    DEFAULT_CONFIG,
    DEFAULT_RIG,
    JOBS_ROOT,
    REPO,
    VENV_PYTHON,
    can_resume,
    load_config,
    load_json,
    save_json,
    sha256_file,
    stage_dir,
    write_manifest,
)
from extract_openpose import extract_openpose
from reconstruct_2d import reconstruct_2d
from reconstruct_3d import reconstruct_3d
from retarget_motion import retarget_motion
from validate_animation import validate_animation


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Video to Three.js dance")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--url")
    source.add_argument("--video")
    parser.add_argument("--start", type=float)
    parser.add_argument("--end", type=float)
    parser.add_argument("--mode", required=True, choices=("front-facing-2d", "full-3d"))
    parser.add_argument("--rig-config", default=str(DEFAULT_RIG))
    parser.add_argument("--root-mode", default="in-place", choices=("in-place", "stage-travel"))
    parser.add_argument("--output", required=True)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    return parser.parse_args()


def job_id(args: argparse.Namespace) -> str:
    source = args.url or args.video
    raw = f"{source}|{args.start}|{args.end}|{args.mode}|{args.root_mode}"
    digest = hashlib.sha1(raw.encode()).hexdigest()[:10]
    slug = "local"
    if args.url and "youtu" in args.url:
        slug = args.url.rstrip("/").split("/")[-1].split("?")[0].replace("watch?v=", "")
        if "v=" in args.url:
            slug = args.url.split("v=", 1)[1].split("&", 1)[0]
    elif args.video:
        slug = Path(args.video).stem[:24]
    return f"{slug}-{digest}"


def ensure_venv_tools() -> None:
    if not VENV_PYTHON.is_file():
        raise SystemExit("missing scripts/video-to-dance/.venv — run install_openpose.py")
    result = subprocess.run(
        [str(VENV_PYTHON), "-c", "import yt_dlp"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        uv = shutil.which("uv")
        if uv:
            subprocess.check_call([uv, "pip", "install", "--python", str(VENV_PYTHON), "yt-dlp"])
        else:
            subprocess.check_call([str(VENV_PYTHON), "-m", "pip", "install", "yt-dlp"])


def copy_preview_media(job_dir: Path, clip_path: Path, output: Path) -> None:
    public_motions = REPO / "public" / "motions"
    public_motions.mkdir(parents=True, exist_ok=True)
    shutil.copy2(clip_path, output)
    preview = job_dir / "02-analysis" / "preview.mp4"
    analysis = job_dir / "02-analysis" / "analysis.mp4"
    overlay = job_dir / "03-openpose" / "overlay.mp4"
    video_src = preview if preview.is_file() else analysis
    if video_src.is_file():
        shutil.copy2(video_src, public_motions / "source-clip.mp4")
    if overlay.is_file():
        shutil.copy2(overlay, public_motions / "source-overlay.mp4")
    report = job_dir / "07-validation" / "quality-report.md"
    if report.is_file():
        shutil.copy2(report, public_motions / "quality-report.md")


def main() -> int:
    args = parse_args()
    ensure_venv_tools()
    config = load_config(Path(args.config))
    job = JOBS_ROOT / job_id(args)
    job.mkdir(parents=True, exist_ok=True)
    print(f"job={job}")

    env_inputs = {"config": sha256_file(Path(args.config))}
    if not (args.resume and can_resume(job, "00-environment", env_inputs)):
        env = collect_environment()
        env["recordedAt"] = datetime.now(timezone.utc).isoformat()
        save_json(stage_dir(job, "00-environment") / "environment.json", env)
        write_manifest(job, "00-environment", {"ok": True, "inputs": env_inputs, "tools": env})
        print(json.dumps({k: env.get(k) for k in ("os", "node", "ffmpeg", "yt_dlp", "openposeBody25")}, indent=2))

    acquire_inputs = {
        "url": args.url,
        "video": args.video,
        "start": args.start,
        "end": args.end,
        "fps": config["analysisFps"],
        "height": config["analysisHeight"],
    }
    source_meta_path = job / "01-source" / "source.meta.json"
    analysis_meta_path = job / "02-analysis" / "analysis.meta.json"
    if args.resume and can_resume(job, "02-analysis", acquire_inputs) and analysis_meta_path.is_file():
        print("resume: skip acquire/analysis")
        analysis_meta = load_json(analysis_meta_path)
    else:
        source_meta, analysis_meta = acquire(
            job,
            url=args.url,
            video=Path(args.video) if args.video else None,
            start=args.start,
            end=args.end,
            fps=int(config["analysisFps"]),
            height=int(config["analysisHeight"]),
        )
        write_manifest(job, "01-source", {"ok": True, "inputs": acquire_inputs, "sha256": source_meta["sha256"]})
        write_manifest(job, "02-analysis", {"ok": True, "inputs": acquire_inputs, "sha256": analysis_meta["sha256"]})

    analysis_mp4 = job / "02-analysis" / "analysis.mp4"
    scales = list(config.get("openposeScales") or [0.5, 1.0, 1.5])
    openpose_inputs = {
        "analysis": analysis_meta["sha256"],
        "maxJump": config["trackMaxJumpFrac"],
        "scales": scales,
    }
    combined_path = job / "03-openpose" / "landmarks.combined.json"
    if args.resume and can_resume(job, "03-openpose", openpose_inputs) and combined_path.is_file():
        print("resume: skip openpose")
    else:
        extract_openpose(
            job,
            analysis_mp4,
            analysis_meta,
            max_jump_frac=float(config["trackMaxJumpFrac"]),
            resume=args.resume,
            scale_search=scales,
        )
        write_manifest(
            job,
            "03-openpose",
            {"ok": True, "inputs": openpose_inputs, "runtime": "pytorch-body25"},
        )

    clean_inputs = {
        "combined": sha256_file(combined_path),
        "minC": config["openposeMinConfidence"],
        "sigma": config["smoothSigmaFrames"],
    }
    cleaned_path = job / "04-cleaned" / "landmarks.cleaned.json"
    if args.resume and can_resume(job, "04-cleaned", clean_inputs) and cleaned_path.is_file():
        print("resume: skip clean")
    else:
        clean_landmarks(job, combined_path, config)
        write_manifest(job, "04-cleaned", {"ok": True, "inputs": clean_inputs})

    recon_inputs = {
        "cleaned": sha256_file(cleaned_path),
        "mode": args.mode,
        "imageToCharacterX": "negated" if args.mode == "front-facing-2d" else "motionbert-h36m",
    }
    recon_path = job / "05-reconstructed" / "canonical.motion.json"
    if args.resume and can_resume(job, "05-reconstructed", recon_inputs) and recon_path.is_file():
        print("resume: skip reconstruct")
    else:
        if args.mode == "full-3d":
            reconstruct_3d(job, cleaned_path, config)
        else:
            reconstruct_2d(job, cleaned_path, config)
        write_manifest(job, "05-reconstructed", {"ok": True, "inputs": recon_inputs})

    rig_path = Path(args.rig_config)
    retarget_inputs = {
        "recon": sha256_file(recon_path),
        "rig": sha256_file(rig_path),
        "root": args.root_mode,
        "armSolver": "direction-euler-v3",
        "code": [
            sha256_file(Path(__file__).with_name("retarget_motion.py")),
            sha256_file(Path(__file__).with_name("arm_retarget.py")),
        ],
        "facingTorso": "locked-plusZ" if args.mode == "front-facing-2d" else "motionbert-yaw",
        "audienceGuard": "forward-upper-arm-no-k-v3" if args.mode == "front-facing-2d" else "full-3d-yaw",
    }
    clip_path = job / "06-retargeted" / "dance.animation.json"
    if args.resume and can_resume(job, "06-retargeted", retarget_inputs) and clip_path.is_file():
        print("resume: skip retarget")
    else:
        retarget_motion(
            job,
            recon_path,
            rig_path,
            config,
            root_mode=args.root_mode,
            capture_mode=args.mode,
        )
        write_manifest(job, "06-retargeted", {"ok": True, "inputs": retarget_inputs})

    validate_inputs = {"clip": sha256_file(clip_path)}
    if not (args.resume and can_resume(job, "07-validation", validate_inputs)):
        validate_animation(job, clip_path, rig_path, config["character"])
        write_manifest(job, "07-validation", {"ok": True, "inputs": validate_inputs})

    output = Path(args.output)
    if not output.is_absolute():
        output = REPO / output
    copy_preview_media(job, clip_path, output)
    print(f"output={output}")
    print("preview: npm run dev  then open /dance-preview.html")
    return 0


if __name__ == "__main__":
    if not VENV_PYTHON.is_file():
        raise SystemExit("missing venv")
    # Re-exec under the isolated venv so OpenPose/torch imports resolve.
    if Path(sys.executable).resolve() != VENV_PYTHON.resolve():
        raise SystemExit(subprocess.call([str(VENV_PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]]))
    raise SystemExit(main())
