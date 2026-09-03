export type VideoPanelState = "hidden" | "expanded" | "minimized";
export type VideoPanelTrigger = "hud" | "minimize" | "expand";

export interface PlaybackPresentation {
  disabled: boolean;
  icon: "▶" | "❚❚";
  label: "播放影片" | "暫停影片";
  pressed: boolean;
  state: "playing" | "paused";
}

export function getNextVideoPanelState(
  state: VideoPanelState,
  trigger: VideoPanelTrigger,
): VideoPanelState {
  if (trigger === "minimize") return state === "expanded" ? "minimized" : state;
  if (trigger === "expand") return state === "minimized" ? "expanded" : state;
  return state === "expanded" ? "minimized" : "expanded";
}

export function getPlaybackPresentation(playerState: number | null): PlaybackPresentation {
  const playing = playerState === 1;
  return {
    disabled: playerState === null,
    icon: playing ? "❚❚" : "▶",
    label: playing ? "暫停影片" : "播放影片",
    pressed: playing,
    state: playing ? "playing" : "paused",
  };
}

export function getSeekTarget(currentTime: number, offset: number): number {
  return Math.max(0, currentTime + offset);
}
