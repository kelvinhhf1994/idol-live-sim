import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { addMovingHead, addParCan, createBeamCones, createSharedMaterials, type FakeBeam } from "../venueKit";
import { COLOR_PERIOD, CROWD_SWEEP, STAGE_SWEEP, createKowloonBayLightShow, type LightShowParts } from "./lightShow";
import type { LightShow } from "../createVenue";

const PALETTE = [0xff2f7d, 0x3f8cff, 0x00e5ff, 0xffaa00];

function buildParts(): LightShowParts {
  const group = new THREE.Group();
  const mats = createSharedMaterials();
  const headFrom = new THREE.Vector3(1.8, 4.9, -7);
  const headTo = new THREE.Vector3(1.44, 0.8, -9.5);
  const headBeam: FakeBeam = { from: headFrom, to: headTo.clone(), color: PALETTE[0], radius: 0.45 };
  const handle = addMovingHead(group, headFrom, headTo, PALETTE[0], mats);

  const light = new THREE.SpotLight(PALETTE[1], 55, 20, 0.42, 0.6, 1.2);
  light.position.set(-1.2, 5.2, -7);
  light.target.position.set(-1.0, 0.8, -9.5);
  const spotBeam: FakeBeam = { from: light.position.clone(), to: light.target.position.clone(), color: PALETTE[1], radius: 0.9 };

  const par = addParCan(group, new THREE.Vector3(0, 5.5, -6), new THREE.Vector3(0, 0.8, -9), PALETTE[2], mats);
  const beams = createBeamCones([headBeam, spotBeam]);
  return {
    heads: [{ handle, beam: headBeam, beamIndex: 0, homeTo: headTo.clone(), sweep: STAGE_SWEEP, phase: 0.4, colorOffset: 0 }],
    spots: [{ light, beam: spotBeam, beamIndex: 1, homeTo: light.target.position.clone(), sweep: STAGE_SWEEP, phase: 1.3, colorOffset: 1 }],
    pars: [par],
    beams,
    palette: PALETTE,
  };
}

describe("createKowloonBayLightShow", () => {
  it("drifts a spot's colour through the palette and moves its target over time", () => {
    const parts = buildParts();
    const show: LightShow = createKowloonBayLightShow(parts);
    const spot = parts.spots[0];
    show.update(0);
    const color0 = spot.light.color.getHex();
    const target0 = spot.light.target.position.clone();
    show.update(4);
    expect(spot.light.color.getHex()).not.toBe(color0);
    expect(spot.light.target.position.distanceTo(target0)).toBeGreaterThan(0.1);
    // Only the aim drifts; the lamp stays clamped to the bar
    expect(spot.light.position.x).toBeCloseTo(-1.2, 6);
  });

  it("only ever blends between neighbouring palette colours", () => {
    const parts = buildParts();
    const show = createKowloonBayLightShow(parts);
    show.update(0);
    expect(parts.heads[0].handle.lens.color.getHex()).toBe(PALETTE[0]);
    show.update(COLOR_PERIOD / 2); // half a step into the next colour: strictly between palette[0] and palette[1]
    const c = parts.heads[0].handle.lens.color;
    const a = new THREE.Color(PALETTE[0]);
    const b = new THREE.Color(PALETTE[1]);
    expect(c.r).toBeGreaterThanOrEqual(Math.min(a.r, b.r) - 1e-6);
    expect(c.r).toBeLessThanOrEqual(Math.max(a.r, b.r) + 1e-6);
    expect(c.getHex()).not.toBe(PALETTE[0]);
    expect(c.getHex()).not.toBe(PALETTE[1]);
  });

  it("pans and tilts the moving head model and its beam in step with the aim", () => {
    const parts = buildParts();
    const show = createKowloonBayLightShow(parts);
    const { handle, beam } = parts.heads[0];
    show.update(0);
    const pan0 = handle.fixture.rotation.y;
    const tilt0 = handle.head.rotation.x;
    const matrixVersion = parts.beams.instanceMatrix.version;
    const colorVersion = parts.beams.instanceColor!.version;
    show.update(5);
    expect(handle.fixture.rotation.y).not.toBeCloseTo(pan0, 3);
    expect(handle.head.rotation.x).not.toBeCloseTo(tilt0, 3);
    // needsUpdate is a write-only setter that bumps the attribute version
    expect(parts.beams.instanceMatrix.version).toBeGreaterThan(matrixVersion);
    expect(parts.beams.instanceColor!.version).toBeGreaterThan(colorVersion);

    // The cone's far end tracks the aim point we wrote into the beam
    const m = new THREE.Matrix4();
    parts.beams.getMatrixAt(0, m);
    const mid = new THREE.Vector3().setFromMatrixPosition(m);
    expect(mid.distanceTo(beam.from.clone().add(beam.to).multiplyScalar(0.5))).toBeLessThan(1e-6);
    expect(beam.to.distanceTo(parts.heads[0].homeTo)).toBeGreaterThan(0.1);
    expect(beam.color).toBe(handle.lens.color.getHex());
  });

  it("keeps every aim inside the sweep envelope around its home point", () => {
    const parts = buildParts();
    const show = createKowloonBayLightShow(parts);
    for (let t = 0; t < 60; t += 0.37) {
      show.update(t);
      const head = parts.heads[0];
      expect(Math.abs(head.beam.to.x - head.homeTo.x)).toBeLessThanOrEqual(STAGE_SWEEP.ampX + 1e-6);
      expect(Math.abs(head.beam.to.z - head.homeTo.z)).toBeLessThanOrEqual(STAGE_SWEEP.ampZ + 1e-6);
      expect(head.beam.to.y).toBeCloseTo(head.homeTo.y, 6);
    }
    expect(CROWD_SWEEP.ampX).toBeGreaterThan(STAGE_SWEEP.ampX);
  });

  it("paces the show for fast songs: a palette step within 2 s and a full sweep under 8 s", () => {
    const parts = buildParts();
    const show = createKowloonBayLightShow(parts);
    show.update(0);
    expect(parts.heads[0].handle.lens.color.getHex()).toBe(PALETTE[0]);
    show.update(COLOR_PERIOD);
    expect(parts.heads[0].handle.lens.color.getHex()).toBe(PALETTE[1]);
    expect(COLOR_PERIOD).toBeLessThanOrEqual(2);
    for (const sweep of [STAGE_SWEEP, CROWD_SWEEP]) {
      expect((2 * Math.PI) / sweep.speed).toBeLessThan(8);
    }
  });

  it("recolours PAR cans without moving them", () => {
    const parts = buildParts();
    const show = createKowloonBayLightShow(parts);
    const face = parts.pars[0].face;
    show.update(0);
    const hex0 = face.emissive.getHex();
    show.update(4);
    expect(face.emissive.getHex()).not.toBe(hex0);
    expect(face.color.getHex()).toBe(face.emissive.getHex());
  });
});
