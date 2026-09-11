import type { Aabb2 } from "../core/collision";
import type { PerformerLine } from "../show/formation";

export type Point3Tuple = readonly [x: number, y: number, z: number];

export interface ElevatedPlatform {
  bounds: Aabb2;
  height: number;
  /** Idle here plays a sit pose (a sofa cushion the player can walk up to). */
  seat?: boolean;
  /** World yaw so the sit faces away from the backrest (back against the sofa). */
  sitYaw?: number;
}

export interface TeleportSpot {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface VenueDefinition {
  id: string;
  name: string;
  scene:
    | { kind: "procedural"; builderId: "neon-backstage" | "ngau-tau-kok" | "kowloon-bay" }
    | { kind: "gltf"; url: string };
  spawn: {
    x: number;
    y: number;
    z: number;
    yaw: number;
  };
  /** Role shortcuts. Absent on venues that have no HUD teleport menu. */
  teleports?: readonly TeleportSpot[];
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  cameraBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  colliders: readonly Aabb2[];
  platforms: readonly ElevatedPlatform[];
  crowdBarrier: Aabb2 & { maxY: number };
  show: {
    performerLine: PerformerLine;
    audiencePoints: readonly Point3Tuple[];
    lightColors: readonly number[];
  };
  youtubeVideoId: string;
}

const stageBounds: Aabb2 = {
  minX: -5.625,
  maxX: 5.625,
  minZ: -14.95,
  maxZ: -9.075,
};
const stageCollider: Aabb2 = { ...stageBounds, maxY: 0.75 };
const crowdBarrier: Aabb2 & { maxY: number } = {
  minX: -5.75,
  maxX: 5.75,
  minZ: -8.35,
  maxZ: -8.21,
  maxY: 1.32,
};

/** Neon Backstage FOH desk, stage-left at the rear of the hall; the operator chairs sit behind it (+Z). */
export const GENERIC_FOH_DESK = { x: -6.85, z: 2.6, width: 3.0, depth: 0.8 } as const;
export const GENERIC_FOH_CHAIRS = [
  { x: GENERIC_FOH_DESK.x - 0.75, z: GENERIC_FOH_DESK.z + 0.85 }, // Behind the sound mixer
  { x: GENERIC_FOH_DESK.x + 0.75, z: GENERIC_FOH_DESK.z + 0.85 }, // Behind the lighting console
] as const;
const genericFohSeats: ElevatedPlatform[] = GENERIC_FOH_CHAIRS.map((chair) => ({
  bounds: { minX: chair.x - 0.35, maxX: chair.x + 0.35, minZ: chair.z - 0.3, maxZ: chair.z + 0.35 },
  height: 0,
  seat: true,
  sitYaw: 0,
}));

export const GENERIC_VENUE: VenueDefinition = {
  id: "generic-hk-live-house-01",
  name: "Neon Backstage",
  scene: { kind: "procedural", builderId: "neon-backstage" },
  spawn: { x: 0, y: 0, z: 20, yaw: 0 },
  bounds: { minX: -9, maxX: 9, minZ: -16, maxZ: 22 },
  cameraBounds: { minX: -8.8, maxX: 8.8, minZ: -15.8, maxZ: 26 },
  colliders: [
    { minX: -9.18, maxX: -8.82, minZ: -16, maxZ: 18 },
    { minX: 8.82, maxX: 9.18, minZ: -16, maxZ: 18 },
    { minX: -9, maxX: 9, minZ: -16.18, maxZ: -15.82 },
    { minX: -9, maxX: -2, minZ: 17.82, maxZ: 18.18 },
    { minX: 2, maxX: 9, minZ: 17.82, maxZ: 18.18 },
    { minX: -9, maxX: -2.3, minZ: 9.36, maxZ: 9.64 },
    { minX: 2.3, maxX: 9, minZ: 9.36, maxZ: 9.64 },
    { minX: -8.35, maxX: -5.15, minZ: 12.08, maxZ: 13.53 },
    stageCollider,
    { minX: 5.75, maxX: 8.55, minZ: -5.3, maxZ: 2.5 },
    // FOH desk (chairs behind it carry no collider so the player can walk onto them and sit)
    {
      minX: GENERIC_FOH_DESK.x - GENERIC_FOH_DESK.width / 2 - 0.05,
      maxX: GENERIC_FOH_DESK.x + GENERIC_FOH_DESK.width / 2 + 0.05,
      minZ: GENERIC_FOH_DESK.z - GENERIC_FOH_DESK.depth / 2,
      maxZ: GENERIC_FOH_DESK.z + GENERIC_FOH_DESK.depth / 2,
      maxY: 1.4,
    },
    { minX: -9, maxX: -8.5, minZ: -9.87, maxZ: -9.63 },
    { minX: -7.3, maxX: -6.9, minZ: -9.87, maxZ: -9.63 },
    { minX: -7.17, maxX: -6.93, minZ: -14.2, maxZ: -9.8 },
    crowdBarrier,
  ],
  crowdBarrier,
  platforms: [
    {
      bounds: stageBounds,
      height: 0.75,
    },
    ...genericFohSeats,
  ],
  show: {
    performerLine: { y: 0.75, z: -12, spacing: 0.88 },
    audiencePoints: [
      [-3.6, 0, -7.6], [-1.8, 0, -7.4], [0, 0, -7.6], [1.8, 0, -7.4], [3.6, 0, -7.6],
      [-3.9, 0, -5.5], [-2.1, 0, -5.3], [-0.4, 0, -5.7], [1.4, 0, -5.3], [3.4, 0, -5.6],
      [-3.3, 0, -3.3], [-1.4, 0, -3.4], [0.5, 0, -3.2], [2.4, 0, -3.5], [4, 0, -3.2],
    ],
    lightColors: [0xff2f7d, 0x7147d9, 0x3f8cff, 0xd6ff3f],
  },
  youtubeVideoId: "M7lc1UVf-VE",
};

const ntkStageBounds: Aabb2 = {
  minX: -4.6,
  maxX: 4.6,
  minZ: -9.2,
  maxZ: -6.2,
};
const ntkStageCollider: Aabb2 = { ...ntkStageBounds, maxY: 0.7 };
const ntkCrowdBarrier: Aabb2 & { maxY: number } = {
  minX: -4.8,
  maxX: 4.2, // Open on stage right for stage access stairs (上台在台右)
  minZ: -5.45,
  maxZ: -5.31,
  maxY: 1.25,
};

// Key depth lines of the Ngau Tau Kok footprint (see docs/superpowers/plans/2026-09-04-ngau-tau-kok-venue-rebuild.md)
export const NTK_BACK_WALL_Z = -9.2; // Inner face of the hall back wall; the stage sits against it
export const NTK_ENTRANCE_Z = 12.0; // Wall between the hall and the foyer (double doors at x: [-1.1, 1.1])
export const NTK_GLASS_Z = 16.0; // Glass shopfront between the foyer and the mall corridor
export const NTK_MALL_END_Z = 20.5; // Far wall of the mall corridor
export const NTK_HALL_CEILING = 6.2;
// FOH / PA booth footprint (3.6m deep) sits flush against the entrance wall at the very back of the hall
export const NTK_PA_BOOTH_MAX_Z = NTK_ENTRANCE_Z - 0.15;
export const NTK_PA_BOOTH_MIN_Z = NTK_PA_BOOTH_MAX_Z - 3.6;
export const NTK_PA_PLATFORM_HEIGHT = 0.48;
/** FOH operator chairs on the booth platform, behind the sound mixer (-X) and the lighting console (+X). */
export const NTK_FOH_CHAIRS = [
  { x: -5.75, z: NTK_PA_BOOTH_MIN_Z + 1.5 },
  { x: -4.45, z: NTK_PA_BOOTH_MIN_Z + 1.5 },
] as const;
const ntkFohSeats: ElevatedPlatform[] = NTK_FOH_CHAIRS.map((chair) => ({
  bounds: { minX: chair.x - 0.35, maxX: chair.x + 0.35, minZ: chair.z - 0.3, maxZ: chair.z + 0.35 },
  height: NTK_PA_PLATFORM_HEIGHT,
  seat: true,
  sitYaw: 0,
}));

export const NGAU_TAU_KOK_VENUE: VenueDefinition = {
  id: "ngau-tau-kok-hall-01",
  name: "牛頭角",
  scene: { kind: "procedural", builderId: "ngau-tau-kok" },
  spawn: { x: 0, y: 0, z: -1.0, yaw: 0 },
  bounds: { minX: -7.0, maxX: 7.0, minZ: NTK_BACK_WALL_Z, maxZ: NTK_MALL_END_Z },
  cameraBounds: { minX: -6.8, maxX: 6.8, minZ: NTK_BACK_WALL_Z + 0.2, maxZ: NTK_MALL_END_Z + 0.4 },
  colliders: [
    // Side walls run the full depth: hall, foyer and mall corridor share the same width
    { minX: -7.2, maxX: -6.9, minZ: NTK_BACK_WALL_Z - 0.3, maxZ: NTK_MALL_END_Z },
    { minX: 6.9, maxX: 7.2, minZ: NTK_BACK_WALL_Z - 0.3, maxZ: NTK_MALL_END_Z },
    // Hall back wall (stage-right EXIT door sits in this wall beside the stage, no gap needed)
    { minX: -7.0, maxX: 7.0, minZ: NTK_BACK_WALL_Z - 0.3, maxZ: NTK_BACK_WALL_Z },
    // Entrance wall with 2.2m central double doors gap (x: [-1.1, 1.1])
    { minX: -7.0, maxX: -1.1, minZ: NTK_ENTRANCE_Z - 0.15, maxZ: NTK_ENTRANCE_Z + 0.15 },
    { minX: 1.1, maxX: 7.0, minZ: NTK_ENTRANCE_Z - 0.15, maxZ: NTK_ENTRANCE_Z + 0.15 },
    // Glass shopfront with 2.0m glass door gap (x: [-1.0, 1.0])
    { minX: -7.0, maxX: -1.0, minZ: NTK_GLASS_Z - 0.05, maxZ: NTK_GLASS_Z + 0.05 },
    { minX: 1.0, maxX: 7.0, minZ: NTK_GLASS_Z - 0.05, maxZ: NTK_GLASS_Z + 0.05 },
    // Mall corridor far wall
    { minX: -7.0, maxX: 7.0, minZ: NTK_MALL_END_Z - 0.15, maxZ: NTK_MALL_END_Z + 0.15 },
    // Foyer left side: tuck shop line-up along the left wall (powerbank kiosk -> two fridges -> staff table)
    { minX: -6.9, maxX: -6.2, minZ: 12.5, maxZ: 13.2 }, // Powerbank rental kiosk
    { minX: -6.9, maxX: -6.1, minZ: 13.4, maxZ: 15.3 }, // Two beverage fridges
    { minX: -5.7, maxX: -3.9, minZ: 14.5, maxZ: 15.3 }, // White staff table
    // Foyer right side: display area (TV stand, merch table, roll-up banner)
    { minX: 5.7, maxX: 6.9, minZ: 13.0, maxZ: 14.6 }, // TV display stand
    { minX: 3.2, maxX: 5.0, minZ: 14.4, maxZ: 15.3 }, // Merch table
    { minX: 6.1, maxX: 6.9, minZ: 15.0, maxZ: 15.6 }, // Roll-up banner
    // Mall corridor queue lane: red rope barriers on both sides of the carpet runner
    { minX: -1.65, maxX: -1.45, minZ: 16.6, maxZ: 20.0, maxY: 1.0 },
    { minX: 1.45, maxX: 1.65, minZ: 16.6, maxZ: 20.0, maxY: 1.0 },
    ntkStageCollider,
    ntkCrowdBarrier,
    // Stage Right stairs outer railing
    { minX: 5.75, maxX: 5.85, minZ: -6.8, maxZ: -5.4, maxY: 1.5 },
    // PA / Sound & lighting control booth: rear left, pushed right up against the entrance wall
    { minX: -6.4, maxX: -3.8, minZ: NTK_PA_BOOTH_MIN_Z + 0.1, maxZ: NTK_PA_BOOTH_MIN_Z + 0.9, maxY: 1.6 }, // Control desk (mixer + lighting console) facing stage
    { minX: -6.7, maxX: -6.5, minZ: NTK_PA_BOOTH_MIN_Z, maxZ: NTK_PA_BOOTH_MAX_Z, maxY: 1.4 }, // Left railing
    { minX: -4.0, maxX: -3.6, minZ: NTK_PA_BOOTH_MIN_Z - 0.05, maxZ: NTK_PA_BOOTH_MIN_Z + 0.1, maxY: 1.4 }, // Front lip right railing
    { minX: -3.7, maxX: -3.55, minZ: NTK_PA_BOOTH_MIN_Z, maxZ: NTK_PA_BOOTH_MIN_Z + 1.4, maxY: 1.4 }, // Side railing (front of stairs)
    { minX: -3.7, maxX: -3.55, minZ: NTK_PA_BOOTH_MIN_Z + 3.2, maxZ: NTK_PA_BOOTH_MAX_Z, maxY: 1.4 }, // Side railing (behind stairs)
    // Floor subwoofer stacks flanking the stage
    { minX: -6.6, maxX: -5.4, minZ: -7.6, maxZ: -6.4 },
    { minX: 6.0, maxX: 6.9, minZ: -7.2, maxZ: -6.3 }, // Keeps the floor in front of the stage-right EXIT door clear
  ],
  crowdBarrier: ntkCrowdBarrier,
  platforms: [
    {
      bounds: ntkStageBounds,
      height: 0.7,
    },
    // Stage Right access stairs (上台在台右) stepping smoothly up onto the 0.7m stage deck
    {
      bounds: { minX: 4.65, maxX: 5.65, minZ: -5.45, maxZ: -5.2 },
      height: 0.175,
    },
    {
      bounds: { minX: 4.65, maxX: 5.65, minZ: -5.7, maxZ: -5.45 },
      height: 0.35,
    },
    {
      bounds: { minX: 4.65, maxX: 5.65, minZ: -5.95, maxZ: -5.7 },
      height: 0.525,
    },
    {
      bounds: { minX: 4.65, maxX: 5.65, minZ: -6.2, maxZ: -5.95 },
      height: 0.7,
    },
    // PA Control Booth elevated platform & side stairs (rear left, against the entrance wall, facing stage)
    {
      bounds: { minX: -6.6, maxX: -3.6, minZ: NTK_PA_BOOTH_MIN_Z, maxZ: NTK_PA_BOOTH_MAX_Z },
      height: NTK_PA_PLATFORM_HEIGHT,
    },
    ...ntkFohSeats,
    // Side stairs stepping up towards stage (-Z)
    {
      bounds: { minX: -3.6, maxX: -2.8, minZ: NTK_PA_BOOTH_MIN_Z + 1.4, maxZ: NTK_PA_BOOTH_MIN_Z + 2.0 },
      height: 0.48,
    },
    {
      bounds: { minX: -3.6, maxX: -2.8, minZ: NTK_PA_BOOTH_MIN_Z + 2.0, maxZ: NTK_PA_BOOTH_MIN_Z + 2.6 },
      height: 0.32,
    },
    {
      bounds: { minX: -3.6, maxX: -2.8, minZ: NTK_PA_BOOTH_MIN_Z + 2.6, maxZ: NTK_PA_BOOTH_MIN_Z + 3.2 },
      height: 0.16,
    },
  ],
  show: {
    performerLine: { y: 0.7, z: -7.7, spacing: 0.78 },
    audiencePoints: [
      [-2.8, 0, -4.5], [-1.4, 0, -4.4], [0, 0, -4.5], [1.4, 0, -4.4], [2.8, 0, -4.5],
      [-3.2, 0, -3.0], [-1.6, 0, -3.1], [0, 0, -2.9], [1.6, 0, -3.1], [3.2, 0, -3.0],
      [-2.5, 0, -1.5], [-0.8, 0, -1.6], [0.8, 0, -1.6], [2.5, 0, -1.5], [0, 0, 0],
    ],
    lightColors: [0x3f8cff, 0xff2f7d, 0x00e5ff, 0xffaa00],
  },
  youtubeVideoId: "M7lc1UVf-VE",
};


// ---------------------------------------------------------------------------
// Kowloon Bay (九龍灣): tall black-box hall with a two-storey backstage on the -X side.
// Audience faces -Z; +X is the audience's right. See docs/superpowers/specs/2026-09-11-kowloon-bay-venue-design.md
// ---------------------------------------------------------------------------
export const KB_MIN_X = -8.5; // Outer wall of the 4 m backstage block, which sits outside the hall's -X edge
export const KB_MAX_X = 6.5;
export const KB_BACK_WALL_Z = -11.0; // Inner face of the back wall; the stage sits against it
export const KB_REAR_WALL_Z = 4.0; // Inner face of the rear (audience) wall
export const KB_HALL_CEILING = 7.6; // Very tall ceiling
export const KB_STAGE_HEIGHT = 1.5; // Tall stage, about three-quarters of a door
export const KB_STAGE_FRONT_Z = -8.0;
export const KB_WALKWAY_HEIGHT = 1.3; // Stacked lighting-truss walkway in front of the stage, one step below the deck
export const KB_WALKWAY_FRONT_Z = -7.4;
export const KB_WALKWAY_STEPS = 6; // Treads at each end of the walkway (1.3 / 6 ≈ 0.217 per step)
export const KB_PARTITION_X = -4.5; // Curtain wall between the hall and the backstage corridor
export const KB_BACKSTAGE_GAP = { minZ: -0.2, maxZ: 1.0 } as const; // Curtain gap into backstage, just stage-ward of the vestibule
export const KB_DECK_HEIGHT = 3.5; // 2/F floor level; leaves 2 m of headroom over the stage-height landing
// Stage-end landing at stage height: corridor floor -> lower stair -> landing -> stage wing, and the upper stair to 2/F
export const KB_LANDING = { minX: KB_MIN_X, maxX: KB_PARTITION_X, minZ: KB_BACK_WALL_Z, maxZ: -9.0 } as const;
// Rises toward -Z; kept clear of the vanity tables (x < -7.9) and dressing booths (x > -5.75)
export const KB_LOWER_STAIR = { minX: -7.7, maxX: -6.1, topZ: KB_LANDING.maxZ, tread: 0.26, rise: KB_STAGE_HEIGHT / 7, steps: 7 } as const;
// Rises toward -X along the back wall, from the landing up to the deck
export const KB_UPPER_STAIR = { minZ: KB_BACK_WALL_Z, maxZ: -10.0, startX: -5.5, tread: 0.28, rise: (KB_DECK_HEIGHT - KB_STAGE_HEIGHT) / 10, steps: 10 } as const;
export const KB_DECK_MIN_Z = KB_UPPER_STAIR.maxZ; // The deck starts where the stairwell ends
/** Opening in the 2/F stairwell rail, wide enough to step off the top treads. */
export const KB_DECK_RAIL_GAP = { minX: KB_MIN_X, maxX: -7.15 } as const;
export const KB_DECK_RAIL = {
  minX: KB_DECK_RAIL_GAP.maxX,
  maxX: KB_PARTITION_X,
  minZ: KB_DECK_MIN_Z - 0.05,
  maxZ: KB_DECK_MIN_Z + 0.05,
  minY: KB_DECK_HEIGHT,
  maxY: KB_DECK_HEIGHT + 1.15,
} as const;
export const KB_VESTIBULE = { minX: KB_MIN_X, maxX: -1.5, minZ: 1.2, maxZ: 4.0 } as const; // Entrance + glass room, pushed into the hall so the stage-facing glass is ~3 m wide
/** Clear aisle between the vestibule doorway wall and the PA desk: 1.5 player widths (2 × 0.34 radius × 1.5). */
export const KB_PA_DOOR_GAP = 1.02;
export const KB_PA_CX = KB_VESTIBULE.maxX + 0.1 + KB_PA_DOOR_GAP + 2.0; // 4 m desk centre, stage-left of the glass room, clear of its doorway
export const KB_PA_DESK_Z = 2.7; // Desk centre; leaves a 0.9 m operator aisle between the desk and the rear wall
/** FOH operator chairs behind the PA desk (one per machine); the player can sit on them facing the stage. */
export const KB_FOH_CHAIRS = [
  { x: KB_PA_CX - 0.8, z: 3.6 }, // Behind the sound mixer
  { x: KB_PA_CX + 0.9, z: 3.6 }, // Behind the lighting console
] as const;
const kbFohSeats: ElevatedPlatform[] = KB_FOH_CHAIRS.map((chair) => ({
  bounds: { minX: chair.x - 0.35, maxX: chair.x + 0.35, minZ: chair.z - 0.3, maxZ: chair.z + 0.35 },
  height: 0,
  seat: true,
  sitYaw: 0,
}));
export const KB_DOORWAY = { minZ: 1.6, maxZ: 2.8 } as const; // Vestibule doorway on its +X face, opening into the rear of the hall
export const KB_WC_BLOCK = { minX: 4.5, maxX: 6.5, minZ: -11.0, maxZ: -7.6 } as const; // WC room beside the stage (+X)

// 1/F backstage: four vanity tables along the -X wall, two dressing booths against the partition
export const KB_VANITY_TABLES = [
  { minX: KB_MIN_X, maxX: KB_MIN_X + 0.58, minZ: -7.05, maxZ: -6.05, maxY: 0.9 },
  { minX: KB_MIN_X, maxX: KB_MIN_X + 0.58, minZ: -5.75, maxZ: -4.75, maxY: 0.9 },
  { minX: KB_MIN_X, maxX: KB_MIN_X + 0.58, minZ: -4.45, maxZ: -3.45, maxY: 0.9 },
  { minX: KB_MIN_X, maxX: KB_MIN_X + 0.58, minZ: -3.15, maxZ: -2.15, maxY: 0.9 },
] as const;
export const KB_DRESSING_ROOMS = [
  { minX: -5.75, maxX: -4.62, minZ: -7.15, maxZ: -5.8 },
  { minX: -5.75, maxX: -4.62, minZ: -5.65, maxZ: -4.3 },
] as const;
const kbDressingWalls: Aabb2[] = KB_DRESSING_ROOMS.flatMap((room) => {
  const t = 0.08;
  return [
    { minX: room.maxX - t, maxX: room.maxX, minZ: room.minZ, maxZ: room.maxZ, maxY: KB_DECK_HEIGHT },
    { minX: room.minX, maxX: room.maxX, minZ: room.minZ, maxZ: room.minZ + t, maxY: KB_DECK_HEIGHT },
    { minX: room.minX, maxX: room.maxX, minZ: room.maxZ - t, maxZ: room.maxZ, maxY: KB_DECK_HEIGHT },
  ];
});

// 2/F corridor lounge: L-sofa in the -X / glass-room corner, wall TV on the partition
export const KB_LOUNGE_BACK_LONG = { minX: -8.35, maxX: -8.08, minZ: -2.4, maxZ: 0.55, minY: KB_DECK_HEIGHT, maxY: KB_DECK_HEIGHT + 0.85 };
export const KB_LOUNGE_BACK_SHORT = { minX: -8.35, maxX: -6.35, minZ: 0.92, maxZ: 1.14, minY: KB_DECK_HEIGHT, maxY: KB_DECK_HEIGHT + 0.85 };
export const KB_LOUNGE_SEAT_LONG = { minX: -8.08, maxX: -7.22, minZ: -2.3, maxZ: 0.5 } as const;
export const KB_LOUNGE_SEAT_SHORT = { minX: -8.08, maxX: -6.45, minZ: 0.52, maxZ: 0.92 } as const;
export const KB_LOUNGE_SOFA = { minX: -8.35, maxX: -6.35, minZ: -2.4, maxZ: 1.14 };
/** Glass-room sofa against the rear wall, facing the stage. Sit zone is the cushion; collider is the backrest. */
export const KB_GLASS_SOFA = { minX: -7.3, maxX: -4.9, minZ: 3.12, maxZ: 3.88, minY: KB_DECK_HEIGHT, maxY: KB_DECK_HEIGHT + 0.8 };
export const KB_GLASS_SOFA_SEAT = { minX: -7.3, maxX: -4.9, minZ: 3.05, maxZ: 3.62 } as const;
export const KB_LOUNGE_TV = { minX: -4.68, maxX: -4.54, minZ: -1.2, maxZ: 0.55, minY: KB_DECK_HEIGHT + 0.88, maxY: KB_DECK_HEIGHT + 1.82 };
export const KB_LOUNGE_CONSOLE = { minX: -5.0, maxX: -4.58, minZ: -0.7, maxZ: 0.25, minY: KB_DECK_HEIGHT, maxY: KB_DECK_HEIGHT + 0.4 };
export const KB_CLAW_MACHINES = [
  { minX: -8.25, maxX: -7.3, minZ: -9.15, maxZ: -8.25, minY: KB_DECK_HEIGHT },
  { minX: -8.25, maxX: -7.3, minZ: -8.19, maxZ: -7.29, minY: KB_DECK_HEIGHT },
] as const;
export const KB_STARLIGHT = { minX: -8.3, maxX: -7.4, minZ: -7.23, maxZ: -6.53, minY: KB_DECK_HEIGHT };
export const KB_MAIMAI = { minX: -8.4, maxX: -7.05, minZ: -6.47, maxZ: -4.72, minY: KB_DECK_HEIGHT };
export const KB_ARCADE_FRIDGE = { minX: -8.28, maxX: -7.48, minZ: -4.66, maxZ: -3.86, minY: KB_DECK_HEIGHT };
export const KB_SNACK_CABINET = { minX: -8.28, maxX: -7.58, minZ: -3.8, maxZ: -3.05, minY: KB_DECK_HEIGHT };

const kbStageBounds: Aabb2 = { minX: -4.5, maxX: 4.5, minZ: KB_BACK_WALL_Z, maxZ: KB_STAGE_FRONT_Z };
const kbWalkwayBounds: Aabb2 = { minX: -3.5, maxX: 3.5, minZ: KB_STAGE_FRONT_Z, maxZ: KB_WALKWAY_FRONT_Z };
const kbWalkway: Aabb2 & { maxY: number } = { ...kbWalkwayBounds, maxY: KB_WALKWAY_HEIGHT };

// Stair heights are exact at the top so a player can step off onto the platform they serve
const treadHeight = (rise: number, i: number, steps: number, top: number) => (i === steps - 1 ? top : rise * (i + 1));
// A climber's circle (r 0.34) already overlaps a collider while stepping onto the tread that abuts it, so a
// height-capped collider must let through the height they step from: the tread `treadsWithinRadius` further back.
const PLAYER_RADIUS = 0.34;
const treadsWithinRadius = (depth: number) => Math.ceil(PLAYER_RADIUS / depth - 0.5);
const capBelow = (treads: ElevatedPlatform[], lastIdxBeforeCollider: number, depth: number) =>
  treads[lastIdxBeforeCollider - treadsWithinRadius(depth)].height - 0.01;

// Six 0.3 m treads at each end of the walkway, rising toward the stage (-Z) and ending at the stage front
const kbWalkwayStairs: ElevatedPlatform[] = [-1, 1].flatMap((side) =>
  Array.from({ length: KB_WALKWAY_STEPS }, (_, i) => ({
    bounds: {
      minX: side < 0 ? -4.4 : 3.5,
      maxX: side < 0 ? -3.5 : 4.4,
      minZ: KB_STAGE_FRONT_Z + 0.3 * (KB_WALKWAY_STEPS - 1 - i),
      maxZ: KB_STAGE_FRONT_Z + 0.3 * (KB_WALKWAY_STEPS - i),
    },
    height: treadHeight(KB_WALKWAY_HEIGHT / KB_WALKWAY_STEPS, i, KB_WALKWAY_STEPS, KB_WALKWAY_HEIGHT),
  })),
);
// Capped so climbers on the end stairs and the walkway pass while floor players are stopped
const kbStageCollider: Aabb2 = { ...kbStageBounds, maxY: capBelow(kbWalkwayStairs, KB_WALKWAY_STEPS - 1, 0.3) };

// Backstage corridor floor -> landing: seven treads rising toward -Z
const kbLowerStairs: ElevatedPlatform[] = Array.from({ length: KB_LOWER_STAIR.steps }, (_, i) => ({
  bounds: {
    minX: KB_LOWER_STAIR.minX,
    maxX: KB_LOWER_STAIR.maxX,
    minZ: KB_LOWER_STAIR.topZ + KB_LOWER_STAIR.tread * (KB_LOWER_STAIR.steps - 1 - i),
    maxZ: KB_LOWER_STAIR.topZ + KB_LOWER_STAIR.tread * (KB_LOWER_STAIR.steps - i),
  },
  height: treadHeight(KB_LOWER_STAIR.rise, i, KB_LOWER_STAIR.steps, KB_STAGE_HEIGHT),
}));
// Platforms above the 1.2 overhead clearance read as ceilings, so the landing and the tall top treads of the
// lower stair need colliders to stop corridor-floor players walking into them; capped so climbers still pass
const kbLandingCollider: Aabb2 = { ...KB_LANDING, maxY: capBelow(kbLowerStairs, KB_LOWER_STAIR.steps - 1, KB_LOWER_STAIR.tread) };
const kbFirstTallTread = kbLowerStairs.findIndex((t) => t.height > 1.2);
const kbLowerStairCollider: Aabb2 = {
  minX: KB_LOWER_STAIR.minX,
  maxX: KB_LOWER_STAIR.maxX,
  minZ: KB_LANDING.maxZ,
  maxZ: kbLowerStairs[kbFirstTallTread].bounds.maxZ,
  maxY: capBelow(kbLowerStairs, kbFirstTallTread - 1, KB_LOWER_STAIR.tread),
};

// Landing -> 2/F: ten 0.2 m treads rising toward -X along the back wall, ending flush with the deck
const kbUpperStairs: ElevatedPlatform[] = Array.from({ length: KB_UPPER_STAIR.steps }, (_, i) => ({
  bounds: {
    minX: KB_UPPER_STAIR.startX - KB_UPPER_STAIR.tread * (i + 1),
    maxX: KB_UPPER_STAIR.startX - KB_UPPER_STAIR.tread * i,
    minZ: KB_UPPER_STAIR.minZ,
    maxZ: KB_UPPER_STAIR.maxZ,
  },
  height: treadHeight(KB_UPPER_STAIR.rise, i, KB_UPPER_STAIR.steps, KB_DECK_HEIGHT - KB_STAGE_HEIGHT) + KB_STAGE_HEIGHT,
}));

const KB_TELEPORTS: readonly TeleportSpot[] = [
  { id: "stage", label: "台上", x: 0, y: KB_STAGE_HEIGHT, z: -8.55, yaw: Math.PI },
  { id: "audience", label: "觀眾", x: 0, y: 0, z: -4.5, yaw: 0 },
  // Land on the operator chairs so the idle sit pose kicks in straight away
  { id: "sound-mixer", label: "音控", x: KB_FOH_CHAIRS[0].x, y: 0, z: KB_FOH_CHAIRS[0].z, yaw: 0 },
  { id: "lighting", label: "燈光控制", x: KB_FOH_CHAIRS[1].x, y: 0, z: KB_FOH_CHAIRS[1].z, yaw: 0 },
  { id: "fridge", label: "雪櫃飲品", x: 5.2, y: 0, z: 2.0, yaw: 0 },
  { id: "glass-deck", label: "2/F 玻璃望台", x: -3.0, y: KB_DECK_HEIGHT, z: 1.65, yaw: 0 },
  { id: "backstage", label: "1/F Backstage", x: -6.5, y: 0, z: -3.6, yaw: -Math.PI / 2 },
];

export const KOWLOON_BAY_VENUE: VenueDefinition = {
  id: "kowloon-bay-live-house-01",
  name: "九龍灣",
  scene: { kind: "procedural", builderId: "kowloon-bay" },
  // Spawn inside the entrance vestibule facing the doorway (+X)
  spawn: { x: -4.6, y: 0, z: 2.2, yaw: -Math.PI / 2 },
  teleports: KB_TELEPORTS,
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
    kbLandingCollider,
    kbLowerStairCollider,
    // Stage wing: the landing opens onto the stage on 1/F, but the 2/F deck is walled off above it
    { minX: KB_PARTITION_X - 0.1, maxX: KB_PARTITION_X + 0.1, minZ: KB_BACK_WALL_Z, maxZ: KB_STAGE_FRONT_Z, minY: KB_DECK_HEIGHT },
    // Backstage curtain partition, floor to ceiling, with the idol gap on 1/F only (the 2/F wall over the gap has minY)
    { minX: KB_PARTITION_X - 0.1, maxX: KB_PARTITION_X + 0.1, minZ: KB_STAGE_FRONT_Z, maxZ: KB_BACKSTAGE_GAP.minZ },
    { minX: KB_PARTITION_X - 0.1, maxX: KB_PARTITION_X + 0.1, minZ: KB_BACKSTAGE_GAP.minZ, maxZ: KB_BACKSTAGE_GAP.maxZ, minY: KB_DECK_HEIGHT },
    { minX: KB_PARTITION_X - 0.1, maxX: KB_PARTITION_X + 0.1, minZ: KB_BACKSTAGE_GAP.maxZ, maxZ: KB_VESTIBULE.minZ + 0.1 },
    // Vestibule -Z face: corridor side is a 1/F wall only (the deck corridor opens into the glass room above it);
    // hall side carries the glass room's stage-facing glazing, so it is full height
    { minX: KB_VESTIBULE.minX, maxX: KB_PARTITION_X, minZ: KB_VESTIBULE.minZ - 0.1, maxZ: KB_VESTIBULE.minZ + 0.1, maxY: KB_DECK_HEIGHT },
    { minX: KB_PARTITION_X, maxX: KB_VESTIBULE.maxX, minZ: KB_VESTIBULE.minZ - 0.1, maxZ: KB_VESTIBULE.minZ + 0.1 },
    // Vestibule +X face: 1/F doorway into the hall, glass room glazing above it
    { minX: KB_VESTIBULE.maxX - 0.1, maxX: KB_VESTIBULE.maxX + 0.1, minZ: KB_VESTIBULE.minZ, maxZ: KB_DOORWAY.minZ },
    { minX: KB_VESTIBULE.maxX - 0.1, maxX: KB_VESTIBULE.maxX + 0.1, minZ: KB_DOORWAY.minZ, maxZ: KB_DOORWAY.maxZ, minY: KB_DECK_HEIGHT },
    { minX: KB_VESTIBULE.maxX - 0.1, maxX: KB_VESTIBULE.maxX + 0.1, minZ: KB_DOORWAY.maxZ, maxZ: KB_VESTIBULE.maxZ },
    { minX: KB_MIN_X + 0.1, maxX: KB_MIN_X + 1.3, minZ: 2.0, maxZ: 3.8, maxY: 1.0 }, // Folding chairs stacked in the vestibule
    ...KB_VANITY_TABLES,
    ...kbDressingWalls,
    KB_DECK_RAIL,
    KB_LOUNGE_BACK_LONG,
    KB_LOUNGE_BACK_SHORT,
    KB_LOUNGE_TV,
    KB_LOUNGE_CONSOLE,
    { minX: KB_GLASS_SOFA.minX, maxX: KB_GLASS_SOFA.maxX, minZ: 3.62, maxZ: KB_GLASS_SOFA.maxZ, minY: KB_DECK_HEIGHT, maxY: KB_GLASS_SOFA.maxY },
    ...KB_CLAW_MACHINES,
    KB_STARLIGHT,
    KB_MAIMAI,
    KB_ARCADE_FRIDGE,
    KB_SNACK_CABINET,
    // +X side props
    { minX: 5.88, maxX: 6.48, minZ: -7.35, maxZ: -6.58, maxY: 1.15 }, // 240L wheelie bin beside the WC door
    { minX: 5.5, maxX: 6.3, minZ: -6.4, maxZ: -5.6, maxY: 1.6 }, // Black throne chair
    { minX: 5.7, maxX: 6.4, minZ: -5.2, maxZ: -4.4, maxY: 2.0 }, // Aluminium ladder with plushie net
    { minX: 5.6, maxX: 6.4, minZ: 3.1, maxZ: 3.9 }, // Coca-Cola fridge in the rear corner
    { minX: 4.3, maxX: 6.1, minZ: 2.4, maxZ: 3.0, maxY: 0.8 }, // Long white folding table in front of the fridge
    // Rear wall, stage-left of the glass room: PA desk with black barrier boards along its front and +X end.
    // The front board stops short of the -X end so the operator walks in from the doorway aisle.
    { minX: KB_PA_CX - 2.0, maxX: KB_PA_CX + 2.0, minZ: KB_PA_DESK_Z - 0.4, maxZ: KB_PA_DESK_Z + 0.4, maxY: 1.2 },
    { minX: KB_PA_CX - 1.6, maxX: KB_PA_CX + 2.4, minZ: KB_PA_DESK_Z - 0.6, maxZ: KB_PA_DESK_Z - 0.5, maxY: 1.1 },
    { minX: KB_PA_CX + 2.3, maxX: KB_PA_CX + 2.4, minZ: KB_PA_DESK_Z - 0.6, maxZ: KB_REAR_WALL_Z, maxY: 1.1 },
  ],
  crowdBarrier: kbWalkway,
  platforms: [
    { bounds: kbStageBounds, height: KB_STAGE_HEIGHT },
    { bounds: kbWalkwayBounds, height: KB_WALKWAY_HEIGHT },
    ...kbWalkwayStairs,
    // Backstage: stage-height landing beside the stage wing, reached by the lower stair; the upper stair climbs from it
    { bounds: { ...KB_LANDING }, height: KB_STAGE_HEIGHT },
    ...kbLowerStairs,
    ...kbUpperStairs,
    // 2/F: corridor deck (stairwell left open at z < KB_DECK_MIN_Z) and the glass room over the vestibule
    { bounds: { minX: KB_MIN_X, maxX: KB_PARTITION_X, minZ: KB_DECK_MIN_Z, maxZ: KB_VESTIBULE.minZ }, height: KB_DECK_HEIGHT },
    { bounds: { ...KB_VESTIBULE }, height: KB_DECK_HEIGHT },
    { bounds: { ...KB_GLASS_SOFA_SEAT }, height: KB_DECK_HEIGHT, seat: true, sitYaw: 0 },
    { bounds: { ...KB_LOUNGE_SEAT_LONG }, height: KB_DECK_HEIGHT, seat: true, sitYaw: -Math.PI / 2 },
    { bounds: { ...KB_LOUNGE_SEAT_SHORT }, height: KB_DECK_HEIGHT, seat: true, sitYaw: 0 },
    ...kbFohSeats,
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
