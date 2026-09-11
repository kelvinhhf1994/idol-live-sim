import * as THREE from "three";
import { KB_FOH_CHAIRS, KB_PA_CX, KB_PA_DESK_Z, KB_REAR_WALL_Z, KB_WC_BLOCK } from "../../config/venue";
import {
  addBox,
  buildFohChair,
  buildLightingConsole,
  buildSoundMixer,
  createExitDoor,
  createFridgeTexture,
  labelPlane,
  speakerGrilleTexture,
  type SharedMaterials,
} from "../venueKit";
import { ACOUSTIC_TILE_TOP_Y } from "./shell";
import { clockFaceTexture, posterTexture, wasteIconTexture } from "./textures";

export function buildProps(group: THREE.Group, mats: SharedMaterials): void {
  buildWcBlock(group, mats);
  buildThrone(group);
  buildLadder(group);
  buildFridge(group, mats);
  buildPaDesk(group, mats);
  buildPaBarrier(group, mats);
  buildPosters(group);
  buildLongTable(group, mats);
}

/** WC room beside the stage: charcoal walls up to the tile line, door facing the audience, wall clock, bin. */
function buildWcBlock(group: THREE.Group, mats: SharedMaterials): void {
  const b = KB_WC_BLOCK;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  addBox(group, w, ACOUSTIC_TILE_TOP_Y, 0.2, mats.wallCharcoal, (b.minX + b.maxX) / 2, ACOUSTIC_TILE_TOP_Y / 2, b.maxZ - 0.1, "wc-wall-front");
  addBox(group, 0.2, ACOUSTIC_TILE_TOP_Y, d, mats.wallCharcoal, b.minX + 0.1, ACOUSTIC_TILE_TOP_Y / 2, (b.minZ + b.maxZ) / 2, "wc-wall-side");
  createExitDoor(group, 5.5, 0, b.maxZ + 0.1, 0, "wc-door", { illuminatedSign: false });

  const clock = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24),
    new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.5 }),
  );
  clock.rotation.x = Math.PI / 2;
  clock.position.set(4.85, 2.85, b.maxZ + 0.03);
  clock.name = "wall-clock";
  group.add(clock);

  buildWheelieBin(group);
}

/** 240L wheelie bin outside the WC door, lid flipped open toward the wall. */
function buildWheelieBin(group: THREE.Group): void {
  const bin = new THREE.Group();
  bin.name = "bin";
  bin.position.set(6.18, 0, -6.95);
  bin.rotation.y = 0.35;

  const plastic = new THREE.MeshStandardMaterial({
    color: 0x3c3c42,
    roughness: 0.5,
    side: THREE.DoubleSide,
    emissive: 0x16161a,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.85 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.8, emissive: 0x080808 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.4, emissive: 0x121214 });

  const bodyW = 0.56;
  const bodyD = 0.70;
  const wall = 0.035;
  const bodyBottom = 0.10;
  const bodyTop = 0.98;
  const bodyH = bodyTop - bodyBottom;
  const bodyY = (bodyBottom + bodyTop) / 2;

  const body = new THREE.Group();
  body.name = "bin-body";
  addBox(body, bodyW, 0.05, bodyD, plastic, 0, bodyBottom + 0.025, 0);
  addBox(body, bodyW, bodyH, wall, plastic, 0, bodyY, bodyD / 2 - wall / 2);
  addBox(body, bodyW, bodyH, wall, plastic, 0, bodyY, -bodyD / 2 + wall / 2);
  addBox(body, wall, bodyH, bodyD - wall * 2, plastic, bodyW / 2 - wall / 2, bodyY, 0);
  addBox(body, wall, bodyH, bodyD - wall * 2, plastic, -bodyW / 2 + wall / 2, bodyY, 0);
  addBox(body, bodyW - wall * 2, 0.02, bodyD - wall * 2, dark, 0, bodyBottom + 0.06, 0, "", false);
  addBox(body, bodyW, 0.03, wall, rim, 0, bodyTop - 0.015, bodyD / 2 - wall / 2, "", false);
  addBox(body, bodyW, 0.03, wall, rim, 0, bodyTop - 0.015, -bodyD / 2 + wall / 2, "", false);
  addBox(body, wall, 0.03, bodyD - wall * 2, rim, bodyW / 2 - wall / 2, bodyTop - 0.015, 0, "", false);
  addBox(body, wall, 0.03, bodyD - wall * 2, rim, -bodyW / 2 + wall / 2, bodyTop - 0.015, 0, "", false);
  bin.add(body);

  const lid = new THREE.Group();
  lid.name = "bin-lid";
  lid.position.set(0, bodyTop, -bodyD / 2);
  lid.rotation.x = -2.15;
  addBox(lid, 0.58, 0.045, 0.72, plastic, 0, 0.02, 0.36);
  addBox(lid, 0.16, 0.04, 0.08, plastic, 0, 0.055, 0.64, "", false);
  bin.add(lid);

  addBox(bin, 0.50, 0.04, 0.04, plastic, 0, 1.0, -bodyD / 2 - 0.01, "", false);

  for (const x of [-0.22, 0.22]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.1, -0.22);
    wheel.name = "bin-wheel";
    bin.add(wheel);
  }

  const badge = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 24),
    new THREE.MeshStandardMaterial({
      map: wasteIconTexture(),
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveMap: wasteIconTexture(),
      emissiveIntensity: 0.35,
      roughness: 0.45,
      transparent: true,
    }),
  );
  badge.position.set(0, 0.62, bodyD / 2 + 0.005);
  bin.add(badge);

  const fill = new THREE.PointLight(0xc8c4bc, 2.4, 2.4, 2);
  fill.position.set(0.15, 1.35, 0.45);
  bin.add(fill);

  group.add(bin);
}

