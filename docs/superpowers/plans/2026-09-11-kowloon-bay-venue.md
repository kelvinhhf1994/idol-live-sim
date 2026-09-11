# Kowloon Bay (九龍灣) Venue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the 九龍灣 live house as a third playable venue: a tall black-box hall with a truss walkway in front of the stage and a two-storey backstage on the -X side whose 2/F ends in a glass room over the entrance vestibule that the player can climb up to.

**Architecture:** A `VenueDefinition` (`KOWLOON_BAY_VENUE`) in `src/config/venue.ts` describes bounds, colliders and platforms (stage, walkway, both stair runs, 2/F deck). A new procedural builder folder `src/scene/kowloonBay/` renders it, sharing generic helpers extracted from the 牛頭角 builder into `src/scene/venueKit.ts`. Multi-level walking comes from a small engine change: `groundHeightAt` ignores platforms far above the player's feet, so the ground floor under the 2/F deck stays walkable.

**Tech Stack:** TypeScript 7, three.js 0.185, Vite 8, Vitest 4 (unit), Playwright 1.62 (e2e).

**Spec:** `docs/superpowers/specs/2026-09-11-kowloon-bay-venue-design.md`

## Global Constraints

- World axes: audience faces -Z, +X is the audience's right. Backstage / vestibule / glass room are on the -X side.
- All comments inside code are English. `tsconfig.json` has `strict`, `noUnusedLocals`, `noUnusedParameters` — remove any import that becomes unused.
- Canvas textures must guard `if (typeof document === "undefined") return new THREE.Texture();` so builders run under Node in Vitest.
- Stair treads are 0.2 m (2/F) or ≤ 0.22 m so the existing `PlayerController` step tolerance (0.22) climbs them.
- The stage must be `platforms[0]` of the venue definition (builders and `ShowController` rely on it).
- Run `npm test` and `npm run typecheck` before every commit. Never commit `preview-*.png`, `test-results/`.
- Existing 牛頭角 / Neon Backstage behaviour and tests must keep passing untouched.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/venueGround.ts` (modify) | `groundHeightAt(venue, x, z, fromY?)` — platforms more than `OVERHEAD_CLEARANCE` above `fromY` are ceilings, not ground |
| `src/player/PlayerController.ts` (modify) | Pass `position.y` to every ground lookup; `debugPlaceOnGround(x, z, fromY?)` |
| `src/scene/venueKit.ts` (create) | Generic builder helpers moved out of `createNgauTauKokVenue.ts` |
| `src/scene/createNgauTauKokVenue.ts` (modify) | Import helpers from `venueKit`, keep venue-specific code |
| `src/config/venue.ts` (modify) | `KB_*` layout constants, `KOWLOON_BAY_VENUE`, `builderId: "kowloon-bay"` |
| `src/config/kowloonBayVenue.test.ts` (create) | Layout invariants (stairs, deck, spawn, gaps, colliders) |
| `src/scene/kowloonBay/createKowloonBayVenue.ts` (create) | Entry point, assembles modules, lights, crowd, `VenueBuild` |
| `src/scene/kowloonBay/shell.ts` (create) | Floor, walls, curtains, acoustic rear wall, ceiling, air-con |
| `src/scene/kowloonBay/stage.ts` (create) | Stage deck, tape marks, truss walkway, wedges, end stairs |
| `src/scene/kowloonBay/backstage.ts` (create) | Partition, stage stairs, 2/F stairs, deck + rail, vestibule, glass room, road cases |
| `src/scene/kowloonBay/rigging.ts` (create) | Pipe grid, fluorescent battens (house lights), moving heads, PARs, line arrays, show lights |
| `src/scene/kowloonBay/props.ts` (create) | WC door + clock, bin, throne, ladder, fridge, PA desk, sofa, posters, tables, pony |
| `src/scene/kowloonBay/textures.ts` (create) | Acoustic tile, clock face, poster textures, plushie colours |
| `src/scene/kowloonBay/createKowloonBayVenue.test.ts` (create) | Builder smoke test (names, house lights, knockables, deck height) |
| `src/scene/createVenue.ts` (modify) | Dispatch `"kowloon-bay"` |
| `src/ui/StationSelector.ts` (modify) | Activate `kowloon-bay` |
| `src/ui/StationSelector.test.ts` (modify) | Coming-soon test uses `diamond-hill` |
| `src/app/App.ts`, `src/main.ts`, `src/types/debug.d.ts` (modify) | `STATION_VENUES` map, `placePlayer(x, z, y?)` |
| `e2e/desktop.spec.ts` (modify) | 九龍灣 entry test; locked-station test uses 鑽石山 |
| `scripts/capture-kowloon-bay-previews.mjs` (create) | Screenshot script for visual comparison with the photos |

---

### Task 1: Y-aware `groundHeightAt`

**Files:**
- Modify: `src/core/venueGround.ts`
- Test: `src/core/venueGround.test.ts`

**Interfaces:**
- Produces: `groundHeightAt(venue, x, z, fromY?: number): number` and `export const OVERHEAD_CLEARANCE = 1.2`. Platforms whose `height - fromY > OVERHEAD_CLEARANCE` are skipped when `fromY` is given. Without `fromY` behaviour is unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/venueGround.test.ts`:

```ts
import type { VenueDefinition } from "../config/venue";

// Two overlapping platforms at the same XZ: a stair tread at 2.8 and a 2/F deck at 3.0
const twoLevel: Pick<VenueDefinition, "platforms" | "spawn"> = {
  spawn: { x: 0, y: 0, z: 0, yaw: 0 },
  platforms: [
    { bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }, height: 3.0 },
    { bounds: { minX: -1, maxX: 1, minZ: 2, maxZ: 3 }, height: 2.8 },
    { bounds: { minX: 4, maxX: 5, minZ: -1, maxZ: 1 }, height: 0.7 },
  ],
};

describe("groundHeightAt with a player height", () => {
  it("treats a deck far overhead as a ceiling for a ground-floor player", () => {
    expect(groundHeightAt(twoLevel, 0, 0, 0)).toBe(0);
  });

  it("returns the deck for a player already standing on it", () => {
    expect(groundHeightAt(twoLevel, 0, 0, 3.0)).toBe(3.0);
  });

  it("returns the deck for a player one tread below it", () => {
    expect(groundHeightAt(twoLevel, 0, 0, 2.8)).toBe(3.0);
  });

  it("still reports a knee-high stage as ground so the step logic can block it", () => {
    expect(groundHeightAt(twoLevel, 4.5, 0, 0)).toBe(0.7);
  });

  it("keeps the legacy highest-platform behaviour when no height is given", () => {
    expect(groundHeightAt(twoLevel, 0, 0)).toBe(3.0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/venueGround.test.ts`
Expected: FAIL — "treats a deck far overhead as a ceiling" receives 3.0 instead of 0.

- [ ] **Step 3: Implement**

Replace the body of `src/core/venueGround.ts`:

```ts
import type { VenueDefinition } from "../config/venue";

/** A platform more than this far above the player's feet is overhead (a ceiling), not ground. */
export const OVERHEAD_CLEARANCE = 1.2;

export function groundHeightAt(
  venue: Pick<VenueDefinition, "platforms" | "spawn">,
  x: number,
  z: number,
  fromY?: number,
): number {
  let height = venue.spawn.y;
  for (const platform of venue.platforms) {
    const { bounds } = platform;
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) continue;
    // Skip decks the player is walking underneath; keep knee-high platforms so movement can block on them
    if (fromY !== undefined && platform.height - fromY > OVERHEAD_CLEARANCE) continue;
    if (platform.height > height) height = platform.height;
  }
  return height;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/venueGround.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/venueGround.ts src/core/venueGround.test.ts
git commit -m "feat: make groundHeightAt ignore platforms far overhead"
```

---

### Task 2: PlayerController walks under decks and climbs to them

**Files:**
- Modify: `src/player/PlayerController.ts` (`update`, `groundHeight`, `debugPlaceOnGround`)
- Test: `src/player/PlayerController.test.ts`

**Interfaces:**
- Consumes: `groundHeightAt(venue, x, z, fromY)` from Task 1.
- Produces: `debugPlaceOnGround(x: number, z: number, fromY = this.position.y): void`.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("PlayerController", ...)` block in `src/player/PlayerController.test.ts`:

```ts
  // Synthetic two-level venue: a 3.0 m deck over x∈[-2,2], z∈[-4,4] with a 15-tread stair rising +Z along x∈[3,4]
  const deckVenue = {
    ...GENERIC_VENUE,
    id: "test-two-level",
    spawn: { x: 0, y: 0, z: 0, yaw: 0 },
    bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    colliders: [{ minX: -2, maxX: -1.8, minZ: -4, maxZ: 4, maxY: 3.0 }],
    platforms: [
      { bounds: { minX: -2, maxX: 2, minZ: -4, maxZ: 4 }, height: 3.0 },
      ...Array.from({ length: 15 }, (_, i) => ({
        bounds: { minX: 3, maxX: 4, minZ: -8 + i * 0.28, maxZ: -8 + (i + 1) * 0.28 },
        height: 0.2 * (i + 1),
      })),
      { bounds: { minX: 2, maxX: 4, minZ: -3.8, maxZ: 4 }, height: 3.0 },
    ],
  };

  it("walks underneath a 2/F deck at ground level", () => {
    const player = new PlayerController(createLowPolyPerson(), deckVenue, deckVenue.colliders);
    player.position.set(0, 0, 6);

    for (let frame = 0; frame < 60; frame += 1) {
      player.update(1 / 60, { x: 0, y: -1 }, 0, true);
    }

    expect(player.position.z).toBeLessThan(4);
    expect(player.position.y).toBe(0);
    expect(player.groundHeight).toBe(0);
  });

  it("climbs a 15-tread stair onto the deck", () => {
    const player = new PlayerController(createLowPolyPerson(), deckVenue, deckVenue.colliders);
    player.position.set(3.5, 0, -8.6);

    for (let frame = 0; frame < 240 && player.position.z < -2; frame += 1) {
      player.update(1 / 60, { x: 0, y: 1 }, 0, true);
    }

    expect(player.position.z).toBeGreaterThan(-3.8);
    expect(player.position.y).toBeCloseTo(3.0, 5);
  });

  it("is blocked at the deck edge instead of dropping to the floor", () => {
    const player = new PlayerController(createLowPolyPerson(), deckVenue, deckVenue.colliders);
    player.position.set(0, 3.0, 3.8);
    player.update(0, { x: 0, y: 0 }, 0, true);

    for (let frame = 0; frame < 30; frame += 1) {
      player.update(1 / 60, { x: 0, y: 1 }, 0, true);
    }

    expect(player.position.z).toBeLessThanOrEqual(4);
    expect(player.position.y).toBeCloseTo(3.0, 5);
  });

  it("ignores ground-floor walls capped at deck height while standing on the deck", () => {
    const player = new PlayerController(createLowPolyPerson(), deckVenue, deckVenue.colliders);
    player.position.set(-1.5, 3.0, 0);
    player.update(0, { x: 0, y: 0 }, 0, true);

    for (let frame = 0; frame < 30; frame += 1) {
      player.update(1 / 60, { x: -1, y: 0 }, 0, true);
    }

    expect(player.position.x).toBeLessThan(-1.8);
  });

  it("places the player on the deck when a debug placement starts from deck height", () => {
    const player = new PlayerController(createLowPolyPerson(), deckVenue, deckVenue.colliders);

    player.debugPlaceOnGround(0, 0);
    expect(player.position.y).toBe(0);

    player.debugPlaceOnGround(0, 0, 3.0);
    expect(player.position.y).toBe(3.0);
  });
```

Note on `{ x: 0, y: 1 }`: with camera yaw 0, `y: 1` moves toward +Z and `y: -1` toward -Z (see `calculateWorldMovement`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/player/PlayerController.test.ts`
Expected: FAIL — "walks underneath a 2/F deck" stops at z ≈ 4 (blocked by the 3.0 platform), and the debug placement test fails on the 3-argument call.

- [ ] **Step 3: Implement**

In `src/player/PlayerController.ts`:

Change the ground lookup inside `update` (currently `groundHeightAt(this.venue, nextX, nextZ)`):

```ts
      const nextGroundHeight = groundHeightAt(this.venue, nextX, nextZ, this.position.y);
```

Change the getter:

```ts
  get groundHeight(): number {
    return groundHeightAt(this.venue, this.position.x, this.position.z, this.position.y);
  }
```

Change `debugPlaceOnGround`:

```ts
  /** Debug teleport. `fromY` picks the level when platforms overlap (e.g. 2/F deck over a vestibule). */
  debugPlaceOnGround(x: number, z: number, fromY = this.position.y): void {
    this.position.x = x;
    this.position.z = z;
    this.position.y = groundHeightAt(this.venue, x, z, fromY);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.syncTransform();
  }
```

- [ ] **Step 4: Run the whole unit suite**

Run: `npm test`
Expected: PASS. If "clears the front barrier and lands on the stage while descending" fails, the jump apex is above the stage by more than `OVERHEAD_CLEARANCE`; that cannot happen with jump velocity 6.8 and stage 0.75 (apex ≈ 1.65 → 0.75 − 1.65 < 1.2), so any failure here means a typo in Step 3.

- [ ] **Step 5: Commit**

```bash
git add src/player/PlayerController.ts src/player/PlayerController.test.ts
git commit -m "feat: let the player walk under and climb onto multi-level platforms"
```

---

### Task 3: Extract `venueKit.ts` from the 牛頭角 builder

**Files:**
- Create: `src/scene/venueKit.ts`
- Modify: `src/scene/createNgauTauKokVenue.ts`
- Test: existing `src/scene/createNgauTauKokVenue.test.ts` (no changes) is the regression check

**Interfaces (produced — later tasks import exactly these names):**

