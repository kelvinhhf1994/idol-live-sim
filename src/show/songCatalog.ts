import type { CaptureMode } from "../animation/capturedDance";

export type { CaptureMode };

export interface SongDefinition {
  id: string;
  title: string;
  audioSrc: string;
  motionSrc: string;
  captureMode: CaptureMode;
  loop: boolean;
  /** Optional BPM fallback when motion is missing (not used for captured playback). */
  bpm?: number;
}

/**
 * Global song list shared by every live house.
 *
 * To add a real track after you drop files in:
 * 1. Put audio under public/songs/<id>.(mp3|wav) — ignored by git except demo-loop.wav
 * 2. Run video-to-dance with --mode from captureMode → public/motions/<id>.animation.json
 * 3. Append a SongDefinition here (audioSrc, motionSrc, captureMode, loop)
 */
export const SONG_CATALOG: readonly SongDefinition[] = [
  {
    id: "ilife-message",
    title: "メッセージ/iLiFE! 踊ってみた",
    audioSrc: "/songs/ilife-message.mp3",
    motionSrc: "/motions/ilife-message.animation.json",
    captureMode: "front-facing-2d",
    loop: false,
  },
  {
    id: "brave-groove-21s",
    title: "BRAVE GROOVE 踊ってみた",
    audioSrc: "/songs/brave-groove-21s.mp3",
    motionSrc: "/motions/brave-groove-21s.animation.json",
    captureMode: "front-facing-2d",
    loop: false,
  },
  {
    id: "yukirinu-45s",
    title: "45秒 踊ってみた",
    audioSrc: "/songs/yukirinu-45s.mp3",
    motionSrc: "/motions/yukirinu-45s.animation.json",
    captureMode: "front-facing-2d",
    loop: false,
  },
  {
    id: "demo-loop",
    title: "Demo Loop",
    audioSrc: "/songs/demo-loop.wav",
    motionSrc: "/motions/demo-loop.animation.json",
    captureMode: "front-facing-2d",
    loop: true,
    bpm: 120,
  },
];

export function getSongById(id: string): SongDefinition | undefined {
  return SONG_CATALOG.find((song) => song.id === id);
}
