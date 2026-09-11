import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { KB_DECK_HEIGHT, KB_HALL_CEILING, KOWLOON_BAY_VENUE } from "../../config/venue";
import { createVenue } from "../createVenue";

function collectNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((child) => {
    if (child.name) names.push(child.name);
  });
  return names;
}

describe("createVenue for Kowloon Bay", () => {
  it("creates a VenueBuild with the hall shell, stage and truss walkway", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);

    expect(build.group.name).toBe("kowloon-bay-live-house-01");
    expect(build.colliders).toHaveLength(KOWLOON_BAY_VENUE.colliders.length);
    expect(build.audiencePoints).toHaveLength(15);
    expect(build.stageLights.length).toBeGreaterThanOrEqual(4);

    const names = collectNames(build.group);
    for (const expected of [
      "plank-floor",
      "ceiling",
      "curtain-back",
      "acoustic-wall",
      "air-con",
      "main-stage",
      "tape-mark",
      "truss-walkway",
      "walkway-plate",
      "wedge-monitor",
      "walkway-stairs-left",
      "walkway-stairs-right",
    ]) {
      expect(names, expected).toContain(expected);
    }
  });

  it("hangs the ceiling at the tall hall height", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const ceiling = build.group.getObjectByName("ceiling")!;
    expect(ceiling.position.y).toBeGreaterThanOrEqual(KB_HALL_CEILING);
    expect(KB_HALL_CEILING).toBeGreaterThan(KB_DECK_HEIGHT + 3);
  });

  it("builds the two-storey backstage: partition, both stairs, deck, vestibule and glass room", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = collectNames(build.group);
    for (const expected of [
      "backstage-partition",
      "backstage-gap-valance",
      "stage-stairs",
      "upper-stairs",
      "upper-deck",
      "deck-corridor",
      "deck-glass-room",
      "deck-rail",
      "entrance-vestibule",
      "entrance-doorway",
      "vestibule-light",
      "glass-room",
      "glass-pane",
      "glass-room-roof",
      "plushie-shelf",
      "plushie-boxes",
      "road-case",
    ]) {
      expect(names, expected).toContain(expected);
    }
  });

  it("puts the deck top at exactly the 2/F walking height", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    build.group.updateMatrixWorld(true);
    const corridor = build.group.getObjectByName("deck-corridor")!;
    const box = new THREE.Box3().setFromObject(corridor);
    expect(box.max.y).toBeCloseTo(KB_DECK_HEIGHT, 5);
    expect(box.max.x).toBeCloseTo(-4.5, 5);
    const panes = build.group.children.flatMap((c) =>
      c.name === "glass-room" ? c.children.filter((p) => p.name === "glass-pane") : [],
    );
    expect(panes.length).toBe(4);
  });

  it("rigs the tall ceiling with pipes, fluorescents, moving heads, PARs and line arrays", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = collectNames(build.group);
    for (const expected of ["pipe-grid", "fluorescent-tube", "moving-head", "par-can", "line-array", "light-beams"]) {
      expect(names, expected).toContain(expected);
    }
    expect(names.filter((n) => n === "moving-head").length).toBeGreaterThanOrEqual(10);
    expect(names.filter((n) => n === "fluorescent-tube").length).toBe(8);
  });

  it("defaults to house lights off and lights the fluorescent tubes when enabled", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const houseLights = build.houseLights!;
    const tube = build.group.getObjectByName("fluorescent-tube") as THREE.Mesh;
    const tubeMat = tube.material as THREE.MeshStandardMaterial;
    const beams = build.group.getObjectByName("light-beams")!;

    expect(houseLights.enabled).toBe(false);
    expect(tubeMat.emissiveIntensity).toBe(0);
    expect(beams.visible).toBe(true);

    houseLights.setEnabled(true);
    expect(tubeMat.emissiveIntensity).toBeGreaterThan(1);
    expect(beams.visible).toBe(false);

    houseLights.setEnabled(false);
    expect(tubeMat.emissiveIntensity).toBe(0);
  });

  it("dresses the hall with the props seen in the photos", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = collectNames(build.group);
    for (const expected of [
      "wc-door",
      "wall-clock",
      "bin",
      "throne-chair",
      "ladder",
      "fridge",
      "pa-desk",
      "pa-mixer",
      "sofa",
      "poster",
      "long-table",
      "ticket-table",
      "red-pony",
    ]) {
      expect(names, expected).toContain(expected);
    }
    const door = build.group.getObjectByName("wc-door")!;
    expect(door.position.z).toBeCloseTo(-7.5, 5);
    expect(door.rotation.y).toBeCloseTo(0, 5); // faces the audience (+Z)
  });

  it("exposes the crowd dummies and the red pony as knockable props", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = build.knockableProps.map((prop) => prop.name);
    expect(names.filter((name) => name === "crowd-dummy").length).toBeGreaterThan(8);
    expect(names).toContain("red-pony");
  });
});
