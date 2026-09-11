# Verification and retarget quality

`validation ok=True` is not the finish line. It only proves the clip is well-formed. The finish line is: the character visibly does what the dancer does at the same timestamps. Run every check below before reporting done.

## 1. Look at the source before choosing a mode

```bash
J=tmp/video-to-dance/<job-id>
# 8 overlay frames across the clip: tracked person, people count, occlusion
for t in 0 3 6 9 12 15 18 21; do ffmpeg -loglevel error -y -ss $t -i $J/03-openpose/overlay.mp4 -frames:v 1 -vf scale=-2:480 /tmp/f$t.png; done
ffmpeg -loglevel error -y -i /tmp/f0.png -i /tmp/f3.png ... -filter_complex "[0][1]...hstack=inputs=8" /tmp/montage.png
```

Then read `/tmp/montage.png`. Confirm the tracked identity is the dancer the user meant and the overlay skeleton hugs the body.

Detect turns numerically instead of guessing. Per second, `shoulder_px / p95(shoulder_px)`:

- ≥ 0.85 the whole clip → `front-facing-2d` is fine.
- dips below ~0.5 → a turn or side view; tell the user where (source timestamp = trimStart + clip time) and that 2D will keep the character facing +Z there. Recommend `full-3d` if the turns matter.

Report `peopleCount` histogram from `landmarks.combined.json`. Occasional 2–5 detections on a single-dancer clip are mirrors/noise; the MidHip tracker keeps identity, but say so.

## 2. Verify the rig's rotation convention numerically before writing any mapping

Do not reason about Euler signs in your head. Check them against the real library:

```js
import * as THREE from "<repo>/node_modules/three/build/three.module.js";
const v = new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(-x, y, z)); // exactly what apply() does
```

For this idol: `R = Rx(-shoulderX) · Ry(shoulderY) · Rz(shoulderZ)`, upper arm `= R·(0,-1,0)`, elbow bends toward `R·(0,0,1)`. Consequences that a mental model gets wrong:

- `shoulderX` swings a **hanging** arm forward. For an **overhead** arm (Z≈π) positive X points it **backward**.
- With the arm horizontal (Z≈±π/2), X is a twist: it selects the elbow bend plane (up/down/forward), not the arm direction.
- Therefore "shoulderX ≥ 0.18 means hands toward the audience" is false. Validate the derived direction (`shoulder_direction(x,y,z)[2]`), never a raw channel.

The same applies to any other rig: print `R·restAxis` for a few channel values and compare with what you expect before mapping.

## 3. Retarget arms from directions, not from angle heuristics

The failure that made the character "not even raise its hand": mapping the 2D coronal angle to `Z = 1.85·sin θ` plus a fixed forward `X`. At θ=π that yields an arm pointing forward-down. Any formula of the shape "clamp Z, add some X for raised arms" has this bug.

Required approach (`scripts/video-to-dance/arm_retarget.py`):

1. Build the observed upper-arm direction `d` and forearm direction `f` in **chest space** (rotate by the inverse of body·pelvis·chest).
2. 2D depth: lift each segment by foreshortening against its own p97 projected length, assume toward the audience, trust it less when the segment hangs down. Mark frames with depth > 0.3 as `foreshortened-*-depth-approximate`.
3. Apply rig-safety as a rotation of the whole arm (`keep_arm_in_front` then rotate `f` with the same rotation) so the elbow angle/plane are untouched.
4. Build the full rotation from `(d, bend)` where `bend` is the observed forearm component perpendicular to `d`, never behind the torso, blended at most ~0.3 per frame and parallel-transported with the arm so it does not flip when the arm points at the camera.
5. Extract Euler, then choose the dual `(x+π, π−y, z+π)` or 2π multiples closest to the previous frame. Unwrapped |Z| > π is fine; the runtime lerps channels.
6. Elbow = angle between `d` and `f`, clamped to the hinge range. Do not cap it with side-abduction heuristics; the bend plane already comes from the forearm.

Unit-test the solver against known poses: overhead → `d.y > 0.95`; side raise → `d.x > 0.95`; hanging → `d.z ≥ FORWARD_MIN`; a full windmill → per-frame channel steps < 0.6 rad and direction error < 0.05 rad around the circle. Compare a few channel triples with the three.js numbers from step 2.

## 4. Compare video and character at the same timestamps

Screenshot the side-by-side page with the repo's Playwright (the Playwright MCP may be unavailable):

```js
import { chromium } from "<repo>/node_modules/@playwright/test/index.mjs";
// goto http://localhost:<port>/dance-preview.html, wait for "#status" to contain "keys"
// for each t: set #source-video.currentTime = t, await "seeked", wait 300 ms, screenshot
```

Pick 8 timestamps covering raises, points, crossings and the fastest section. Build a 2×4 montage with ffmpeg and read it. For each frame check:

- Same arm is raised (mirror sense: dancer's left appears on image-right and on the character's screen-right).
- Arm height matches (overhead stays overhead, horizontal stays horizontal).
- Hands-in-front poses stay in front, not behind the back.
- Feet stance width and lift roughly match; no crossed feet, no shin pointing at the camera.

If a pose is wrong, dump that frame's cleaned landmarks and the exported channels and compute `shoulder_direction()` for them. Decide whether the error is detection, depth guess, or mapping before touching code.

## 5. Measure continuity, not just validity

```python
R = shoulder_matrix(*prev).T @ shoulder_matrix(*cur); step = acos((trace(R)-1)/2)
```

Count adjacent frames with step > 0.6 rad. Split them into "direction moved" (input motion/noise, acceptable) and "twist only" (direction moved < 0.25 but rotation > 0.6 — a solver flip, fix it). Report both numbers. Do not report only `validation ok`.

## 6. Environment and cache traps seen on this machine

- `npm run video-to-dance` can fail with numpy "have 'arm64', need 'x86_64'" when the Node in PATH is x64/Rosetta. Run `scripts/video-to-dance/.venv/bin/python scripts/video-to-dance/orchestrator.py ...` directly.
- yt-dlp `CERTIFICATE_VERIFY_FAILED` in the python.org venv: `uv pip install --python <venv python> certifi`.
- Vite started from an agent shell dies when the command returns. Use the user's running `npm run dev` (check the terminals folder for its port) or start Vite as a background shell.
- The orchestrator's `copy_preview_media` overwrites `public/motions/source-clip.mp4`, `source-overlay.mp4`, `quality-report.md` for **whichever job ran last**. When regenerating another clip, rerun the preview's job afterwards with `--resume` so `/dance-preview.html` shows matching video and motion.
- Retarget cache key includes hashes of `retarget_motion.py` and `arm_retarget.py`; code changes rerun retarget on `--resume`. Extraction and reconstruction stay cached.
- Reusing an older job that was analysed at another `analysisHeight`: pass `--config` pointing at a copy of the config with that height so acquire/openpose resume instead of rerunning.

## 7. What to report

- Source: title, duration, resolution, fps, trim; job dir.
- Tracking: frames, missing detections, people-count histogram, turn spans with source timestamps.
- Retarget: solver used, per-frame rotation-step counts (total / twist-only), uncertain-span reasons and counts.
- Playback: page, port, status line, console errors, which timestamps were screenshotted; embed the montage.
- Limitations still present (2D depth ambiguity, one-axis elbow, turns not reconstructed in 2D).
- Anything the pipeline changed outside the job (regenerated other clips, README/config edits).
