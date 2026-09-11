import * as THREE from "three";
import {
  KB_BACK_WALL_Z,
  KB_HALL_CEILING,
  KB_MAX_X,
  KB_PARTITION_X,
  KB_REAR_WALL_Z,
  type ElevatedPlatform,
} from "../../config/venue";
import type { LightShow } from "../createVenue";
import {
  addBox,
  addMovingHead,
  addParCan,
  createBeamCones,
  setInstanceTransform,
  speakerGrilleTexture,
  type FakeBeam,
  type InstanceTransform,
  type ParCanHandle,
  type SharedMaterials,
} from "../venueKit";
import {
  CROWD_SWEEP,
  STAGE_SWEEP,
  createKowloonBayLightShow,
  type AnimatedHead,
  type AnimatedSpot,
  type Sweep,
} from "./lightShow";

export const PIPE_Y = 6.2;
export const STAGE_BAR_Y = 5.4;
export const STAGE_BAR_Z = -7.0;
const CROSS_PIPES_Z = [-9.0, -6.0, -2.0, 2.0] as const;
const LONG_PIPES_X = [-4.0, 0, 4.0] as const;
const TUBE_XS = [-3.5, 3.5] as const;
const TUBE_ZS = [-9.2, -5.6, -2.0, 1.6] as const;
// Key spots sit further out on the bar than the heads, so a tighter x sweep keeps them on the stage
const KEY_SPOT_SWEEP: Sweep = { ampX: 1.4, ampZ: 0.8, speed: 1.05 };

/** Fixture models plus the live handles the light show drives. */
export interface RigParts {
  tubeMaterial: THREE.MeshStandardMaterial;
  heads: AnimatedHead[];
  pars: ParCanHandle[];
}

export function buildRigging(
  group: THREE.Group,
  mats: SharedMaterials,
  colors: readonly number[],
  fakeBeams: FakeBeam[],
): RigParts {
  buildPipeGrid(group, mats);
  const tubeMaterial = buildFluorescents(group, mats);
  const { heads, pars } = buildFixtures(group, mats, colors, fakeBeams);
  buildLineArrays(group, mats);
  return { tubeMaterial, heads, pars };
}

/** Scaffold-pipe grid hung from the ceiling plus the lower fixture bar over the stage front. */
function buildPipeGrid(group: THREE.Group, mats: SharedMaterials): void {
  const transforms: InstanceTransform[] = [];
  // The grid covers the hall only; the backstage block has its own lighting
  const spanX = KB_MAX_X - KB_PARTITION_X - 0.4;
  const gridCx = (KB_PARTITION_X + KB_MAX_X) / 2;
  const spanZ = KB_REAR_WALL_Z - KB_BACK_WALL_Z - 0.4;
  for (const z of CROSS_PIPES_Z) transforms.push([gridCx, PIPE_Y, z, 0, 0, Math.PI / 2, 1, spanX, 1]);
  for (const x of LONG_PIPES_X) transforms.push([x, PIPE_Y + 0.08, (KB_BACK_WALL_Z + KB_REAR_WALL_Z) / 2, Math.PI / 2, 0, 0, 1, spanZ, 1]);
  // Drop rods from the slab to every intersection
  const dropLen = KB_HALL_CEILING - PIPE_Y;
  for (const z of CROSS_PIPES_Z) {
    for (const x of LONG_PIPES_X) transforms.push([x, PIPE_Y + dropLen / 2, z, 0, 0, 0, 1, dropLen, 1]);
  }
  // Fixture bar over the stage front, hung from the z = -6 cross pipe
  transforms.push([0, STAGE_BAR_Y, STAGE_BAR_Z, 0, 0, Math.PI / 2, 1, 8.6, 1]);
  for (const x of [-3.9, 3.9]) {
    const len = Math.hypot(PIPE_Y - STAGE_BAR_Y, CROSS_PIPES_Z[1] - STAGE_BAR_Z);
    transforms.push([
      x,
      (PIPE_Y + STAGE_BAR_Y) / 2,
      (CROSS_PIPES_Z[1] + STAGE_BAR_Z) / 2,
      Math.atan2(CROSS_PIPES_Z[1] - STAGE_BAR_Z, PIPE_Y - STAGE_BAR_Y),
      0,
      0,
      1,
      len,
      1,
    ]);
  }
  const pipes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), mats.steel, transforms.length);
  transforms.forEach((t, i) => setInstanceTransform(pipes, i, t));
  pipes.instanceMatrix.needsUpdate = true;
  pipes.castShadow = false;
  pipes.name = "pipe-grid";
  group.add(pipes);
}

