# Video to Three.js dance

Pipeline from a dancer video to a `PersonPose` clip for `createChibiIdol`.

This machine uses a PyTorch BODY_25 runtime (official CMU weights), not MediaPipe and not the CUDA `OpenPoseDemo`.

## Install

```bash
python3 scripts/video-to-dance/install_openpose.py
```

Downloads ~100MB BODY_25 weights on first run. Isolated venv: `scripts/video-to-dance/.venv`.

```bash
scripts/video-to-dance/.venv/bin/python scripts/video-to-dance/check_environment.py
PYTHONPATH=scripts/video-to-dance scripts/video-to-dance/.venv/bin/python scripts/video-to-dance/test_openpose.py
```

Hands/face networks stay off.

`full-3d` uses MotionBERT (2D→3D lift) on MPS/CPU. Install with `install_motionbert.py`. Do not silently fall back to 2D.

## Run

```bash
npm run video-to-dance -- \
  --url "https://www.youtube.com/watch?v=VIDEO_ID" \
  --mode front-facing-2d \
  --root-mode in-place \
  --output public/motions/dance.animation.json \
  --resume
```

Local file:

```bash
npm run video-to-dance -- \
  --video /path/to/clip.mp4 \
  --mode front-facing-2d \
  --root-mode in-place \
  --output public/motions/dance.animation.json \
  --resume
```

Optional: `--start`, `--end`, `--rig-config`, `--config`.

`--resume` skips stages whose cache inputs still match under `tmp/video-to-dance/<job-id>/`.

## Preview

```bash
npm run dev
```

Open `/dance-preview.html`. Source video and the chibi idol share `video.currentTime`. Procedural `idolDance` sampling is not running on that page.

## Cache stages

1. `00-environment.json`
2. `01-source/` downloaded or copied MP4
3. `02-analysis/` CFR analysis MP4 + preview-with-audio
4. `03-openpose/` raw per-frame JSON, `landmarks.combined.json`, overlay
5. `04-cleaned/`
6. `05-reconstructed/` constrained 2D canonical motion
7. `06-retargeted/` animation JSON + rig mapping
8. `07-validation/` quality report

OpenPose writes each frame to `03-openpose/raw/` so a crash can continue without re-detecting finished frames.

## Troubleshooting

- **yt-dlp missing**: the orchestrator installs it into the isolated venv. You can also `python3 -m yt_dlp`.
- **yt-dlp `CERTIFICATE_VERIFY_FAILED`**: the python.org venv has no CA bundle. `uv pip install --python scripts/video-to-dance/.venv/bin/python certifi` (yt-dlp picks it up automatically).
- **numpy "incompatible architecture (have 'arm64', need 'x86_64')"**: `npm run` under an x64/Rosetta Node inherits x86_64. Run the orchestrator directly: `scripts/video-to-dance/.venv/bin/python scripts/video-to-dance/orchestrator.py ...`.
- **OpenPose smoke fails**: re-run `install_openpose.py`. Weights live in `scripts/video-to-dance/models/`.
- **Lost tracking**: open `public/motions/source-overlay.mp4`. `people[0]` is not used; MidHip continuity is. If two dancers swap, re-run after isolating the clip.
- **Arms fold back / K-legs**: `arm_retarget.py` keeps the upper-arm direction at Z ≥ 0.18 in chest space and feet uncrossed with Z ≤ 0.02. Validation fails the job if a clip still has those poses.
- **Arms do not raise / stay near horizontal**: shoulders must be solved from the observed upper-arm direction (`ArmSolver`), not from a fixed forward swing. Check `shoulder_direction(x, y, z)` for a frame; it should match the overlay.
- **Arms look flat / turns wrong**: expected in `front-facing-2d`. Use `full-3d` only after a 3D backend is installed.
- **Feet slide or lock**: contact uses height + speed hysteresis. Check `quality-report.md` uncertain spans.
- **Two writers on one joint**: captured playback must go through `sampleCapturedDance` + `applyIdolDancePose` only. Do not also call `writeIdolDancePose` in the same frame.

## Repro notes

Recorded in each job `00-environment` and stage `manifest.json`: OS, torch, OpenPose runtime, analysis fps/height, trim, source hash.
