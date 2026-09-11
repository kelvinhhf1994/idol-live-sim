import { describe, expect, it } from "vitest";
import { DEFAULT_IDOL_COUNT, IDOL_MEMBERS, MAX_IDOL_COUNT } from "./idolMembers";

describe("IDOL_MEMBERS", () => {
  it("fills the stage capacity with the twelve atlas personalities", () => {
    expect(MAX_IDOL_COUNT).toBe(12);
    expect(IDOL_MEMBERS).toHaveLength(MAX_IDOL_COUNT);
  });

  it("opens every venue with a five-idol V", () => {
    expect(DEFAULT_IDOL_COUNT).toBe(5);
    expect(DEFAULT_IDOL_COUNT).toBeLessThanOrEqual(MAX_IDOL_COUNT);
  });

  it("gives every member a distinct silhouette and wardrobe colour", () => {
    const silhouettes = IDOL_MEMBERS.map((member) => `${member.hairStyle}/${member.outfit}`);
    const mains = IDOL_MEMBERS.map((member) => member.main);

    expect(new Set(silhouettes).size).toBe(IDOL_MEMBERS.length);
    expect(new Set(mains).size).toBe(IDOL_MEMBERS.length);
  });
});
