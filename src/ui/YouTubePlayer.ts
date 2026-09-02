import { parseYouTubeVideoId } from "./youtubeUrl";

export class YouTubePlayer {
  private player: YT.Player | null = null;
  private loading: Promise<void> | null = null;
  private ready = false;
  private pendingVideoId: string | null = null;

  constructor(
    private readonly videoId: string,
    private readonly panel: HTMLElement,
    private readonly container: HTMLElement,
    private readonly status: HTMLElement,
  ) {}

  open(): void {
    this.panel.hidden = false;
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

  close(): void {
    this.player?.pauseVideo();
    this.panel.hidden = true;
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
    this.player?.destroy();
    this.player = null;
    this.ready = false;
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
        },
        onError: () => {
          this.status.textContent = "影片暫時無法播放，你仍可繼續探索場館。";
        },
      },
    });
  }
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
