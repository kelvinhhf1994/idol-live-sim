import type { AppSnapshot } from "../app/App";

declare global {
  interface Window {
    __liveHouseDebug?: {
      snapshot: () => AppSnapshot;
      triggerAudienceKnockback: (mode: "mosh" | "lift") => boolean;
      triggerPerformerKnockback: (mode: "mosh" | "lift") => boolean;
      placePlayer: (x: number, z: number) => void;
      setTwoStepPhase: (progress: number) => void;
      setMoshPhase: (progress: number) => void;
      setCameraYaw: (yaw: number) => void;
      setCameraView: (yaw: number, pitch: number) => void;
    };
  }
}

export {};
