import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { getFaceTexture } from "./faceTexture";

describe("getFaceTexture", () => {
  it("returns a texture per iris colour", () => {
    expect(getFaceTexture(0x3f5c8c)).toBeInstanceOf(THREE.Texture);
    expect(getFaceTexture(0x8b5cf6)).not.toBe(getFaceTexture(0x3f5c8c));
  });

  it("caches by iris colour so repeated idols share one texture", () => {
    expect(getFaceTexture(0xd6ff3f)).toBe(getFaceTexture(0xd6ff3f));
  });

  it("caches chibi variants apart from the hero face", () => {
    const open = getFaceTexture(0xff397d, "chibi-open");
    const closed = getFaceTexture(0xff397d, "chibi-closed");

    expect(open).toBe(getFaceTexture(0xff397d, "chibi-open"));
    expect(open).not.toBe(closed);
    expect(open).not.toBe(getFaceTexture(0xff397d));
  });
});
