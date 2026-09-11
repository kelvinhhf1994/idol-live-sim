# Kowloon Bay (九龍灣) Live House Venue Design

**Date:** 2026-09-11
**Status:** Approved by user, ready for implementation planning

## Goal

Add a third playable venue, 九龍灣, to the live house explorer. It is modelled on reference photos and
a hand-drawn floor plan of the real room. Its signature features are a very high ceiling and a
two-storey backstage on stage right whose upper floor extends over the audience entrance and ends in
a glass-walled room full of plushies that overlooks the stage. The player spawns inside the entrance
vestibule, can walk through a curtain gap into the backstage corridor, climb to 2/F and stand in the
glass room looking down at the stage.

Detail level matches 牛頭角: props, textures, rigging, house-light toggle, atmospheric penlight crowd.

## Reference photo reading (world coordinates)

Audience faces -Z; +X is the audience's right hand; the stage sits against the back wall at -Z.
Backstage, entrance vestibule and the glass room are therefore on the -X side (the performer's right
when facing the audience); the WC door, fridge, PA desk and sofa are on the +X side.

| Photo | What it tells us |
|---|---|
| Audience facing stage | Black stage against black curtains; two-tier aluminium truss walkway in front with 3-step stairs at both ends; WC door with EXIT sign and wall clock on the +X side beside the stage; light grey wood laminate floor; dense pipe rigging, moving heads, fluorescent tubes, cassette air-con units on a very high black ceiling. |
| Stage facing audience | Rear wall covered in grey acoustic foam tiles with posters; Coca-Cola fridge and PA desk on +X rear; glass room with plushies on 2/F at -X rear with the entrance doorway underneath it; hung line-array on upper -X. |
| The right side (+X) | WC door + clock near the stage, metal panel, bin, black ornate throne chair, aluminium ladder with net bag of plushies, fridge at the rear corner. |
| The left side (-X) | Glass room (two large panes + a corner pane) above the entrance doorway; white ticket table with lamp beside the doorway; folding chairs visible inside the vestibule. |
| Panel / entrance photos | PA desk with mixer and two monitors, black sofa in front facing the stage, cables on the acoustic wall. |
| Floor plan | Stage at the bottom; stairs at both ends of the stage front; "stair to stage" and "to 2/F" on the backstage side next to the stage; backstage corridor along the side wall up to the entrance box at the rear corner; fridge and panel at the opposite rear corner; WC beside the stage on the other side. |

## Dimensions (metres)

- Footprint: x ∈ [-6.5, 6.5], z ∈ [-11.0, 4.0]. Back wall inner face z = -11.0, rear wall z = 4.0.
- Ceiling 7.6 (牛頭角 is 6.2). Pipe grid 5.6–6.4. Fluorescent battens hang at 6.0.
- Stage: x ∈ [-4.5, 4.5], z ∈ [-11.0, -8.0], height 0.7. Performer line y 0.7, z -9.5, spacing 0.78.
- Truss walkway ("花道"): x ∈ [-3.5, 3.5], z ∈ [-8.0, -7.4], height 0.6, two truss tiers with diamond
  plate top; 5 wedge monitors on top facing the stage. End stairs: x ∈ [-4.4, -3.5] and [3.5, 4.4],
  three 0.3 m treads at 0.2 / 0.4 / 0.6 with handrails, clear of the partition (x = -4.5) and the WC
  block (x = 4.5). Stepping from 0.6 onto the 0.7 stage is allowed. `crowdBarrier` is only consumed
  by scene builders for rendering, so here it is the walkway footprint and `stage.ts` renders it.
- WC block (+X, beside stage): x ∈ [4.5, 6.5], z ∈ [-11.0, -7.6]. Door on its +Z face at x ≈ 5.5 with
  EXIT sign and wall clock above; bin beside it.
- Backstage partition (black curtain wall): x = -4.5, from z = -8.0 to z = 1.2, with a curtain gap at
  z ∈ [-0.2, 1.0] (the backstage entrance, just stage-ward of the vestibule).
