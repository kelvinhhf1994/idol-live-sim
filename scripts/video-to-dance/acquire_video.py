#!/usr/bin/env python3
"""Download or copy a source video and write a CFR analysis clip."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from common import VENV_PYTHON, run, save_json, sha256_file, stage_dir


def _yt_dlp() -> list[str]:
    if VENV_PYTHON.is_file():
        return [str(VENV_PYTHON), "-m", "yt_dlp"]
    exe = shutil.which("yt-dlp")
    if exe:
        return [exe]
    return ["python3", "-m", "yt_dlp"]


def _ffprobe(path: Path) -> dict[str, Any]:
    result = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        capture_output=True,
    )
    return json.loads(result.stdout)


def _video_stream(probe: dict[str, Any]) -> dict[str, Any]:
    for stream in probe.get("streams", []):
        if stream.get("codec_type") == "video":
            return stream
    raise RuntimeError("no video stream")


def _rotation(stream: dict[str, Any]) -> int:
    tags = stream.get("tags") or {}
    raw = tags.get("rotate") or stream.get("rotation") or 0
    try:
        return int(float(raw)) % 360
    except (TypeError, ValueError):
        return 0


def download_youtube(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            *_yt_dlp(),
            "--no-playlist",
            "-f",
            "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
            "--merge-output-format",
            "mp4",
            "-o",
            str(dest),
            url,
        ]
    )


def copy_local(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def write_source_meta(
    dest: Path,
    *,
    url: str | None,
    original: str | None,
    probe: dict[str, Any],
) -> dict[str, Any]:
    stream = _video_stream(probe)
    meta = {
        "sourceReference": url or original,
        "url": url,
        "originalPath": original,
        "file": dest.name,
        "sha256": sha256_file(dest),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "fps": stream.get("avg_frame_rate") or stream.get("r_frame_rate"),
        "duration": float(probe.get("format", {}).get("duration") or stream.get("duration") or 0),
        "rotation": _rotation(stream),
        "codec": stream.get("codec_name"),
    }
    save_json(dest.with_name("source.meta.json"), meta)
    return meta


def prepare_analysis(
    source: Path,
    dest: Path,
    *,
    start: float | None,
    end: float | None,
    fps: int,
    height: int,
    source_meta: dict[str, Any],
) -> dict[str, Any]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    vf_parts = []
    rotation = int(source_meta.get("rotation") or 0)
    if rotation == 90:
        vf_parts.append("transpose=1")
    elif rotation == 180:
        vf_parts.append("transpose=1,transpose=1")
    elif rotation == 270:
        vf_parts.append("transpose=2")
    vf_parts.append(f"scale=-2:{int(height)}")
    vf_parts.append(f"fps={int(fps)}")
    # -ss/-to before -i are input timestamps on the source file.
    # -to after -i is an output duration clock and would keep encoding until `end` seconds.
    command = ["ffmpeg", "-y"]
    if start is not None:
        command += ["-ss", f"{start:.3f}"]
    if end is not None:
        command += ["-to", f"{end:.3f}"]
    command += ["-i", str(source)]
    command += [
        "-vf",
        ",".join(vf_parts),
        "-an",
        "-fps_mode",
        "cfr",
        str(dest),
    ]
    run(command)

    probe = _ffprobe(dest)
    stream = _video_stream(probe)
    duration = float(probe.get("format", {}).get("duration") or 0)
    meta = {
        "file": dest.name,
        "sha256": sha256_file(dest),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "fps": fps,
        "duration": duration,
        "trimStart": start or 0.0,
        "trimEnd": end,
        "sourceFps": source_meta.get("fps"),
        "sourceWidth": source_meta.get("width"),
        "sourceHeight": source_meta.get("height"),
        "rotationApplied": rotation,
        "transforms": vf_parts,
        "timestampRule": "timestamp = frameIndex / analysisFps; source time = trimStart + timestamp",
    }
    save_json(dest.with_name("analysis.meta.json"), meta)

    preview = dest.with_name("preview.mp4")
    preview_cmd = ["ffmpeg", "-y", "-i", str(source)]
    if start is not None:
        preview_cmd += ["-ss", f"{start:.3f}"]
    if end is not None:
        preview_cmd += ["-to", f"{end:.3f}"]
    preview_cmd += [
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(preview),
    ]
    run(preview_cmd)
    meta["previewFile"] = preview.name
    save_json(dest.with_name("analysis.meta.json"), meta)
    return meta


def acquire(
    job_dir: Path,
    *,
    url: str | None,
    video: Path | None,
    start: float | None,
    end: float | None,
    fps: int,
    height: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    source_dir = stage_dir(job_dir, "01-source")
    analysis_dir = stage_dir(job_dir, "02-analysis")
    source_mp4 = source_dir / "source.mp4"
    analysis_mp4 = analysis_dir / "analysis.mp4"

    if url:
        download_youtube(url, source_mp4)
        original = None
    elif video:
        copy_local(video, source_mp4)
        original = str(video)
    else:
        raise ValueError("url or video is required")

    probe = _ffprobe(source_mp4)
    source_meta = write_source_meta(source_mp4, url=url, original=original, probe=probe)
    analysis_meta = prepare_analysis(
        source_mp4,
        analysis_mp4,
        start=start,
        end=end,
        fps=fps,
        height=height,
        source_meta=source_meta,
    )
    return source_meta, analysis_meta


if __name__ == "__main__":
    raise SystemExit("use orchestrator.py")
