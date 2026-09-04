import type { Aabb2 } from "../core/collision";
import type { PerformerLine } from "../show/formation";

export type Point3Tuple = readonly [x: number, y: number, z: number];

export interface ElevatedPlatform {
  bounds: Aabb2;
  height: number;
}

export interface VenueDefinition {
  id: string;
  name: string;
  scene:
    | { kind: "procedural"; builderId: "neon-backstage" | "ngau-tau-kok" }
    | { kind: "gltf"; url: string };
  spawn: {
    x: number;
    y: number;
    z: number;
    yaw: number;
  };
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
    { minX: -8.48, maxX: -5.22, minZ: 1.9, maxZ: 4.1 },
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
  ],
  show: {
    performerLine: { y: 0.75, z: -12, spacing: 1.45 },
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
    { minX: -6.0, maxX: -4.0, minZ: NTK_PA_BOOTH_MIN_Z + 0.1, maxZ: NTK_PA_BOOTH_MIN_Z + 0.9, maxY: 1.6 }, // Control desk facing stage
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
      height: 0.48,
    },
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
    performerLine: { y: 0.7, z: -7.7, spacing: 1.15 },
    audiencePoints: [
      [-2.8, 0, -4.5], [-1.4, 0, -4.4], [0, 0, -4.5], [1.4, 0, -4.4], [2.8, 0, -4.5],
      [-3.2, 0, -3.0], [-1.6, 0, -3.1], [0, 0, -2.9], [1.6, 0, -3.1], [3.2, 0, -3.0],
      [-2.5, 0, -1.5], [-0.8, 0, -1.6], [0.8, 0, -1.6], [2.5, 0, -1.5], [0, 0, 0],
    ],
    lightColors: [0x3f8cff, 0xff2f7d, 0x00e5ff, 0xffaa00],
  },
  youtubeVideoId: "M7lc1UVf-VE",
};

