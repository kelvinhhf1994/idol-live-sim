import * as THREE from "three";
import {
  KB_ARCADE_FRIDGE,
  KB_CLAW_MACHINES,
  KB_DECK_HEIGHT,
  KB_DRESSING_ROOMS,
  KB_LOUNGE_BACK_LONG,
  KB_LOUNGE_BACK_SHORT,
  KB_LOUNGE_SEAT_LONG,
  KB_LOUNGE_SEAT_SHORT,
  KB_LOUNGE_TV,
  KB_MAIMAI,
  KB_SNACK_CABINET,
  KB_STARLIGHT,
  KB_VANITY_TABLES,
} from "../../config/venue";
import { addBox, createFridgeTexture, labelPlane, pleatedCurtainTexture, type SharedMaterials } from "../venueKit";
import { PLUSHIE_COLORS, loungeGameTexture, maimaiMatTexture, maimaiScreenTexture, starlightScreenTexture } from "./textures";

const WOOD = new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.7 });
const PINK = new THREE.MeshStandardMaterial({ color: 0xff6ba8, roughness: 0.45 });
const CREAM = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.55 });
const FABRIC = new THREE.MeshStandardMaterial({ color: 0xc8b8a4, roughness: 0.88 });
const VELVET = new THREE.MeshStandardMaterial({ color: 0xb89f86, roughness: 0.92 });
const SCREEN = new THREE.MeshStandardMaterial({ color: 0x0b1c33, emissive: 0x1a4a8a, emissiveIntensity: 0.7, roughness: 0.25 });
const BULB = new THREE.MeshStandardMaterial({ color: 0xfff4c8, emissive: 0xffeeaa, emissiveIntensity: 1.4, roughness: 0.3 });
const CHROME = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.25, metalness: 0.85 });

export function buildBackstageSet(group: THREE.Group, mats: SharedMaterials): void {
  const set = new THREE.Group();
  set.name = "backstage-set";
  for (const table of KB_VANITY_TABLES) buildVanity(set, mats, table);
  for (const room of KB_DRESSING_ROOMS) buildDressingRoom(set, mats, room);
  buildSofa(set, mats);
  buildTvStand(set, mats);
  buildStarlight(set, mats);
  buildMaimai(set, mats);
  for (const box of KB_CLAW_MACHINES) buildClawMachine(set, mats, box);
  buildArcadeFridge(set, mats);
  buildSnackCabinet(set);
  group.add(set);
}

function cxz(b: { minX: number; maxX: number; minZ: number; maxZ: number }): { cx: number; cz: number; w: number; d: number } {
  return { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, w: b.maxX - b.minX, d: b.maxZ - b.minZ };
}

/** Makeup desk against the -X wall: wood top, lit mirror, stool. */
function buildVanity(parent: THREE.Group, mats: SharedMaterials, bounds: (typeof KB_VANITY_TABLES)[number]): void {
  const { cx, cz, w, d } = cxz(bounds);
  const table = new THREE.Group();
  table.name = "vanity-table";
  table.position.set(cx, 0, cz);
  addBox(table, w - 0.04, 0.04, d - 0.08, WOOD, 0, 0.74, 0);
  for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.08], [w / 2 - 0.06, -d / 2 + 0.08], [-w / 2 + 0.06, d / 2 - 0.08], [w / 2 - 0.06, d / 2 - 0.08]] as const) {
    addBox(table, 0.04, 0.72, 0.04, mats.steel, x, 0.36, z, "", false);
  }
  addBox(table, 0.04, 0.72, d - 0.12, WOOD, -w / 2 + 0.03, 1.1, 0, "", false);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(d - 0.22, 0.62), mats.glass);
  mirror.rotation.y = Math.PI / 2;
  mirror.position.set(-w / 2 + 0.056, 1.12, 0);
  table.add(mirror);
  for (const z of [-d / 2 + 0.12, 0, d / 2 - 0.12]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), BULB);
    bulb.position.set(-w / 2 + 0.08, 1.5, z);
    table.add(bulb);
  }
  addBox(table, 0.06, 0.04, 0.08, PINK, 0.08, 0.78, -0.12, "", false);
  addBox(table, 0.05, 0.08, 0.05, new THREE.MeshStandardMaterial({ color: 0x7ec8e3, roughness: 0.2, transparent: true, opacity: 0.7 }), 0.1, 0.81, 0.16, "", false);
  addBox(table, 0.32, 0.06, 0.32, mats.matteBlack, w / 2 + 0.22, 0.42, 0, "", false);
  addBox(table, 0.05, 0.4, 0.05, mats.steel, w / 2 + 0.22, 0.2, 0, "", false);
  parent.add(table);
}