/** Eight fluorescent battens hung under the grid; their tube material is the house-light emitter. */
function buildFluorescents(group: THREE.Group, mats: SharedMaterials): THREE.MeshStandardMaterial {
  const tubeMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a30, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 });
  for (const x of TUBE_XS) {
    for (const z of TUBE_ZS) {
      addBox(group, 1.25, 0.07, 0.14, mats.matteBlack, x, 6.0 + 0.05, z, "batten", false);
      addBox(group, 1.2, 0.04, 0.06, tubeMaterial, x, 6.0, z, "fluorescent-tube", false);
      for (const dx of [-0.5, 0.5]) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, PIPE_Y - 6.05, 4), mats.steel);
        wire.position.set(x + dx, (PIPE_Y + 6.05) / 2, z);
        group.add(wire);
      }
    }
  }
  return tubeMaterial;
}

/** Moving heads on the stage bar and the mid-hall pipe, PAR cans on the z = -6 pipe. */
function buildFixtures(
  group: THREE.Group,
  mats: SharedMaterials,
  colors: readonly number[],
  fakeBeams: FakeBeam[],
): Pick<RigParts, "heads" | "pars"> {
  const color = (i: number) => colors[i % colors.length] ?? 0xffffff;
  const heads: AnimatedHead[] = [];
  const addHead = (from: THREE.Vector3, to: THREE.Vector3, hex: number, radius: number, sweep: Sweep, phase: number, colorOffset: number) => {
    const handle = addMovingHead(group, from, to, hex, mats);
    const beam: FakeBeam = { from, to, color: hex, radius };
    heads.push({ handle, beam, beamIndex: fakeBeams.length, homeTo: to.clone(), sweep, phase, colorOffset });
    fakeBeams.push(beam);
  };
  [-3.6, -1.8, 0, 1.8, 3.6].forEach((x, i) => {
    const from = new THREE.Vector3(x, STAGE_BAR_Y - 0.5, STAGE_BAR_Z);
    const to = new THREE.Vector3(x * 0.8, 0.8, -9.5);
    addHead(from, to, color(i), 0.45, STAGE_SWEEP, i * 1.1, i);
  });
  [-4.0, -2.0, 0, 2.0, 4.0].forEach((x, i) => {
    const from = new THREE.Vector3(x, PIPE_Y - 0.5, CROSS_PIPES_Z[2]);
    const to = new THREE.Vector3(-x * 0.5, 0.5, -5.0);
    addHead(from, to, color(i + 2), 0.6, CROWD_SWEEP, i * 0.9 + 0.5, i + 2);
  });
  const pars = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75].map((x, i) =>
    addParCan(group, new THREE.Vector3(x, PIPE_Y - 0.15, CROSS_PIPES_Z[1]), new THREE.Vector3(x, 0.8, -9.0), color(i + 1), mats),
  );
  return { heads, pars };
}

/** Four-box line array flown on the hall +X side. The -X hang sat inside the 2/F backstage and was removed. */
function buildLineArrays(group: THREE.Group, mats: SharedMaterials): void {
  const grilleMat = new THREE.MeshStandardMaterial({ map: speakerGrilleTexture(), roughness: 0.8 });
  const array = new THREE.Group();
  array.name = "line-array";
  array.position.set(5.6, 0, -7.2);
  addBox(array, 0.7, 0.08, 0.6, mats.steel, 0, 6.15, 0, "", false);
  for (let i = 0; i < 4; i++) {
    const y = 5.9 - i * 0.42;
    const cabinet = addBox(array, 0.6, 0.38, 0.5, mats.fixtureBlack, 0, y, 0);
    cabinet.rotation.x = -0.06 * i; // Lower boxes aim further down toward the crowd
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.32), grilleMat);
    grille.position.set(0, 0, 0.251);
    cabinet.add(grille);
  }
  group.add(array);
}

