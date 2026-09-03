import { parseYouTubeVideoId } from "./youtubeUrl";
import {
  getNextVideoPanelState,
  getPlaybackPresentation,
  getSeekTarget,
  type VideoPanelState,
} from "./youtubeMiniPlayer";

export interface YouTubePlayerControls {
  toggleButton: HTMLButtonElement;
  minimizeButton: HTMLButtonElement;
  backwardButton: HTMLButtonElement;
  playbackButton: HTMLButtonElement;
  forwardButton: HTMLButtonElement;
  expandButton: HTMLButtonElement;
}

export class YouTubePlayer {
  private player: YT.Player | null = null;
  private loading: Promise<void> | null = null;
  private ready = false;
  private pendingVideoId: string | null = null;
  private panelState: VideoPanelState = "hidden";

  constructor(
    private readonly videoId: string,
    private readonly panel: HTMLElement,
    private readonly container: HTMLElement,
    private readonly status: HTMLElement,
    private readonly controls: YouTubePlayerControls,
  ) {
    controls.minimizeButton.addEventListener("click", this.handleMinimize);
    controls.backwardButton.addEventListener("click", this.handleSeekBackward);
    controls.playbackButton.addEventListener("click", this.handlePlaybackToggle);
    controls.forwardButton.addEventListener("click", this.handleSeekForward);
    controls.expandButton.addEventListener("click", this.handleExpand);
    this.applyPanelState();
    this.syncPlaybackControls(null);
  }

  open(): void {
    this.panelState = "expanded";
    this.applyPanelState();
    this.ensurePlayer();
  }

  toggle(): void {
    this.panelState = getNextVideoPanelState(this.panelState, "hud");
    this.applyPanelState();
    if (this.panelState === "expanded") this.ensurePlayer();
  }

  minimize(): void {
    this.panelState = getNextVideoPanelState(this.panelState, "minimize");
    this.applyPanelState();
  }

  private ensurePlayer(): void {
    if (this.player || this.loading) return;

    this.status.textContent = "正在連接 YouTube…";
    this.loading = loadYouTubeApi()
      .then(() => this.createPlayer())
      .catch(() => {
        this.status.textContent = "影片暫時無法播放，你仍可繼續探索場館。";
      })
      .finally(() => {
        this.loading = null;
      });
  }

  load(input: string): boolean {
    const videoId = parseYouTubeVideoId(input);
    if (!videoId) return false;

    this.pendingVideoId = videoId;
    this.status.textContent = "正在載入影片…";
    if (this.player && this.ready) {
      this.player.loadVideoById(videoId);
      this.pendingVideoId = null;
    }
    return true;
  }

  dispose(): void {
    this.controls.minimizeButton.removeEventListener("click", this.handleMinimize);
    this.controls.backwardButton.removeEventListener("click", this.handleSeekBackward);
    this.controls.playbackButton.removeEventListener("click", this.handlePlaybackToggle);
    this.controls.forwardButton.removeEventListener("click", this.handleSeekForward);
    this.controls.expandButton.removeEventListener("click", this.handleExpand);
    try {
      this.player?.pauseVideo();
    } catch {
      // The player may already be unavailable during page teardown.
    }
    this.player?.destroy();
    this.player = null;
    this.ready = false;
    delete document.documentElement.dataset.videoPanelState;
  }

  private createPlayer(): void {
    if (!window.YT) throw new Error("YouTube API is unavailable");

    this.player = new window.YT.Player(this.container, {
      videoId: this.videoId,
      playerVars: {
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          this.ready = true;
          if (this.pendingVideoId) {
            this.player?.loadVideoById(this.pendingVideoId);
            this.pendingVideoId = null;
          }
          this.status.textContent = "按播放器開始播放。舞台動畫與影片獨立運作。";
          this.syncPlaybackControls(this.readPlayerState());
        },
        onStateChange: (event) => this.syncPlaybackControls(event.data),
        onError: () => {
          this.status.textContent = "影片暫時無法播放，你仍可繼續探索場館。";
        },
      },
    });
  }

  private applyPanelState(): void {
    this.panel.hidden = this.panelState === "hidden";
    this.panel.dataset.state = this.panelState;
    this.panel.classList.toggle("is-minimized", this.panelState === "minimized");
    document.documentElement.dataset.videoPanelState = this.panelState;
    const toggleLabel =
      this.panelState === "expanded" ? "縮小現場影片" : this.panelState === "minimized" ? "展開現場影片" : "開啟現場影片";
    this.controls.toggleButton.setAttribute("aria-label", toggleLabel);
    this.controls.toggleButton.setAttribute(
      "aria-pressed",
      String(this.panelState !== "hidden"),
    );
  }

  private syncPlaybackControls(playerState: number | null): void {
    const presentation = getPlaybackPresentation(playerState);
    const button = this.controls.playbackButton;
    button.disabled = presentation.disabled;
    button.textContent = presentation.icon;
    button.setAttribute("aria-label", presentation.label);
    button.title = presentation.label;
    button.setAttribute("aria-pressed", String(presentation.pressed));
    button.dataset.state = presentation.state;
    this.controls.backwardButton.disabled = presentation.disabled;
    this.controls.forwardButton.disabled = presentation.disabled;
  }

  private readPlayerState(): number | null {
    if (!this.player || !this.ready) return null;
    try {
      return this.player.getPlayerState();
    } catch {
      return null;
    }
  }

  private seekBy(offset: number): void {
    if (!this.player || !this.ready) return;
    try {
      this.player.seekTo(getSeekTarget(this.player.getCurrentTime(), offset), true);
    } catch {
      // Live streams may not expose a seekable DVR window.
    }
  }

  private readonly handleMinimize = (): void => this.minimize();

  private readonly handleExpand = (): void => {
    this.panelState = getNextVideoPanelState(this.panelState, "expand");
    this.applyPanelState();
    if (this.panelState === "expanded") this.ensurePlayer();
  };

  private readonly handleSeekBackward = (): void => this.seekBy(-10);

  private readonly handleSeekForward = (): void => this.seekBy(10);

  private readonly handlePlaybackToggle = (): void => {
    if (!this.player || !this.ready) return;
    try {
      if (this.player.getPlayerState() === 1) this.player.pauseVideo();
      else this.player.playVideo();
    } catch {
      // Player commands can be rejected while a stream changes state.
    }
  };
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  document.getElementById("youtube-iframe-api")?.remove();
  const promise = new Promise<void>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      window.onYouTubeIframeAPIReady = previousReady;
      reject(new Error("YouTube API load timed out"));
    }, 12_000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previousReady?.();
      resolve();
    };

    script.id = "youtube-iframe-api";
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        script.remove();
        window.onYouTubeIframeAPIReady = previousReady;
        reject(new Error("YouTube API failed to load"));
      },
      { once: true },
    );
    document.head.append(script);
  }).catch((error: unknown) => {
    youtubeApiPromise = null;
    throw error;
  });

  youtubeApiPromise = promise;
  return promise;
}