/** Three-walled booth against the partition, curtain left open toward the corridor. */
function buildDressingRoom(parent: THREE.Group, mats: SharedMaterials, room: (typeof KB_DRESSING_ROOMS)[number]): void {
  const { cx, cz, w, d } = cxz(room);
  const booth = new THREE.Group();
  booth.name = "dressing-room";
  booth.position.set(cx, 0, cz);
  const h = 2.35;
  const t = 0.08;
  const liner = new THREE.MeshStandardMaterial({ color: 0xf4efe8, roughness: 0.88 });
  addBox(booth, t, h, d, liner, w / 2 - t / 2, h / 2, 0, "dressing-wall");
  addBox(booth, w, h, t, liner, 0, h / 2, -d / 2 + t / 2, "dressing-wall");
  addBox(booth, w, h, t, liner, 0, h / 2, d / 2 - t / 2, "dressing-wall");
  addBox(booth, w - 0.1, 0.02, d - 0.1, new THREE.MeshStandardMaterial({ color: 0x2a2430, roughness: 0.95 }), 0, 0.01, 0, "", false);
  addBox(booth, 0.07, h, 0.07, mats.frameBlack, -w / 2 + 0.03, h / 2, -d / 2 + 0.04, "", false);
  addBox(booth, 0.07, h, 0.07, mats.frameBlack, -w / 2 + 0.03, h / 2, d / 2 - 0.04, "", false);
  addBox(booth, 0.07, 0.07, d, mats.frameBlack, -w / 2 + 0.03, 2.18, 0, "", false);
  const curtainW = (d - 0.16) * 0.42;
  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(curtainW, 2.05),
    new THREE.MeshStandardMaterial({ map: pleatedCurtainTexture(), color: 0xe86aa8, roughness: 0.7, side: THREE.DoubleSide }),
  );
  curtain.rotation.y = Math.PI / 2;
  curtain.position.set(-w / 2 + 0.04, 1.08, d / 2 - curtainW / 2 - 0.08);
  booth.add(curtain);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, d - 0.08, 6), mats.steel);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(-w / 2 + 0.04, 2.12, 0);
  booth.add(rail);
  addBox(booth, 0.36, 0.06, 0.7, WOOD, 0.15, 0.42, 0, "", false);
  const tag = labelPlane("試身室", "#2a1820", "#ffd0e4", 0.42, 0.12);
  tag.rotation.y = -Math.PI / 2;
  tag.position.set(-w / 2 - 0.02, 2.02, 0);
  booth.add(tag);
  parent.add(booth);
}