```ts
export type InstanceTransform = readonly [number, number, number, number, number, number, number, number, number];
export interface FakeBeam { from: THREE.Vector3; to: THREE.Vector3; color: number; radius: number }
export interface SharedMaterials {
  steel: THREE.MeshStandardMaterial; matteBlack: THREE.MeshStandardMaterial; wallCharcoal: THREE.MeshStandardMaterial;
  fixtureBlack: THREE.MeshStandardMaterial; offWhite: THREE.MeshStandardMaterial; glass: THREE.MeshStandardMaterial;
  frameBlack: THREE.MeshStandardMaterial;
}
export interface HouseLightParts { panelMaterial: THREE.MeshStandardMaterial }
export interface WoodPlankPalette { base: string; planks: readonly string[]; grain: string; seam: string }
export const OAK_PLANKS: WoodPlankPalette;
export function createSharedMaterials(): SharedMaterials;
export function addBox(parent: THREE.Object3D, width: number, height: number, depth: number, meshMaterial: THREE.Material, x: number, y: number, z: number, name = "", castsShadow = true): THREE.Mesh;
export function material(color: number, roughness: number, metalness = 0, emissive = 0x000000): THREE.MeshStandardMaterial;
export function labelPlane(text: string, background: string, color: string, width: number, height: number): THREE.Mesh;
export function textTexture(text: string, background: string, color: string, width: number, height: number): THREE.Texture;
export function setInstanceTransform(mesh: THREE.InstancedMesh, index: number, transform: InstanceTransform): void;
export function aimAngles(from: THREE.Vector3, to: THREE.Vector3): { pan: number; tilt: number };
export function addMovingHead(parent: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, lensColor: number, mats: SharedMaterials): void;
export function addParCan(parent: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, color: number, mats: SharedMaterials): void;
export function createBeamCones(beams: readonly FakeBeam[]): THREE.InstancedMesh;
export function createHouseLights(group: THREE.Group, parts: HouseLightParts, showOnly: readonly THREE.Object3D[]): HouseLights;
export function createExitSignTexture(): THREE.Texture;
export function createExitDoor(group: THREE.Group, x: number, y: number, z: number, rotationY: number, name: string): void;
export function createAtmosphericCrowd(group: THREE.Group, positions: readonly (readonly [number, number])[]): THREE.Group[];
export function woodPlankTexture(palette: WoodPlankPalette = OAK_PLANKS): THREE.Texture;
export function pleatedCurtainTexture(): THREE.Texture;
export function speakerGrilleTexture(): THREE.Texture;
export function createFridgeTexture(): THREE.Texture;
export function consoleMixerTexture(): THREE.Texture;
```

- [ ] **Step 1: Record the baseline**

Run: `npm test && npm run typecheck`
Expected: PASS. (If it does not pass before you start, stop and report.)

- [ ] **Step 2: Create `src/scene/venueKit.ts` by moving code verbatim**

Create the file with this header, then **cut** (not copy) the listed items from `src/scene/createNgauTauKokVenue.ts` into it, adding `export` to each:

```ts
import * as THREE from "three";
import type { HouseLights } from "./createVenue";

// Generic building blocks shared by the procedural venue builders (牛頭角, 九龍灣).
```

Move, in this order:
1. `type InstanceTransform`, `interface FakeBeam`, `interface SharedMaterials` (top of the NTK file).
2. `interface HouseLightParts` (just above `buildHallShell`).
3. The `mats: SharedMaterials = { ... }` object literal from `createNgauTauKokVenue` becomes:

```ts
export function createSharedMaterials(): SharedMaterials {
  return {
    steel: material(0x60636d, 0.35, 0.7),
    matteBlack: material(0x0b0b0e, 0.9),
    wallCharcoal: material(0x141319, 0.88),
    fixtureBlack: new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.55, metalness: 0.45 }),
    // Faint emissive stands in for bounced light in bright side rooms (three.js has no local ambient)
    offWhite: new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.85, metalness: 0.02, emissive: 0x1a1816 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xdff4ff,
      transparent: true,
      opacity: 0.22,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
    frameBlack: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.45, metalness: 0.6 }),
  };
}
```

   and the NTK call site becomes `const mats = createSharedMaterials();`.
4. `aimAngles`, `addMovingHead`, `addParCan`.
5. `createBeamCones`, `createHouseLights`.
6. `addBox`, `material`, `labelPlane`, `textTexture`.
7. `createExitSignTexture`, `createExitDoor`.
8. `createAtmosphericCrowd` — change its signature to take positions:

```ts
export function createAtmosphericCrowd(
  group: THREE.Group,
  positions: readonly (readonly [number, number])[],
): THREE.Group[] {
```

   Delete the local `crowdPositions` array inside it and iterate `positions.forEach(([x, z], i) => { ... })`. In the NTK file, add near the top:

```ts
// Penlight crowd standing positions on the hall floor
const NTK_CROWD_POSITIONS: readonly (readonly [number, number])[] = [
  [-3.8, -4.8], [-2.0, -4.9], [0.8, -4.8], [2.2, -4.9], [3.8, -4.7],
  [-4.2, -3.8], [-2.6, -3.7], [-0.8, -3.9], [1.2, -3.7], [2.8, -3.8], [4.2, -3.9],
  [-3.5, -2.7], [-1.8, -2.5], [0.3, -2.6], [2.0, -2.5], [3.5, -2.8],
  [-3.0, -1.6], [-1.2, -1.4], [0.6, -1.5], [2.4, -1.7], [3.8, -1.5],
  [-2.2, -0.4], [-0.4, -0.2], [1.4, -0.3], [3.0, -0.5],
];
```

   and change the call to `createAtmosphericCrowd(group, NTK_CROWD_POSITIONS)`.
9. `woodPlankTexture` — add the palette parameter:

```ts
export interface WoodPlankPalette {
  base: string;
  planks: readonly string[];
  grain: string;
  seam: string;
}

export const OAK_PLANKS: WoodPlankPalette = {
  base: "#c8a070",
  planks: ["#c49a68", "#cfa672", "#d6b07c", "#bd9260", "#b48a5a", "#c9a06c"],
  grain: "rgba(90, 55, 25, 0.16)",
  seam: "rgba(60, 35, 15, 0.55)",
};

export function woodPlankTexture(palette: WoodPlankPalette = OAK_PLANKS): THREE.Texture {
```

   Inside, replace the literals: `ctx.fillStyle = palette.base;`, `plankColors` → `palette.planks`, the grain `strokeStyle` → `palette.grain`, the seam `strokeStyle` → `palette.seam`, and the fallback `?? "#c49a68"` → `?? palette.base`. Keep `texture.repeat.set(4, 6)`.
10. `pleatedCurtainTexture`, `speakerGrilleTexture`, `consoleMixerTexture`, `createFridgeTexture`, `setInstanceTransform`.

- [ ] **Step 3: Import the kit into the NTK builder**

At the top of `src/scene/createNgauTauKokVenue.ts` add:

```ts
import {
  addBox,
  addMovingHead,
  addParCan,
  consoleMixerTexture,
  createAtmosphericCrowd,
  createBeamCones,
  createExitDoor,
  createFridgeTexture,
  createHouseLights,
  createSharedMaterials,
  labelPlane,
  material,
  pleatedCurtainTexture,
  setInstanceTransform,
  speakerGrilleTexture,
  textTexture,
  woodPlankTexture,
  type FakeBeam,
  type HouseLightParts,
  type InstanceTransform,
  type SharedMaterials,
} from "./venueKit";
```

Then run `npm run typecheck` and remove every name the compiler reports as unused (e.g. `HouseLights` from `./createVenue` if only `VenueBuild` is still needed, `textTexture` if only `labelPlane` used it).

- [ ] **Step 4: Verify nothing changed**

Run: `npm test && npm run typecheck`
Expected: PASS — all 牛頭角 builder/config tests unchanged and green.

- [ ] **Step 5: Commit**

```bash
git add src/scene/venueKit.ts src/scene/createNgauTauKokVenue.ts
git commit -m "refactor: extract shared venue builder helpers into venueKit"
```

---

### Task 4: `KOWLOON_BAY_VENUE` definition

**Files:**
- Modify: `src/config/venue.ts`
- Test: `src/config/kowloonBayVenue.test.ts` (create)

**Interfaces:**
- Produces: `KOWLOON_BAY_VENUE: VenueDefinition` (id `kowloon-bay-live-house-01`), `builderId` union member `"kowloon-bay"`, and exported constants `KB_MIN_X, KB_MAX_X, KB_BACK_WALL_Z, KB_REAR_WALL_Z, KB_HALL_CEILING, KB_STAGE_HEIGHT, KB_STAGE_FRONT_Z, KB_WALKWAY_HEIGHT, KB_WALKWAY_FRONT_Z, KB_PARTITION_X, KB_BACKSTAGE_GAP, KB_DECK_HEIGHT, KB_UPPER_STAIR, KB_DECK_MIN_Z, KB_VESTIBULE, KB_DOORWAY, KB_WC_BLOCK`.

- [ ] **Step 1: Write the failing tests**

Create `src/config/kowloonBayVenue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { OVERHEAD_CLEARANCE, groundHeightAt } from "../core/venueGround";
import { formationPoints } from "../show/formation";
import { MAX_IDOL_COUNT } from "../show/idolMembers";
import {
  KB_BACKSTAGE_GAP,
  KB_BACK_WALL_Z,
  KB_DECK_HEIGHT,
  KB_DECK_MIN_Z,
  KB_DOORWAY,
  KB_PARTITION_X,
  KB_REAR_WALL_Z,
  KB_STAGE_HEIGHT,
  KB_UPPER_STAIR,
  KB_VESTIBULE,
  KB_WALKWAY_HEIGHT,
  KOWLOON_BAY_VENUE,
} from "./venue";

const venue = KOWLOON_BAY_VENUE;
const inside = (x: number, z: number, b: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
  x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

describe("KOWLOON_BAY_VENUE configuration", () => {
  it("is a 13m x 15m hall with a 9m stage against the back wall as platforms[0]", () => {
    expect(venue.id).toBe("kowloon-bay-live-house-01");
    expect(venue.scene).toEqual({ kind: "procedural", builderId: "kowloon-bay" });
    expect(venue.bounds.maxX - venue.bounds.minX).toBeCloseTo(13, 5);
    expect(venue.bounds.maxZ - venue.bounds.minZ).toBeCloseTo(KB_REAR_WALL_Z - KB_BACK_WALL_Z, 5);
    const stage = venue.platforms[0];
    expect(stage.height).toBe(KB_STAGE_HEIGHT);
    expect(stage.bounds.minZ).toBe(KB_BACK_WALL_Z);
    expect(stage.bounds.maxX - stage.bounds.minX).toBeCloseTo(9, 5);
  });

  it("keeps a full twelve-idol line on the stage", () => {
    const stage = venue.platforms[0].bounds;
    for (const { x, y, z } of formationPoints(venue.show.performerLine, MAX_IDOL_COUNT)) {
      expect(inside(x, z, stage)).toBe(true);
      expect(y).toBe(KB_STAGE_HEIGHT);
    }
  });

  it("uses the truss walkway as the crowd barrier and lets a walkway-height player step onto the stage", () => {
    const walkway = venue.crowdBarrier;
    expect(walkway.maxY).toBe(KB_WALKWAY_HEIGHT);
    expect(walkway.minZ).toBe(venue.platforms[0].bounds.maxZ);
    expect(venue.colliders).toContain(walkway);
    const walkwayPlatform = venue.platforms.find((p) => p.bounds === walkway || (p.bounds.minZ === walkway.minZ && p.height === KB_WALKWAY_HEIGHT));
    expect(walkwayPlatform).toBeDefined();
    const stageCollider = venue.colliders.find((c) => c.minZ === KB_BACK_WALL_Z && c.maxX - c.minX === 9);
    expect(stageCollider?.maxY).toBe(KB_WALKWAY_HEIGHT);
  });

  it("builds the 2/F stair as 15 abutting 0.2m treads that end flush with the deck", () => {
    const treads = venue.platforms
      .filter((p) => p.bounds.minX === KB_UPPER_STAIR.minX && p.bounds.maxX === KB_UPPER_STAIR.maxX && p.height <= KB_DECK_HEIGHT && p.height > 0.19)
      .sort((a, b) => a.height - b.height);
    expect(treads).toHaveLength(KB_UPPER_STAIR.steps);
    treads.forEach((tread, i) => {
      expect(tread.height).toBeCloseTo(KB_UPPER_STAIR.rise * (i + 1), 5);
      expect(tread.height - (treads[i - 1]?.height ?? 0)).toBeLessThanOrEqual(0.22);
      if (i > 0) expect(tread.bounds.minZ).toBeCloseTo(treads[i - 1].bounds.maxZ, 5);
    });
    expect(treads[treads.length - 1].bounds.maxZ).toBeCloseTo(KB_DECK_MIN_Z, 5);
    const deck = venue.platforms.find((p) => p.height === KB_DECK_HEIGHT && p.bounds.minZ === KB_DECK_MIN_Z);
    expect(deck).toBeDefined();
  });

  it("puts a 3.0m deck over the vestibule while keeping the vestibule floor walkable", () => {
    const x = (KB_VESTIBULE.minX + KB_VESTIBULE.maxX) / 2;
    const z = (KB_VESTIBULE.minZ + KB_VESTIBULE.maxZ) / 2;
    expect(groundHeightAt(venue, x, z, 0)).toBe(0);
    expect(groundHeightAt(venue, x, z, KB_DECK_HEIGHT)).toBe(KB_DECK_HEIGHT);
    expect(KB_DECK_HEIGHT).toBeGreaterThan(OVERHEAD_CLEARANCE);
  });

  it("spawns inside the vestibule, inside bounds and clear of every collider", () => {
    const { x, z } = venue.spawn;
    expect(inside(x, z, KB_VESTIBULE)).toBe(true);
    expect(inside(x, z, venue.bounds)).toBe(true);
    const radius = 0.34;
    for (const c of venue.colliders) {
      const overlaps = x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ;
      expect(overlaps, JSON.stringify(c)).toBe(false);
    }
  });

  it("leaves the vestibule doorway and the backstage curtain gap free of colliders", () => {
    const doorwayX = (KB_DOORWAY.minX + KB_DOORWAY.maxX) / 2;
    const doorwayBlockers = venue.colliders.filter((c) => c.minZ <= KB_VESTIBULE.minZ && c.maxZ >= KB_VESTIBULE.minZ && c.minX < doorwayX && c.maxX > doorwayX);
    expect(doorwayBlockers).toHaveLength(0);
    const gapZ = (KB_BACKSTAGE_GAP.minZ + KB_BACKSTAGE_GAP.maxZ) / 2;
    const gapBlockers = venue.colliders.filter((c) => c.minX <= KB_PARTITION_X && c.maxX >= KB_PARTITION_X && c.minZ < gapZ && c.maxZ > gapZ);
    expect(gapBlockers).toHaveLength(0);
  });

  it("caps every wall under the 2/F at deck height so the deck is walkable above them", () => {
    const underDeck = venue.colliders.filter(
      (c) => c.maxX <= KB_PARTITION_X + 0.1 && c.minX >= venue.bounds.minX && c.minZ >= KB_DECK_MIN_Z && c.maxX - c.minX < 0.3,
    );
    expect(underDeck.length).toBeGreaterThan(0);
    for (const c of underDeck) expect(c.maxY).toBe(KB_DECK_HEIGHT);
    const vestibuleFace = venue.colliders.filter((c) => c.minZ < KB_VESTIBULE.minZ && c.maxZ > KB_VESTIBULE.minZ && c.maxX <= KB_VESTIBULE.maxX + 0.1);
    expect(vestibuleFace.length).toBeGreaterThanOrEqual(2);
    for (const c of vestibuleFace) expect(c.maxY).toBe(KB_DECK_HEIGHT);
  });

  it("positions the audience on the floor in front of the walkway", () => {
    expect(venue.show.audiencePoints).toHaveLength(15);
    for (const [x, y, z] of venue.show.audiencePoints) {
      expect(y).toBe(0);
      expect(z).toBeGreaterThan(venue.crowdBarrier.maxZ);
      expect(x).toBeGreaterThan(KB_PARTITION_X);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/config/kowloonBayVenue.test.ts`