/** Glossy black ornate throne chair against the +X wall. */
function buildThrone(group: THREE.Group): void {
  const throne = new THREE.Group();
  throne.name = "throne-chair";
  throne.position.set(5.9, 0, -6.0);
  throne.rotation.y = -Math.PI / 2; // Faces into the hall (-X)
  const gloss = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.25, metalness: 0.3 });
  addBox(throne, 0.7, 0.14, 0.7, gloss, 0, 0.5, 0);
  addBox(throne, 0.7, 1.3, 0.12, gloss, 0, 1.15, -0.3);
  const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16, 1, false, 0, Math.PI), gloss);
  crest.rotation.x = Math.PI / 2;
  crest.rotation.z = Math.PI / 2;
  crest.position.set(0, 1.8, -0.3);
  throne.add(crest);
  for (const x of [-0.36, 0.36]) {
    addBox(throne, 0.08, 0.3, 0.6, gloss, x, 0.72, 0.02);
    addBox(throne, 0.08, 0.5, 0.08, gloss, x, 0.25, 0.3);
  }
  group.add(throne);
}

/** Aluminium A-frame ladder draped with a green net and hanging plushies. */
function buildLadder(group: THREE.Group): void {
  const ladder = new THREE.Group();
  ladder.name = "ladder";
  ladder.position.set(6.05, 0, -4.8);
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.4, metalness: 0.8 });
  for (const side of [-1, 1] as const) {
    // Each leg pair leans inward toward the top (rotation about X tilts +Y toward -Z for positive angles)
    for (const x of [-0.22, 0.22]) {
      const rail = addBox(ladder, 0.05, 2.0, 0.05, alu, x, 1.0, side * 0.18);
      rail.rotation.x = side * 0.18;
    }
    for (let i = 0; i < 5; i++) {
      const y = 0.3 + i * 0.4;
      addBox(ladder, 0.44, 0.04, 0.06, alu, 0, y, side * (0.18 - (y - 1.0) * 0.18), "", false);
    }
  }
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.6),
    new THREE.MeshStandardMaterial({ map: speakerGrilleTexture(), color: 0x7ddc4a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  net.position.set(0, 1.1, -0.28);
  net.rotation.x = -0.18;
  ladder.add(net);
  const plushColors = [0xff7eb6, 0xffd166, 0xff9f68, 0xffffff];
  plushColors.forEach((color, i) => {
    const plush = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    plush.position.set(-0.3 + i * 0.2, 1.5 - (i % 2) * 0.3, -0.34);
    ladder.add(plush);
  });
  group.add(ladder);
}

/** Red Coca-Cola fridge in the rear +X corner, door facing the stage. */
function buildFridge(group: THREE.Group, mats: SharedMaterials): void {
  const fridge = new THREE.Group();
  fridge.name = "fridge";
  fridge.position.set(6.0, 0, 3.5);
  const red = new THREE.MeshStandardMaterial({ color: 0xd0161d, roughness: 0.4, metalness: 0.1 });
  addBox(fridge, 0.8, 1.9, 0.8, red, 0, 0.95, 0);
  const shelves = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.4), new THREE.MeshStandardMaterial({ map: createFridgeTexture(), emissive: 0x333333 }));
  shelves.position.set(0, 1.05, -0.401);
  shelves.rotation.y = Math.PI;
  fridge.add(shelves);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.46), mats.glass);
  glass.position.set(0, 1.05, -0.41);
  glass.rotation.y = Math.PI;
  fridge.add(glass);
  const label = labelPlane("Coca-Cola", "#d0161d", "#ffffff", 0.6, 0.2);
  label.position.set(0, 1.85, -0.41);
  label.rotation.y = Math.PI;
  fridge.add(label);
  group.add(fridge);
}

