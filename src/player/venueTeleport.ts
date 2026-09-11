import type { TeleportSpot } from "../config/venue";

export type { TeleportSpot };

export function applyVenueTeleport(
  player: {
    setLiftActive: (active: boolean) => void;
    setRideActive: (active: boolean) => void;
    teleportTo: (x: number, y: number, z: number, yaw: number) => void;
  },
  camera: { yaw: number },
  spot: TeleportSpot,
): void {
  player.setLiftActive(false);
  player.setRideActive(false);
  player.teleportTo(spot.x, spot.y, spot.z, spot.yaw);
  camera.yaw = spot.yaw;
}