Expected: FAIL — `KOWLOON_BAY_VENUE` and `KB_*` are not exported.

- [ ] **Step 3: Implement the definition**

In `src/config/venue.ts` change the union:

```ts
    | { kind: "procedural"; builderId: "neon-backstage" | "ngau-tau-kok" | "kowloon-bay" }
```

Append at the end of the file:

```ts
// ---------------------------------------------------------------------------
// Kowloon Bay (九龍灣): tall black-box hall with a two-storey backstage on the -X side.
// Audience faces -Z; +X is the audience's right. See docs/superpowers/specs/2026-09-11-kowloon-bay-venue-design.md
// ---------------------------------------------------------------------------
export const KB_MIN_X = -6.5;
export const KB_MAX_X = 6.5;
export const KB_BACK_WALL_Z = -11.0; // Inner face of the back wall; the stage sits against it
export const KB_REAR_WALL_Z = 4.0; // Inner face of the rear (audience) wall
export const KB_HALL_CEILING = 7.6; // 樓底好高
export const KB_STAGE_HEIGHT = 0.7;
export const KB_STAGE_FRONT_Z = -8.0;
export const KB_WALKWAY_HEIGHT = 0.6; // Two-tier truss walkway in front of the stage
export const KB_WALKWAY_FRONT_Z = -7.4;
export const KB_PARTITION_X = -4.5; // Curtain wall between the hall and the backstage corridor
export const KB_BACKSTAGE_GAP = { minZ: -0.2, maxZ: 1.0 } as const; // Curtain gap into backstage, just stage-ward of the vestibule
export const KB_DECK_HEIGHT = 3.0; // 2/F floor level
export const KB_UPPER_STAIR = { minX: -6.5, maxX: -5.5, startZ: -10.2, tread: 0.28, rise: 0.2, steps: 15 } as const;
export const KB_DECK_MIN_Z = KB_UPPER_STAIR.startZ + KB_UPPER_STAIR.tread * KB_UPPER_STAIR.steps; // -6.0
export const KB_VESTIBULE = { minX: -6.5, maxX: -3.0, minZ: 1.2, maxZ: 4.0 } as const; // Entrance box; glass room sits on top
export const KB_DOORWAY = { minX: -4.4, maxX: -3.2 } as const; // Vestibule doorway on its -Z face
export const KB_WC_BLOCK = { minX: 4.5, maxX: 6.5, minZ: -11.0, maxZ: -7.6 } as const; // WC room beside the stage (+X)

const kbStageBounds: Aabb2 = { minX: -4.5, maxX: 4.5, minZ: KB_BACK_WALL_Z, maxZ: KB_STAGE_FRONT_Z };
// Capped at walkway height so a player on the 0.6 walkway can step up the last 0.1 onto the stage
const kbStageCollider: Aabb2 = { ...kbStageBounds, maxY: KB_WALKWAY_HEIGHT };
const kbWalkwayBounds: Aabb2 = { minX: -3.5, maxX: 3.5, minZ: KB_STAGE_FRONT_Z, maxZ: KB_WALKWAY_FRONT_Z };
const kbWalkway: Aabb2 & { maxY: number } = { ...kbWalkwayBounds, maxY: KB_WALKWAY_HEIGHT };

// Three treads at each end of the walkway, rising toward the stage (-Z): 0.2 / 0.4 / 0.6
const kbWalkwayStairs: ElevatedPlatform[] = [-1, 1].flatMap((side) =>
  [0, 1, 2].map((i) => ({
    bounds: {
      minX: side < 0 ? -4.4 : 3.5,
      maxX: side < 0 ? -3.5 : 4.4,
      minZ: KB_WALKWAY_FRONT_Z - 0.3 * i,
      maxZ: KB_WALKWAY_FRONT_Z - 0.3 * i + 0.3,
    },
    height: 0.2 * (i + 1),
  })),
);

// Backstage -> stage wing: four treads rising toward +X onto the 0.7 deck
const kbStageStairs: ElevatedPlatform[] = [0, 1, 2, 3].map((i) => ({
  bounds: { minX: -5.5 + 0.25 * i, maxX: -5.25 + 0.25 * i, minZ: -9.5, maxZ: -8.5 },
  height: (KB_STAGE_HEIGHT / 4) * (i + 1),
}));

// Backstage -> 2/F: fifteen 0.2 m treads rising toward +Z, ending flush with the deck
const kbUpperStairs: ElevatedPlatform[] = Array.from({ length: KB_UPPER_STAIR.steps }, (_, i) => ({
  bounds: {
    minX: KB_UPPER_STAIR.minX,
    maxX: KB_UPPER_STAIR.maxX,
    minZ: KB_UPPER_STAIR.startZ + KB_UPPER_STAIR.tread * i,
    maxZ: KB_UPPER_STAIR.startZ + KB_UPPER_STAIR.tread * (i + 1),
  },
  height: KB_UPPER_STAIR.rise * (i + 1),
}));

export const KOWLOON_BAY_VENUE: VenueDefinition = {
  id: "kowloon-bay-live-house-01",
  name: "九龍灣",
  scene: { kind: "procedural", builderId: "kowloon-bay" },
  // Spawn inside the entrance vestibule facing the doorway (-Z)
  spawn: { x: -3.8, y: 0, z: 2.8, yaw: 0 },
  bounds: { minX: KB_MIN_X, maxX: KB_MAX_X, minZ: KB_BACK_WALL_Z, maxZ: KB_REAR_WALL_Z },
  cameraBounds: { minX: KB_MIN_X + 0.2, maxX: KB_MAX_X - 0.2, minZ: KB_BACK_WALL_Z + 0.2, maxZ: KB_REAR_WALL_Z - 0.2 },
  colliders: [
    // Shell
    { minX: KB_MIN_X - 0.3, maxX: KB_MIN_X, minZ: KB_BACK_WALL_Z - 0.3, maxZ: KB_REAR_WALL_Z + 0.3 },
    { minX: KB_MAX_X, maxX: KB_MAX_X + 0.3, minZ: KB_BACK_WALL_Z - 0.3, maxZ: KB_REAR_WALL_Z + 0.3 },
    { minX: KB_MIN_X, maxX: KB_MAX_X, minZ: KB_BACK_WALL_Z - 0.3, maxZ: KB_BACK_WALL_Z },
    { minX: KB_MIN_X, maxX: KB_MAX_X, minZ: KB_REAR_WALL_Z, maxZ: KB_REAR_WALL_Z + 0.3 },
    { ...KB_WC_BLOCK },
    kbStageCollider,
    kbWalkway,
    // Backstage curtain partition with the gap; 2/F players walk over it (maxY = deck)
    { minX: KB_PARTITION_X - 0.1, maxX: KB_PARTITION_X + 0.1, minZ: KB_STAGE_FRONT_Z, maxZ: KB_BACKSTAGE_GAP.minZ, maxY: KB_DECK_HEIGHT },
    { minX: KB_PARTITION_X - 0.1, maxX: KB_PARTITION_X + 0.1, minZ: KB_BACKSTAGE_GAP.maxZ, maxZ: KB_VESTIBULE.minZ + 0.1, maxY: KB_DECK_HEIGHT },
    // Vestibule walls (glass room deck on top); doorway gap on the -Z face
    { minX: KB_VESTIBULE.minX, maxX: KB_DOORWAY.minX, minZ: KB_VESTIBULE.minZ - 0.1, maxZ: KB_VESTIBULE.minZ + 0.1, maxY: KB_DECK_HEIGHT },
    { minX: KB_DOORWAY.maxX, maxX: KB_VESTIBULE.maxX, minZ: KB_VESTIBULE.minZ - 0.1, maxZ: KB_VESTIBULE.minZ + 0.1, maxY: KB_DECK_HEIGHT },
    { minX: KB_VESTIBULE.maxX - 0.1, maxX: KB_VESTIBULE.maxX + 0.1, minZ: KB_VESTIBULE.minZ, maxZ: KB_VESTIBULE.maxZ, maxY: KB_DECK_HEIGHT },
    { minX: -6.4, maxX: -5.2, minZ: 2.0, maxZ: 3.8, maxY: 1.0 }, // Folding chairs stacked in the vestibule
    // Backstage corridor road cases along the -X wall
    { minX: -6.5, maxX: -6.0, minZ: -3.4, maxZ: -2.6, maxY: 1.1 },
    { minX: -6.5, maxX: -6.0, minZ: -1.6, maxZ: -0.8, maxY: 1.1 },
    // +X side props
    { minX: 5.9, maxX: 6.4, minZ: -7.3, maxZ: -6.8, maxY: 1.0 }, // Bin beside the WC door
    { minX: 5.5, maxX: 6.3, minZ: -6.4, maxZ: -5.6, maxY: 1.6 }, // Black throne chair
    { minX: 5.7, maxX: 6.4, minZ: -5.2, maxZ: -4.4, maxY: 2.0 }, // Aluminium ladder with plushie net
    { minX: 5.6, maxX: 6.4, minZ: 3.1, maxZ: 3.9 }, // Coca-Cola fridge in the rear corner
    { minX: 2.6, maxX: 5.4, minZ: 2.6, maxZ: 3.4, maxY: 1.2 }, // PA desk facing the stage
    { minX: 2.9, maxX: 5.1, minZ: 1.4, maxZ: 2.3, maxY: 1.0 }, // Black sofa in front of the desk
    // Rear tables
    { minX: -2.1, maxX: -0.3, minZ: 3.2, maxZ: 3.8, maxY: 0.8 }, // Long white folding table
    { minX: -2.8, maxX: -2.0, minZ: 1.4, maxZ: 2.0, maxY: 0.9 }, // Ticket table with lamp beside the doorway
  ],
  crowdBarrier: kbWalkway,
  platforms: [
    { bounds: kbStageBounds, height: KB_STAGE_HEIGHT },
    { bounds: kbWalkwayBounds, height: KB_WALKWAY_HEIGHT },
    ...kbWalkwayStairs,
    ...kbStageStairs,
    ...kbUpperStairs,
    // 2/F: corridor deck (stairwell left open at z < KB_DECK_MIN_Z) and the glass room over the vestibule
    { bounds: { minX: KB_MIN_X, maxX: KB_PARTITION_X, minZ: KB_DECK_MIN_Z, maxZ: KB_VESTIBULE.minZ }, height: KB_DECK_HEIGHT },
    { bounds: { ...KB_VESTIBULE }, height: KB_DECK_HEIGHT },
  ],
  show: {
    performerLine: { y: KB_STAGE_HEIGHT, z: -9.5, spacing: 0.78 },
    audiencePoints: [
      [-3.0, 0, -6.0], [-1.5, 0, -5.9], [0, 0, -6.0], [1.5, 0, -5.9], [3.0, 0, -6.0],
      [-3.4, 0, -4.6], [-1.7, 0, -4.5], [0, 0, -4.6], [1.7, 0, -4.5], [3.4, 0, -4.6],
      [-2.6, 0, -3.2], [-0.9, 0, -3.1], [0.9, 0, -3.1], [2.6, 0, -3.2], [0, 0, -1.8],
    ],
    lightColors: [0xff2f7d, 0x3f8cff, 0x00e5ff, 0xffaa00],
  },
  youtubeVideoId: "M7lc1UVf-VE",
};
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/config/kowloonBayVenue.test.ts && npm run typecheck`
Expected: PASS (9 tests). `createVenue` still throws for `"kowloon-bay"` at runtime, but nothing calls it yet.

- [ ] **Step 5: Commit**

```bash
git add src/config/venue.ts src/config/kowloonBayVenue.test.ts
git commit -m "feat: add Kowloon Bay venue definition with 2/F deck and stairs"
```

---

### Task 5: Builder skeleton — textures, shell, stage, dispatch

**Files:**
- Create: `src/scene/kowloonBay/textures.ts`, `src/scene/kowloonBay/shell.ts`, `src/scene/kowloonBay/stage.ts`, `src/scene/kowloonBay/createKowloonBayVenue.ts`
- Modify: `src/scene/createVenue.ts`
- Test: `src/scene/kowloonBay/createKowloonBayVenue.test.ts` (create)

**Interfaces:**
- Consumes: `venueKit` exports (Task 3), `KB_*` constants and `KOWLOON_BAY_VENUE` (Task 4).
- Produces: `createKowloonBayVenue(definition: VenueDefinition): VenueBuild`; `buildShell(group, mats)`, `buildStage(group, mats, stage: ElevatedPlatform, walkway: VenueDefinition["crowdBarrier"])`; textures `acousticTileTexture()`, `clockFaceTexture()`, `posterTexture(variant: number)`, `PLUSHIE_COLORS`. Later tasks add `buildBackstage`, `buildRigging`, `createShowLights`, `buildProps` and wire them into the entry point (stubs are added here so the file compiles).

- [ ] **Step 1: Write the failing test**

Create `src/scene/kowloonBay/createKowloonBayVenue.test.ts`:

```ts
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { KB_DECK_HEIGHT, KB_HALL_CEILING, KOWLOON_BAY_VENUE } from "../../config/venue";
import { createVenue } from "../createVenue";

function collectNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((child) => {
    if (child.name) names.push(child.name);
  });
  return names;
}

describe("createVenue for Kowloon Bay", () => {
  it("creates a VenueBuild with the hall shell, stage and truss walkway", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);

    expect(build.group.name).toBe("kowloon-bay-live-house-01");
    expect(build.colliders).toHaveLength(KOWLOON_BAY_VENUE.colliders.length);
    expect(build.audiencePoints).toHaveLength(15);
    expect(build.stageLights.length).toBeGreaterThanOrEqual(4);

    const names = collectNames(build.group);
    for (const expected of [
      "plank-floor",
      "ceiling",
      "curtain-back",
      "acoustic-wall",
      "air-con",
      "main-stage",
      "tape-mark",
      "truss-walkway",
      "walkway-plate",
      "wedge-monitor",
      "walkway-stairs-left",
      "walkway-stairs-right",
    ]) {
      expect(names, expected).toContain(expected);
    }
  });

  it("hangs the ceiling at the tall hall height", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const ceiling = build.group.getObjectByName("ceiling")!;
    expect(ceiling.position.y).toBeGreaterThanOrEqual(KB_HALL_CEILING);
    expect(KB_HALL_CEILING).toBeGreaterThan(KB_DECK_HEIGHT + 3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scene/kowloonBay/createKowloonBayVenue.test.ts`
Expected: FAIL — `Unsupported venue scene: kowloon-bay-live-house-01`.

- [ ] **Step 3: Create `textures.ts`**

