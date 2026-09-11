import * as THREE from "three";
import type { LightShow } from "../createVenue";
import { aimAngles, setBeamInstance, type FakeBeam, type MovingHeadHandle, type ParCanHandle } from "../venueKit";

// Paced for fast songs: a full sweep takes 6-8 s and each palette step blends over COLOR_PERIOD seconds (a bar at ~120 BPM).

/** Lissajous envelope around a fixture's home aim point (metres, rad/s). */
export interface Sweep {
  ampX: number;
  ampZ: number;
  speed: number;
}

/** Stage-bar fixtures stay inside the 9 m x 3 m stage footprint. */
export const STAGE_SWEEP: Sweep = { ampX: 1.6, ampZ: 0.8, speed: 0.95 };
/** Mid-hall fixtures wander over the crowd floor. */
export const CROWD_SWEEP: Sweep = { ampX: 2.2, ampZ: 1.5, speed: 0.8 };

export const COLOR_PERIOD = 2;

interface AnimatedBeam {
  beam: FakeBeam;
  beamIndex: number;
  homeTo: THREE.Vector3;
  sweep: Sweep;
  phase: number;
  /** Palette offset in steps so the rig is never monochrome. */
  colorOffset: number;
}

export interface AnimatedHead extends AnimatedBeam {
  handle: MovingHeadHandle;
}

export interface AnimatedSpot extends AnimatedBeam {
  light: THREE.SpotLight;
}

export interface LightShowParts {
  heads: AnimatedHead[];
  spots: AnimatedSpot[];
  pars: ParCanHandle[];
  beams: THREE.InstancedMesh;
  palette: readonly number[];
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function createKowloonBayLightShow(parts: LightShowParts): LightShow {
  const palette = parts.palette.map((hex) => new THREE.Color(hex));
  const color = new THREE.Color();
  const aim = new THREE.Vector3();

  const paletteAt = (t: number): THREE.Color => {
    const n = palette.length;
    const step = Math.floor(t);
    const a = palette[((step % n) + n) % n];
    const b = palette[(((step + 1) % n) + n) % n];
    return color.copy(a).lerp(b, smoothstep(t - step));
  };

  const sweepAim = (item: AnimatedBeam, elapsed: number): THREE.Vector3 => {
    const { homeTo, sweep, phase } = item;
    return aim.set(
      homeTo.x + Math.sin(elapsed * sweep.speed + phase) * sweep.ampX,
      homeTo.y,
      homeTo.z + Math.cos(elapsed * sweep.speed * 0.7 + phase) * sweep.ampZ,
    );
  };

  const writeBeam = (item: AnimatedBeam, to: THREE.Vector3, tint: THREE.Color): void => {
    item.beam.to.copy(to);
    item.beam.color = tint.getHex();
    setBeamInstance(parts.beams, item.beamIndex, item.beam);
  };

  return {
    update(elapsed) {
      const colorT = elapsed / COLOR_PERIOD;
      for (const head of parts.heads) {
        const to = sweepAim(head, elapsed);
        const tint = paletteAt(colorT + head.colorOffset);
        const { pan, tilt } = aimAngles(head.beam.from, to);
        head.handle.fixture.rotation.y = pan;
        head.handle.head.rotation.x = tilt;
        head.handle.lens.color.copy(tint);
        head.handle.lens.emissive.copy(tint);
        writeBeam(head, to, tint);
      }
      for (const spot of parts.spots) {
        const to = sweepAim(spot, elapsed);
        const tint = paletteAt(colorT + spot.colorOffset);
        spot.light.color.copy(tint);
        spot.light.target.position.copy(to);
        writeBeam(spot, to, tint);
      }
      parts.pars.forEach((par, i) => {
        const tint = paletteAt(colorT + i * 0.35);
        par.face.color.copy(tint);
        par.face.emissive.copy(tint);
      });
      parts.beams.instanceMatrix.needsUpdate = true;
      if (parts.beams.instanceColor) parts.beams.instanceColor.needsUpdate = true;
    },
  };
}
