# Dance validation

- ok: True
- frames: 730
- duration: 24.3
- apply path: applyIdolDancePose
- uncertain spans: 482

## Errors
- none

## Warnings
- none

## Source

- File: `/Users/kelvin/Downloads/WhatsApp Video 2026-09-11 at 02.30.29.mp4`
- Duration: 24.327s (full clip, no trim)
- Original: 490×850, ~60 fps, h264 + aac, 4.3 MB
- Analysis: 416×720, 30 fps CFR, 730 frames
- Job: `tmp/video-to-dance/WhatsApp Video 2026-09-1-db87e00194`
- Mode: `front-facing-2d` / root: `in-place`
- Output: `public/motions/preview-dance.animation.json`
- Preview: http://localhost:5173/preview-dance.html

Single frontal dancer, full body and feet visible, fixed camera, no cuts. TikTok UI sits on the edges. Shoulder-width / p95 stays ≥ 0.836 every second (min at t=6s and t=9s). No turn span below 0.5. `front-facing-2d` is appropriate.

## Tracking

- Identity: `track-0` for all 730 frames
- Person detections missing: 0 / 730
- Landmark-level gaps exist (e.g. `LWrist` at t=0); they are not treated as coordinates
- peopleCount histogram: `{1: 710, 2: 15, 3: 5}` — extra 2–5 hits are TikTok chrome / noise; MidHip continuity kept the dancer
- Overlay montage (0, 3, 6, 9, 12, 15, 18, 21s): skeleton hugs the body; laterality matches

## Retarget

- Solver: `ArmSolver` direction-euler-v3
- Rotation steps > 0.6 rad: **8 total / 0 twist-only** (all were direction motion)
- Large direction steps at ~0.57s, 0.73s, 10.17s, 13.33s, 13.77s, 17.47s, 17.93s — source arm snaps, not Euler flips
- Uncertain spans: 482
  - `foreshortened-arm-depth-approximate`: 396
  - `foreshortened-shin-depth-approximate`: 86
- Feet stay uncrossed; foot Z = 0; no K-pose

## Playback

- Page: `/preview-dance.html` on port 5173
- Status: `front-facing-2d · in-place · 730 keys`
- Console errors: none
- Controls checked: play (time advanced), pause, seek to ~12.15s, restart to 0
- Screenshots at 0, 3, 6, 9, 12, 13.87, 17.6, 21s
- Montage: `07-validation/side-by-side-montage.png`

Pose-by-pose:

| t | Source | Character | Verdict |
|---|--------|-----------|---------|
| 0.00 | Arms slightly out; `LWrist` missing | Arms nearer rest | Weak start; detection gap |
| 3.00 | Right (image-left) raised | Same arm raised and bent | Match |
| 6.00 | Both arms up, peace signs | Both arms up, elbows bent | Match (no finger joints) |
| 9.00 | Arms open to the sides | Elbows more bent in front | Same family; extra bend from short 2D forearm (`RWrist` c=0.65) |
| 12.00 | Left (image-right) wave | Left arm out/up, right down | Same arm; height a bit lower |
| 13.87 | Right arm overhead, right knee up | Right arm up, right foot lifted | Same arm and foot; overhead compressed |
| 17.60 | Right arm overhead, right knee up | Right arm up (`Rdir.y≈0.96`), right foot lifted | Same; overhead not fully vertical |
| 21.00 | Left peace at chest | Both elbows bent in front | Approximate; no fingers |

## Limitations

- `front-facing-2d` cannot recover true depth or turns. Overhead arms go up but stay short of vertical (`keep_arm_in_front` Z ≥ 0.18).
- One-axis elbows. Foreshortened wrists (t≈9s) look more bent than the dancer.
- No hand/face rig. Peace signs become bent elbows.
- In-place root: no stage travel.
- TikTok captions sit on the torso; they did not steal identity.

## Other files touched

- `preview-dance.html` / `src/preview/previewDance.ts` now load `preview-dance.{animation.json,clip,overlay}` instead of the iLiFE clip.
- Orchestrator also wrote `source-clip.mp4` / `source-overlay.mp4`; those were restored from job `ZzbhbphxX2g-e5bed2274b` so `/dance-preview.html` still matches `dance.animation.json`.
- Live-house `ilife-message.*` files were not overwritten.
