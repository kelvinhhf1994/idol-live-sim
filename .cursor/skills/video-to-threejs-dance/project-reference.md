# 3d-game idol rig

Inspect these files before asking the user to describe joints. Do not assume another character's bone names.

Package manager: npm. Runtime: Vite + TypeScript + Three.js `^0.185`. Tests: Vitest + Playwright.

## Character constructors

| Builder | File | Notes |
|---------|------|--------|
| `createChibiIdol` | `src/scene/createChibiIdol.ts` | Stage idols. `PersonRig`. Pelvis rest Y ≈ 0.91. Group scale compresses body (`CHIBI`). |
| `createWeekendHero` | `src/scene/createWeekendHero.ts` | Alternate `PersonRig`. Pelvis rest Y ≈ 0.516. |
| `createCharacter` | `src/scene/createCharacter.ts` | Audience/player `PersonRig`. Pelvis rest Y = 0.64. |
| `makeIdol()` | `idol-dance.html` | Standalone demo hierarchy used as the simple-rig reference. |

`PersonRig` (`src/scene/createCharacter.ts`): `group`, `body`, `pelvis`, `chest`, `neck`, `head`, shoulders, elbows, hips, knees, `leftFootPivot` / `rightFootPivot`, `pelvisRestY`.

Hierarchy: `group` → `body` → `pelvis` → `chest` → `neck`; hips parented to `pelvis`; shoulders parented to `chest`.

Atlas idols face +Z. Up is +Y. Image x-right / y-down is not the same as Three.js.

## Pose and apply paths

Two apply paths exist. Do not mix them in one frame.

### `applyPersonPose` — `src/animation/personPose.ts`

Euler channels on `PersonPose`. Elbows write `rotation.x` as the pose value (no sign flip). Knees write `-leftKnee` / `-rightKnee`. Root `body.position.z` is not driven. `resetRigPose` zeros `body.position.z`.

`clampPersonPose` limits include: elbows `[0, 2.4]`, knees `[0, 2.35]`, `bodyPositionX` `[-0.5, 0.5]`. Do not silently raise these to hide retarget error.

### `applyIdolDancePose` — `src/show/idolDance.ts`

Used by the live-house show. Shoulder/elbow X uses a **negative** sign:

```
leftShoulder.rotation.set(-leftShoulderX, leftShoulderY, leftShoulderZ)
leftElbow.rotation.set(-leftElbow, 0, 0)
```

`body.position` is `(bodyPositionX, bodyY, 0)` — no forward/backward root. Procedural `writeIdolDancePose` forces `bodyYaw = 0`. `applyIdolDancePose` writes `pose.bodyYaw` so `full-3d` turns play.

`plantFoot` solves two-bone IK from foot targets in **idol-group space**. Shoe offset `SHOE = 0.08`. Limb lengths `THIGH = 0.43`, `SHIN = 0.4`. Knee is a one-axis hinge. The hip twist uses a **+Z audience pole** so the shin does not jut at the camera (K-pose).

## Audience-facing generation invariants

Every captured clip for this rig must keep the performer facing the audience. Future video-to-dance runs have to enforce these in retarget **and** `validate_animation` (fail the job, do not ship a K-pose):

- Face and body stay on +Z: `bodyYaw`, `chestY`, and `pelvisTwist` are 0 in `front-facing-2d`. `full-3d` writes unwrapped `bodyYaw`.
- Shoulders are solved from the observed upper-arm direction (`scripts/video-to-dance/arm_retarget.py`, `ArmSolver`). Euler order is XYZ with `R = Rx(-X) Ry(Y) Rz(Z)`; upper arm = `R·(0,-1,0)`, elbow bends toward `R·(0,0,1)`. Do not approximate a raised arm with a fixed forward X: X only swings a *hanging* arm forward; for an overhead arm positive X points it backward.
- Upper arm stays in front of the chest mesh: direction Z ≥ 0.18 in chest space (`shoulder_direction(x, y, z)[2]`), more when the arm crosses the midline. `validate_animation` fails otherwise.
- The elbow is a one-axis hinge; its bend plane is chosen from the observed forearm (never behind the torso) and rotated gradually so it does not flip.
- Feet stay on their own side (`leftFootX` ≤ −0.06, `rightFootX` ≥ 0.06) with a gap. Do not let both feet share one column.
- Foot Z ≤ 0.02. Do not plant the foot toward the audience; that bends the calf forward into a K.
- Do not invent yaw from the 2D shoulder line. That line already points along −X on a facing dancer.

`idol-dance.html` `apply()` is the same hybrid: torso/arms from Euler pose, legs from `plantFoot`, `body.position.z` fixed at `0`.

## Required retarget ownership for this idol

Prefer the hybrid in Step 8:

- Torso and arms: retargeted local rotations (respect apply-path sign conventions).
- Feet: contact-aware targets in group space (`leftFootX/Y/Z`, `rightFootX/Y/Z`).
- Legs: existing `plantFoot` / adapted IK. Do not also bake competing hip/knee Euler tracks.
- Pelvis/root: body position and facing. Add root Z only if playback needs stage travel.

Elbows and knees are one-axis hinges. Project captured bends onto that axis.

Do not overwrite bind-pose `pelvisRestY` or bone lengths. `createChibiIdol` `PROPORTIONS`: upperArm 0.265, forearm 0.235, thigh 0.43, shin 0.4, ankleHeight 0.08.

## Existing procedural dance (must bypass)

`src/show/idolDance.ts` and `idol-dance.html` `sample()` write procedural cycles. While captured animation plays, disable that update. Two writers on the same joint in one frame is a validation failure.

`ShowController` also layers idol poses. Check it before wiring playback into the live house.

## Suggested project layout

Follow existing `src/`, `public/`, `scripts/` conventions:

```
scripts/video-to-dance/          # Python/CLI stages + orchestrator
public/motions/                  # dance.animation.json and chunks
src/animation/capturedDance.ts   # player + rig adapter
src/animation/rigMapping.ts
```

Use npm scripts on the orchestrator. Isolated Python env for OpenPose / 3D backends. Do not add Python deps to the Vite `package.json` unless the user asks.

## Preview pages

Reuse standalone HTML next to `idol-dance.html` / `character-studio.html` for overlay and side-by-side previews. Do not replace the live-house `index.html` flow unless asked.