- Backstage corridor: x ∈ [-6.5, -4.5], z ∈ [-11.0, 1.2].
  - Stage stairs: x ∈ [-5.5, -4.5], z ∈ [-9.5, -8.5], four 0.25 m treads rising in +X at
    0.175 / 0.35 / 0.525 / 0.7 onto the stage wing.
  - 2/F stairs: x ∈ [-6.5, -5.5], 15 treads of 0.28 m, rising in +Z from z = -10.2 to z = -6.0,
    heights 0.2, 0.4 … 3.0. Steel stringers and handrails. The stairwell above it is open (no deck).
- 2/F deck, height 3.0: corridor deck x ∈ [-6.5, -4.5], z ∈ [-6.0, 1.2]; glass room deck
  x ∈ [-6.5, -3.0], z ∈ [1.2, 4.0].
- Entrance vestibule (ground floor under the glass room): x ∈ [-6.5, -3.0], z ∈ [1.2, 4.0]. Doorway
  1.6 m wide on its -Z face at x ∈ [-5.0, -3.4]. Closed outer door with 入口 sign on the +Z wall.
  Folding chairs inside. Player spawn (-4.2, 0, 2.8), yaw 0 (facing -Z through the doorway).
- Glass room (2/F over the vestibule): walls with glazing on the -Z face (facing the stage) and the
  +X face (facing the hall); sill 0.9 above the deck (y 3.9), glass 1.5 tall (to y 5.4); thin dark
  frames; room ceiling at 5.8. Shelves inside lined with instanced colourful plushie boxes; warm
  interior light.
- Audience floor: x ∈ [-4.5, 6.5], z ∈ [-7.4, 4.0] minus the vestibule.

## Multi-level ground (engine change)

`groundHeightAt(venue, x, z, fromY?)` in `src/core/venueGround.ts` gains an optional `fromY`. When
provided, it returns the highest platform containing (x, z) whose `height <= fromY + 0.22`, falling
back to `venue.spawn.y`. When omitted it keeps today's "highest platform" behaviour so existing
callers and venues are unaffected.

`PlayerController` passes `this.position.y` for both the starting and next ground lookups and for the
`groundHeight` getter. Consequences, all intended:

- Ground-floor players walk under the 2/F deck (vestibule, backstage corridor) at height 0.
- Each stair tread is a platform; 0.2 m steps are within the existing 0.22 step tolerance.
- A player on the deck cannot walk off its edge: the drop to 0 exceeds 0.22 so movement is blocked.
  Deck edges therefore act as railings without extra colliders.
- Ground-floor walls under the deck (partition, vestibule walls) carry `maxY: 3.0` so they stop
  ignoring the player once `baseY >= 3.0`, using the existing collider semantics. No `minY` is needed.

Jumping under the deck never reaches `3.0 - 0.22`, so a ground player cannot pop onto the deck.

## Venue definition (`src/config/venue.ts`)

- `builderId` union gains `"kowloon-bay"`.
- `KOWLOON_BAY_VENUE`: id `kowloon-bay-live-house-01`, name `九龍灣`, bounds and camera bounds from the
  footprint, spawn in the vestibule, colliders for walls / WC block / partition (with the gap) /
  vestibule walls (doorway gap) / truss walkway / stage / fridge / PA desk / sofa / throne / ladder /
  tables, platforms for stage, truss walkway, both stair runs, 2/F deck and glass room deck,
  `crowdBarrier` = the truss walkway footprint with `maxY: 0.6` (also listed in `colliders` so a
  ground player cannot clip into the truss), 15 audience points on the floor,
  light colours, `youtubeVideoId` same as 牛頭角.

## Scene builder

New folder `src/scene/kowloonBay/` so the builder does not become another 2300-line file:

- `createKowloonBayVenue.ts` – entry point; assembles the modules below, show lighting, beam cones,
  house lights, atmospheric crowd; returns `VenueBuild` with `houseLights` and `knockableProps`.
- `shell.ts` – light grey plank floor, black curtain side walls, acoustic-tile rear wall and vestibule
  face, black ceiling, two cassette air-con units.
- `stage.ts` – stage deck, skirt, yellow tape marks, back curtain, truss walkway with diamond plate,
  wedge monitors, end stairs with handrails.
