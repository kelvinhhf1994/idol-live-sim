# Ngau Tau Kok Venue Rebuild Plan

**Goal:** Rebuild the 牛頭角 live house so it matches the reference photos: stage-right EXIT door on the
back wall beside the stage, an open glass-fronted foyer facing a mall corridor (tuck shop and display
area side by side, no partitions, red rope queue + carpet outside), larger and more detailed rigging
(box truss, moving heads, line arrays, ceiling panels), and a "house lights off, show on" default with
a HUD toggle (top-left) to switch house lights on/off.

**Approach:** Replace `src/scene/createNgauTauKokVenue.ts` with a zone-based rebuild driven by a few
top-level dimension constants. Proven parts are ported verbatim: PA booth, LED wall texture, disco
ball, stage-right stairs, penlight crowd, shop canvas textures. `venue.ts` definition is edited in
place. `VenueBuild` gains an optional `houseLights` controller consumed by `App.ts`.

## Dimensions (metres)

- Hall: x ∈ [-7, 7], back wall inner face z = -9.2 (stage sits against it), entrance wall z = 12.0,
  ceiling 6.2, trusses at 5.0.
- Stage: x ∈ [-4.6, 4.6], z ∈ [-9.2, -6.2], height 0.7 (unchanged, performer points unchanged).
- Foyer: z ∈ [12.15, 16.0]; glass shopfront at z = 16.0 with door gap x ∈ [-1, 1].
- Mall corridor: z ∈ [16.0, 20.5]; mall far wall at z = 20.5. Total footprint 14.0 × 29.7.

## Tasks

1. `src/config/venue.ts` + `src/config/ngauTauKokVenue.test.ts`: new bounds, colliders (walls,
   glass front, foyer furniture, queue ropes), remove backstage/pillar colliders.
2. `src/scene/createNgauTauKokVenue.ts`: hall shell, stage, stage-right exit door on back wall, box
   truss rigging, moving heads, PARs, line arrays, ceiling LED panels, ducts.
3. Same file: foyer (powerbank kiosk, 2 fridges, staff table on the left; TV display, merch table,
   roll-up banner on the right) + mall corridor (marble floor, carpet runner, rope stanchions).
4. Lighting: local (attenuated) lobby lights; hall house lights (panels + ambient) behind a
   `houseLights` toggle, default off; show lights + back lights + volumetric beam cones.
5. HUD: `#house-lights-button` beside the venue badge (`index.html`, `styles.css`, `App.ts`); shown
   only when the loaded venue exposes `houseLights`. e2e assertion for 牛頭角.
6. Verify: `npm test`, `npm run typecheck`, Playwright screenshots compared against the photos.

Out of scope: LED wall artwork, Neon Backstage venue, automatic lights-off transition.