/** L-shaped lounge sofa: long arm on the -X wall, short return toward the glass room. */
function buildSofa(parent: THREE.Group, mats: SharedMaterials): void {
  const sofa = new THREE.Group();
  sofa.name = "lounge-sofa";
  sofa.position.set(0, KB_DECK_HEIGHT, 0);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6d4e, roughness: 0.55 });
  const long = cxz(KB_LOUNGE_SEAT_LONG);
  const short = cxz(KB_LOUNGE_SEAT_SHORT);
  addBox(sofa, long.w + 0.2, 0.1, long.d + 0.1, wood, long.cx - 0.06, 0.08, long.cz, "", false);
  addBox(sofa, long.w + 0.04, 0.22, long.d, FABRIC, long.cx, 0.26, long.cz);
  addBox(sofa, 0.18, 0.62, long.d + 0.08, FABRIC, KB_LOUNGE_BACK_LONG.minX + 0.14, 0.54, long.cz);
  for (const z of [-0.85, -0.05, 0.7]) {
    addBox(sofa, long.w - 0.08, 0.09, 0.72, VELVET, long.cx + 0.02, 0.38, long.cz + z * 0.55, "", false);
  }
  addBox(sofa, short.w + 0.08, 0.1, short.d + 0.16, wood, short.cx, 0.08, short.cz + 0.04, "", false);
  addBox(sofa, short.w, 0.22, short.d + 0.04, FABRIC, short.cx, 0.26, short.cz);
  addBox(sofa, short.w + 0.08, 0.62, 0.18, FABRIC, short.cx, 0.54, KB_LOUNGE_BACK_SHORT.maxZ - 0.1);
  addBox(sofa, 0.2, 0.16, 0.2, CREAM, long.cx + 0.08, 0.46, long.cz - 0.7, "", false);
  addBox(sofa, 0.2, 0.16, 0.2, CREAM, short.cx + 0.4, 0.46, short.cz, "", false);
  addBox(sofa, 0.72, 0.06, 0.72, wood, -6.95, 0.22, -0.4, "", false);
  addBox(sofa, 0.64, 0.03, 0.64, mats.matteBlack, -6.95, 0.26, -0.4, "", false);
  parent.add(sofa);
}

/** Wall-mounted lounge TV on the partition, game picture on, console + PS5 below. */
function buildTvStand(parent: THREE.Group, mats: SharedMaterials): void {
  const { cx, cz, w, d } = cxz(KB_LOUNGE_TV);
  const tvH = KB_LOUNGE_TV.maxY - KB_LOUNGE_TV.minY;
  const tvY = (KB_LOUNGE_TV.minY + KB_LOUNGE_TV.maxY) / 2;
  const tv = addBox(parent, w, tvH, d, mats.fixtureBlack, cx, tvY, cz, "lounge-tv");
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(d - 0.1, tvH - 0.1),
    new THREE.MeshStandardMaterial({ map: loungeGameTexture(), emissive: 0x223344, emissiveIntensity: 0.22, roughness: 0.35 }),
  );
  screen.name = "lounge-tv-screen";
  screen.rotation.y = -Math.PI / 2;
  screen.position.set(-w / 2 - 0.002, 0, 0);
  tv.add(screen);
  addBox(parent, 0.06, 0.05, d - 0.2, mats.matteBlack, cx - 0.02, KB_LOUNGE_TV.minY - 0.04, cz, "", false);
  addBox(parent, 0.36, 0.08, 1.05, WOOD, -4.78, KB_DECK_HEIGHT + 0.28, -0.2);
  addBox(parent, 0.34, 0.22, 1.0, mats.matteBlack, -4.78, KB_DECK_HEIGHT + 0.14, -0.2);
  addBox(parent, 0.05, 0.2, 0.16, CREAM, -4.95, KB_DECK_HEIGHT + 0.42, -0.42, "ps5");
  addBox(parent, 0.08, 0.03, 0.14, mats.matteBlack, -5.05, KB_DECK_HEIGHT + 0.4, 0.05, "", false);
}

