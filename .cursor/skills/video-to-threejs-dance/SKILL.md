---
name: video-to-threejs-dance
description: Use when converting a dancer video or YouTube URL into playable Three.js character animation; retargeting OpenPose BODY_25 or monocular 3D motion (WHAM, GVHMR) onto a glTF/GLB or custom Object3D idol rig; or when the user asks for video-to-dance, front-facing-2d, full-3d, captured dance playback, or motion retargeting.
---

# Video to Three.js Dance

Build and execute the pipeline. Working code, motion data, playback, and validation are required. A design document is not a completed result.

Follow [pipeline.md](pipeline.md) exactly. For this repository's idol rig, read [project-reference.md](project-reference.md) before asking the user to describe joints the code already defines. Landmark names: [body25.md](body25.md). Invocation and resume examples: [examples.md](examples.md). Before reporting done, run every check in [verification.md](verification.md).

## Purpose

Build and execute an end-to-end pipeline that converts a real dancer's
video into a playable animation for an existing Three.js character.

Accept either:
- A YouTube URL
- A local video file

Support two explicit quality modes:

1. front-facing-2d:
   A lightweight approximation for mostly front-facing dance.
   Use OpenPose 2D landmarks and constrained retargeting.

2. full-3d:
   Use a compatible monocular 3D human-motion reconstruction model
   to estimate depth, facing direction, and body motion.
   OpenPose 2D landmarks alone are not enough for this mode.

The skill must produce working code, motion data, playback integration,
and validation results—not just a design document.

Do not promise an exact reconstruction of movement hidden from a
single camera.

## Operating behavior

Before making changes:
- Inspect the existing project and available tools.
- Reuse installed dependencies.
- Preserve unrelated application code.
- Ask before privileged installations, destructive changes, or large
  model downloads.
- Follow the project's package manager and coding conventions.

Execute in small, verifiable stages.
Cache successful outputs so the user can resume after failures.

Never silently:
- Replace real capture data with procedural dancing.
- Substitute another pose detector for OpenPose.
- Downgrade full-3d mode to a flat 2D approximation.
- Claim an installation, extraction, or browser test succeeded if it
  was not actually run.

If a required tool cannot run, explain the blocker and offer an
explicit alternative.

## Red flags — stop

| Thought | Required action |
|---------|-----------------|
| "OpenPose is hard; MediaPipe is close enough" | Ask first. Document that landmark format differs. Do not swap silently. |
| "I will generate a dance cycle so something moves" | Forbidden. Keep source rhythm and timing. |
| "full-3d can wait; 2D depth hacks are fine" | Forbidden. Do not downgrade full-3d. |
| "I assumed CUDA / people[0] / bone names" | Inspect first. Track identity. Map the actual rig. |
| "Hip-relative coords are world movement" | State the limitation. Offer in-place or labeled approximate root. |
| "I will say install/extract/browser test succeeded" | Only after it was actually run. Otherwise mark unverified. |
| "Raised arm = clamp Z and add some forward X" | Forbidden. Fit the full shoulder rotation to the observed upper-arm and forearm directions. See verification.md §3. |
| "I know what rotation.x does on this rig" | Print `R·restAxis` with the real three.js Euler first. Signs flip once the arm passes horizontal. |
| "validation ok=True, so it works" | Not enough. Screenshot video and character at the same timestamps and compare pose by pose. |
| "Validate shoulderX ≥ threshold" | Validate the derived limb direction, not a raw Euler channel. |

A folder of OpenPose JSON files alone is not a completed result. A clip that passes validation but whose character does not raise its hand when the dancer does is not a completed result either.

## Pipeline

Execute [pipeline.md](pipeline.md) in order. Do not skip steps or invent a shorter process.

1. Check environment and install tools
2. Ask for source and character information
3. Acquire and prepare video
4. Extract OpenPose data
5. Clean and normalize landmarks
6A. Front-facing-2d motion mode — or — 6B. Full-3d motion mode
7. Inspect and adapt the target character
8. Retarget motion
9. Ground contact and motion cleanup
10. Export a Three.js animation format
11. Implement Three.js playback
12. Validate with a short clip first

## Deliverables

Create a coherent folder structure following the existing project's
conventions, including equivalents of:

- video_to_dance_config.json
- scripts/check_environment
- scripts/acquire_video
- scripts/extract_openpose
- scripts/clean_landmarks
- scripts/reconstruct_3d
- scripts/retarget_motion
- scripts/validate_animation
- public/motions/dance.animation.json
- rig-mapping.json
- Three.js motion player and rig adapter
- Source-pose overlay preview
- Side-by-side preview page
- Quality report
- README with install, run, resume, and troubleshooting instructions

Implement one orchestrator command appropriate to the project that
runs the pipeline with configurable:

--video or --url
--start
--end
--mode
--rig-config
--root-mode
--output
--resume

Record tool/model versions and important processing settings so
results can be reproduced.

The orchestrator must resume from valid cached stages rather than
redownloading videos or rerunning extraction unnecessarily.

## Definition of done

The skill is successful when:
- A real video has been processed.
- The selected dancer's movement drives the actual target character.
- Playback timing matches the source.
- Joint mapping and foot behavior have been checked.
- The result is playable in the user's Three.js project.
- The user can repeat the process with another video.
- Remaining limitations are clearly reported.
- A side-by-side screenshot montage (≥ 8 timestamps: raises, points, crossings, fastest section) shows the character matching the dancer, and the per-frame rotation-step counts (total / twist-only) are reported. See [verification.md](verification.md).

A folder of OpenPose JSON files alone is not a completed result.

## Additional resources

- Full step instructions (required): [pipeline.md](pipeline.md)
- Quality gate: numeric rig checks, direction-based arm retarget, side-by-side comparison, continuity metrics, environment traps (required before done): [verification.md](verification.md)
- This repo's idol rig, pose channels, and IK ownership: [project-reference.md](project-reference.md)
- OpenPose BODY_25 named landmarks: [body25.md](body25.md)
- Orchestrator flags, cache stages, and example runs: [examples.md](examples.md)
