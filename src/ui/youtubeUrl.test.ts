import { describe, expect, it } from "vitest";
import { parseYouTubeVideoId } from "./youtubeUrl";

const videoId = "dQw4w9WgXcQ";

describe("parseYouTubeVideoId", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${videoId}&feature=share#details`, videoId],
    [`https://youtu.be/${videoId}?si=example#details`, videoId],
    [`https://youtube.com/shorts/${videoId}?feature=share`, videoId],
    [`https://m.youtube.com/live/${videoId}#chat`, videoId],
    [`https://music.youtube.com/watch?v=${videoId}`, videoId],
    [videoId, videoId],
  ])("extracts a video ID from %s", (input, expected) => {
    expect(parseYouTubeVideoId(input)).toBe(expected);
  });

  it.each([
    "",
    "not-video",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://evil-youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=too-short",
    "https://youtu.be/dQw4w9WgXcQextra",
    "https://youtube.com/embed/dQw4w9WgXcQ",
  ])("rejects invalid or unsupported input %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBeNull();
  });
});