/** White box cabinet: rectangular base, wall-flush vertical monitor, 3+3 buttons on the top deck. */
function buildStarlight(parent: THREE.Group, mats: SharedMaterials): void {
  const { cx, cz, w } = cxz(KB_STARLIGHT);
  const cab = new THREE.Group();
  cab.name = "starlight-cabinet";
  cab.position.set(cx, KB_DECK_HEIGHT, cz);
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.38 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.35, metalness: 0.35 });
  const bodyW = 0.58;
  const bodyD = 0.5;
  const boxH = 0.86;
  const ox = (bodyD - w) / 2;
  const back = ox - bodyD / 2;
  addBox(cab, bodyD, boxH, bodyW, white, ox, boxH / 2, 0);
  for (const z of [-bodyW / 2 + 0.018, bodyW / 2 - 0.018]) {
    addBox(cab, 0.014, boxH, 0.014, gold, ox + bodyD / 2 - 0.01, boxH / 2, z, "", false);
  }
  addBox(cab, bodyD - 0.06, 0.02, bodyW - 0.06, white, ox + 0.01, boxH + 0.01, 0);
  addBox(cab, 0.05, 0.03, 0.07, mats.fixtureBlack, ox + 0.12, boxH + 0.03, 0, "", false);
  const colors = [0x3d8bff, 0x3ddc84, 0xffe36b, 0xff9f1c, 0xff3b5c, 0xc59cff] as const;
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const slot = i % 3;
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.016, 12),
      new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.28 }),
    );
    btn.name = "starlight-button";
    btn.position.set(ox + 0.16, boxH + 0.024, side * (0.1 + slot * 0.08));
    cab.add(btn);
  }
  const monH = 0.78;
  const monY = boxH + monH / 2;
  addBox(cab, 0.04, monH, bodyW - 0.06, white, back + 0.02, monY, 0);
  addBox(cab, 0.012, 0.012, bodyW - 0.1, gold, back + 0.04, boxH + monH, 0, "", false);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.7),
    new THREE.MeshStandardMaterial({ map: starlightScreenTexture(), emissive: 0x446688, emissiveIntensity: 0.2, roughness: 0.4 }),
  );
  screen.rotation.y = Math.PI / 2;
  screen.position.set(back + 0.042, monY, 0);
  cab.add(screen);
  for (const [x, z] of [
    [ox - 0.2, -0.22],
    [ox - 0.2, 0.22],
    [ox + 0.2, -0.22],
    [ox + 0.2, 0.22],
  ] as const) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 10), mats.matteBlack);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.024, z);
    cab.add(wheel);
  }
  parent.add(cab);
}

/** Dual white DX cabinet on the -X wall, left of starlight, facing the corridor. Taller than a player. */
function buildMaimai(parent: THREE.Group, mats: SharedMaterials): void {
  const { cx, cz, w } = cxz(KB_MAIMAI);
  const game = new THREE.Group();
  game.name = "maimai";
  game.position.set(cx, KB_DECK_HEIGHT, cz);
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f4f8, roughness: 0.32 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xff4da6, emissive: 0xff2f88, emissiveIntensity: 0.35, roughness: 0.4 });
  const led = new THREE.MeshStandardMaterial({ color: 0x7ef0ff, emissive: 0x5ae8ff, emissiveIntensity: 1.4, roughness: 0.2 });
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xe8e4ee, roughness: 0.25, metalness: 0.15 });
  const screenMat = new THREE.MeshStandardMaterial({ map: maimaiScreenTexture(), emissive: 0x442233, emissiveIntensity: 0.18, roughness: 0.4 });
  const bodyW = 1.64;
  const bodyD = 0.82;
  const ox = (bodyD - w) / 2;
  const front = ox + bodyD / 2;
  addBox(game, bodyD, 0.28, bodyW, mats.matteBlack, ox, 0.14, 0);
  addBox(game, bodyD, 1.82, bodyW, white, ox, 1.19, 0);
  addBox(game, 0.22, 1.6, 0.14, white, ox, 1.2, 0);
  addBox(game, 0.02, 0.12, 0.1, mats.matteBlack, front + 0.012, 1.05, 0, "", false);
  addBox(game, 0.95, 0.14, bodyW + 0.1, canopyMat, ox + 0.08, 2.22, 0, "maimai-canopy");
  addBox(game, 0.04, 0.04, bodyW + 0.06, led, front - 0.02, 2.12, 0, "", false);
  for (const z of [-0.42, 0.42]) {
    addBox(game, 0.04, 0.1, 0.36, mats.fixtureBlack, front + 0.01, 1.95, z, "", false);
    const monitor = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.08), SCREEN);
    monitor.rotation.y = Math.PI / 2;
    monitor.position.set(front + 0.032, 1.95, z);
    game.add(monitor);
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.38, 28), white);
    plate.rotation.y = Math.PI / 2;
    plate.position.set(front + 0.012, 1.22, z);
    game.add(plate);
    const screen = new THREE.Mesh(new THREE.CircleGeometry(0.22, 28), screenMat);
    screen.rotation.y = Math.PI / 2;
    screen.position.set(front + 0.02, 1.22, z);
    game.add(screen);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 8, 28), led);
    halo.rotation.y = Math.PI / 2;
    halo.position.set(front + 0.018, 1.22, z);
    game.add(halo);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, 0.075), btnMat);
      btn.position.set(front + 0.03, 1.22 + Math.sin(a) * 0.32, z + Math.cos(a) * 0.32);
      game.add(btn);
    }
  }
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.5), new THREE.MeshStandardMaterial({ map: maimaiMatTexture(), roughness: 0.85 }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(front + 0.5, 0.01, 0);
  game.add(mat);
  parent.add(game);
}

