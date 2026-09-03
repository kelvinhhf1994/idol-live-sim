import type { VenueDefinition } from "../config/venue";

export function groundHeightAt(
  venue: Pick<VenueDefinition, "platforms" | "spawn">,
  x: number,
  z: number,
): number {
  let height = venue.spawn.y;
  for (const platform of venue.platforms) {
    const { bounds } = platform;
    if (
      x >= bounds.minX &&
      x <= bounds.maxX &&
      z >= bounds.minZ &&
      z <= bounds.maxZ &&
      platform.height > height
    ) {
      height = platform.height;
    }
  }
  return height;
}
