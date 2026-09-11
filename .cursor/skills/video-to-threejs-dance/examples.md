# Pipeline examples

## Orchestrator

One command, project-appropriate (npm script wrapping Python is fine):

```bash
npm run video-to-dance -- \
  --url "https://www.youtube.com/watch?v=VIDEO_ID" \
  --start 12.5 \
  --end 20.0 \
  --mode front-facing-2d \
  --rig-config scripts/video-to-dance/rig-mapping.json \
  --root-mode in-place \
  --output public/motions/dance.animation.json \
  --resume
```

Local file:

```bash
npm run video-to-dance -- \
  --video /path/to/clip.mp4 \
  --mode full-3d \
  --root-mode stage-travel \
  --output public/motions/dance.animation.json \
  --resume
```

Required flags: `--video` or `--url`, `--mode`, `--output`. Optional: `--start`, `--end`, `--rig-config`, `--root-mode`, `--resume`, `--config`.

`--resume` skips stages whose cache manifest is valid (same source hash, trim, mode, tool versions). Re-run a stage only when its inputs changed. The retarget stage also hashes `retarget_motion.py` and `arm_retarget.py`, so a solver edit plus `--resume` reruns only retarget + validation (seconds, not minutes).

If `npm run` fails with an arm64/x86_64 numpy error (Rosetta Node), call the venv directly:

```bash
scripts/video-to-dance/.venv/bin/python scripts/video-to-dance/orchestrator.py \
  --url "https://www.youtube.com/shorts/VIDEO_ID" --start 14 \
  --mode front-facing-2d --root-mode in-place \
  --output public/motions/dance.animation.json --resume
```

Regenerating a second clip (e.g. the live-house song) from its cache, then restoring the preview media for the first:

```bash
# other job, analysed earlier at a different height -> matching config copy keeps its cache valid
scripts/video-to-dance/.venv/bin/python scripts/video-to-dance/orchestrator.py \
  --url "https://www.youtube.com/watch?v=OTHER_ID" --mode front-facing-2d \
  --config /tmp/config-480.json --output public/motions/other.animation.json --resume
# rerun the preview's job last: copy_preview_media follows the last job
scripts/video-to-dance/.venv/bin/python scripts/video-to-dance/orchestrator.py \
  --url "https://www.youtube.com/shorts/VIDEO_ID" --start 14 --mode front-facing-2d \
  --output public/motions/dance.animation.json --resume
```

## Cache stages

Write under a job directory, e.g. `tmp/video-to-dance/<job-id>/`:

1. `00-environment.json` — detected tools, versions, GPU/CPU note
2. `01-source/` — downloaded or copied video + `source.meta.json`
3. `02-analysis/` — trimmed CFR analysis MP4 + `analysis.meta.json`
4. `03-openpose/` — raw per-frame JSON (preserved) + `landmarks.combined.json` + overlay MP4
5. `04-cleaned/` — filtered landmarks + quality flags
6. `05-reconstructed/` — canonical 3D or constrained 2D motion (`full-3d` only for estimator output)
7. `06-retargeted/` — target-rig animation JSON + `rig-mapping.json`
8. `07-validation/` — automated report + preview paths

Record tool/model versions in each stage manifest.

## Animation JSON (shape)

```json
{
  "schemaVersion": 1,
  "duration": 7.5,
  "units": "meters",
  "coordinateSystem": {
    "x": "right",
    "y": "up",
    "z": "forward",
    "space": "target-rig-group"
  },
  "targetRig": "person-rig-v2",
  "rootMotionMode": "in-place",
  "localRotationConvention": "complete-local",
  "quaternionOrder": [ "x", "y", "z", "w" ],
  "timestamps": [0, 0.033, 0.067],
  "root": {
    "space": "target-rig-parent",
    "positions": [[0, 0.91, 0]],
    "quaternions": [[0, 0, 0, 1]]
  },
  "bones": {
    "chest": { "quaternions": [[0, 0, 0, 1]] }
  },
  "feet": {
    "space": "target-rig-group",
    "left": { "positions": [[-0.14, 0.08, 0]], "contact": [true] },
    "right": { "positions": [[0.14, 0.08, 0]], "contact": [true] }
  },
  "quality": { "uncertainSpans": [] }
}
```

Quaternions are `[x, y, z, w]`. Root is not repeated inside `bones`. Do not ship one OpenPose JSON fetch per frame.

## What "done" looks like

Wrong: `03-openpose/*.json` exists and work stops.

Right:

- A real trimmed clip was processed.
- Overlay video shows the selected dancer.
- `public/motions/dance.animation.json` loads once and drives the actual `PersonRig`.
- Side-by-side preview keeps video and character time-aligned.
- Automated validation ran; browser/GPU gaps are labeled unverified.
- Procedural `idolDance` / `sample()` is not writing the same joints.
- Quality report lists turns, occlusions, and 2D depth limits.

## Mode choice

| Clip | Mode |
|------|------|
| Mostly frontal, feet visible, no turns | `front-facing-2d` |
| Turns, travel in depth, side views | `full-3d` |
| User asked `full-3d` | Never silently fall back to 2D |

If the user picks `front-facing-2d` on a turning clip, explain the limitation and recommend `full-3d`. Still run 2D only if they confirm.
