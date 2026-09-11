import type { ElevatedPlatform, VenueDefinition } from "../config/venue";

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

function matchingSeat(
  venue: Pick<VenueDefinition, "platforms">,
  x: number,
  z: number,
  fromY: number,
): ElevatedPlatform | undefined {
  return venue.platforms.find((platform) => {
    if (!platform.seat) return false;
    const { bounds } = platform;
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return false;
    return Math.abs(platform.height - fromY) <= 0.25;
  });
}

/** True when the player is standing on a marked sofa/bench seat at their current floor. */
export function isOnSeat(
  venue: Pick<VenueDefinition, "platforms">,
  x: number,
  z: number,
  fromY: number,
): boolean {
  return matchingSeat(venue, x, z, fromY) !== undefined;
}

/** Sit facing so the player's back rests against the sofa. */
export function seatFacingAt(
  venue: Pick<VenueDefinition, "platforms">,
  x: number,
  z: number,
  fromY: number,
): number | undefined {
  return matchingSeat(venue, x, z, fromY)?.sitYaw;
}
