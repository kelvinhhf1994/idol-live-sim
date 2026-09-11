import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { KB_BACK_WALL_Z, KB_DECK_HEIGHT, KB_HALL_CEILING, KB_MAIMAI, KB_PARTITION_X, KB_STAGE_FRONT_Z, KB_STAGE_HEIGHT, KB_STARLIGHT, KOWLOON_BAY_VENUE } from "../../config/venue";
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
      "led-screen",
      "led-frame",
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

  it("mounts a rectangular LED wall on the back wall behind the stage", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const led = build.group.getObjectByName("led-screen") as THREE.Mesh | undefined;
    expect(led).toBeDefined();
    const geom = led!.geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBeGreaterThan(geom.parameters.height);
    expect(led!.position.z).toBeGreaterThan(KB_BACK_WALL_Z);
    expect(led!.position.z).toBeLessThan(KB_STAGE_FRONT_Z);
    expect(led!.position.y).toBeGreaterThan(KB_STAGE_HEIGHT);
    const mat = led!.material as THREE.MeshStandardMaterial;
    expect(mat.emissiveIntensity).toBeGreaterThan(0);
    expect(mat.map).toBeTruthy();
  });

  it("hangs the ceiling at the tall hall height", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const ceiling = build.group.getObjectByName("ceiling")!;
    expect(ceiling.position.y).toBeGreaterThanOrEqual(KB_HALL_CEILING);
    expect(KB_HALL_CEILING).toBeGreaterThan(KB_DECK_HEIGHT + 3);
  });

  it("builds the two-storey backstage: partition, landing, both stairs, deck, vestibule, glass room and its own lights", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = collectNames(build.group);
    for (const expected of [
      "backstage-partition",
      "backstage-gap-valance",
      "backstage-landing",
      "lower-stairs",
      "upper-stairs",
      "upper-deck",
      "deck-corridor",
      "deck-glass-room",
      "deck-rail",
      "entrance-vestibule",
      "entrance-doorway",
      "backstage-lights",
      "backstage-tube",
      "backstage-light",
      "glass-room",
      "glass-pane",
      "glass-room-roof",
      "plushie-shelf",
      "plushie-boxes",
      "glass-sofa",
      "vanity-table",
      "dressing-room",
      "backstage-wall",
      "backstage-ceiling",
      "lounge-sofa",
      "lounge-tv",
      "lounge-tv-screen",
      "ps5",
      "starlight-cabinet",
      "maimai",
      "claw-machine",
      "arcade-fridge",
      "snack-cabinet",
    ]) {
      expect(names, expected).toContain(expected);
    }
    expect(names.filter((n) => n === "vanity-table")).toHaveLength(4);
    expect(names.filter((n) => n === "dressing-room")).toHaveLength(2);
    expect(names.filter((n) => n === "claw-machine")).toHaveLength(2);
    expect(names).not.toContain("road-case");
  });

  it("builds a white upright starlight cabinet with a tall screen and no title placard", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const cab = build.group.getObjectByName("starlight-cabinet")!;
    expect(cab).toBeDefined();
    let tallScreen = false;
    cab.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry) {
        const { width, height } = obj.geometry.parameters;
        if (height > width) tallScreen = true;
      }
    });
    expect(tallScreen).toBe(true);
    const labels: string[] = [];
    cab.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshBasicMaterial && obj.material.map) labels.push(obj.name);
    });
    expect(labels).toHaveLength(0);
    let buttons = 0;
    cab.traverse((obj) => {
      if (obj.name === "starlight-button") buttons += 1;
    });
    expect(buttons).toBe(6);
  });

  it("paints the backstage interiors white on both floors", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const wall = build.group.getObjectByName("backstage-wall") as THREE.Mesh;
    const ceiling = build.group.getObjectByName("backstage-ceiling") as THREE.Mesh;
    expect(wall).toBeDefined();
    expect(ceiling).toBeDefined();
    const wallMats = (Array.isArray(wall.material) ? wall.material : [wall.material]) as THREE.MeshStandardMaterial[];
    const ceilMats = (Array.isArray(ceiling.material) ? ceiling.material : [ceiling.material]) as THREE.MeshStandardMaterial[];
    expect(wallMats.some((mat) => mat.color.getHex() > 0xe0e0e0)).toBe(true);
    expect(ceilMats.some((mat) => mat.color.getHex() > 0xe0e0e0)).toBe(true);
  });

  it("keeps the hall-facing partition faces dark so the white liner stays inside", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    build.group.updateMatrixWorld(true);
    const partition: THREE.Mesh[] = [];
    build.group.traverse((obj) => {
      if (obj.name !== "backstage-wall" || !(obj instanceof THREE.Mesh)) return;
      const box = new THREE.Box3().setFromObject(obj);
      if (box.min.x > KB_PARTITION_X - 0.2 && box.max.x < KB_PARTITION_X + 0.05) partition.push(obj);
    });
    expect(partition.length).toBeGreaterThan(0);
    for (const wall of partition) {
      const mats = (Array.isArray(wall.material) ? wall.material : [wall.material]) as THREE.MeshStandardMaterial[];
      const hallFace = mats[0];
      const roomFace = mats[1] ?? mats[0];
      expect(hallFace.color.getHex()).toBeLessThan(0x333333);
      expect(roomFace.color.getHex()).toBeGreaterThan(0xe0e0e0);
    }
  });

  it("keeps cream decks, sills, roofs and vestibule boxes from flashing white into the hall", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const face = (mesh: THREE.Mesh, index: number) => {
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
      return mats[index] ?? mats[0];
    };
    const corridor = build.group.getObjectByName("deck-corridor") as THREE.Mesh;
    const glassDeck = build.group.getObjectByName("deck-glass-room") as THREE.Mesh;
    const roof = build.group.getObjectByName("glass-room-roof") as THREE.Mesh;
    const sills: THREE.Mesh[] = [];
    const vestibuleWalls: THREE.Mesh[] = [];
    build.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.name === "glass-room-sill") sills.push(obj);
      if (obj.name === "vestibule-wall") vestibuleWalls.push(obj);
    });
    expect(face(corridor, 0).color.getHex()).toBeLessThan(0x333333);
    expect(face(glassDeck, 0).color.getHex()).toBeLessThan(0x333333);
    expect(face(glassDeck, 5).color.getHex()).toBeLessThan(0x333333);
    expect(face(roof, 0).color.getHex()).toBeLessThan(0x333333);
    expect(face(roof, 5).color.getHex()).toBeLessThan(0x333333);
    expect(sills.length).toBeGreaterThan(0);
    for (const sill of sills) {
      const mats = (Array.isArray(sill.material) ? sill.material : [sill.material]) as THREE.MeshStandardMaterial[];
      expect(mats.every((mat) => mat.color.getHex() < 0x333333)).toBe(true);
    }
    expect(vestibuleWalls.length).toBeGreaterThan(0);
    for (const wall of vestibuleWalls) {
      expect(face(wall, 2).color.getHex()).toBeLessThan(0x333333);
    }
  });

  it("hangs a large lounge TV with a game picture and builds an L-shaped sofa", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const tv = build.group.getObjectByName("lounge-tv")!;
    tv.updateWorldMatrix(true, true);
    const tvBox = new THREE.Box3().setFromObject(tv);
    expect(tvBox.max.x - tvBox.min.x).toBeLessThan(0.22);
    expect(tvBox.min.y).toBeGreaterThan(KB_DECK_HEIGHT + 0.55);
    expect(tvBox.max.z - tvBox.min.z).toBeGreaterThan(1.4);
    const screen = build.group.getObjectByName("lounge-tv-screen") as THREE.Mesh;
    expect((screen.material as THREE.MeshStandardMaterial).map).toBeTruthy();
    const sofa = build.group.getObjectByName("lounge-sofa")!;
    sofa.updateWorldMatrix(true, true);
    const sofaBox = new THREE.Box3().setFromObject(sofa);
    expect(sofaBox.max.z - sofaBox.min.z).toBeGreaterThan(2.4);
    expect(sofaBox.max.x - sofaBox.min.x).toBeGreaterThan(1.5);
  });

  it("builds maimai taller than a person and parks it left of the starlight cabinet", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const cab = build.group.getObjectByName("maimai")!;
    expect(cab).toBeDefined();
    let circles = 0;
    cab.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CircleGeometry) circles += 1;
    });
    expect(circles).toBeGreaterThanOrEqual(2);
    const canopy = cab.getObjectByName("maimai-canopy")!;
    expect(canopy).toBeDefined();
    cab.updateWorldMatrix(true, true);
    const top = new THREE.Box3().setFromObject(cab).max.y;
    expect(top - KB_DECK_HEIGHT).toBeGreaterThan(1.85);
    expect(KB_MAIMAI.minZ).toBeGreaterThan(KB_STARLIGHT.maxZ);
    expect(KB_MAIMAI.maxX).toBeLessThan(-6.8);
  });

  it("builds a glass-door drink fridge and a snack cabinet on the 2/F arcade row", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const fridge = build.group.getObjectByName("arcade-fridge")!;
    const snacks = build.group.getObjectByName("snack-cabinet")!;
    expect(fridge).toBeDefined();
    expect(snacks).toBeDefined();
    fridge.updateWorldMatrix(true, true);
    snacks.updateWorldMatrix(true, true);
    const fridgeBox = new THREE.Box3().setFromObject(fridge);
    const snackBox = new THREE.Box3().setFromObject(snacks);
    expect(fridgeBox.min.y).toBeCloseTo(KB_DECK_HEIGHT, 1);
    expect(fridgeBox.max.y - fridgeBox.min.y).toBeGreaterThan(1.6);
    expect(snackBox.min.y).toBeCloseTo(KB_DECK_HEIGHT, 1);
    expect(snackBox.max.y - snackBox.min.y).toBeGreaterThan(1.4);
    let glass = 0;
    fridge.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshPhysicalMaterial) glass += 1;
      if (obj instanceof THREE.Mesh && Array.isArray(obj.material)) return;
      if (obj instanceof THREE.Mesh && "transparent" in obj.material && (obj.material as THREE.Material).transparent) glass += 1;
    });
    expect(glass).toBeGreaterThan(0);
    let packs = 0;
    snacks.traverse((obj) => {
      if (obj.name === "snack-pack") packs += 1;
    });
    expect(packs).toBeGreaterThanOrEqual(8);
  });

  it("does not hang a line array inside the 2/F backstage corridor", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const arrays: THREE.Object3D[] = [];
    build.group.traverse((o) => {
      if (o.name === "line-array") arrays.push(o);
    });
    expect(arrays.length).toBe(1);
    expect(arrays[0]!.position.x).toBeGreaterThan(KB_PARTITION_X);
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
    expect(panes.length).toBe(2);
    const front = panes.find((p) => Math.abs(p.rotation.y) < 0.01);
    expect(front).toBeDefined();
    const frontGeom = (front as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(frontGeom.parameters.width).toBeGreaterThan(2.8);
    expect(front!.position.y + frontGeom.parameters.height / 2).toBeCloseTo(KB_HALL_CEILING, 1);
    expect(build.group.getObjectByName("glass-room-shade")).toBeUndefined();
    for (const pane of panes) {
      const mat = (pane as THREE.Mesh).material as THREE.MeshStandardMaterial;
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBeLessThan(0.4);
    }
  });

  it("keeps the backstage work lights on independently of the house-light tubes", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const tubes: THREE.Mesh[] = [];
    build.group.traverse((o) => {
      if (o.name === "backstage-tube" && o instanceof THREE.Mesh) tubes.push(o);
    });
    expect(tubes.length).toBeGreaterThanOrEqual(6);
    const houseTube = build.group.getObjectByName("fluorescent-tube") as THREE.Mesh;
    for (const tube of tubes) {
      const mat = tube.material as THREE.MeshStandardMaterial;
      expect(mat).not.toBe(houseTube.material);
      expect(mat.emissiveIntensity).toBeGreaterThan(1);
    }
    const lights: THREE.PointLight[] = [];
    build.group.traverse((o) => {
      if (o.name === "backstage-light" && o instanceof THREE.PointLight) lights.push(o);
    });
    expect(lights.some((l) => l.position.y < KB_DECK_HEIGHT)).toBe(true);
    expect(lights.some((l) => l.position.y > KB_DECK_HEIGHT)).toBe(true);
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
      "sound-mixer",
      "lighting-console",
      "foh-chair",
      "pa-barrier",
      "poster",
      "long-table",
    ]) {
      expect(names, expected).toContain(expected);
    }
    const door = build.group.getObjectByName("wc-door")!;
    expect(door.position.z).toBeCloseTo(-7.5, 5);
    expect(door.rotation.y).toBeCloseTo(0, 5); // faces the audience (+Z)

    let greenExitGlows = 0;
    door.traverse((obj) => {
      if (obj instanceof THREE.PointLight && obj.color.getHex() === 0x00ff66) greenExitGlows += 1;
    });
    expect(greenExitGlows).toBe(0);
  });

  it("puts an open 240L wheelie bin beside the WC door", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const bin = build.group.getObjectByName("bin")!;
    expect(bin).toBeDefined();
    expect(bin.position.x).toBeCloseTo(6.18, 5);
    expect(bin.position.z).toBeCloseTo(-6.95, 5);

    const lid = bin.getObjectByName("bin-lid")!;
    expect(lid).toBeDefined();
    expect(Math.abs(lid.rotation.x)).toBeGreaterThan(1.5);

    const wheels: THREE.Object3D[] = [];
    bin.traverse((obj) => {
      if (obj.name === "bin-wheel") wheels.push(obj);
    });
    expect(wheels).toHaveLength(2);
  });

  it("runs a light show that recolours the key spots and swings the moving heads", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    expect(build.lightShow).toBeDefined();
    const spot = build.stageLights[0];
    const heads: THREE.Object3D[] = [];
    build.group.traverse((o) => {
      if (o.name === "moving-head") heads.push(o);
    });
    build.lightShow!.update(0);
    const hex0 = spot.color.getHex();
    const target0 = spot.target.position.clone();
    const pans0 = heads.map((h) => h.rotation.y);
    build.lightShow!.update(4);
    expect(spot.color.getHex()).not.toBe(hex0);
    expect(spot.target.position.distanceTo(target0)).toBeGreaterThan(0.1);
    expect(heads.every((h, i) => Math.abs(h.rotation.y - pans0[i]) > 1e-3)).toBe(true);
  });

  it("adds a soft static face fill so idols stay readable between beams", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const fill = build.group.getObjectByName("face-fill") as THREE.SpotLight;
    expect(fill).toBeInstanceOf(THREE.SpotLight);
    expect(fill.intensity).toBeGreaterThan(0);
    // Aimed at face height on the performer line, from front of house
    expect(fill.target.position.z).toBeCloseTo(KOWLOON_BAY_VENUE.show.performerLine.z, 5);
    expect(fill.target.position.y).toBeGreaterThan(KB_STAGE_HEIGHT + 0.8);
    expect(fill.position.z).toBeGreaterThan(KB_STAGE_FRONT_Z);
    // Static: not part of the sweeping key spots
    expect(build.stageLights).not.toContain(fill);
    const hex0 = fill.color.getHex();
    const target0 = fill.target.position.clone();
    build.lightShow!.update(5);
    expect(fill.color.getHex()).toBe(hex0);
    expect(fill.target.position.equals(target0)).toBe(true);
  });

  it("keeps every stage-bar spot aimed inside the stage footprint while sweeping", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const stage = KOWLOON_BAY_VENUE.platforms[0].bounds;
    for (let t = 0; t < 60; t += 0.41) {
      build.lightShow!.update(t);
      for (const spot of build.stageLights) {
        const { x, z } = spot.target.position;
        expect(x).toBeGreaterThanOrEqual(stage.minX);
        expect(x).toBeLessThanOrEqual(stage.maxX);
        expect(z).toBeGreaterThanOrEqual(stage.minZ);
        expect(z).toBeLessThanOrEqual(stage.maxZ);
      }
    }
  });

  it("exposes the crowd dummies as knockable props", () => {
    const build = createVenue(KOWLOON_BAY_VENUE);
    const names = build.knockableProps.map((prop) => prop.name);
    expect(names.filter((name) => name === "crowd-dummy").length).toBeGreaterThan(8);
  });
});
