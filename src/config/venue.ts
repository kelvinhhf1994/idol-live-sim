import type { Aabb2 } from "../core/collision";

export type Point3Tuple = readonly [x: number, y: number, z: number];

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
  show: {
    performerPoints: readonly Point3Tuple[];
    audiencePoints: readonly Point3Tuple[];
    lightColors: readonly number[];
  };
  youtubeVideoId: string;
}

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
    { minX: -4.5, maxX: 4.5, minZ: -14.95, maxZ: -10.25 },
    { minX: 5.75, maxX: 8.55, minZ: -5.3, maxZ: 2.5 },
    { minX: -8.48, maxX: -5.22, minZ: 1.9, maxZ: 4.1 },
    { minX: -9, maxX: -8.2, minZ: -9.87, maxZ: -9.63 },
    { minX: -6.8, maxX: -5.6, minZ: -9.87, maxZ: -9.63 },
    { minX: -5.74, maxX: -5.5, minZ: -14.2, maxZ: -9.8 },
  ],
  show: {
    performerPoints: [
      [-3.2, 0.75, -12.2],
      [-1.6, 0.75, -12.2],
      [0, 0.75, -12.2],
      [1.6, 0.75, -12.2],
      [3.2, 0.75, -12.2],
    ],
    audiencePoints: [
      [-3.6, 0, -8.8], [-1.8, 0, -8.6], [0, 0, -8.8], [1.8, 0, -8.6], [3.6, 0, -8.8],
      [-3.9, 0, -6.7], [-2.1, 0, -6.5], [-0.4, 0, -6.9], [1.4, 0, -6.5], [3.4, 0, -6.8],
      [-3.3, 0, -4.5], [-1.4, 0, -4.6], [0.5, 0, -4.4], [2.4, 0, -4.7], [4, 0, -4.4],
    ],
    lightColors: [0xff2f7d, 0x7147d9, 0x3f8cff, 0xd6ff3f],
  },
  youtubeVideoId: "M7lc1UVf-VE",
};
