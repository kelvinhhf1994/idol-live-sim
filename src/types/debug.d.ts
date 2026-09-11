import type { AppSnapshot } from "../app/App";
import type { VenueDefinition } from "../config/venue";

declare global {
  interface Window {
    __liveHouseDebug?: {
      snapshot: () => AppSnapshot;
      triggerAudienceKnockback: (mode: "mosh" | "lift") => boolean;
      triggerPerformerKnockback: (mode: "mosh" | "lift") => boolean;
      placePlayer: (x: number, z: number, y?: number) => void;
      setTwoStepPhase: (progress: number) => void;
      setMoshPhase: (progress: number) => void;
      setCameraYaw: (yaw: number) => void;
      setCameraView: (yaw: number, pitch: number) => void;
      setIdolCount: (count: number) => void;
      loadVenue: (venueDef: VenueDefinition) => void;
    };
  }
}

export {};
