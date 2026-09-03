import type { Aabb2 } from "../core/collision";

export type Point3Tuple = readonly [x: number, y: number, z: number];

export interface ElevatedPlatform {
  bounds: Aabb2;
  height: number;
}

export interface VenueDefinition {
  id: string;
  name: string;
  scene:
    | { kind: "procedural"; builderId: "neon-backstage" }
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
    performerPoints: readonly Point3Tuple[];
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
    performerPoints: [
      [-4, 0.75, -12],
      [-2, 0.75, -12],
      [0, 0.75, -12],
      [2, 0.75, -12],
      [4, 0.75, -12],
    ],
    audiencePoints: [
      [-3.6, 0, -7.6], [-1.8, 0, -7.4], [0, 0, -7.6], [1.8, 0, -7.4], [3.6, 0, -7.6],
      [-3.9, 0, -5.5], [-2.1, 0, -5.3], [-0.4, 0, -5.7], [1.4, 0, -5.3], [3.4, 0, -5.6],
      [-3.3, 0, -3.3], [-1.4, 0, -3.4], [0.5, 0, -3.2], [2.4, 0, -3.5], [4, 0, -3.2],
    ],
    lightColors: [0xff2f7d, 0x7147d9, 0x3f8cff, 0xd6ff3f],
  },
  youtubeVideoId: "M7lc1UVf-VE",
};
