import { describe, expect, it } from "vitest";
import { applyVenueTeleport, type TeleportSpot } from "./venueTeleport";

describe("applyVenueTeleport", () => {
  it("moves the player, faces the spot yaw, and snaps the camera", () => {
    const player = {
      liftOff: false,
      rideOff: false,
      pose: { x: 0, y: 0, z: 0, yaw: 1 },
      setLiftActive(active: boolean) {
        if (!active) this.liftOff = true;
      },
      setRideActive(active: boolean) {
        if (!active) this.rideOff = true;
      },
      teleportTo(x: number, y: number, z: number, yaw: number) {
        this.pose = { x, y, z, yaw };
      },
    };
    const camera = { yaw: 2 };
    const spot: TeleportSpot = {
      id: "stage",
      label: "台上",
      x: 0,
      y: 1.5,
      z: -8.55,
      yaw: Math.PI,
    };

    applyVenueTeleport(player, camera, spot);

    expect(player.liftOff).toBe(true);
    expect(player.rideOff).toBe(true);
    expect(player.pose).toEqual({ x: 0, y: 1.5, z: -8.55, yaw: Math.PI });
    expect(camera.yaw).toBe(Math.PI);
  });
});
