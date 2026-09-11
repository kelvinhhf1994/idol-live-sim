import { parseDanceClip, type DanceClip } from "../animation/capturedDance";
import type { SongDefinition } from "./songCatalog";

export interface SongPlayerState {
  songId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  clip: DanceClip | null;
}

export class SongPlayer {
  private song: SongDefinition | null = null;
  private clip: DanceClip | null = null;
  private loadToken = 0;

  constructor(private readonly audio: HTMLAudioElement = new Audio()) {}

  getState(): SongPlayerState {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    return {
      songId: this.song?.id ?? null,
      playing: Boolean(this.song) && !this.audio.paused,
      currentTime: this.song ? this.audio.currentTime : 0,
      duration: this.song ? duration : 0,
      clip: this.clip,
    };
  }

  async select(song: SongDefinition): Promise<void> {
    const token = ++this.loadToken;
    this.song = song;
    this.clip = null;
    this.audio.pause();
    this.audio.src = song.audioSrc;
    this.audio.loop = song.loop;
    this.audio.currentTime = 0;
    this.audio.load?.();

    const motionPromise = this.loadMotion(song.motionSrc, token);
    await this.play();
    if (token !== this.loadToken) return;
    await motionPromise;
  }

  async play(): Promise<void> {
    if (!this.song) return;
    try {
      await this.audio.play();
    } catch {
      // Autoplay may be blocked outside a user gesture; keep selection.
    }
  }

  pause(): void {
    this.audio.pause();
  }

  /** Clears the selection so the stage returns to procedural dance. */
  stop(): void {
    this.loadToken += 1;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.song = null;
    this.clip = null;
  }

  togglePlayback(): Promise<void> {
    if (!this.song) return Promise.resolve();
    if (this.audio.paused) return this.play();
    this.pause();
    return Promise.resolve();
  }

  dispose(): void {
    this.stop();
    this.audio.removeAttribute("src");
    this.audio.load();
  }

  private async loadMotion(url: string, token: number): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const raw: unknown = await response.json();
      if (token !== this.loadToken) return;
      this.clip = parseDanceClip(raw);
    } catch {
      // Missing or invalid motion: audio may still play with procedural dance.
    }
  }
}
