import { afterEach, describe, expect, it, vi } from "vitest";
import type { DanceClip } from "../animation/capturedDance";
import { SongPlayer } from "./SongPlayer";
import type { SongDefinition } from "./songCatalog";

const tinyClip: DanceClip = {
  schemaVersion: 1,
  duration: 1,
  targetRig: "person-rig-chibi-idol",
  captureMode: "front-facing-2d",
  rootMotionMode: "in-place",
  timestamps: [0, 1],
  poses: [{ leftShoulderX: 0.2 }, { leftShoulderX: 1.2 }],
};

const songA: SongDefinition = {
  id: "demo-a",
  title: "Demo A",
  audioSrc: "/songs/demo-a.mp3",
  motionSrc: "/motions/demo-a.animation.json",
  captureMode: "front-facing-2d",
  loop: true,
};

const songB: SongDefinition = {
  id: "demo-b",
  title: "Demo B",
  audioSrc: "/songs/demo-b.mp3",
  motionSrc: "/motions/demo-b.animation.json",
  captureMode: "full-3d",
  loop: false,
};

class FakeAudio {
  src = "";
  loop = false;
  currentTime = 0;
  paused = true;
  duration = 12;
  playCalls = 0;
  pauseCalls = 0;

  play(): Promise<void> {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
  }

  load(): void {
    // no-op for tests
  }
}

function mockFetchClip(clip: DanceClip | null): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (clip && url.includes(".animation.json")) {
        return {
          ok: true,
          json: async () => clip,
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

describe("SongPlayer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts with no selection", () => {
    const audio = new FakeAudio();
    const player = new SongPlayer(audio as unknown as HTMLAudioElement);
    expect(player.getState()).toEqual({
      songId: null,
      playing: false,
      currentTime: 0,
      duration: 0,
      clip: null,
    });
  });

  it("selects a song, loads motion, and starts playing", async () => {
    mockFetchClip(tinyClip);
    const audio = new FakeAudio();
    const player = new SongPlayer(audio as unknown as HTMLAudioElement);

    await player.select(songA);

    expect(audio.src).toContain("/songs/demo-a.mp3");
    expect(audio.loop).toBe(true);
    expect(audio.playCalls).toBe(1);
    const state = player.getState();
    expect(state.songId).toBe("demo-a");
    expect(state.playing).toBe(true);
    expect(state.clip?.duration).toBe(1);
    expect(state.duration).toBe(12);
  });

  it("pauses and resumes the same song", async () => {
    mockFetchClip(tinyClip);
    const audio = new FakeAudio();
    const player = new SongPlayer(audio as unknown as HTMLAudioElement);
    await player.select(songA);

    player.pause();
    expect(player.getState().playing).toBe(false);
    expect(audio.pauseCalls).toBeGreaterThan(0);

    await player.play();
    expect(player.getState().playing).toBe(true);
    expect(audio.playCalls).toBe(2);
  });

  it("stop clears selection so the stage can return to procedural dance", async () => {
    mockFetchClip(tinyClip);
    const audio = new FakeAudio();
    const player = new SongPlayer(audio as unknown as HTMLAudioElement);
    await player.select(songA);

    player.stop();
    expect(player.getState()).toMatchObject({
      songId: null,
      playing: false,
      clip: null,
      currentTime: 0,
    });
    expect(audio.pauseCalls).toBeGreaterThan(0);
    expect(audio.currentTime).toBe(0);
  });

  it("still plays audio when motion fetch fails", async () => {
    mockFetchClip(null);
    const audio = new FakeAudio();
    const player = new SongPlayer(audio as unknown as HTMLAudioElement);

    await player.select(songB);

    expect(audio.playCalls).toBe(1);
    expect(audio.loop).toBe(false);
    expect(player.getState().songId).toBe("demo-b");
    expect(player.getState().playing).toBe(true);
    expect(player.getState().clip).toBeNull();
  });

  it("reports audio currentTime while selected", async () => {
    mockFetchClip(tinyClip);
    const audio = new FakeAudio();
    const player = new SongPlayer(audio as unknown as HTMLAudioElement);
    await player.select(songA);
    audio.currentTime = 3.5;
    expect(player.getState().currentTime).toBe(3.5);
  });
});