```ts
import * as THREE from "three";

/** Pastel plushie-box colours for the glass room shelves. */
export const PLUSHIE_COLORS = [0xff7eb6, 0xffd166, 0x8be9fd, 0xb8f28e, 0xc59cff, 0xff9f68, 0xffffff, 0x6ec6ff];

/** Grey acoustic foam tiles (0.6 m grid). Callers set `repeat` to (width / 0.6, height / 0.6). */
export function acousticTileTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#1c1c20";
  ctx.fillRect(0, 0, 256, 256);
  const tile = 128;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const x = c * tile + 6;
      const y = r * tile + 6;
      const face = ctx.createLinearGradient(x, y, x + tile - 12, y + tile - 12);
      face.addColorStop(0, "#44444b");
      face.addColorStop(1, "#33333a");
      ctx.fillStyle = face;
      ctx.fillRect(x, y, tile - 12, tile - 12);
      // Bevel highlight on the top-left edges
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + tile - 12);
      ctx.lineTo(x, y);
      ctx.lineTo(x + tile - 12, y);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** White analogue wall clock face reading about ten past ten. */
export function clockFaceTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#f6f6f2";
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 6;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
    ctx.lineTo(128 + Math.cos(a) * 116, 128 + Math.sin(a) * 116);
    ctx.stroke();
  }
  const hand = (angle: number, length: number, width: number) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(angle) * length, 128 + Math.sin(angle) * length);
    ctx.stroke();
  };
  hand(-Math.PI / 2 + (10 / 12) * Math.PI * 2, 60, 9); // hour
  hand(-Math.PI / 2 + (10 / 60) * Math.PI * 2, 92, 6); // minute

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Simple idol-live poster with a big title; `variant` picks the colour scheme. */
export function posterTexture(variant: number): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 362;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const schemes = [
    ["#ff2f7d", "#2b0a1a", "#ffffff"],
    ["#3f8cff", "#0a1430", "#ffe9a8"],
    ["#ffaa00", "#2a1a00", "#111111"],
  ];
  const [accent, background, ink] = schemes[variant % schemes.length];
  const fill = ctx.createLinearGradient(0, 0, 0, 362);
  fill.addColorStop(0, accent);
  fill.addColorStop(1, background);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 256, 362);
  ctx.fillStyle = ink;
  ctx.font = "900 58px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LIVE", 128, 120);
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(`VOL.${variant + 1}`, 128, 170);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(24, 300, 208, 30);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
```

- [ ] **Step 4: Create `shell.ts`**

```ts
import * as THREE from "three";
import {
  KB_BACK_WALL_Z,
  KB_HALL_CEILING,
  KB_MAX_X,
  KB_MIN_X,
  KB_REAR_WALL_Z,
  KB_VESTIBULE,
  KB_WC_BLOCK,
} from "../../config/venue";
import { addBox, pleatedCurtainTexture, woodPlankTexture, type SharedMaterials, type WoodPlankPalette } from "../venueKit";
import { acousticTileTexture } from "./textures";

const WALL_T = 0.3;
const WIDTH = KB_MAX_X - KB_MIN_X;
const DEPTH = KB_REAR_WALL_Z - KB_BACK_WALL_Z;
const CENTER_Z = (KB_BACK_WALL_Z + KB_REAR_WALL_Z) / 2;
export const ACOUSTIC_TILE_TOP_Y = 3.2;

// Light grey laminate seen in every reference photo
const GREY_PLANKS: WoodPlankPalette = {
  base: "#cfcbc4",
  planks: ["#d6d2cb", "#c9c5be", "#dedad3", "#c2beb7", "#d0ccc5", "#d9d5ce"],
  grain: "rgba(70, 65, 60, 0.14)",
  seam: "rgba(60, 55, 50, 0.45)",
};

/** Acoustic-tile material sized so the 0.6 m tile grid stays square on a w × h plane. */
export function acousticTileMaterial(width: number, height: number): THREE.MeshStandardMaterial {
  const map = acousticTileTexture();
  map.repeat.set(width / 0.6, height / 0.6);
  return new THREE.MeshStandardMaterial({ map, roughness: 1.0 });
}

export function buildShell(group: THREE.Group, mats: SharedMaterials): void {
  const floorTexture = woodPlankTexture(GREY_PLANKS);
  floorTexture.repeat.set(3, 4);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(WIDTH, 0.1, DEPTH),
    new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.55, metalness: 0.05 }),
  );
  floor.position.set(0, -0.05, CENTER_Z);
  floor.receiveShadow = true;
  floor.name = "plank-floor";
  group.add(floor);

  // Exposed black ceiling far overhead
  addBox(group, WIDTH + 2 * WALL_T, 0.2, DEPTH + 2 * WALL_T, mats.matteBlack, 0, KB_HALL_CEILING + 0.1, CENTER_Z, "ceiling", false);

  // Structural walls
  addBox(group, WALL_T, KB_HALL_CEILING, DEPTH + 2 * WALL_T, mats.wallCharcoal, KB_MIN_X - WALL_T / 2, KB_HALL_CEILING / 2, CENTER_Z, "wall-left");
  addBox(group, WALL_T, KB_HALL_CEILING, DEPTH + 2 * WALL_T, mats.wallCharcoal, KB_MAX_X + WALL_T / 2, KB_HALL_CEILING / 2, CENTER_Z, "wall-right");
  addBox(group, WIDTH, KB_HALL_CEILING, WALL_T, mats.wallCharcoal, 0, KB_HALL_CEILING / 2, KB_BACK_WALL_Z - WALL_T / 2, "wall-back");
  addBox(group, WIDTH, KB_HALL_CEILING, WALL_T, mats.wallCharcoal, 0, KB_HALL_CEILING / 2, KB_REAR_WALL_Z + WALL_T / 2, "wall-rear");

  // Black pleated curtains on the inner faces (PlaneGeometry faces +Z before rotation)
  const curtainMat = new THREE.MeshStandardMaterial({ map: pleatedCurtainTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const hang = (w: number, h: number, x: number, y: number, z: number, rotY: number, name: string) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), curtainMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.name = name;
    group.add(mesh);
  };
  hang(WIDTH, KB_HALL_CEILING, 0, KB_HALL_CEILING / 2, KB_BACK_WALL_Z + 0.05, 0, "curtain-back");
  const rightLen = KB_REAR_WALL_Z - KB_WC_BLOCK.maxZ;
  hang(rightLen, KB_HALL_CEILING, KB_MAX_X - 0.05, KB_HALL_CEILING / 2, KB_WC_BLOCK.maxZ + rightLen / 2, -Math.PI / 2, "curtain-right");
  hang(DEPTH, KB_HALL_CEILING, KB_MIN_X + 0.05, KB_HALL_CEILING / 2, CENTER_Z, Math.PI / 2, "curtain-left");
  const upper = KB_HALL_CEILING - ACOUSTIC_TILE_TOP_Y;
  hang(WIDTH, upper, 0, ACOUSTIC_TILE_TOP_Y + upper / 2, KB_REAR_WALL_Z - 0.05, Math.PI, "curtain-rear");

  // Grey acoustic foam tiles on the rear wall beside the vestibule
  const tileWidth = KB_MAX_X - KB_VESTIBULE.maxX;
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(tileWidth, ACOUSTIC_TILE_TOP_Y), acousticTileMaterial(tileWidth, ACOUSTIC_TILE_TOP_Y));
  tiles.position.set(KB_VESTIBULE.maxX + tileWidth / 2, ACOUSTIC_TILE_TOP_Y / 2, KB_REAR_WALL_Z - 0.04);
  tiles.rotation.y = Math.PI;
  tiles.name = "acoustic-wall";
  group.add(tiles);

  // Cassette air-conditioning units recessed into the ceiling
  for (const [x, z] of [[2.5, -3.0], [2.5, 1.5], [-2.0, -1.0]] as const) {
    const unit = addBox(group, 0.95, 0.22, 0.95, mats.offWhite, x, KB_HALL_CEILING - 0.11, z, "air-con", false);
    addBox(unit, 0.55, 0.02, 0.55, mats.matteBlack, 0, -0.12, 0, "", false);
  }
}
```

- [ ] **Step 5: Create `stage.ts`**

```ts
import * as THREE from "three";
import {
  KB_STAGE_FRONT_Z,
  KB_WALKWAY_FRONT_Z,
  type ElevatedPlatform,
  type VenueDefinition,
} from "../../config/venue";
import { addBox, setInstanceTransform, speakerGrilleTexture, type InstanceTransform, type SharedMaterials } from "../venueKit";

const STEP_MAT = new THREE.MeshStandardMaterial({ color: 0x1a1920, roughness: 0.75, metalness: 0.2 });
const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: 0xffee00, emissive: 0xffaa00, emissiveIntensity: 0.8, roughness: 0.3 });

export function buildStage(
  group: THREE.Group,
  mats: SharedMaterials,
  stage: ElevatedPlatform,
  walkway: VenueDefinition["crowdBarrier"],
): void {
  const { bounds, height } = stage;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.85 });
  addBox(group, width, height, depth, deckMat, cx, height / 2, cz, "main-stage");
  addBox(group, width + 0.04, 0.06, 0.06, mats.matteBlack, cx, height - 0.03, bounds.maxZ + 0.02, "", false);

  // Yellow gaffer T-marks along the front of the deck
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xf5d90a, emissive: 0xf5d90a, emissiveIntensity: 0.25, roughness: 0.6 });
  for (const x of [-3.2, -1.6, 0, 1.6, 3.2]) {
    addBox(group, 0.4, 0.004, 0.05, tapeMat, x, height + 0.002, bounds.maxZ - 0.6, "tape-mark", false);
    addBox(group, 0.05, 0.004, 0.3, tapeMat, x, height + 0.002, bounds.maxZ - 0.45, "", false);
  }

  buildTrussWalkway(group, mats, walkway);
  buildWalkwayStairs(group, mats, -1);
  buildWalkwayStairs(group, mats, 1);
}

/** Two-tier aluminium truss with a diamond-plate top and five wedge monitors facing the stage. */
function buildTrussWalkway(group: THREE.Group, mats: SharedMaterials, walkway: VenueDefinition["crowdBarrier"]): void {
  const truss = new THREE.Group();
  truss.name = "truss-walkway";
  const width = walkway.maxX - walkway.minX;
  const depth = walkway.maxZ - walkway.minZ;
  const cx = (walkway.minX + walkway.maxX) / 2;
  const cz = (walkway.minZ + walkway.maxZ) / 2;
  const top = walkway.maxY;
  const zFaces = [walkway.minZ + 0.05, walkway.maxZ - 0.05];

  const aluminium = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.35, metalness: 0.85 });
  const transforms: InstanceTransform[] = [];
  const bays = Math.round(width / 0.5);
  const bay = width / bays;
  for (const [lo, hi] of [[0.03, top / 2 - 0.03], [top / 2 + 0.03, top - 0.03]] as const) {
    const mid = (lo + hi) / 2;
    const rise = hi - lo;
    for (const z of zFaces) {
      // Horizontal chords
      for (const y of [lo, hi]) transforms.push([cx, y, z, 0, 0, Math.PI / 2, 1, width, 1]);
      for (let i = 0; i <= bays; i++) {
        const x = walkway.minX + i * bay;
        // Verticals
        transforms.push([x, mid, z, 0, 0, 0, 1, rise, 1]);
        // Alternating diagonals
        if (i < bays) {
          const angle = Math.atan2(rise, bay) * (i % 2 === 0 ? 1 : -1);
          transforms.push([x + bay / 2, mid, z, 0, 0, Math.PI / 2 - angle, 1, Math.hypot(bay, rise), 1]);
        }
      }
    }
    // Ties between the front and back faces
    for (let i = 0; i <= bays; i++) {
      const x = walkway.minX + i * bay;
      for (const y of [lo, hi]) transforms.push([x, y, cz, Math.PI / 2, 0, 0, 1, depth - 0.1, 1]);
    }
  }
  const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), aluminium, transforms.length);
  transforms.forEach((t, i) => setInstanceTransform(tubes, i, t));
  tubes.instanceMatrix.needsUpdate = true;
  tubes.castShadow = false;
  truss.add(tubes);

  const plateMat = new THREE.MeshStandardMaterial({ color: 0x9a9da5, roughness: 0.45, metalness: 0.7 });
  addBox(truss, width, 0.03, depth, plateMat, cx, top - 0.015, cz, "walkway-plate");

  const grilleMat = new THREE.MeshStandardMaterial({ map: speakerGrilleTexture(), roughness: 0.8 });
  for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) {
    const wedge = new THREE.Group();
    wedge.name = "wedge-monitor";
    wedge.position.set(x, top, cz);
    const body = addBox(wedge, 0.55, 0.3, 0.42, mats.fixtureBlack, 0, 0.16, 0);
    body.rotation.x = 0.55; // Tilted up toward the performers
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), grilleMat);
    grille.position.set(0, 0, -0.211);
    grille.rotation.y = Math.PI; // Face -Z (the stage)
    body.add(grille);
    truss.add(wedge);
  }
  group.add(truss);
}

/** Three treads at one end of the walkway, rising toward the stage, with an outer handrail. */
function buildWalkwayStairs(group: THREE.Group, mats: SharedMaterials, side: -1 | 1): void {
  const stairs = new THREE.Group();
  stairs.name = side < 0 ? "walkway-stairs-left" : "walkway-stairs-right";
  const cx = side < 0 ? -3.95 : 3.95; // Tread span x ∈ [-4.4, -3.5] or [3.5, 4.4]

  for (let i = 0; i < 3; i++) {
    const h = 0.2 * (i + 1);
    const z = KB_WALKWAY_FRONT_Z + 0.15 - 0.3 * i; // -7.25, -7.55, -7.85
    addBox(stairs, 0.9, h, 0.3, STEP_MAT, cx, h / 2, z);
    addBox(stairs, 0.9, 0.03, 0.05, STRIPE_MAT, cx, h + 0.015, z + 0.125, "", false);
  }

  const railX = cx + side * 0.47;
  const bottomZ = KB_WALKWAY_FRONT_Z + 0.3;
  const topZ = KB_STAGE_FRONT_Z;
  for (const [z, h] of [[bottomZ, 0.9], [topZ, 1.5]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 6), mats.steel);
    post.position.set(railX, h / 2, z);
    stairs.add(post);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(0.9, 0.6), 6), mats.steel);
  rail.position.set(railX, 1.2, (bottomZ + topZ) / 2);
  rail.rotation.x = -Math.atan2(0.9, 0.6); // Rises 0.6 over 0.9 toward -Z
  stairs.add(rail);
  group.add(stairs);
}
```

- [ ] **Step 6: Create the entry point with stubs for later tasks**

`src/scene/kowloonBay/createKowloonBayVenue.ts`:

```ts
import * as THREE from "three";
import type { VenueDefinition } from "../../config/venue";
import type { VenueBuild } from "../createVenue";
import { createAtmosphericCrowd, createHouseLights, createSharedMaterials, type FakeBeam } from "../venueKit";
import { buildShell } from "./shell";
import { buildStage } from "./stage";

// Penlight crowd on the hall floor (x > partition, z between the walkway and the rear tables)
const CROWD_POSITIONS: readonly (readonly [number, number])[] = [
  [-3.6, -6.4], [-1.8, -6.5], [0.2, -6.4], [2.0, -6.5], [3.8, -6.3],
  [-3.9, -5.3], [-2.2, -5.2], [-0.4, -5.4], [1.4, -5.2], [3.0, -5.3], [4.6, -5.4],
  [-3.2, -4.1], [-1.4, -4.0], [0.6, -4.1], [2.4, -4.0], [4.0, -4.2],
  [-2.6, -2.9], [-0.8, -2.8], [1.0, -2.9], [2.8, -2.7],
  [-1.6, -1.6], [0.4, -1.5], [2.2, -1.7],
];

export function createKowloonBayVenue(definition: VenueDefinition): VenueBuild {
  const group = new THREE.Group();
  group.name = definition.id;
  const colliders = definition.colliders.map((collider) => ({ ...collider }));
  const mats = createSharedMaterials();
  const stagePlatform = definition.platforms[0];
  if (!stagePlatform) throw new Error("Kowloon Bay must define the stage as platforms[0]");
  const showOnly: THREE.Object3D[] = []; // Hidden while house lights are on (volumetric beams)
  const fakeBeams: FakeBeam[] = [];

  buildShell(group, mats);
  buildStage(group, mats, stagePlatform, definition.crowdBarrier);
  const crowd = createAtmosphericCrowd(group, CROWD_POSITIONS);

  // TEMPORARY until Task 7 wires rigging: bare placeholder lights so the build is renderable
  const tubeMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a30, emissive: 0xffffff, emissiveIntensity: 0 });
  const stageLights = definition.show.lightColors.map((color, idx) => {
    const light = new THREE.SpotLight(color, 55, 20, 0.42, 0.6, 1.2);
    light.position.set(-3.6 + idx * 2.4, 5.2, -7.0);
    light.target.position.set(-3.0 + idx * 2.0, 0.8, -9.5);
    group.add(light, light.target);
    return light;
  });
  void fakeBeams;
  const houseLights = createHouseLights(group, { panelMaterial: tubeMaterial }, showOnly);

  return {
    group,
    colliders,
    audiencePoints: definition.show.audiencePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    stageLights,
    houseLights,
    knockableProps: [...crowd],
  };
}
```

- [ ] **Step 7: Dispatch in `createVenue.ts`**

Add the import and branch (below the `ngau-tau-kok` branch):

```ts
import { createKowloonBayVenue } from "./kowloonBay/createKowloonBayVenue";
```

```ts
  if (definition.scene.builderId === "kowloon-bay") {
    return createKowloonBayVenue(definition);
  }
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/scene/kowloonBay && npm run typecheck`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add src/scene/kowloonBay src/scene/createVenue.ts
git commit -m "feat: scaffold Kowloon Bay builder with shell, stage and truss walkway"
```

---

### Task 6: Backstage, stairs, 2/F deck, vestibule and glass room

**Files:**
- Create: `src/scene/kowloonBay/backstage.ts`
- Modify: `src/scene/kowloonBay/createKowloonBayVenue.ts`
- Test: `src/scene/kowloonBay/createKowloonBayVenue.test.ts`

**Interfaces:**
- Produces: `buildBackstage(group: THREE.Group, mats: SharedMaterials): void`.

- [ ] **Step 1: Write the failing tests**

Append to the `describe` in `createKowloonBayVenue.test.ts`:

```ts
  it("builds the two-storey backstage: partition, both stairs, deck, vestibule and glass room", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = collectNames(build.group);
    for (const expected of [
      "backstage-partition",
      "backstage-gap-valance",
      "stage-stairs",
      "upper-stairs",
      "upper-deck",
      "deck-corridor",
      "deck-glass-room",
      "deck-rail",
      "entrance-vestibule",
      "entrance-doorway",
      "vestibule-light",
      "glass-room",
      "glass-pane",
      "glass-room-roof",
      "plushie-shelf",
      "plushie-boxes",
      "road-case",
    ]) {
      expect(names, expected).toContain(expected);
    }
  });

  it("puts the deck top at exactly the 2/F walking height", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    build.group.updateMatrixWorld(true);
    const corridor = build.group.getObjectByName("deck-corridor")!;
    const box = new THREE.Box3().setFromObject(corridor);
    expect(box.max.y).toBeCloseTo(KB_DECK_HEIGHT, 5);
    expect(box.max.x).toBeCloseTo(-4.5, 5);
    const panes = build.group.children.flatMap((c) => (c.name === "glass-room" ? c.children.filter((p) => p.name === "glass-pane") : []));
    expect(panes.length).toBe(4);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/scene/kowloonBay`
Expected: FAIL — `backstage-partition` missing.

- [ ] **Step 3: Create `backstage.ts`**

```ts
import * as THREE from "three";
import {
  KB_BACKSTAGE_GAP,
  KB_DECK_HEIGHT,
  KB_DECK_MIN_Z,
  KB_DOORWAY,
  KB_MIN_X,
  KB_PARTITION_X,
  KB_STAGE_FRONT_Z,
  KB_STAGE_HEIGHT,
  KB_UPPER_STAIR,
  KB_VESTIBULE,
} from "../../config/venue";
import { addBox, labelPlane, pleatedCurtainTexture, setInstanceTransform, type InstanceTransform, type SharedMaterials } from "../venueKit";
import { acousticTileMaterial } from "./shell";
import { PLUSHIE_COLORS } from "./textures";

const GLASS_SILL_Y = KB_DECK_HEIGHT + 0.9;
const GLASS_TOP_Y = GLASS_SILL_Y + 1.5;
const GLASS_ROOM_CEILING_Y = 5.8;
const STEP_MAT = new THREE.MeshStandardMaterial({ color: 0x1a1920, roughness: 0.75, metalness: 0.2 });
const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: 0xffee00, emissive: 0xffaa00, emissiveIntensity: 0.8, roughness: 0.3 });

export function buildBackstage(group: THREE.Group, mats: SharedMaterials): void {
  buildPartition(group, mats);
  buildStageStairs(group, mats);
  buildUpperStairs(group, mats);
  buildUpperDeck(group, mats);
  buildVestibule(group, mats);
  buildGlassRoom(group, mats);
  buildRoadCases(group, mats);
}

/** Black curtain wall between the hall and the corridor, with the idol entrance gap in front of the vestibule. */
function buildPartition(group: THREE.Group, mats: SharedMaterials): void {
  const partition = new THREE.Group();
  partition.name = "backstage-partition";
  const curtainMat = new THREE.MeshStandardMaterial({ map: pleatedCurtainTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const hang = (minZ: number, maxZ: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(maxZ - minZ, KB_DECK_HEIGHT), curtainMat);
    mesh.position.set(KB_PARTITION_X, KB_DECK_HEIGHT / 2, (minZ + maxZ) / 2);
    mesh.rotation.y = Math.PI / 2;
    partition.add(mesh);
  };
  hang(KB_STAGE_FRONT_Z, KB_BACKSTAGE_GAP.minZ);
  hang(KB_BACKSTAGE_GAP.maxZ, KB_VESTIBULE.minZ);
  const gapLen = KB_BACKSTAGE_GAP.maxZ - KB_BACKSTAGE_GAP.minZ;
  addBox(partition, 0.12, 0.5, gapLen + 0.2, mats.matteBlack, KB_PARTITION_X, KB_DECK_HEIGHT - 0.25, (KB_BACKSTAGE_GAP.minZ + KB_BACKSTAGE_GAP.maxZ) / 2, "backstage-gap-valance", false);
  const trackLen = KB_VESTIBULE.minZ - KB_STAGE_FRONT_Z;
  const track = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, trackLen, 8), mats.steel);
  track.rotation.x = Math.PI / 2;
  track.position.set(KB_PARTITION_X, KB_DECK_HEIGHT - 0.02, KB_STAGE_FRONT_Z + trackLen / 2);
  partition.add(track);
  group.add(partition);
}

/** Four treads from the corridor floor up onto the stage wing, rising toward +X. */
function buildStageStairs(group: THREE.Group, mats: SharedMaterials): void {
  const stairs = new THREE.Group();
  stairs.name = "stage-stairs";
  const treadW = 0.25;
  const depth = 1.0;
  const cz = -9.0;
  for (let i = 0; i < 4; i++) {
    const h = (KB_STAGE_HEIGHT / 4) * (i + 1);
    const x = -5.5 + treadW * (i + 0.5);
    addBox(stairs, treadW, h, depth, STEP_MAT, x, h / 2, cz);
    addBox(stairs, 0.05, 0.03, depth, STRIPE_MAT, x - treadW / 2 + 0.025, h + 0.015, cz, "", false);
  }
  const railZ = cz - depth / 2 - 0.03;
  for (const [x, h] of [[-5.5, 0.9], [-4.5, 0.9 + KB_STAGE_HEIGHT]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 6), mats.steel);
    post.position.set(x, h / 2, railZ);
    stairs.add(post);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(1.0, KB_STAGE_HEIGHT), 6), mats.steel);
  rail.position.set(-5.0, 0.9 + KB_STAGE_HEIGHT / 2, railZ);
  rail.rotation.z = -Math.atan2(1.0, KB_STAGE_HEIGHT); // Rises toward +X
  stairs.add(rail);
  group.add(stairs);
}

/** Fifteen steel treads with stringers and handrails, rising toward +Z to the deck. */
function buildUpperStairs(group: THREE.Group, mats: SharedMaterials): void {
  const { minX, maxX, startZ, tread, rise, steps } = KB_UPPER_STAIR;
  const stairs = new THREE.Group();
  stairs.name = "upper-stairs";
  const width = maxX - minX;
  const cx = (minX + maxX) / 2;
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7, metalness: 0.35 });
  const riserMat = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.8 });
  for (let i = 0; i < steps; i++) {
    const h = rise * (i + 1);
    const z = startZ + tread * (i + 0.5);
    addBox(stairs, width, 0.05, tread, treadMat, cx, h - 0.025, z);
    addBox(stairs, width - 0.1, rise, 0.03, riserMat, cx, h - rise / 2, z - tread / 2 + 0.015, "", false);
  }
  const run = tread * steps;
  const totalRise = rise * steps;
  const slopeLen = Math.hypot(run, totalRise);
  const slope = Math.atan2(totalRise, run);
  for (const x of [minX + 0.03, maxX - 0.03]) {
    const stringer = addBox(stairs, 0.06, 0.25, slopeLen, mats.steel, x, totalRise / 2 - 0.1, startZ + run / 2);
    stringer.rotation.x = -slope;
  }
  for (const x of [minX - 0.03, maxX + 0.03]) {
    for (let i = 0; i <= steps; i += 5) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), mats.steel);
      post.position.set(x, rise * i + 0.45, startZ + tread * i);
      stairs.add(post);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, slopeLen, 6), mats.steel);
    rail.position.set(x, totalRise / 2 + 0.9, startZ + run / 2);
    rail.rotation.x = Math.PI / 2 - slope;
    stairs.add(rail);
  }
  group.add(stairs);
}

/** 2/F floor: corridor deck (stairwell open at z < KB_DECK_MIN_Z) and the glass room deck, with a safety rail. */
function buildUpperDeck(group: THREE.Group, mats: SharedMaterials): void {
  const deck = new THREE.Group();
  deck.name = "upper-deck";
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x1d1c22, roughness: 0.8 });
  const corridorLen = KB_VESTIBULE.minZ - KB_DECK_MIN_Z;
  addBox(deck, KB_PARTITION_X - KB_MIN_X, 0.12, corridorLen, deckMat, (KB_MIN_X + KB_PARTITION_X) / 2, KB_DECK_HEIGHT - 0.06, (KB_DECK_MIN_Z + KB_VESTIBULE.minZ) / 2, "deck-corridor");
  addBox(
    deck,
    KB_VESTIBULE.maxX - KB_VESTIBULE.minX,
    0.12,
    KB_VESTIBULE.maxZ - KB_VESTIBULE.minZ,
    deckMat,
    (KB_VESTIBULE.minX + KB_VESTIBULE.maxX) / 2,
    KB_DECK_HEIGHT - 0.06,
    (KB_VESTIBULE.minZ + KB_VESTIBULE.maxZ) / 2,
    "deck-glass-room",
  );

  // Two-rail steel balustrade along the hall edge and across the stairwell edge
  const edges: Array<{ from: readonly [number, number]; to: readonly [number, number] }> = [
    { from: [KB_PARTITION_X, KB_DECK_MIN_Z], to: [KB_PARTITION_X, KB_VESTIBULE.minZ] },
    { from: [KB_UPPER_STAIR.maxX, KB_DECK_MIN_Z], to: [KB_PARTITION_X, KB_DECK_MIN_Z] },
  ];
  const transforms: InstanceTransform[] = [];
  for (const { from, to } of edges) {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const cx = (from[0] + to[0]) / 2;
    const cz = (from[1] + to[1]) / 2;
    const alongX = Math.abs(to[0] - from[0]) > Math.abs(to[1] - from[1]);
    for (const y of [KB_DECK_HEIGHT + 0.55, KB_DECK_HEIGHT + 1.05]) {
      transforms.push(alongX ? [cx, y, cz, 0, 0, Math.PI / 2, 1, len, 1] : [cx, y, cz, Math.PI / 2, 0, 0, 1, len, 1]);
    }
    const posts = Math.max(2, Math.round(len / 1.2) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      transforms.push([from[0] + (to[0] - from[0]) * t, KB_DECK_HEIGHT + 0.525, from[1] + (to[1] - from[1]) * t, 0, 0, 0, 1, 1.05, 1]);
    }
  }
  const rails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), mats.steel, transforms.length);
  transforms.forEach((t, i) => setInstanceTransform(rails, i, t));
  rails.instanceMatrix.needsUpdate = true;
  rails.name = "deck-rail";
  deck.add(rails);
  group.add(deck);
}

