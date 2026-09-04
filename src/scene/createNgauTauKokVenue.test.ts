import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { NGAU_TAU_KOK_VENUE, NTK_BACK_WALL_Z, NTK_ENTRANCE_Z, NTK_GLASS_Z } from "../config/venue";
import { createVenue } from "./createVenue";

function collectNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((child) => {
    if (child.name) names.push(child.name);
  });
  return names;
}

describe("createVenue for Ngau Tau Kok", () => {
  it("creates a valid VenueBuild object with meshes, colliders, and lights", () => {
    const build = createVenue(NGAU_TAU_KOK_VENUE);

    expect(build.group).toBeDefined();
    expect(build.group.name).toBe("ngau-tau-kok-hall-01");
    expect(build.colliders.length).toBeGreaterThan(5);
    expect(build.audiencePoints).toHaveLength(15);
    expect(build.stageLights.length).toBeGreaterThanOrEqual(4);

    const names = collectNames(build.group);
    for (const expected of [
      "wood-floor",
      "main-stage",
      "led-screen",
      "disco-ball",
      "box-truss",
      "moving-head",
      "line-arrays",
      "pa-console",
      "pa-platform",
      "pa-stair-1",
      "pa-stair-2",
      "pa-stair-3",
      "pa-red-gear",
      "pa-desk",
      "stairs-right",
      "crowd-barrier",
      "exit-door-stage-right",
      "entrance-lobby",
      "tuck-shop",
      "powerbank-kiosk",
      "tuck-fridge",
      "display-area",
      "tv-display",
      "merch-table",
      "idol-standee",
      "glass-shopfront",
      "mall-corridor",
      "carpet-runner",
      "queue-rope",
    ]) {
      expect(names, expected).toContain(expected);
    }
    // The old partitioned shops and the rear-left door are gone
    expect(names).not.toContain("merch-shop");
    expect(names).not.toContain("tuck-glass");
    expect(names).not.toContain("exit-door-left");
  });

  it("places the FOH / PA booth flush against the entrance wall at the back of the hall", () => {
    const build = createVenue(NGAU_TAU_KOK_VENUE);
    build.group.updateMatrixWorld(true);
    const platform = build.group.getObjectByName("pa-platform")!;
    const box = new THREE.Box3().setFromObject(platform);
    expect(box.max.z).toBeCloseTo(NTK_ENTRANCE_Z - 0.15, 5);
    expect(box.max.x).toBeLessThan(0);
  });

  it("puts the stage-right EXIT door on the back wall beside the stage", () => {
    const build = createVenue(NGAU_TAU_KOK_VENUE);
    const door = build.group.getObjectByName("exit-door-stage-right");
    expect(door).toBeDefined();
    const stage = NGAU_TAU_KOK_VENUE.platforms[0].bounds;
    expect(door!.position.z).toBeCloseTo(NTK_BACK_WALL_Z, 5);
    expect(door!.position.x).toBeGreaterThan(stage.maxX);
    expect(door!.position.x).toBeLessThan(NGAU_TAU_KOK_VENUE.bounds.maxX);
    expect(door!.rotation.y).toBeCloseTo(0, 5); // faces into the room (+Z)
  });

  it("builds the foyer as one open glass-fronted unit with tuck shop and display side by side", () => {
    const build = createVenue(NGAU_TAU_KOK_VENUE);
    const tuck = build.group.getObjectByName("tuck-shop")!;
    const display = build.group.getObjectByName("display-area")!;
    const glass = build.group.getObjectByName("glass-front") as THREE.Mesh;

    const tuckBox = new THREE.Box3().setFromObject(tuck);
    const displayBox = new THREE.Box3().setFromObject(display);
    // Tuck shop on the left (-X), display on the right (+X), both inside the foyer depth
    expect(tuckBox.max.x).toBeLessThan(0);
    expect(displayBox.min.x).toBeGreaterThan(0);
    expect(tuckBox.max.z).toBeLessThan(NTK_GLASS_Z);
    expect(displayBox.max.z).toBeLessThan(NTK_GLASS_Z);
    // Glass shopfront sits on the mall side of both
    expect(glass.position.z).toBeCloseTo(NTK_GLASS_Z, 5);
  });

  it("defaults to house lights off and toggles ceiling panels + ambient when enabled", () => {
    const build = createVenue(NGAU_TAU_KOK_VENUE);
    expect(build.houseLights).toBeDefined();
    const houseLights = build.houseLights!;
    const panel = build.group.getObjectByName("ceiling-panel") as THREE.Mesh;
    const panelMat = panel.material as THREE.MeshStandardMaterial;
    const ambient = build.group.getObjectByName("house-ambient") as THREE.AmbientLight;
    const beams = build.group.getObjectByName("light-beams")!;

    expect(houseLights.enabled).toBe(false);
    expect(panelMat.emissiveIntensity).toBe(0);
    expect(ambient.intensity).toBe(0);
    expect(beams.visible).toBe(true);

    houseLights.setEnabled(true);
    expect(houseLights.enabled).toBe(true);
    expect(panelMat.emissiveIntensity).toBeGreaterThan(1);
    expect(ambient.intensity).toBeGreaterThan(0.5);
    expect(beams.visible).toBe(false);

    houseLights.setEnabled(false);
    expect(panelMat.emissiveIntensity).toBe(0);
    expect(beams.visible).toBe(true);
  });

  it("exposes atmospheric crowd dummies, the idol standee, and tee mannequins as knockable props", () => {
    const build = createVenue(NGAU_TAU_KOK_VENUE);
    const names = build.knockableProps.map((prop) => prop.name);

    expect(names.filter((name) => name === "crowd-dummy").length).toBeGreaterThan(8);
    expect(names).toContain("idol-standee");
    expect(names.filter((name) => name === "tee-mannequin").length).toBe(2);
  });

  it("lets lift knock the idol standee without moving distant crowd dummies", async () => {
    const { ShowController } = await import("../show/ShowController");
    const build = createVenue(NGAU_TAU_KOK_VENUE);
    const standee = build.knockableProps.find((prop) => prop.name === "idol-standee")!;
    const crowd = build.knockableProps.find((prop) => prop.name === "crowd-dummy")!;
    const crowdHome = crowd.position.clone();
    const standeeHomeZ = standee.position.z;

    const show = new ShowController(
      NGAU_TAU_KOK_VENUE.show.performerLine,
      [],
      [],
      NGAU_TAU_KOK_VENUE,
      build.knockableProps,
    );
    show.update(0.016, 0.016, {
      mode: "lift",
      x: 6.5,
      y: 0,
      z: 14.3,
      movementX: 0,
      movementZ: 1,
      forwardX: 0,
      forwardZ: 1,
    });

    expect(show.getPropStatus().knockedPropCount).toBeGreaterThan(0);
    expect(standee.position.z).not.toBeCloseTo(standeeHomeZ);
    expect(crowd.position.z).toBeCloseTo(crowdHome.z);
  });

  it("does not expose house lights for the Neon Backstage venue", async () => {
    const { GENERIC_VENUE } = await import("../config/venue");
    const build = createVenue(GENERIC_VENUE);
    expect(build.houseLights).toBeUndefined();
  });
});
