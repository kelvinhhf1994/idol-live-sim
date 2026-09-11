# FOH Consoles and Sittable Chairs Design

**Date:** 2026-09-11
**Status:** Approved by user (all three venues, auto-sit, chairs at 0.44 m, old monitors removed)

## Goal

Every live house gets a proper FOH (front-of-house) desk with the two machines a venue always
has: a **lighting console** (reference: Tekmand Compact — two wide screens on a raised rear panel,
dark grey wedge body, key grid, five encoders, backlit faders) and a **sound mixer** (reference:
Yamaha DM7 — three touch screens, 24+ white-cap faders in three banks, rows of coloured buttons).
The chairs behind the desk are sittable: the hero walks onto a chair, stops, and sits facing the
stage, exactly like the existing Kowloon Bay sofas.

## Shared props (`src/scene/venueKit.ts`)

- `buildLightingConsole(): THREE.Group` — group `lighting-console`, ~1.2 m wide × 0.55 m deep,
  faces -Z (operator sits at +Z). Dark grey wedge body, raised rear panel with a wide
  `console-screen` plane (canvas: orange wireframe plot left, blue grid patch right), key grid,
  five encoder cylinders, fader bank with blue/orange backlit strips, "Compact" side label.
- `buildSoundMixer(): THREE.Group` — group `sound-mixer`, ~1.1 m × 0.6 m, faces -Z. Black flat
  body, `mixer-screen` planes (three screens: coloured channel strips, EQ curve, meters),
  three fader banks with white caps, rows of coloured buttons, "YAMAHA DM7" label.
- `buildFohChair(): THREE.Group` — group `foh-chair`, seat top at 0.44 m, backrest at +Z so the
  sitter faces -Z (stage). Replaces the ad-hoc office-chair / stool boxes.
- Canvas texture helpers `lightingConsoleScreenTexture()` and `soundMixerScreenTexture()`; both
  return an empty `THREE.Texture` when `document` is undefined (Vitest).

## Placement per venue

| Venue | Desk | Machines | Chairs / seats | Colliders |
|---|---|---|---|---|
| Kowloon Bay (`props.ts`) | existing 4 m `pa-desk`, moved forward to `KB_PA_DESK_Z = 2.7` so a 0.9 m operator aisle opens in front of the rear wall, and shifted +X so the desk end stays `KB_PA_DOOR_GAP` (1.02 m = 1.5 player widths) clear of the vestibule doorway wall | sound mixer on -X half, lighting console on +X half; old `pa-mixer` and two `monitor` boxes removed | two `foh-chair` behind the desk, one per machine; `seat: true, sitYaw: 0`; the `sound-mixer` / `lighting` teleports land on them | barrier front board runs from `KB_PA_CX - 1.6` to the +X end board, so the way in is the doorway aisle at the -X end; the +X end is closed up to the rear wall |
| Ngau Tau Kok (`createNgauTauKokVenue.ts`) | red casing widened to 2.7 m | sound mixer + lighting console side by side; old mixer plane, `pa-red-gear`, `pa-mon1/2` removed | high stool replaced by two `foh-chair` on the 0.48 m platform; seat platforms at `height: 0.48`, `sitYaw: 0` | desk collider widened to match |
| Neon Backstage (`createVenue.ts`) | 1.5 m black box replaced by a 0.78 m desk (3.0 × 0.8, z ≈ 2.2–3.0) | both machines on the desk top; "FOH" sign kept | two `foh-chair` behind the desk; `seat: true, sitYaw: 0` | old FOH box collider replaced by the desk AABB |

Seat platforms are ~0.7 × 0.7 m (slightly larger than the chair) so walking onto the chair is easy.
Chairs get no collider, the same as the sofas.

## Sitting

No new input or proximity system. `PlayerController` already applies `writeSitPose` when the hero
is idle inside a `seat: true` platform at the matching floor height, and damps yaw to `sitYaw`.
All FOH chairs are 0.44 m so the existing pose fits without a per-seat body offset.

## Testing (Vitest)

- `venueKit.test.ts`: each builder returns a group with the expected name, footprint (Box3), and
  screen meshes; chair seat top ≈ 0.44 m.
- Venue config tests (`kowloonBayVenue.test.ts`, NTK / generic equivalents): each venue has two
  `seat: true` FOH platforms, and `moveCircleWithCollisions` can carry a floor player from the hall
  into each seat (Kowloon Bay via the new +X gap; NTK via the booth stairs).
- Scene tests: each venue scene contains one `lighting-console`, one `sound-mixer`, two
  `foh-chair`; Kowloon Bay no longer contains `pa-mixer` / `monitor` under `pa-desk`.