/** Ground-floor entrance box under the glass room: acoustic-tiled faces, doorway toward the stage, chairs, outer door. */
function buildVestibule(group: THREE.Group, mats: SharedMaterials): void {
  const vestibule = new THREE.Group();
  vestibule.name = "entrance-vestibule";
  const v = KB_VESTIBULE;

  // -Z face in two segments around the doorway; tiles face -Z toward the stage
  for (const [a, b] of [[v.minX, KB_DOORWAY.minX], [KB_DOORWAY.maxX, v.maxX]] as const) {
    addBox(vestibule, b - a, KB_DECK_HEIGHT, 0.2, mats.wallCharcoal, (a + b) / 2, KB_DECK_HEIGHT / 2, v.minZ, "vestibule-wall");
    const tiles = new THREE.Mesh(new THREE.PlaneGeometry(b - a, KB_DECK_HEIGHT), acousticTileMaterial(b - a, KB_DECK_HEIGHT));
    tiles.rotation.y = Math.PI;
    tiles.position.set((a + b) / 2, KB_DECK_HEIGHT / 2, v.minZ - 0.101);
    vestibule.add(tiles);
  }
  // +X face looking into the hall; tiles face +X
  const sideLen = v.maxZ - v.minZ;
  addBox(vestibule, 0.2, KB_DECK_HEIGHT, sideLen, mats.wallCharcoal, v.maxX, KB_DECK_HEIGHT / 2, (v.minZ + v.maxZ) / 2, "vestibule-wall");
  const sideTiles = new THREE.Mesh(new THREE.PlaneGeometry(sideLen, KB_DECK_HEIGHT), acousticTileMaterial(sideLen, KB_DECK_HEIGHT));
  sideTiles.rotation.y = Math.PI / 2;
  sideTiles.position.set(v.maxX + 0.101, KB_DECK_HEIGHT / 2, (v.minZ + v.maxZ) / 2);
  vestibule.add(sideTiles);
  // Header over the doorway and steel trims
  const doorCx = (KB_DOORWAY.minX + KB_DOORWAY.maxX) / 2;
  const doorW = KB_DOORWAY.maxX - KB_DOORWAY.minX;
  addBox(vestibule, doorW, KB_DECK_HEIGHT - 2.2, 0.2, mats.wallCharcoal, doorCx, 2.2 + (KB_DECK_HEIGHT - 2.2) / 2, v.minZ, "", false);
  const doorway = new THREE.Group();
  doorway.name = "entrance-doorway";
  doorway.position.set(doorCx, 0, v.minZ);
  addBox(doorway, 0.08, 2.24, 0.26, mats.frameBlack, -doorW / 2 - 0.04, 1.12, 0, "", false);
  addBox(doorway, 0.08, 2.24, 0.26, mats.frameBlack, doorW / 2 + 0.04, 1.12, 0, "", false);
  addBox(doorway, doorW + 0.16, 0.08, 0.26, mats.frameBlack, 0, 2.24, 0, "", false);
  vestibule.add(doorway);

  // Warm light inside so the doorway reads bright from the dark hall
  const light = new THREE.PointLight(0xffe9c8, 12, 7, 1.6);
  light.position.set((v.minX + v.maxX) / 2, 2.7, (v.minZ + v.maxZ) / 2);
  light.name = "vestibule-light";
  vestibule.add(light);

  // Stacked folding chairs along the -X wall
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2c2c31, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const chair = addBox(vestibule, 0.45, 0.9, 0.06, chairMat, -6.0 + i * 0.03, 0.5, 2.3 + i * 0.4, "folding-chair");
    chair.rotation.x = 0.12;
  }

  // Outer door on the rear wall with the entrance sign
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a2830, roughness: 0.7, metalness: 0.2 });
  addBox(vestibule, 1.0, 2.1, 0.08, doorMat, -4.8, 1.05, v.maxZ - 0.06, "outer-door");
  const sign = labelPlane("入口 ENTRANCE", "#111114", "#ffffff", 1.2, 0.35);
  sign.position.set(-4.8, 2.5, v.maxZ - 0.12);
  sign.rotation.y = Math.PI;
  vestibule.add(sign);
  group.add(vestibule);
}

/** Glass-walled room on 2/F over the vestibule, glazed toward the stage (-Z) and the hall (+X), shelves of plushies inside. */
function buildGlassRoom(group: THREE.Group, mats: SharedMaterials): void {
  const room = new THREE.Group();
  room.name = "glass-room";
  const v = KB_VESTIBULE;
  const w = v.maxX - v.minX;
  const d = v.maxZ - v.minZ;
  const cx = (v.minX + v.maxX) / 2;
  const cz = (v.minZ + v.maxZ) / 2;
  const sillH = GLASS_SILL_Y - KB_DECK_HEIGHT;
  const headerH = GLASS_ROOM_CEILING_Y - GLASS_TOP_Y;

  addBox(room, w, sillH, 0.15, mats.wallCharcoal, cx, KB_DECK_HEIGHT + sillH / 2, v.minZ, "glass-room-sill");
  addBox(room, w, headerH, 0.15, mats.wallCharcoal, cx, GLASS_TOP_Y + headerH / 2, v.minZ, "glass-room-header");
  glazing(room, mats, [v.minX + 0.1, v.maxX - 0.1], v.minZ, "z");
  addBox(room, 0.15, sillH, d, mats.wallCharcoal, v.maxX, KB_DECK_HEIGHT + sillH / 2, cz, "glass-room-sill");
  addBox(room, 0.15, headerH, d, mats.wallCharcoal, v.maxX, GLASS_TOP_Y + headerH / 2, cz, "glass-room-header");
  glazing(room, mats, [v.minZ + 0.1, v.maxZ - 0.1], v.maxX, "x");
  addBox(room, w + 0.15, 0.15, d + 0.15, mats.matteBlack, cx, GLASS_ROOM_CEILING_Y + 0.075, cz, "glass-room-roof");

  buildPlushieShelves(room, mats);

  const light = new THREE.PointLight(0xfff1dc, 14, 6, 1.4);
  light.position.set(cx, GLASS_ROOM_CEILING_Y - 0.2, cz);
  light.name = "glass-room-light";
  room.add(light);
  group.add(room);
}

/** Two glass panes split by a centre mullion, framed top and bottom. `axis` is the wall's running direction. */
function glazing(parent: THREE.Group, mats: SharedMaterials, span: readonly [number, number], at: number, axis: "x" | "z"): void {
  const len = span[1] - span[0];
  const mid = (span[0] + span[1]) / 2;
  const h = GLASS_TOP_Y - GLASS_SILL_Y;
  const cy = (GLASS_SILL_Y + GLASS_TOP_Y) / 2;
  const paneLen = len / 2 - 0.05;
  for (const offset of [-len / 4, len / 4]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(paneLen, h), mats.glass);
    pane.name = "glass-pane";
    if (axis === "z") {
      pane.position.set(mid + offset, cy, at);
    } else {
      pane.position.set(at, cy, mid + offset);
      pane.rotation.y = Math.PI / 2;
    }
    parent.add(pane);
  }
  for (const y of [GLASS_SILL_Y, GLASS_TOP_Y]) {
    if (axis === "z") addBox(parent, len, 0.08, 0.08, mats.frameBlack, mid, y, at, "", false);
    else addBox(parent, 0.08, 0.08, len, mats.frameBlack, at, y, mid, "", false);
  }
  for (const p of [span[0], mid, span[1]]) {
    if (axis === "z") addBox(parent, 0.08, h, 0.08, mats.frameBlack, p, cy, at, "", false);
    else addBox(parent, 0.08, h, 0.08, mats.frameBlack, at, cy, p, "", false);
  }
}

/** Two shelf tiers along the -X and rear walls, lined with instanced colourful plushie boxes. */
function buildPlushieShelves(room: THREE.Group, mats: SharedMaterials): void {
  const v = KB_VESTIBULE;
  const slots: Array<[number, number, number]> = [];
  for (const y of [KB_DECK_HEIGHT + 0.9, KB_DECK_HEIGHT + 1.6]) {
    addBox(room, 0.35, 0.04, v.maxZ - v.minZ - 0.4, mats.offWhite, v.minX + 0.2, y, (v.minZ + v.maxZ) / 2, "plushie-shelf");
    for (let z = v.minZ + 0.35; z < v.maxZ - 0.3; z += 0.27) slots.push([v.minX + 0.2, y + 0.13, z]);
    addBox(room, v.maxX - v.minX - 0.8, 0.04, 0.35, mats.offWhite, (v.minX + v.maxX) / 2 + 0.2, y, v.maxZ - 0.2, "plushie-shelf");
    for (let x = v.minX + 0.6; x < v.maxX - 0.3; x += 0.27) slots.push([x, y + 0.13, v.maxZ - 0.2]);
  }
  const boxes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    slots.length,
  );
  slots.forEach(([x, y, z], i) => {
    setInstanceTransform(boxes, i, [x, y, z, 0, ((i * 7) % 5) * 0.08, 0, 1, 1, 1]);
    boxes.setColorAt(i, new THREE.Color(PLUSHIE_COLORS[i % PLUSHIE_COLORS.length] ?? 0xffffff));
  });
  boxes.instanceMatrix.needsUpdate = true;
  if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true;
  boxes.name = "plushie-boxes";
  room.add(boxes);
}

/** Black road cases parked along the corridor's -X wall (colliders in venue.ts). */
function buildRoadCases(group: THREE.Group, mats: SharedMaterials): void {
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6, metalness: 0.3 });
  for (const [z0, z1] of [[-3.4, -2.6], [-1.6, -0.8]] as const) {
    const roadCase = addBox(group, 0.5, 1.0, z1 - z0, caseMat, -6.25, 0.5, (z0 + z1) / 2, "road-case");
    addBox(roadCase, 0.52, 0.04, z1 - z0 + 0.02, mats.steel, 0, 0.5, 0, "", false);
  }
}
```

- [ ] **Step 4: Wire it into the entry point**

In `createKowloonBayVenue.ts` add `import { buildBackstage } from "./backstage";` and call `buildBackstage(group, mats);` right after `buildStage(...)`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/scene/kowloonBay && npm run typecheck`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/scene/kowloonBay
git commit -m "feat: build Kowloon Bay backstage, 2/F deck, vestibule and glass room"
```

---

### Task 7: Rigging, show lights and house lights

**Files:**
- Create: `src/scene/kowloonBay/rigging.ts`
- Modify: `src/scene/kowloonBay/createKowloonBayVenue.ts`
- Test: `src/scene/kowloonBay/createKowloonBayVenue.test.ts`

**Interfaces:**
- Produces: `buildRigging(group, mats, colors: readonly number[], fakeBeams: FakeBeam[]): THREE.MeshStandardMaterial` (returns the fluorescent tube material used as the house-light emitter) and `createShowLights(group, colors, stage: ElevatedPlatform, fakeBeams: readonly FakeBeam[], showOnly: THREE.Object3D[]): THREE.SpotLight[]`.

- [ ] **Step 1: Write the failing tests**

Append to the `describe`:

```ts
  it("rigs the tall ceiling with pipes, fluorescents, moving heads, PARs and line arrays", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = collectNames(build.group);
    for (const expected of ["pipe-grid", "fluorescent-tube", "moving-head", "par-can", "line-array", "light-beams"]) {
      expect(names, expected).toContain(expected);
    }
    expect(names.filter((n) => n === "moving-head").length).toBeGreaterThanOrEqual(10);
    expect(names.filter((n) => n === "fluorescent-tube").length).toBe(8);
  });

  it("defaults to house lights off and lights the fluorescent tubes when enabled", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const houseLights = build.houseLights!;
    const tube = build.group.getObjectByName("fluorescent-tube") as THREE.Mesh;
    const tubeMat = tube.material as THREE.MeshStandardMaterial;
    const beams = build.group.getObjectByName("light-beams")!;

    expect(houseLights.enabled).toBe(false);
    expect(tubeMat.emissiveIntensity).toBe(0);
    expect(beams.visible).toBe(true);

    houseLights.setEnabled(true);
    expect(tubeMat.emissiveIntensity).toBeGreaterThan(1);
    expect(beams.visible).toBe(false);

    houseLights.setEnabled(false);
    expect(tubeMat.emissiveIntensity).toBe(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/scene/kowloonBay`
Expected: FAIL — `pipe-grid` missing.

- [ ] **Step 3: Create `rigging.ts`**

```ts
import * as THREE from "three";
import {
  KB_BACK_WALL_Z,
  KB_HALL_CEILING,
  KB_MAX_X,
  KB_MIN_X,
  KB_REAR_WALL_Z,
  type ElevatedPlatform,
} from "../../config/venue";
import {
  addBox,
  addMovingHead,
  addParCan,
  createBeamCones,
  setInstanceTransform,
  speakerGrilleTexture,
  type FakeBeam,
  type InstanceTransform,
  type SharedMaterials,
} from "../venueKit";

export const PIPE_Y = 6.2;
export const STAGE_BAR_Y = 5.4;
export const STAGE_BAR_Z = -7.0;
const CROSS_PIPES_Z = [-9.0, -6.0, -2.0, 2.0] as const;
const LONG_PIPES_X = [-4.0, 0, 4.0] as const;
const TUBE_XS = [-3.5, 3.5] as const;
const TUBE_ZS = [-9.2, -5.6, -2.0, 1.6] as const;

export function buildRigging(
  group: THREE.Group,
  mats: SharedMaterials,
  colors: readonly number[],
  fakeBeams: FakeBeam[],
): THREE.MeshStandardMaterial {
  buildPipeGrid(group, mats);
  const tubeMaterial = buildFluorescents(group, mats);
  buildFixtures(group, mats, colors, fakeBeams);
  buildLineArrays(group, mats);
  return tubeMaterial;
}

/** Scaffold-pipe grid hung from the ceiling plus the lower fixture bar over the stage front. */
function buildPipeGrid(group: THREE.Group, mats: SharedMaterials): void {
  const transforms: InstanceTransform[] = [];
  const spanX = KB_MAX_X - KB_MIN_X - 0.4;
  const spanZ = KB_REAR_WALL_Z - KB_BACK_WALL_Z - 0.4;
  for (const z of CROSS_PIPES_Z) transforms.push([0, PIPE_Y, z, 0, 0, Math.PI / 2, 1, spanX, 1]);
  for (const x of LONG_PIPES_X) transforms.push([x, PIPE_Y + 0.08, (KB_BACK_WALL_Z + KB_REAR_WALL_Z) / 2, Math.PI / 2, 0, 0, 1, spanZ, 1]);
  // Drop rods from the slab to every intersection
  const dropLen = KB_HALL_CEILING - PIPE_Y;
  for (const z of CROSS_PIPES_Z) {
    for (const x of LONG_PIPES_X) transforms.push([x, PIPE_Y + dropLen / 2, z, 0, 0, 0, 1, dropLen, 1]);
  }
  // Fixture bar over the stage front, hung from the z = -6 cross pipe
  transforms.push([0, STAGE_BAR_Y, STAGE_BAR_Z, 0, 0, Math.PI / 2, 1, 8.6, 1]);
  for (const x of [-3.9, 3.9]) {
    const len = Math.hypot(PIPE_Y - STAGE_BAR_Y, CROSS_PIPES_Z[1] - STAGE_BAR_Z);
    transforms.push([x, (PIPE_Y + STAGE_BAR_Y) / 2, (CROSS_PIPES_Z[1] + STAGE_BAR_Z) / 2, Math.atan2(CROSS_PIPES_Z[1] - STAGE_BAR_Z, PIPE_Y - STAGE_BAR_Y), 0, 0, 1, len, 1]);
  }
  const pipes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), mats.steel, transforms.length);
  transforms.forEach((t, i) => setInstanceTransform(pipes, i, t));
  pipes.instanceMatrix.needsUpdate = true;
  pipes.castShadow = false;
  pipes.name = "pipe-grid";
  group.add(pipes);
}

