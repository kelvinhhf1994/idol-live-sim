# FT Special — Kowloon Bay Sheep Ride Design

**Date:** 2026-09-11
**Status:** Approved by user (speed 2×, jump allowed while riding)

## Goal

Add a Kowloon Bay–only action, **FT Special**. When active the hero sits astride a plush
"sheep" stool (modelled on the reference photos of a white bouclé pony/sheep footstool) and can
move at lift speed. The sheep is built entirely from rounded primitives (spheres and capsules).

## Trigger and gating

- New round button `#ft-special-button` in `.action-cluster__pit` beside 2STEP / LIFT / MOSH.
- Visible only while the loaded venue is `kowloon-bay-live-house-01`. `App.loadVenue` hides the
  button and dismounts when any other venue loads.
- Toggle semantics like LIFT: click mounts, click again dismounts. `aria-pressed` reflects state.

## Sheep model (`src/scene/createSheepMount.ts`)

Dimensions follow the product photo for length and seat (83 cm long, 50 cm seat height, ~78 cm to
ear tip) but the body is widened 2× (≈60 cm) and the head 1.5× for a chubbier plush look, per user
feedback. Sheep faces -Z like the hero. Parts, all `SphereGeometry` / `CapsuleGeometry`:

- Rump: large ellipsoid at the rear, slightly flattened; the seat.
- Body: horizontal capsule from rump to shoulders; back is flat enough to sit on.
- Legs: four vertical capsules. Front pair thicker and taller, rear pair short and stout.
- Neck: short thick capsule, mostly buried between shoulders and head.
- Head: one chunky loaf-shaped capsule tilted forward-down, scaled uniformly 1.5×; the nose
  therefore reaches past the 0.83 m sheet length.
- Ears: two short capsules standing up on the crown.
- No eyes or mouth (the stool has none). Colour `#f4eee4`, `roughness 1`. Each mesh gets an
  inverted-hull outline for consistency with the hero.

Returns `{ group, body, frontLeftLeg, frontRightLeg, rearLeftLeg, rearRightLeg, head }` so the
ride action can animate the gallop.

## Ride action (`src/player/SheepRideAction.ts`)

- `start()` / `stop()` / `isActive`.
- `update(dt, moving)`: advances a gallop phase only while moving; phase eases back when idle.
- `writeRidePose(phase, moving, pose)`: rider pose — `bodyY` lifted so the pelvis sits on the seat,
  hips flexed forward and abducted to straddle, knees bent, arms forward gripping the neck, slight
  forward chest lean, small vertical bounce synced to the gallop.
- `applySheepGallop(phase, moving, mount)`: front and rear leg pairs swing in anti-phase; body bobs.

## PlayerController integration

- `startRide()` cancels mosh, two-step, jump-point, beat and lift, then attaches the mount to
  `rig.group`. `stopRide()` detaches and hides it.
- Movement speed while riding: `settings.liftSpeed` (2×). Collision radius / boundary padding 0.45.
- Riding pose has top priority in `animate()` including airborne frames, so a jump carries the
  sheep along without breaking the seat.
- Penlight cheer poses are suppressed while riding (hands on the sheep). Stick stays idle.

## App wiring

- `App` owns the button; `handleRideToggle` flips `player.rideActive` and updates `aria-pressed`.
  Riding is mutually exclusive with MOSH / LIFT / 2STEP / 跳指 the same way those actions already
  are with each other: starting any of them dismounts, and `syncRideChrome` keeps the button in step.
- `AppSnapshot.rideActive` exposed for tests.

## Testing

- `createSheepMount.test.ts`: bounding box matches photo proportions; only sphere/capsule
  geometry; four legs; head in front (-Z).
- `SheepRideAction.test.ts`: phase advances only while moving; pose straddles (opposite hipZ sign)
  and lifts the body.
- `PlayerController.test.ts`: riding speed equals lift speed; start cancels mosh/lift; mount is
  attached to the rig group only while riding; jump while riding keeps the mount attached.
