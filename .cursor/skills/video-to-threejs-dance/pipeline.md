# Pipeline steps

Execute these steps in order. Do not skip, reorder, or replace them with a shorter process.

## Step 1 — Check environment and install tools

Detect:
- Operating system
- Python and package/environment manager
- Node.js and project package manager
- FFmpeg and ffprobe
- yt-dlp
- OpenPose
- GPU availability, VRAM, and relevant CUDA compatibility
- Existing Three.js project structure

Use an isolated Python environment where applicable.

If OpenPose is missing:
- Choose an installation method appropriate to the actual OS and hardware.
- Use official sources and compatible dependencies.
- Download required model weights if approved.
- Run a small extraction test before declaring it ready.

Do not assume CUDA or a GPU exists.
If CPU-only execution is possible but slow, explain that.
If installation is impractical, ask whether to use an alternative
such as MediaPipe; document that its landmark format differs.

For full-3d mode, inspect available 3D motion-estimation tools.
Choose a maintained implementation compatible with:
- Available hardware
- Model/code licenses
- Required input format
- Desired root-motion and body-orientation outputs

Examples to evaluate include WHAM, GVHMR, or another appropriate
video-based human-motion reconstruction system.

Do not assume every 3D pose model estimates reliable movement
through the scene. Distinguish:
- Hip-relative 3D pose
- Camera-relative motion
- Ground/world-referenced root motion

Install only the selected backend and verify it with a short test.

## Step 2 — Ask for source and character information

After the environment check, ask for missing information together:

- YouTube URL or local video path
- Optional start/end timestamps
- Which dancer to track if multiple people appear
- Three.js project path
- Character asset or character-construction code
- Requested mode: front-facing-2d or full-3d
- Root behavior: move across the stage or dance in place

Recommend:
- A short initial clip
- Full body and feet visible
- Fixed camera
- No cuts
- Minimal occlusion
- Mostly frontal view for front-facing-2d mode

Inspect the character code before asking the user to describe
details that can be determined automatically.

If a proposed clip has turns or strong depth motion, explain that
front-facing-2d mode will have limitations and recommend full-3d.

## Step 3 — Acquire and prepare video

For YouTube:
- Use yt-dlp for videos the user is authorized to download/process.
- Do not bypass DRM or access restrictions.
- Download a suitable quality video and prepare an MP4.

For local files:
- Inspect and reuse the provided file when possible.

Use FFmpeg/ffprobe to:
- Apply requested trimming
- Handle rotation metadata
- Record dimensions, duration, and frame timing
- Create a constant-frame-rate analysis video when necessary
- Avoid stretching or distorting the image

Save metadata including:
- Source reference
- Trim offset
- Original and analysis frame rates
- Analysis width and height
- Any resize, crop, or mirror transformation

Keep the video-to-animation timestamp relationship exact.
Do not speed up or slow down movement accidentally.

If the clip includes a camera cut, split it or ask for a single-shot
segment rather than interpolating motion across the cut.

## Step 4 — Extract OpenPose data

Use OpenPose BODY_25 for body and foot landmarks.

Enable hand/face extraction only when requested and supported by
the target character; do not add that cost by default.

Write per-frame OpenPose JSON and preserve the raw output.

Create a combined landmarks file ordered by numeric frame index.

Store:
- Frame index
- Timestamp
- Selected dancer identity
- Landmark positions
- Confidence
- Missing-detection flags

OpenPose BODY_25 data is a flat sequence of:
x, y, confidence

Use a named landmark mapping rather than unexplained numeric indices.

Do not assume people[0] always refers to the same dancer.
Track the selected person across frames using spatial and temporal
continuity. Ask the user to select a person in a preview if ambiguous.

Handle empty detections and tracking loss explicitly.

Create a pose-overlay video for verification before retargeting.

## Step 5 — Clean and normalize landmarks

Implement:
- Confidence-aware filtering
- Short-gap interpolation
- Temporal smoothing
- Outlier rejection
- Stable person tracking

Do not treat missing landmarks or zero-confidence values as real
coordinates.

Do not interpolate blindly across long occlusions.
Flag uncertain spans in the quality report.

Use smoothing that preserves sharp dance accents.

Document coordinate conventions:
- Image coordinates: x right, y down
- Canonical motion coordinates: explicitly defined
- Three.js target rig axes: determined from the actual project

Keep source mirroring separate from anatomical left/right labels.
Do not silently swap limbs.

