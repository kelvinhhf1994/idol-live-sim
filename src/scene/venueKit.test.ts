import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  addMovingHead,
  addParCan,
  aimAngles,
  buildFohChair,
  buildLightingConsole,
  buildSoundMixer,
  createBeamCones,
  createSharedMaterials,
  FOH_CHAIR_SEAT_HEIGHT,
  setBeamInstance,
} from "./venueKit";

function worldBox(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}

describe("FOH desk props", () => {
  it("builds a lighting console about 1.2m wide that faces -Z with a raised twin screen at the back", () => {
    const console = buildLightingConsole();
    expect(console.name).toBe("lighting-console");
    const box = worldBox(console);
    expect(box.max.x - box.min.x).toBeCloseTo(1.2, 1);
    expect(box.max.z - box.min.z).toBeGreaterThan(0.5);
    expect(box.max.z - box.min.z).toBeLessThan(0.75);
    expect(box.min.y).toBeCloseTo(0, 5);
    const screen = console.getObjectByName("console-screen") as THREE.Mesh;
    expect(screen).toBeDefined();
    const screenPos = screen.getWorldPosition(new THREE.Vector3());
    // Screen stands on the rear (-Z) edge above the fader deck
    expect(screenPos.z).toBeLessThan(-0.15);
    expect(screenPos.y).toBeGreaterThan(0.25);
    expect(console.getObjectByName("console-deck")).toBeDefined();
    expect(console.getObjectByName("console-encoder")).toBeDefined();
  });

  it("builds a flat sound mixer about 1.1m wide with screens on the far edge and faders towards the operator", () => {
    const mixer = buildSoundMixer();
    expect(mixer.name).toBe("sound-mixer");
    const box = worldBox(mixer);
    expect(box.max.x - box.min.x).toBeCloseTo(1.1, 1);
    expect(box.max.y).toBeLessThan(0.25);
    const screens = mixer.getObjectByName("mixer-screen") as THREE.Mesh;
    const faders = mixer.getObjectByName("mixer-faders") as THREE.Mesh;
    expect(screens.getWorldPosition(new THREE.Vector3()).z).toBeLessThan(faders.getWorldPosition(new THREE.Vector3()).z);
    let caps = 0;
    mixer.traverse((o) => {
      if (o.name === "fader-cap") caps += 1;
    });
    expect(caps).toBeGreaterThanOrEqual(24);
  });

  it("builds an FOH chair whose seat top sits at the sit-pose height with the backrest behind (+Z)", () => {
    const chair = buildFohChair();
    expect(chair.name).toBe("foh-chair");
    expect(FOH_CHAIR_SEAT_HEIGHT).toBeCloseTo(0.44, 5);
    chair.updateMatrixWorld(true);
    const seat = chair.getObjectByName("seat")!;
    const seatBox = new THREE.Box3().setFromObject(seat);
    expect(seatBox.max.y).toBeCloseTo(FOH_CHAIR_SEAT_HEIGHT, 5);
    const back = chair.getObjectByName("backrest")!;
    expect(back.getWorldPosition(new THREE.Vector3()).z).toBeGreaterThan(seat.getWorldPosition(new THREE.Vector3()).z);
    expect(worldBox(chair).min.y).toBeCloseTo(0, 5);
  });
});

describe("addMovingHead", () => {
  it("returns a handle whose fixture is parented and whose head tilt matches aimAngles", () => {
    const parent = new THREE.Group();
    const from = new THREE.Vector3(1, 5, -7);
    const to = new THREE.Vector3(0.5, 0.8, -9.5);
    const handle = addMovingHead(parent, from, to, 0xff2f7d, createSharedMaterials());

    expect(handle.fixture.parent).toBe(parent);
    expect(handle.head.parent).toBe(handle.fixture);
    const { pan, tilt } = aimAngles(from, to);
    expect(handle.fixture.rotation.y).toBeCloseTo(pan, 6);
    expect(handle.head.rotation.x).toBeCloseTo(tilt, 6);
    expect(handle.lens.emissive.getHex()).toBe(0xff2f7d);
  });
});

describe("addParCan", () => {
  it("returns the emissive face material", () => {
    const parent = new THREE.Group();
    const handle = addParCan(parent, new THREE.Vector3(0, 5, -6), new THREE.Vector3(0, 0.8, -9), 0x3f8cff, createSharedMaterials());
    expect(handle.face.emissive.getHex()).toBe(0x3f8cff);
    expect(parent.children.some((c) => c.name === "par-can")).toBe(true);
  });
});

describe("setBeamInstance", () => {
  it("rewrites one cone's transform and colour without touching its neighbours", () => {
    const beams = [
      { from: new THREE.Vector3(0, 5, 0), to: new THREE.Vector3(0, 0, 0), color: 0xff0000, radius: 1 },
      { from: new THREE.Vector3(2, 5, 0), to: new THREE.Vector3(2, 0, 0), color: 0x00ff00, radius: 1 },
    ];
    const mesh = createBeamCones(beams);
    const before1 = new THREE.Matrix4();
    mesh.getMatrixAt(1, before1);

    setBeamInstance(mesh, 0, { from: new THREE.Vector3(0, 5, 0), to: new THREE.Vector3(3, 1, 0), color: 0x0000ff, radius: 0.5 });

    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    m.decompose(pos, quat, scale);
    expect(pos.x).toBeCloseTo(1.5, 6);
    expect(pos.y).toBeCloseTo(3, 6);
    expect(scale.x).toBeCloseTo(0.5, 6);
    expect(scale.y).toBeCloseTo(5, 6);

    const c = new THREE.Color();
    mesh.getColorAt(0, c);
    expect(c.getHex()).toBe(0x0000ff);
    const after1 = new THREE.Matrix4();
    mesh.getMatrixAt(1, after1);
    expect(after1.equals(before1)).toBe(true);
  });
});