/** Glass-front claw machine with a hanging claw and colourful prizes. */
function buildClawMachine(parent: THREE.Group, mats: SharedMaterials, bounds: (typeof KB_CLAW_MACHINES)[number]): void {
  const { cx, cz, w, d } = cxz(bounds);
  const machine = new THREE.Group();
  machine.name = "claw-machine";
  machine.position.set(cx, KB_DECK_HEIGHT, cz);
  const cabinet = new THREE.MeshStandardMaterial({ color: 0x1a2a6c, roughness: 0.5 });
  addBox(machine, w, 0.7, d, cabinet, 0, 0.35, 0);
  addBox(machine, w, 0.08, d, mats.matteBlack, 0, 0.74, 0);
  addBox(machine, w, 0.08, d, PINK, 0, 1.78, 0);
  for (const [x, z] of [[-w / 2 + 0.04, -d / 2 + 0.04], [w / 2 - 0.04, -d / 2 + 0.04], [-w / 2 + 0.04, d / 2 - 0.04], [w / 2 - 0.04, d / 2 - 0.04]] as const) {
    addBox(machine, 0.06, 1.0, 0.06, CHROME, x, 1.26, z, "", false);
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.92, d - 0.1), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.18, roughness: 0.05 }));
  glass.position.y = 1.24;
  machine.add(glass);
  const prizes = [0xff7eb6, 0xffd166, 0x8be9fd, 0xb8f28e, 0xc59cff, ...PLUSHIE_COLORS];
  prizes.slice(0, 8).forEach((color, i) => {
    const prize = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    prize.position.set(-0.18 + (i % 3) * 0.16, 0.86 + (i % 2) * 0.08, -0.16 + Math.floor(i / 3) * 0.14);
    machine.add(prize);
  });
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), CHROME);
  arm.position.set(0.05, 1.52, 0);
  machine.add(arm);
  const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 5), CHROME);
  claw.position.set(0.05, 1.3, 0);
  machine.add(claw);
  addBox(machine, 0.18, 0.06, 0.22, mats.fixtureBlack, w / 2 - 0.08, 0.62, 0.08, "", false);
  parent.add(machine);
}

/** White glass-door drink cooler on the arcade row, door facing the corridor. */
function buildArcadeFridge(parent: THREE.Group, mats: SharedMaterials): void {
  const { cx, cz, w, d } = cxz(KB_ARCADE_FRIDGE);
  const fridge = new THREE.Group();
  fridge.name = "arcade-fridge";
  fridge.position.set(cx, KB_DECK_HEIGHT, cz);
  const white = new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.32, metalness: 0.22 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x149494, roughness: 0.38, emissive: 0x0a5555, emissiveIntensity: 0.4 });
  const led = new THREE.MeshStandardMaterial({ color: 0xc8f4ff, emissive: 0x9ee8ff, emissiveIntensity: 1.2, roughness: 0.2 });
  addBox(fridge, 0.05, 1.92, d, white, -w / 2 + 0.025, 0.96, 0);
  addBox(fridge, w, 0.06, d, white, 0, 0.03, 0);
  addBox(fridge, w, 0.12, d, teal, 0, 1.86, 0);
  addBox(fridge, w, 1.74, 0.05, white, 0, 0.93, -d / 2 + 0.025);
  addBox(fridge, w, 1.74, 0.05, white, 0, 0.93, d / 2 - 0.025);
  addBox(fridge, 0.05, 0.12, d, teal, w / 2 - 0.01, 1.86, 0);
  addBox(fridge, 0.04, 0.08, d, white, w / 2 - 0.01, 0.06, 0);
  addBox(fridge, 0.04, 1.68, 0.05, white, w / 2 - 0.01, 0.92, -d / 2 + 0.025);
  addBox(fridge, 0.04, 1.68, 0.05, white, w / 2 - 0.01, 0.92, d / 2 - 0.025);
  const drinkTex = createFridgeTexture();
  const shelves = new THREE.Mesh(
    new THREE.PlaneGeometry(d - 0.18, 1.56),
    new THREE.MeshStandardMaterial({ map: drinkTex, emissive: 0xffffff, emissiveMap: drinkTex, emissiveIntensity: 0.7, roughness: 0.35 }),
  );
  shelves.rotation.y = Math.PI / 2;
  shelves.position.set(-w / 2 + 0.06, 0.92, 0);
  fridge.add(shelves);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(d - 0.16, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xc8e8f8, transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0.15 }),
  );
  glass.rotation.y = Math.PI / 2;
  glass.position.set(w / 2 + 0.012, 0.92, 0);
  fridge.add(glass);
  addBox(fridge, 0.012, 1.58, 0.016, led, w / 2 + 0.01, 0.92, -d / 2 + 0.06, "", false);
  addBox(fridge, 0.012, 1.58, 0.016, led, w / 2 + 0.01, 0.92, d / 2 - 0.06, "", false);
  addBox(fridge, w - 0.1, 0.08, 0.02, teal, -0.02, 1.55, d / 2 + 0.012, "", false);
  addBox(fridge, 0.03, 0.42, 0.04, mats.matteBlack, w / 2 + 0.02, 0.95, 0.18, "", false);
  const tag = labelPlane("DRINKS", "#063838", "#9ff6ee", 0.46, 0.1);
  tag.rotation.y = Math.PI / 2;
  tag.position.set(w / 2 + 0.018, 1.86, 0);
  fridge.add(tag);
  parent.add(fridge);
}