/** Long FOH desk on the rear wall, stage-left of the glass room: sound mixer (-X), lighting console (+X), one chair behind each. */
function buildPaDesk(group: THREE.Group, mats: SharedMaterials): void {
  const desk = new THREE.Group();
  desk.name = "pa-desk";
  desk.position.set(KB_PA_CX, 0, KB_PA_DESK_Z);
  const top = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.6 });
  addBox(desk, 4.0, 0.05, 0.8, top, 0, 0.78, 0);
  for (const [x, z] of [[-1.9, -0.35], [1.9, -0.35], [-1.9, 0.35], [1.9, 0.35]] as const) {
    addBox(desk, 0.05, 0.76, 0.05, mats.steel, x, 0.38, z, "", false);
  }
  const mixer = buildSoundMixer();
  mixer.position.set(KB_FOH_CHAIRS[0].x - KB_PA_CX, 0.805, 0);
  desk.add(mixer);
  const lightingConsole = buildLightingConsole();
  lightingConsole.position.set(KB_FOH_CHAIRS[1].x - KB_PA_CX, 0.805, 0);
  desk.add(lightingConsole);
  for (const { x, z } of KB_FOH_CHAIRS) {
    const chair = buildFohChair();
    chair.position.set(x - KB_PA_CX, 0, z - KB_PA_DESK_Z);
    desk.add(chair);
  }
  group.add(desk);
}

/** Black fabric barrier boards on steel feet, running along the front of the PA desk and closing its +X end. */
function buildPaBarrier(group: THREE.Group, mats: SharedMaterials): void {
  const barrier = new THREE.Group();
  barrier.name = "pa-barrier";
  const fabric = new THREE.MeshStandardMaterial({ color: 0x0e0e11, roughness: 0.98 });
  const height = 1.1;
  const board = (w: number, d: number, x: number, z: number) => {
    addBox(barrier, w, height, d, fabric, x, height / 2, z);
    addBox(barrier, w + 0.04, 0.03, d + 0.04, mats.steel, x, height + 0.015, z, "", false);
  };
  const frontZ = KB_PA_DESK_Z - 0.55;
  // Front, audience side: runs from 1.6 m before the desk centre to the +X end board, leaving the -X end open as the way in
  board(3.95, 0.08, KB_PA_CX + 0.375, frontZ);
  board(0.08, KB_REAR_WALL_Z - (frontZ - 0.05), KB_PA_CX + 2.35, (frontZ - 0.05 + KB_REAR_WALL_Z) / 2); // +X end, back to the rear wall
  for (const [x, z] of [[KB_PA_CX - 1.3, frontZ], [KB_PA_CX, frontZ], [KB_PA_CX + 1.6, frontZ], [KB_PA_CX + 2.35, 3.0]] as const) {
    addBox(barrier, 0.05, 0.04, 0.5, mats.steel, x, 0.02, z, "", false);
  }
  group.add(barrier);
}

/** Three live posters on the acoustic rear wall. */
function buildPosters(group: THREE.Group): void {
  [KB_PA_CX + 0.8, KB_PA_CX + 1.6, KB_PA_CX + 2.4].forEach((x, i) => {
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), new THREE.MeshStandardMaterial({ map: posterTexture(i), roughness: 0.9 }));
    poster.position.set(x, 1.9, KB_REAR_WALL_Z - 0.07);
    poster.rotation.y = Math.PI;
    poster.name = "poster";
    group.add(poster);
  });
}

/** Long white folding table in front of the fridge. */
function buildLongTable(group: THREE.Group, mats: SharedMaterials): void {
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 });
  const longTable = new THREE.Group();
  longTable.name = "long-table";
  longTable.position.set(5.2, 0, 2.7);
  addBox(longTable, 1.8, 0.04, 0.6, white, 0, 0.74, 0);
  for (const [x, z] of [[-0.8, -0.25], [0.8, -0.25], [-0.8, 0.25], [0.8, 0.25]] as const) {
    addBox(longTable, 0.04, 0.72, 0.04, mats.steel, x, 0.36, z, "", false);
  }
  group.add(longTable);
}
