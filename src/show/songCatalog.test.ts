import { describe, expect, it } from "vitest";
import { SONG_CATALOG, getSongById } from "./songCatalog";

describe("songCatalog", () => {
  it("exposes a shared catalog array", () => {
    expect(Array.isArray(SONG_CATALOG)).toBe(true);
  });

  it("looks up songs by id", () => {
    if (SONG_CATALOG.length === 0) {
      expect(getSongById("missing")).toBeUndefined();
      return;
    }
    const first = SONG_CATALOG[0]!;
    expect(getSongById(first.id)).toEqual(first);
    expect(getSongById("definitely-missing")).toBeUndefined();
  });

  it("includes the iLiFE message cover with audio and captured motion", () => {
    const song = getSongById("ilife-message");
    expect(song).toEqual({
      id: "ilife-message",
      title: "メッセージ/iLiFE! 踊ってみた",
      audioSrc: "/songs/ilife-message.mp3",
      motionSrc: "/motions/ilife-message.animation.json",
      captureMode: "front-facing-2d",
      loop: false,
    });
  });
});
