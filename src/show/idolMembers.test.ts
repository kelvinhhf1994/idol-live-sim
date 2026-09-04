import { describe, expect, it } from "vitest";
import { IDOL_MEMBERS, MAX_IDOL_COUNT } from "./idolMembers";

describe("IDOL_MEMBERS", () => {
  it("fills the stage capacity", () => {
    expect(MAX_IDOL_COUNT).toBe(7);
    expect(IDOL_MEMBERS).toHaveLength(MAX_IDOL_COUNT);
  });

  it("gives every member a distinct silhouette and member colour", () => {
    const silhouettes = IDOL_MEMBERS.map((member) => `${member.hair}/${member.headpiece}`);
    const accents = IDOL_MEMBERS.map((member) => member.accent);

    expect(new Set(silhouettes).size).toBe(IDOL_MEMBERS.length);
    expect(new Set(accents).size).toBe(IDOL_MEMBERS.length);
  });
});
