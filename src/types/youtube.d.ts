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
    };
  }

  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions);
    loadVideoById(videoId: string): void;
    pauseVideo(): void;
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