/** Eight fluorescent battens hung under the grid; their tube material is the house-light emitter. */
function buildFluorescents(group: THREE.Group, mats: SharedMaterials): THREE.MeshStandardMaterial {
  const tubeMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a30, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 });
  for (const x of TUBE_XS) {
    for (const z of TUBE_ZS) {
      addBox(group, 1.25, 0.07, 0.14, mats.matteBlack, x, 6.0 + 0.05, z, "batten", false);
      addBox(group, 1.2, 0.04, 0.06, tubeMaterial, x, 6.0, z, "fluorescent-tube", false);
      for (const dx of [-0.5, 0.5]) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, PIPE_Y - 6.05, 4), mats.steel);
        wire.position.set(x + dx, (PIPE_Y + 6.05) / 2, z);
        group.add(wire);
      }
    }
  }
  return tubeMaterial;
}

/** Moving heads on the stage bar and the mid-hall pipe, PAR cans on the z = -6 pipe. */
function buildFixtures(group: THREE.Group, mats: SharedMaterials, colors: readonly number[], fakeBeams: FakeBeam[]): void {
  const color = (i: number) => colors[i % colors.length] ?? 0xffffff;
  [-3.6, -1.8, 0, 1.8, 3.6].forEach((x, i) => {
    const from = new THREE.Vector3(x, STAGE_BAR_Y - 0.5, STAGE_BAR_Z);
    const to = new THREE.Vector3(x * 0.8, 0.8, -9.5);
    addMovingHead(group, from, to, color(i), mats);
    fakeBeams.push({ from, to, color: color(i), radius: 0.45 });
  });
  [-4.0, -2.0, 0, 2.0, 4.0].forEach((x, i) => {
    const from = new THREE.Vector3(x, PIPE_Y - 0.5, CROSS_PIPES_Z[2]);
    const to = new THREE.Vector3(-x * 0.5, 0.5, -5.0);
    addMovingHead(group, from, to, color(i + 2), mats);
    fakeBeams.push({ from, to, color: color(i + 2), radius: 0.6 });
  });
  [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75].forEach((x, i) => {
    addParCan(group, new THREE.Vector3(x, PIPE_Y - 0.15, CROSS_PIPES_Z[1]), new THREE.Vector3(x, 0.8, -9.0), color(i + 1), mats);
  });
}

/** Four-box line arrays flown either side of the stage front. */
function buildLineArrays(group: THREE.Group, mats: SharedMaterials): void {
  const grilleMat = new THREE.MeshStandardMaterial({ map: speakerGrilleTexture(), roughness: 0.8 });
  for (const side of [-1, 1] as const) {
    const array = new THREE.Group();
    array.name = "line-array";
    array.position.set(side * 5.6, 0, -7.2);
    addBox(array, 0.7, 0.08, 0.6, mats.steel, 0, 6.15, 0, "", false);
    for (let i = 0; i < 4; i++) {
      const y = 5.9 - i * 0.42;
      const cabinet = addBox(array, 0.6, 0.38, 0.5, mats.fixtureBlack, 0, y, 0);
      cabinet.rotation.x = -0.06 * i; // Lower boxes aim further down toward the crowd
      const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.32), grilleMat);
      grille.position.set(0, 0, 0.251);
      cabinet.add(grille);
    }
    group.add(array);
  }
}

/** Show lighting: base fill, crowd wash, four ShowController key spots, two back lights and volumetric beam cones. */
export function createShowLights(
  group: THREE.Group,
  colors: readonly number[],
  stage: ElevatedPlatform,
  fakeBeams: readonly FakeBeam[],
  showOnly: THREE.Object3D[],
): THREE.SpotLight[] {
  group.add(new THREE.HemisphereLight(0x2a2450, 0x050409, 0.7));
  const crowdWash = new THREE.PointLight(0x2a3cff, 26, 13, 1.5);
  crowdWash.position.set(1.0, 4.5, -2.0);
  group.add(crowdWash);

  const centerZ = (stage.bounds.minZ + stage.bounds.maxZ) / 2;
  const lights = colors.map((color, idx) => {
    const light = new THREE.SpotLight(color, 55, 20, 0.42, 0.6, 1.2);
    light.position.set(-3.6 + idx * 2.4, STAGE_BAR_Y - 0.2, STAGE_BAR_Z);
    light.target.position.set(-3.0 + idx * 2.0, 0.8, centerZ);
    light.castShadow = false;
    group.add(light, light.target);
    return light;
  });

  const backBlue = new THREE.SpotLight(0x3f6cff, 70, 24, 0.55, 0.7, 1.1);
  backBlue.position.set(-2.8, PIPE_Y - 0.3, CROSS_PIPES_Z[0]);
  backBlue.target.position.set(2.0, 0, 2.0);
  const backPurple = new THREE.SpotLight(0x8a3cff, 70, 24, 0.55, 0.7, 1.1);
  backPurple.position.set(2.8, PIPE_Y - 0.3, CROSS_PIPES_Z[0]);
  backPurple.target.position.set(-2.0, 0, 2.0);
  group.add(backBlue, backBlue.target, backPurple, backPurple.target);

  const beams: FakeBeam[] = [
    ...lights.map((l) => ({ from: l.position.clone(), to: l.target.position.clone(), color: l.color.getHex(), radius: 0.9 })),
    { from: backBlue.position.clone(), to: backBlue.target.position.clone(), color: 0x3f6cff, radius: 1.3 },
    { from: backPurple.position.clone(), to: backPurple.target.position.clone(), color: 0x8a3cff, radius: 1.3 },
    ...fakeBeams,
  ];
  const beamMesh = createBeamCones(beams);
  group.add(beamMesh);
  showOnly.push(beamMesh);
  return lights;
}
```

- [ ] **Step 4: Replace the placeholder lighting in the entry point**

In `createKowloonBayVenue.ts`, delete the block starting at `// TEMPORARY until Task 7` through `void fakeBeams;`, add `import { buildRigging, createShowLights } from "./rigging";`, and after `buildBackstage(group, mats);` insert:

```ts
  const tubeMaterial = buildRigging(group, mats, definition.show.lightColors, fakeBeams);
  const crowd = createAtmosphericCrowd(group, CROWD_POSITIONS);
  const stageLights = createShowLights(group, definition.show.lightColors, stagePlatform, fakeBeams, showOnly);
  const houseLights = createHouseLights(group, { panelMaterial: tubeMaterial }, showOnly);
```

(remove the earlier `const crowd = ...` line so it is declared once). Keep the `return` unchanged.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/scene/kowloonBay && npm run typecheck`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/scene/kowloonBay
git commit -m "feat: rig Kowloon Bay ceiling with pipes, fluorescents, fixtures and show lights"
```

---

### Task 8: Props on the +X side, rear wall and floor

**Files:**
- Create: `src/scene/kowloonBay/props.ts`
- Modify: `src/scene/kowloonBay/createKowloonBayVenue.ts`
- Test: `src/scene/kowloonBay/createKowloonBayVenue.test.ts`

**Interfaces:**
- Produces: `buildProps(group: THREE.Group, mats: SharedMaterials): THREE.Object3D[]` returning knockable props (the red pony).

- [ ] **Step 1: Write the failing tests**

Append to the `describe`:

```ts
  it("dresses the hall with the props seen in the photos", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = collectNames(build.group);
    for (const expected of [
      "wc-door",
      "wall-clock",
      "bin",
      "throne-chair",
      "ladder",
      "fridge",
      "pa-desk",
      "pa-mixer",
      "sofa",
      "poster",
      "long-table",
      "ticket-table",
      "red-pony",
    ]) {
      expect(names, expected).toContain(expected);
    }
    const door = build.group.getObjectByName("wc-door")!;
    expect(door.position.z).toBeCloseTo(-7.5, 5);
    expect(door.rotation.y).toBeCloseTo(0, 5); // faces the audience (+Z)
  });

  it("exposes the crowd dummies and the red pony as knockable props", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = build.knockableProps.map((prop) => prop.name);
    expect(names.filter((name) => name === "crowd-dummy").length).toBeGreaterThan(8);
    expect(names).toContain("red-pony");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/scene/kowloonBay`
Expected: FAIL — `wc-door` missing.

- [ ] **Step 3: Create `props.ts`**

```ts
import * as THREE from "three";
import { KB_REAR_WALL_Z, KB_WC_BLOCK } from "../../config/venue";
import {
  addBox,
  consoleMixerTexture,
  createExitDoor,
  createFridgeTexture,
  labelPlane,
  speakerGrilleTexture,
  type SharedMaterials,
} from "../venueKit";
import { ACOUSTIC_TILE_TOP_Y } from "./shell";
import { clockFaceTexture, posterTexture } from "./textures";

export function buildProps(group: THREE.Group, mats: SharedMaterials): THREE.Object3D[] {
  buildWcBlock(group, mats);
  buildThrone(group);
  buildLadder(group);
  buildFridge(group, mats);
  buildPaDesk(group, mats);
  buildSofa(group);
  buildPosters(group);
  buildTables(group, mats);
  return [buildRedPony(group)];
}

/** WC room beside the stage: charcoal walls up to the tile line, EXIT door facing the audience, wall clock, bin. */
function buildWcBlock(group: THREE.Group, mats: SharedMaterials): void {
  const b = KB_WC_BLOCK;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  addBox(group, w, ACOUSTIC_TILE_TOP_Y, 0.2, mats.wallCharcoal, (b.minX + b.maxX) / 2, ACOUSTIC_TILE_TOP_Y / 2, b.maxZ - 0.1, "wc-wall-front");
  addBox(group, 0.2, ACOUSTIC_TILE_TOP_Y, d, mats.wallCharcoal, b.minX + 0.1, ACOUSTIC_TILE_TOP_Y / 2, (b.minZ + b.maxZ) / 2, "wc-wall-side");
  createExitDoor(group, 5.5, 0, b.maxZ + 0.1, 0, "wc-door");

  const clock = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24),
    new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.5 }),
  );
  clock.rotation.x = Math.PI / 2;
  clock.position.set(4.85, 2.85, b.maxZ + 0.03);
  clock.name = "wall-clock";
  group.add(clock);

  const binMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.6 });
  const bin = addBox(group, 0.45, 0.9, 0.45, binMat, 6.15, 0.45, -7.05, "bin");
  addBox(bin, 0.47, 0.06, 0.47, mats.matteBlack, 0, 0.45, 0, "", false);
}

/** Glossy black ornate throne chair against the +X wall. */
function buildThrone(group: THREE.Group): void {
  const throne = new THREE.Group();
  throne.name = "throne-chair";
  throne.position.set(5.9, 0, -6.0);
  throne.rotation.y = -Math.PI / 2; // Faces into the hall (-X)
  const gloss = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.25, metalness: 0.3 });
  addBox(throne, 0.7, 0.14, 0.7, gloss, 0, 0.5, 0);
  addBox(throne, 0.7, 1.3, 0.12, gloss, 0, 1.15, -0.3);
  const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16, 1, false, 0, Math.PI), gloss);
  crest.rotation.x = Math.PI / 2;
  crest.rotation.z = Math.PI / 2;
  crest.position.set(0, 1.8, -0.3);
  throne.add(crest);
  for (const x of [-0.36, 0.36]) {
    addBox(throne, 0.08, 0.3, 0.6, gloss, x, 0.72, 0.02);
    addBox(throne, 0.08, 0.5, 0.08, gloss, x, 0.25, 0.3);
  }
  group.add(throne);
}

/** Aluminium A-frame ladder draped with a green net and hanging plushies. */
function buildLadder(group: THREE.Group): void {
  const ladder = new THREE.Group();
  ladder.name = "ladder";
  ladder.position.set(6.05, 0, -4.8);
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.4, metalness: 0.8 });
  for (const side of [-1, 1] as const) {
    // Each leg pair leans inward toward the top (rotation about X tilts +Y toward -Z for positive angles)
    for (const x of [-0.22, 0.22]) {
      const rail = addBox(ladder, 0.05, 2.0, 0.05, alu, x, 1.0, side * 0.18);
      rail.rotation.x = side * 0.18;
    }
    for (let i = 0; i < 5; i++) {
      const y = 0.3 + i * 0.4;
      addBox(ladder, 0.44, 0.04, 0.06, alu, 0, y, side * (0.18 - (y - 1.0) * 0.18), "", false);
    }
  }
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.6),
    new THREE.MeshStandardMaterial({ map: speakerGrilleTexture(), color: 0x7ddc4a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  net.position.set(0, 1.1, -0.28);
  net.rotation.x = -0.18;
  ladder.add(net);
  const plushColors = [0xff7eb6, 0xffd166, 0xff9f68, 0xffffff];
  plushColors.forEach((color, i) => {
    const plush = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    plush.position.set(-0.3 + i * 0.2, 1.5 - (i % 2) * 0.3, -0.34);
    ladder.add(plush);
  });
  group.add(ladder);
}

/** Red Coca-Cola fridge in the rear +X corner, door facing the stage. */
function buildFridge(group: THREE.Group, mats: SharedMaterials): void {
  const fridge = new THREE.Group();
  fridge.name = "fridge";
  fridge.position.set(6.0, 0, 3.5);
  const red = new THREE.MeshStandardMaterial({ color: 0xd0161d, roughness: 0.4, metalness: 0.1 });
  addBox(fridge, 0.8, 1.9, 0.8, red, 0, 0.95, 0);
  const shelves = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.4), new THREE.MeshStandardMaterial({ map: createFridgeTexture(), emissive: 0x333333 }));
  shelves.position.set(0, 1.05, -0.401);
  shelves.rotation.y = Math.PI;
  fridge.add(shelves);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.46), mats.glass);
  glass.position.set(0, 1.05, -0.41);
  glass.rotation.y = Math.PI;
  fridge.add(glass);
  const label = labelPlane("Coca-Cola", "#d0161d", "#ffffff", 0.6, 0.2);
  label.position.set(0, 1.85, -0.41);
  label.rotation.y = Math.PI;
  fridge.add(label);
  group.add(fridge);
}

/** Sound desk facing the stage with a mixer, two monitors and two office chairs behind it. */
function buildPaDesk(group: THREE.Group, mats: SharedMaterials): void {
  const desk = new THREE.Group();
  desk.name = "pa-desk";
  desk.position.set(4.0, 0, 3.0);
  const top = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.6 });
  addBox(desk, 2.8, 0.05, 0.8, top, 0, 0.78, 0);
  for (const [x, z] of [[-1.3, -0.35], [1.3, -0.35], [-1.3, 0.35], [1.3, 0.35]] as const) {
    addBox(desk, 0.05, 0.76, 0.05, mats.steel, x, 0.38, z, "", false);
  }
  const mixer = addBox(desk, 1.4, 0.12, 0.6, mats.fixtureBlack, -0.4, 0.86, 0, "pa-mixer");
  const faders = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.56), new THREE.MeshStandardMaterial({ map: consoleMixerTexture(), emissive: 0x222222 }));
  faders.rotation.x = -Math.PI / 2;
  faders.position.set(0, 0.061, 0);
  mixer.add(faders);
  const screen = new THREE.MeshStandardMaterial({ color: 0x0b1c33, emissive: 0x2f6fff, emissiveIntensity: 0.9 });
  for (const x of [0.6, 1.1]) {
    addBox(desk, 0.5, 0.32, 0.04, screen, x, 1.25, -0.3, "monitor");
    addBox(desk, 0.06, 0.28, 0.06, mats.fixtureBlack, x, 1.0, -0.3, "", false);
  }
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.8 });
  for (const x of [-0.6, 0.8]) {
    addBox(desk, 0.5, 0.08, 0.5, chairMat, x, 0.48, 0.75, "office-chair");
    addBox(desk, 0.5, 0.5, 0.08, chairMat, x, 0.78, 0.98, "", false);
    addBox(desk, 0.06, 0.44, 0.06, mats.steel, x, 0.22, 0.75, "", false);
  }
  group.add(desk);
}

/** Black fabric sofa facing the stage in front of the desk. */
function buildSofa(group: THREE.Group): void {
  const sofa = new THREE.Group();
  sofa.name = "sofa";
  sofa.position.set(4.0, 0, 1.85);
  const fabric = new THREE.MeshStandardMaterial({ color: 0x0e0e11, roughness: 0.98 });
  addBox(sofa, 2.2, 0.42, 0.9, fabric, 0, 0.21, 0);
  addBox(sofa, 2.2, 0.5, 0.2, fabric, 0, 0.67, 0.35);
  for (const x of [-1.05, 1.05]) addBox(sofa, 0.1, 0.25, 0.9, fabric, x, 0.54, 0);
  group.add(sofa);
}

/** Three live posters on the acoustic rear wall. */
function buildPosters(group: THREE.Group): void {
  [0.8, 1.6, 2.4].forEach((x, i) => {
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), new THREE.MeshStandardMaterial({ map: posterTexture(i), roughness: 0.9 }));
    poster.position.set(x, 1.9, KB_REAR_WALL_Z - 0.07);
    poster.rotation.y = Math.PI;
    poster.name = "poster";
    group.add(poster);
  });
}

/** Long white folding table at the rear and the small ticket table with a lamp beside the doorway. */
function buildTables(group: THREE.Group, mats: SharedMaterials): void {
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 });
  const longTable = new THREE.Group();
  longTable.name = "long-table";
  longTable.position.set(-1.2, 0, 3.5);
  addBox(longTable, 1.8, 0.04, 0.6, white, 0, 0.74, 0);
  for (const [x, z] of [[-0.8, -0.25], [0.8, -0.25], [-0.8, 0.25], [0.8, 0.25]] as const) {
    addBox(longTable, 0.04, 0.72, 0.04, mats.steel, x, 0.36, z, "", false);
  }
  group.add(longTable);

  const ticket = new THREE.Group();
  ticket.name = "ticket-table";
  ticket.position.set(-2.4, 0, 1.7);
  addBox(ticket, 0.7, 0.04, 0.5, white, 0, 0.86, 0);
  for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]] as const) {
    addBox(ticket, 0.03, 0.84, 0.03, mats.steel, x, 0.42, z, "", false);
  }
  addBox(ticket, 0.03, 0.5, 0.03, mats.steel, 0.2, 1.13, -0.1, "", false);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffe2b0, emissiveIntensity: 1.2 });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 12, 1, true), shadeMat);
  shade.position.set(0.2, 1.42, -0.1);
  ticket.add(shade);
  const lamp = new THREE.PointLight(0xffe2b0, 3, 3, 1.8);
  lamp.position.set(0.2, 1.35, -0.1);
  ticket.add(lamp);
  group.add(ticket);
}

/** Small red rocking-pony plush left on the floor; knockable by mosh / lift. */
function buildRedPony(group: THREE.Group): THREE.Object3D {
  const pony = new THREE.Group();
  pony.name = "red-pony";
  pony.position.set(0.6, 0, 2.6);
  const red = new THREE.MeshStandardMaterial({ color: 0xd42a2a, roughness: 0.9 });
  addBox(pony, 0.5, 0.28, 0.24, red, 0, 0.45, 0);
  addBox(pony, 0.24, 0.26, 0.2, red, 0.32, 0.62, 0);
  addBox(pony, 0.06, 0.12, 0.06, red, 0.4, 0.78, 0, "", false);
  for (const [x, z] of [[-0.18, -0.08], [0.18, -0.08], [-0.18, 0.08], [0.18, 0.08]] as const) {
    addBox(pony, 0.08, 0.32, 0.08, red, x, 0.16, z, "", false);
  }
  group.add(pony);
  return pony;
}
```

