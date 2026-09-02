import type { AppSnapshot } from "../app/App";

declare global {
  interface Window {
    __liveHouseDebug?: {
      snapshot: () => AppSnapshot;
      triggerAudienceKnockback: (mode: "mosh" | "lift") => boolean;
    };
  }
}

export {};
