# Kowloon Bay — Moving Light Show Design

**Date:** 2026-09-11
**Status:** Approved by user (approach A, always-on while house lights are off, moving heads + spots move, PARs colour-only). Revised after review: faster pacing for fast songs and a static face fill.

## Goal

Turn the Kowloon Bay hall rig from a static dressing into a running show: the moving heads and
stage spots sweep slowly across the stage and crowd while their colours drift through the venue
palette. The decorative fixture models, the real `SpotLight`s and the volumetric beam cones all
stay in sync so nothing visibly detaches.

## Current state

- `rigging.ts` → `buildFixtures` places 10 moving heads (5 on the stage bar aimed at the stage,
  5 on the mid-hall pipe aimed at the crowd) and 6 PAR cans. Pan/tilt is baked at build time and
  each fixture pushes one static `FakeBeam`.
- `rigging.ts` → `createShowLights` adds 4 key `SpotLight`s, 2 back spots and folds every beam
  into a single static `InstancedMesh` (`light-beams`).
- `ShowController.update` only pulses `stageLights` intensity. Nothing changes colour or aim.
- `VenueBuild` exposes no per-frame hook; `App.render` drives `showController.update` only.

## Design

### Venue-level `lightShow` hook

`VenueBuild` gains an optional `lightShow?: { update(elapsed: number): void }`. `App.render`
calls `this.venue.lightShow?.update(elapsed)` right before `showController.update`. The call is
skipped while `houseLights.enabled` is true (the beams are hidden then anyway and the room reads as
work-light mode). Ngau Tau Kok and the generic venue return no `lightShow` and are untouched.

### Handles from `venueKit`

- `addMovingHead` returns `MovingHeadHandle { fixture: THREE.Group; head: THREE.Group; lens: THREE.MeshStandardMaterial }`
  so the show can drive pan (`fixture.rotation.y`), tilt (`head.rotation.x`) and lens colour.
- `addParCan` returns `ParCanHandle { face: THREE.MeshStandardMaterial }` for colour-only cycling.
- `aimAngles(from, to)` is exported so the show reuses the same pan/tilt convention the builders use.
- `setBeamInstance(mesh, index, beam)` is extracted from `createBeamCones` and exported; the show
  calls it per frame for animated cones, then flags `instanceMatrix` / `instanceColor` dirty.

### `src/scene/kowloonBay/lightShow.ts`

`createKowloonBayLightShow(parts, palette)` where `parts` is collected by `rigging.ts`:

- `heads: { handle, from, homeTo, beamIndex, sweep: { ampX, ampZ, speed, phase } }[]`
- `spots: { light, homeTo, beamIndex, sweep }[]` — the 4 key spots and 2 back spots
- `pars: ParCanHandle[]`
- `beams: THREE.InstancedMesh` (the shared cone mesh) and each beam's `radius`

`update(elapsed)` per fixture:

- **Aim:** `to = homeTo + (sin(elapsed·speed + phase)·ampX, 0, cos(elapsed·speed·0.7 + phase)·ampZ)`.
  Amplitudes keep stage-bar heads inside the stage footprint (±1.6 m x, ±0.8 m z; key spots ±1.4 m x)
  and mid-hall heads inside the crowd floor (±2.2 m x, ±1.5 m z). Speeds 0.8–1.05 rad/s so a full
  sweep takes 6–8 s, matching the fast songs the venue mostly plays.
- **Colour:** palette index drifts continuously: `t = elapsed / COLOR_PERIOD + fixtureOffset` with
  `COLOR_PERIOD = 2` s (one bar at ~120 BPM); colour is
  `lerp(palette[floor t], palette[floor t + 1], smoothstep(frac t))`. Each fixture has a different
  offset so the rig is never monochrome.
- Writes: `spot.color`, `spot.target.position`, `fixture.rotation.y`, `head.rotation.x`,
  `lens.color` + `lens.emissive`, `par.face.color` + `emissive`, and the beam instance matrix and
  colour via `setBeamInstance`.

Constants live at the top of the file; no runtime configuration.

### Face fill

A static neutral `SpotLight` named `face-fill` (0xffe6d6, intensity 22, decay 1.0) hangs on the
mid-hall pipe and aims at face height (stage + 1.1 m) on the performer line. It is not part of the
show or `stageLights`, so idols stay readable between sweeping beams without washing out the colour.

### `ShowController`

Unchanged. Its intensity pulse on `stageLights` continues on top of the colour drift.

## Testing

- `venueKit.test.ts` (new): `addMovingHead` returns a handle whose `fixture` is in the parent and
  whose `head.rotation.x` matches `aimAngles`; `setBeamInstance` writes the expected matrix and
  colour.
- `lightShow.test.ts` (new): after `update(0)` and `update(4)`, a spot's colour hex and target
  position differ; a moving head's pan/tilt differs; the beam mesh `instanceMatrix.needsUpdate` is
  set; every stage-bar aim point stays within the stage bounds and every mid-hall aim point stays
  above the hall floor region; PAR face colour changes while its group rotation does not.
- `createKowloonBayVenue.test.ts`: `build.lightShow` is defined; `face-fill` exists, aims at the
  performer line and does not change under `update`; `createNgauTauKokVenue` / generic
  `createVenue` leave it undefined.
- `lightShow.test.ts` also guards pacing: one palette step within 2 s, a full sweep under 8 s.
- Visual check via `scripts/capture-kowloon-bay-previews.mjs` at two timestamps.