- [ ] **Step 4: Wire it into the entry point**

In `createKowloonBayVenue.ts` add `import { buildProps } from "./props";`, call `const knockables = buildProps(group, mats);` after `buildRigging(...)`, and return `knockableProps: [...crowd, ...knockables]`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/scene/kowloonBay && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/scene/kowloonBay
git commit -m "feat: dress Kowloon Bay with WC door, PA desk, sofa, throne, fridge and props"
```

---

### Task 9: Open the 九龍灣 station and wire the app

**Files:**
- Modify: `src/ui/StationSelector.ts`, `src/ui/StationSelector.test.ts`, `src/app/App.ts`, `src/main.ts`, `src/types/debug.d.ts`
- Test: `e2e/desktop.spec.ts`

**Interfaces:**
- Consumes: `KOWLOON_BAY_VENUE` (Task 4), `debugPlaceOnGround(x, z, fromY?)` (Task 2).
- Produces: `window.__liveHouseDebug.placePlayer(x, z, y?)`.

- [ ] **Step 1: Update the unit test that used 九龍灣 as a coming-soon station**

In `src/ui/StationSelector.test.ts`, in the test "never enters coming-soon stations, even after repeated clicks", change:

```ts
    state.selectStationById("diamond-hill");
    expect(state.getCurrentStation().name).toBe("鑽石山");
    expect(onStationChange).toHaveBeenCalledWith(STATIONS[3]);
```

Add a new test in the same file:

```ts
  it("enters 九龍灣 on one click now that it is open", () => {
    const state = new StationSelectorState({ onEnter, onStationChange, onFeedbackChange });
    state.selectStationById("kowloon-bay");
    const result = state.handleEnterClick();
    expect(result.entered).toBe(true);
    expect(onEnter).toHaveBeenCalledWith(STATIONS[2]);
  });
```

Run: `npx vitest run src/ui/StationSelector.test.ts` → the new test FAILS (status still coming-soon).

- [ ] **Step 2: Activate the station**

In `src/ui/StationSelector.ts` replace the `kowloon-bay` entry:

```ts
  {
    id: "kowloon-bay",
    name: "九龍灣",
    enName: "KOWLOON BAY",
    code: "KOB",
    status: "active",
    copy: "樓底特高的黑盒場：truss 花道、台右兩層 backstage，2/F 玻璃房俯瞰舞台。",
    venueId: "kowloon-bay-live-house-01",
  },
```

Run: `npx vitest run src/ui/StationSelector.test.ts` → PASS.

- [ ] **Step 3: Replace the station→venue if/else chain in `App.ts`**

Change the import to include the new venue:

```ts
import { GENERIC_VENUE, KOWLOON_BAY_VENUE, NGAU_TAU_KOK_VENUE, type VenueDefinition } from "../config/venue";
```

Add below the imports:

```ts
// Station id (StationSelector) -> venue to load
const STATION_VENUES: Readonly<Record<string, VenueDefinition>> = {
  "neo-backstage": GENERIC_VENUE,
  "ngau-tau-kok": NGAU_TAU_KOK_VENUE,
  "kowloon-bay": KOWLOON_BAY_VENUE,
};
```

Replace the URL-parameter block:

```ts
    // Check URL parameters for direct preview of a venue (e.g. ?station=kowloon-bay or ?venue=ngau-tau-kok-hall-01)
    const urlParams = new URLSearchParams(window.location.search);
    const requestedStation =
      urlParams.get("station") ?? (urlParams.get("venue") === "ngau-tau-kok-hall-01" ? "ngau-tau-kok" : null);
    if (requestedStation) {
      this.stationSelector.selectStationById(requestedStation, false);
      const venue = STATION_VENUES[requestedStation];
      if (venue) this.loadVenue(venue);
    }
```

Replace the start of `handleEnterWithStation`:

```ts
  private readonly handleEnterWithStation = (station: Station): void => {
    const venue = STATION_VENUES[station.id];
    if (venue) this.loadVenue(venue);
```

(keep the rest of the method as is). Change `debugPlacePlayer`:

```ts
  debugPlacePlayer(x: number, z: number, y?: number): void {
    this.player.debugPlaceOnGround(x, z, y);
  }
```

In `src/main.ts`: `placePlayer: (x, z, y) => app.debugPlacePlayer(x, z, y),`
In `src/types/debug.d.ts`: `placePlayer: (x: number, z: number, y?: number) => void;`

- [ ] **Step 4: Update e2e**

In `e2e/desktop.spec.ts`, test "keeps unreleased stations locked without a click-to-unlock easter egg": change `stations.nth(2)` to `stations.nth(3)` and `"九龍灣"` to `"鑽石山"`.

Add a new test after it:

```ts
test("enters 九龍灣 via the station selector and can stand in the 2/F glass room", async ({ page }) => {
  test.slow();
  await page.goto("/?station=kowloon-bay");

  await expect(page.locator("#entry-title")).toContainText("九龍灣");
  await expect(page.locator("#station-status-badge")).toContainText("現正開放");
  await page.locator("#enter-button").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#venue-badge-text")).toContainText("LIVE · 九龍灣");
  await expect(page.locator("#house-lights-button")).toBeVisible();

  // Spawns on the vestibule floor, under the glass room
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y)).toBe(0);

  // Debug-place the player on the 2/F glass room deck
  await page.evaluate(() => window.__liveHouseDebug?.placePlayer(-4.75, 2.6, 3.0));
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().groundHeight)).toBeCloseTo(3.0, 5);
});
```

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run test:e2e -- --grep "九龍灣|unreleased stations|MTR station selector"`
Expected: PASS. (Playwright starts the dev server per `playwright.config`; if the run needs a manual server, run `npm run dev` in another terminal first.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/StationSelector.ts src/ui/StationSelector.test.ts src/app/App.ts src/main.ts src/types/debug.d.ts e2e/desktop.spec.ts
git commit -m "feat: open the Kowloon Bay station and route it to the new venue"
```

---

### Task 10: Visual verification against the photos

**Files:**
- Create: `scripts/capture-kowloon-bay-previews.mjs`
- Modify (tuning only): files under `src/scene/kowloonBay/`, `src/config/venue.ts`

- [ ] **Step 1: Create the capture script**

```js
import { chromium } from "playwright";

// Camera yaw: forward = (-sin yaw, -cos yaw); yaw 0 looks toward -Z (the stage).
const SHOTS = [
  { name: "vestibule-doorway", place: [-3.8, 2.8, 0], view: [0.0, -0.02] },
  { name: "audience-facing-stage", place: [1.0, 1.0, 0], view: [0.0, -0.05] },
  { name: "stage-facing-audience", place: [0, -9.5, 0.7], view: [Math.PI, -0.04] },
  { name: "right-side-wc-door", place: [0, -3.0, 0], view: [-Math.PI / 2, -0.02] },
  { name: "left-side-glass-room", place: [2.0, -6.0, 0], view: [Math.PI * 0.75, 0.12] },
  { name: "backstage-corridor", place: [-5.0, -4.0, 0], view: [Math.PI, 0.0] },
  { name: "glass-room-view", place: [-4.75, 2.6, 3.0], view: [-0.37, -0.15] },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://127.0.0.1:5173/?station=kowloon-bay", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#enter-button");
  await page.click("#enter-button");
  await page.waitForTimeout(1500);
  await page.click("#camera-button"); // first person
  await page.waitForTimeout(500);

  for (const shot of SHOTS) {
    await page.evaluate(({ place, view }) => {
      window.__liveHouseDebug?.placePlayer(place[0], place[1], place[2]);
      window.__liveHouseDebug?.setCameraView(view[0], view[1]);
    }, shot);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `preview-kb-${shot.name}.png` });
    console.log(`captured preview-kb-${shot.name}.png`);
  }
  await browser.close();
}

run().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Capture**

Run: `npm run dev` (background), then `node scripts/capture-kowloon-bay-previews.mjs`
Expected: seven `preview-kb-*.png` files in the repo root (gitignored).

- [ ] **Step 3: Compare with the reference photos and tune**

Check each shot against the corresponding photo and fix in place. Look for:
- `audience-facing-stage`: stage left of centre with the WC door + clock on the right, truss walkway with end stairs, dense rigging overhead, light grey floor.
- `stage-facing-audience`: fridge + PA desk + sofa on the left (+X), acoustic tile rear wall with posters, glass room with plushies upper right (-X) and the bright doorway beneath it.
- `left-side-glass-room`: glass room panes visible above the doorway; ticket table with lamp beside the doorway.
- `glass-room-view`: camera at 2/F; stage visible through the -Z glazing, rail and deck below.
- `backstage-corridor`: 2/F stairs, stage stairs and road cases; deck soffit overhead.
- Nothing z-fights (floor vs tape marks, curtains vs walls); adjust offsets by ±0.01–0.05 if needed.

Also walk it interactively at `http://127.0.0.1:5173/?station=kowloon-bay`: spawn → doorway → curtain gap → corridor → up the stairs → glass room; confirm you cannot walk off the deck edge and that the house-light toggle lights the tubes.

- [ ] **Step 4: Final verification**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/capture-kowloon-bay-previews.mjs src/scene/kowloonBay src/config/venue.ts
git commit -m "feat: add Kowloon Bay preview capture script and visual tuning"
```

---

## Self-review

- **Spec coverage:** multi-level ground (T1–T2), venueKit extraction (T3), definition + constants + colliders + platforms + spawn (T4), shell/stage/walkway/end stairs (T5), partition + gap + stairs + deck + rail + vestibule + glass room + shelves (T6), pipes/fluorescents/moving heads/PARs/line arrays/show lights/house lights/beams (T7), WC door + clock, bin, throne, ladder, fridge, PA desk, sofa, posters, tables, pony, crowd (T5/T8), station activation, `STATION_VENUES` map, URL preview, debug placement, e2e (T9), screenshots vs photos (T10).
- **Placeholders:** the only "TEMPORARY" block is in Task 5 and is explicitly removed in Task 7 Step 4.
- **Type consistency:** `buildShell(group, mats)`, `buildStage(group, mats, stage, walkway)`, `buildBackstage(group, mats)`, `buildRigging(group, mats, colors, fakeBeams): MeshStandardMaterial`, `createShowLights(group, colors, stage, fakeBeams, showOnly): SpotLight[]`, `buildProps(group, mats): Object3D[]`, `acousticTileMaterial(width, height)` and `ACOUSTIC_TILE_TOP_Y` exported from `shell.ts`, `createAtmosphericCrowd(group, positions)` and `createHouseLights(group, { panelMaterial }, showOnly)` from `venueKit.ts` — all used with the same names and argument orders across tasks.