/** Open snack cabinet: four shelves of colourful packs, facing the corridor. */
function buildSnackCabinet(parent: THREE.Group): void {
  const { cx, cz, w, d } = cxz(KB_SNACK_CABINET);
  const cabinet = new THREE.Group();
  cabinet.name = "snack-cabinet";
  cabinet.position.set(cx, KB_DECK_HEIGHT, cz);
  const cream = new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.55 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.62 });
  const header = new THREE.MeshStandardMaterial({ color: 0xff6b4a, roughness: 0.4, emissive: 0x6a2010, emissiveIntensity: 0.25 });
  addBox(cabinet, 0.04, 1.64, d, cream, -w / 2 + 0.02, 0.86, 0);
  addBox(cabinet, w, 1.64, 0.04, cream, 0, 0.86, -d / 2 + 0.02);
  addBox(cabinet, w, 1.64, 0.04, cream, 0, 0.86, d / 2 - 0.02);
  addBox(cabinet, w, 0.04, d, wood, 0, 0.03, 0, "", false);
  addBox(cabinet, w, 0.08, d, header, 0, 1.72, 0, "", false);
  const shelfYs = [0.34, 0.7, 1.06, 1.42];
  for (const y of shelfYs) {
    addBox(cabinet, w - 0.08, 0.025, d - 0.08, wood, 0, y, 0, "", false);
  }
  const colors = [0xff3b5c, 0xffc43d, 0x3d8bff, 0x3ddc84, 0xc59cff, 0xff9f1c, 0xef476f, 0x06d6a0, 0xffd166, 0x118ab2, 0xf72585, 0x4cc9f0, 0xff6b4a, 0x7d5fff, 0x2ec4b6, 0xffb703];
  colors.forEach((color, i) => {
    const shelf = shelfYs[Math.floor(i / 4)];
    const across = i % 4;
    const ph = 0.15 + (i % 3) * 0.02;
    const pw = 0.13 + (i % 2) * 0.02;
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, ph, pw),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    pack.name = "snack-pack";
    pack.position.set(w / 2 - 0.15, shelf + ph / 2 + 0.012, -d / 2 + 0.13 + across * ((d - 0.26) / 3));
    cabinet.add(pack);
  });
  const tag = labelPlane("SNACKS", "#3a140c", "#ffe4c8", 0.5, 0.1);
  tag.rotation.y = Math.PI / 2;
  tag.position.set(w / 2 + 0.018, 1.72, 0);
  cabinet.add(tag);
  parent.add(cabinet);
}