## Step 6A — Front-facing-2d motion mode

Build a constrained approximation suitable for a frontal dancer.

Estimate from the 2D data:
- Pelvis position relative to the initial pose
- Torso lean and lateral movement
- Upper-arm directions
- Elbow bends
- Leg directions and knee bends
- Approximate foot movement and contact

Use body-relative measurements and a stable scale estimate.
Do not change character bone lengths frame by frame.

Keep facing direction approximately fixed toward the camera.
Do not invent large yaw rotations from noisy 2D observations.

For ambiguous depth:
- Use conservative anatomical constraints.
- Reuse the prior valid configuration where appropriate.
- Mark the result as approximate.

Explain that forward-reaching arms, crossed limbs, sideways poses,
and turns cannot be reconstructed reliably from 2D alone.

Retain the source rhythm and timing; do not replace the motion with
generic dance cycles.

## Step 6B — Full-3d motion mode

Run the selected 3D video-motion estimator.

Respect that estimator's own input and preprocessing requirements.
Do not assume OpenPose JSON can be fed into any 3D model directly.

Use OpenPose as additional tracking/validation data where useful.

Convert estimator output into a documented canonical representation:
- Joint names and hierarchy
- 3D joint positions and/or rotations
- Root translation
- Root/body orientation
- Timestamps
- Units and coordinate axes
- Confidence or uncertainty information when available

Separate global root movement from body-relative pose.

Preserve real turns:
- Estimate facing from the reconstructed body orientation.
- Maintain temporal consistency.
- Avoid arbitrary front/back flips.
- Maintain continuous yaw where needed.
- Use normalized quaternions and temporal quaternion-sign continuity.

Handle:
- Camera motion when supported by the estimator
- Temporary occlusion
- Left/right tracking errors
- Low-confidence spans

If the backend cannot estimate scene-relative translation reliably:
- State that limitation.
- Offer in-place playback or a clearly labeled approximate root path.
- Do not present hip-relative coordinates as world movement.

Body joints do not uniquely determine every bone's axial twist.
Use estimator rotations when available; otherwise apply conservative,
temporally stable twist constraints.

Do not claim hidden movements were recovered exactly.

## Step 7 — Inspect and adapt the target character

Support both:
- A glTF/GLB skinned character
- A custom Three.js Object3D hierarchy

Inspect:
- Joint/bone names
- Parent-child hierarchy
- Rest-pose local transforms
- Bone lengths
- Character scale
- Forward/up axes
- Supported joint degrees of freedom
- Existing animation/update code

Create a reusable rig mapping configuration.

Map source anatomy to available target joints:
- Root/pelvis
- Spine/chest
- Neck/head
- Shoulders/upper arms
- Elbows/forearms
- Hips/thighs
- Knees/shins
- Ankles/feet
- Wrists/hands only when supported

Do not assume bone names or axes match another character.

Do not overwrite the rest pose permanently during calibration.

For the existing procedural idol rig, inspect functions such as
makeIdol() and apply(), if present.

In particular:
- Elbows and knees may be one-axis hinges.
- Arms may use custom rotation signs.
- Leg rotations may already be computed from foot targets using IK.
- Root translation may lack a forward/backward component.

Adapt these constraints intentionally rather than forcing a generic
rig implementation onto the character.

## Step 8 — Retarget motion

Convert source motion to target-rig animation.

Requirements:
- Preserve target bone lengths and proportions.
- Align source and target rest poses.
- Compute target local rotations relative to each parent.
- Account for each bone's rest orientation and axis conventions.
- Use quaternions internally.
- Enforce anatomical and rig-specific joint limits.
- For a facing-camera idol: keep body/face on +Z, bring raised hands toward the audience, and reject K-poses (crossed feet or shin-forward foot Z). See project-reference.md.
- Scale root translation appropriately for the character.

Do not directly copy image joint positions onto character bones.

When only joint positions are available:
- Derive limb directions.
- Use bend-plane information and temporal constraints where possible.
- Do not assume a direction vector determines full axial twist.
- Build the full joint rotation from (limb direction, bend direction) and
  extract the rig's Euler order from that matrix. Do not map a 2D angle
  onto one Euler channel and patch the rest with constant offsets; verify
  the rig's channel meaning numerically first (verification.md §2–3).

For custom hinge joints, project motion into the allowed bend axis
and document the limitation.

Choose ONE clear owner for leg animation:

Option A:
- Bake final leg rotations after IK correction.

Option B:
- Export foot targets/contact states.
- Let the Three.js runtime solve leg IK.

Do not apply captured leg rotations and then overwrite them with
an unrelated IK pass.

For the existing simple idol rig, prefer a hybrid if appropriate:
- Torso and arms use retargeted local rotations.
- Feet use contact-aware targets.
- Legs use the existing adapted IK.
- Pelvis/root carries body position and facing.

## Step 9 — Ground contact and motion cleanup

Detect likely foot-contact intervals using:
- Foot height
- Foot velocity
- Detection/reconstruction confidence
- Temporal consistency

For reliable contact intervals:
- Anchor the planted foot.
- Solve the leg toward that anchor.
- Adjust root height when necessary.
- Respect target limb reach.
- Prevent foot penetration through the ground.

Allow foot lifts and deliberate pivots.
Do not lock both feet rigidly throughout the dance.

Handle shoe sole/ankle offsets from the actual model.

Use hysteresis or equivalent stabilization to avoid rapid switching
between planted and unplanted states.

Smooth correction transitions without erasing steps or dance accents.

## Step 10 — Export a Three.js animation format

Keep separate artifacts for:
1. Raw detector output
2. Cleaned canonical motion
3. Target-rig animation

Define and validate an animation JSON schema containing:

- schemaVersion
- duration
- coordinate system and units
- target rig identifier
- root-motion mode
- timestamps
- root positions and quaternions
- per-bone local quaternion tracks
- optional foot targets and contact states
- confidence/quality metadata

Quaternion order must be explicitly:
[x, y, z, w]

Declare whether exported local rotations:
- Include the target rest-pose orientation, or
- Are deltas from rest

Prefer complete local rotations to avoid runtime ambiguity.

Root transforms must be relative to a documented parent space.
Foot targets must also declare their coordinate space.

Do not export non-root position tracks that stretch target limbs
unless the rig explicitly requires them.

Do not include a duplicate root track among the bone tracks.

Use stable bone identifiers or paths.
Save a rig mapping file alongside the animation.

Package playback data into one file or a small number of chunks.
Do not fetch one OpenPose JSON file per animation frame.

## Step 11 — Implement Three.js playback

Build working playback integration that:

- Loads the exported motion once
- Waits for the character to be ready
- Resolves track identifiers to actual joints
- Uses elapsed time and recorded timestamps
- Interpolates positions with lerp
- Interpolates quaternions with slerp
- Supports play, pause, seek, restart, speed, and optional looping
- Applies runtime IK only if that export mode was selected

Do not advance by one capture frame per render frame.

For skinned rigs:
- Use AnimationClip/AnimationMixer where appropriate.

For custom rigs:
- Use an adapter that applies tracks to Object3D joints and/or
  feeds foot targets into the existing IK.

Disable or bypass the old procedural dance update while captured
animation is playing. Avoid two animation systems writing to the
same joint in one frame.

Add root forward/backward movement if needed.

Synchronize a reference video with the animation for inspection.
Seeking and speed changes should keep both aligned.

Do not assume the last pose matches the first.
Default to non-looping playback unless a loop transition is created.

## Step 12 — Validate with a short clip first

Before processing a full song:

1. Process a short test segment.
2. Render landmarks over the source video.
3. Render the reconstructed skeleton.
4. Animate the actual target character.
5. Display video and character side by side.

Provide optional debug views:
- Joint names and axes
- Ground plane
- Foot targets
- Contact states
- Facing direction
- Confidence indicators

Verify:
- Correct dancer tracked
- Correct left/right correspondence
- Correct scale and ground level
- Correct arm and knee bend directions
- Stable bone lengths
- No NaNs or invalid quaternions
- Correct timing and duration
- Reasonable foot planting
- No competing animation updates
- Turns preserved in full-3d mode when visible in the test clip

Add automated validation for:
- Monotonic timestamps
- Track/sample consistency
- Finite numbers
- Normalized quaternions
- Valid rig mappings
- Reachable or safely clamped IK targets

Report uncertainties and failure spans.
If a browser or GPU test cannot be run, state that it is unverified.

Then run the full quality gate in verification.md: overlay montage,
turn detection, numeric rig-convention check, side-by-side screenshots
at matched timestamps, rotation-step continuity counts, and the report
template. A green validator with a character that does not follow the
dancer is a failed job.