- `rigging.ts` – pipe grid, fluorescent battens (house lights), moving heads with fake beam cones,
  PAR cans, hung line arrays.
- `backstage.ts` – partition curtains with gap, corridor, stage stairs, 2/F stairs with stringers and
  handrails, corridor deck with edge rail, glass room (frames, glass, shelves, plushie boxes, light).
- `props.ts` – WC door with EXIT sign and clock, bin, throne chair, ladder with plushie net, fridge,
  PA desk with mixer and monitors, sofa, posters, long white folding table, ticket table with lamp,
  red pony (knockable), folding chairs in the vestibule.
- `textures.ts` – new canvas textures: acoustic foam tiles, plushie box faces, wall clock, 入口 sign,
  poster wall variant.

New `src/scene/venueKit.ts` holds the generic helpers moved out of `createNgauTauKokVenue.ts`:
`addBox`, `material`, `labelPlane`, `textTexture`, `setInstanceTransform`, `pleatedCurtainTexture`,
`woodPlankTexture` (gains a colour option for the light grey floor), `createFridgeTexture`,
`createExitSignTexture`, `createExitDoor`, `speakerGrilleTexture`, `consoleMixerTexture`,
`addMovingHead`, `addParCan`. 牛頭角 imports them; behaviour is unchanged and its existing tests
remain the regression check. `createVenue.ts` dispatches `"kowloon-bay"` to the new builder.

## App wiring

- `src/ui/StationSelector.ts`: `kowloon-bay` status becomes `active`.
- `src/app/App.ts`: replace the station id if/else chain with a `STATION_VENUES` map
  (`neo-backstage`, `ngau-tau-kok`, `kowloon-bay`) used both by `handleEnterWithStation` and the
  `?station=` URL preview. Venue badge shows `LIVE · 九龍灣`.
- House-light HUD button appears because the venue exposes `houseLights`; default off.

## Testing

- `src/core/venueGround.test.ts`: overlapping 0 / 3.0 platforms → `fromY` 0 gives 0, `fromY` 3 gives
  3, `fromY` 2.9 gives 3 (within tolerance), omitted `fromY` keeps the highest.
- `src/player/PlayerController.test.ts`: walks under a deck at ground level; climbs 15 × 0.2 treads to
  3.0; is blocked at the deck edge; walls with `maxY: 3.0` do not block a player standing at 3.0.
- `src/config/kowloonBayVenue.test.ts`: consecutive stair treads differ by ≤ 0.22 and abut; the top
  tread abuts the deck; spawn lies inside the vestibule, inside bounds and outside every collider; the
  backstage gap and the doorway have no collider; partition / vestibule colliders have `maxY <= 3.0`;
  performer line lies inside the stage; all audience points are on the audience floor.
- `src/scene/kowloonBay/createKowloonBayVenue.test.ts`: builds under Node (canvas textures guard on
  `typeof document`), returns `houseLights` (default off) and colliders equal to the definition,
  `knockableProps` includes the pony.
- Existing 牛頭角 tests keep passing after the `venueKit` extraction.
- e2e (`e2e/desktop.spec.ts`): `?station=kowloon-bay` enters, HUD shows 九龍灣 badge and house-light
  button, screenshot captured for visual comparison with the photos.
- `npm test` and `npm run typecheck` green.

## Implementation order

1. Y-aware `groundHeightAt` + `PlayerController` (TDD).
2. Extract `venueKit.ts`; 牛頭角 tests stay green.
3. `KOWLOON_BAY_VENUE` definition + config tests.
4. `kowloonBay/` shell, stage, truss walkway.
5. Backstage, both stair runs, 2/F deck, glass room.
6. Rigging, show lights, house lights, beam cones.
7. Props, textures, atmospheric crowd, knockables.
8. Station activation, App map, e2e screenshot, visual tuning against photos.

## Out of scope

Interior furnishing of the backstage corridor beyond stairs and cases, rooms along the 2/F corridor,
leaving the venue through the outer door, camera collision with the glass room ceiling, changes to
Neon Backstage.
