import * as THREE from "three";
import type { VenueDefinition } from "../../config/venue";
import type { VenueBuild } from "../createVenue";
import { createAtmosphericCrowd, createHouseLights, createSharedMaterials, type FakeBeam } from "../venueKit";
import { buildBackstage } from "./backstage";
import { buildProps } from "./props";
import { buildRigging, createShowLights } from "./rigging";
import { buildShell } from "./shell";
import { buildStage } from "./stage";

// Penlight crowd on the hall floor (x > partition, z between the walkway and the rear tables)
const CROWD_POSITIONS: readonly (readonly [number, number])[] = [
  [-3.6, -6.4], [-1.8, -6.5], [0.2, -6.4], [2.0, -6.5], [3.8, -6.3],
  [-3.9, -5.3], [-2.2, -5.2], [-0.4, -5.4], [1.4, -5.2], [3.0, -5.3], [4.6, -5.4],
  [-3.2, -4.1], [-1.4, -4.0], [0.6, -4.1], [2.4, -4.0], [4.0, -4.2],
  [-2.6, -2.9], [-0.8, -2.8], [1.0, -2.9], [2.8, -2.7],
  [-1.6, -1.6], [0.4, -1.5], [2.2, -1.7],
];

export function createKowloonBayVenue(definition: VenueDefinition): VenueBuild {
  const group = new THREE.Group();
  group.name = definition.id;
  const colliders = definition.colliders.map((collider) => ({ ...collider }));
  const mats = createSharedMaterials();
  const stagePlatform = definition.platforms[0];
  if (!stagePlatform) throw new Error("Kowloon Bay must define the stage as platforms[0]");
  const showOnly: THREE.Object3D[] = []; // Hidden while house lights are on (volumetric beams)
  const fakeBeams: FakeBeam[] = [];

  buildShell(group, mats);
  buildStage(group, mats, stagePlatform, definition.crowdBarrier);
  buildBackstage(group, mats);
  const rig = buildRigging(group, mats, definition.show.lightColors, fakeBeams);
  buildProps(group, mats);
  const crowd = createAtmosphericCrowd(group, CROWD_POSITIONS);
  const { stageLights, lightShow } = createShowLights(group, definition.show.lightColors, stagePlatform, fakeBeams, showOnly, rig);
  const houseLights = createHouseLights(group, { panelMaterial: rig.tubeMaterial }, showOnly);

  return {
    group,
    colliders,
    audiencePoints: definition.show.audiencePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    stageLights,
    houseLights,
    lightShow,
    knockableProps: crowd,
  };
}
