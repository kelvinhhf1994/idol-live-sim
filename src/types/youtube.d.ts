declare namespace YT {
  interface PlayerOptions {
    videoId: string;
    playerVars?: {
      playsinline?: 0 | 1;
      rel?: 0 | 1;
    };
    events?: {
      onReady?: () => void;
      onError?: (event: { data: number }) => void;
      onStateChange?: (event: { data: number }) => void;
    };
  }

  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions);
    loadVideoById(videoId: string): void;
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getPlayerState(): number;
    destroy(): void;
  }

  const PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
