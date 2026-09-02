const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const allowedHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export function parseYouTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (videoIdPattern.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (!allowedHosts.has(url.hostname.toLowerCase())) return null;

  let candidate: string | null = null;
  if (url.hostname.toLowerCase() === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (url.pathname === "/watch") {
    candidate = url.searchParams.get("v");
  } else {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "shorts" || segments[0] === "live") {
      candidate = segments[1] ?? null;
    }
  }

  return candidate && videoIdPattern.test(candidate) ? candidate : null;
}