/**
 * Show lighting: base fill, crowd wash, four ShowController key spots, two back lights and volumetric beam cones.
 * Also assembles the light show that sweeps and recolours the spots and the rig's fixtures.
 */
export function createShowLights(
  group: THREE.Group,
  colors: readonly number[],
  stage: ElevatedPlatform,
  fakeBeams: readonly FakeBeam[],
  showOnly: THREE.Object3D[],
  rig: Pick<RigParts, "heads" | "pars">,
): { stageLights: THREE.SpotLight[]; lightShow: LightShow } {
  group.add(new THREE.HemisphereLight(0x2a2450, 0x050409, 0.7));
  const crowdWash = new THREE.PointLight(0x2a3cff, 26, 13, 1.5);
  crowdWash.position.set(1.0, 4.5, -2.0);
  group.add(crowdWash);

  const centerZ = (stage.bounds.minZ + stage.bounds.maxZ) / 2;
  // Soft neutral face fill from the mid-hall pipe so the idols stay readable between sweeping beams.
  // Narrow cone (~16 deg) covers just the performer line so it never pools on the stage floor or LED wall.
  const faceFill = new THREE.SpotLight(0xffe6d6, 4, 24, 0.28, 1.0, 1.0);
  faceFill.name = "face-fill";
  faceFill.position.set(0, PIPE_Y - 0.3, CROSS_PIPES_Z[2]);
  faceFill.target.position.set(0, stage.height + 1.1, centerZ);
  faceFill.castShadow = false;
  group.add(faceFill, faceFill.target);
  const lights = colors.map((color, idx) => {
    const light = new THREE.SpotLight(color, 55, 20, 0.42, 0.6, 1.2);
    light.position.set(-3.6 + idx * 2.4, STAGE_BAR_Y - 0.2, STAGE_BAR_Z);
    light.target.position.set(-3.0 + idx * 2.0, 0.8, centerZ);
    light.castShadow = false;
    group.add(light, light.target);
    return light;
  });

  // Back lights rake the crowd floor from 12 m away, so keep them narrow and modest or they pool into one big wash
  const backBlue = new THREE.SpotLight(0x3f6cff, 20, 24, 0.34, 0.8, 1.1);
  backBlue.position.set(-2.8, PIPE_Y - 0.3, CROSS_PIPES_Z[0]);
  backBlue.target.position.set(2.0, 0, 2.0);
  const backPurple = new THREE.SpotLight(0x8a3cff, 20, 24, 0.34, 0.8, 1.1);
  backPurple.position.set(2.8, PIPE_Y - 0.3, CROSS_PIPES_Z[0]);
  backPurple.target.position.set(-2.0, 0, 2.0);
  group.add(backBlue, backBlue.target, backPurple, backPurple.target);

  // Fixture beams keep the indices buildFixtures recorded; spot beams are appended after them
  const beams: FakeBeam[] = [...fakeBeams];
  const spots: AnimatedSpot[] = [];
  const addSpot = (light: THREE.SpotLight, radius: number, sweep: Sweep, phase: number, colorOffset: number) => {
    const beam: FakeBeam = { from: light.position.clone(), to: light.target.position.clone(), color: light.color.getHex(), radius };
    spots.push({ light, beam, beamIndex: beams.length, homeTo: light.target.position.clone(), sweep, phase, colorOffset });
    beams.push(beam);
  };
  lights.forEach((light, idx) => addSpot(light, 0.9, KEY_SPOT_SWEEP, idx * 1.4 + 0.7, idx));
  // Adjacent palette offsets: complementary pairs (blue + amber) overlap on the floor and mix to white
  addSpot(backBlue, 1.3, CROWD_SWEEP, 2.1, 1);
  addSpot(backPurple, 1.3, CROWD_SWEEP, 4.0, 2);

  const beamMesh = createBeamCones(beams);
  group.add(beamMesh);
  showOnly.push(beamMesh);
  const lightShow = createKowloonBayLightShow({ heads: rig.heads, spots, pars: rig.pars, beams: beamMesh, palette: colors });
  return { stageLights: lights, lightShow };
}
