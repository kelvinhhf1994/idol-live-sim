import * as THREE from "three";
import {
  KB_BACK_WALL_Z,
  KB_HALL_CEILING,
  KB_MAX_X,
  KB_MIN_X,
  KB_REAR_WALL_Z,
  KB_VESTIBULE,
  KB_WC_BLOCK,
} from "../../config/venue";
import { addBox, pleatedCurtainTexture, woodPlankTexture, type SharedMaterials, type WoodPlankPalette } from "../venueKit";
import { acousticTileTexture } from "./textures";

const WALL_T = 0.3;
const WIDTH = KB_MAX_X - KB_MIN_X;
const DEPTH = KB_REAR_WALL_Z - KB_BACK_WALL_Z;
const CENTER_X = (KB_MIN_X + KB_MAX_X) / 2;
const CENTER_Z = (KB_BACK_WALL_Z + KB_REAR_WALL_Z) / 2;
export const ACOUSTIC_TILE_TOP_Y = 3.2;

// Light grey laminate seen in every reference photo
const GREY_PLANKS: WoodPlankPalette = {
  base: "#cfcbc4",
  planks: ["#d6d2cb", "#c9c5be", "#dedad3", "#c2beb7", "#d0ccc5", "#d9d5ce"],
  grain: "rgba(70, 65, 60, 0.14)",
  seam: "rgba(60, 55, 50, 0.45)",
};

/** Acoustic-tile material sized so the 0.6 m tile grid stays square on a w × h plane. */
export function acousticTileMaterial(width: number, height: number): THREE.MeshStandardMaterial {
  const map = acousticTileTexture();
  map.repeat.set(width / 0.6, height / 0.6);
  return new THREE.MeshStandardMaterial({ map, roughness: 1.0 });
}

export function buildShell(group: THREE.Group, mats: SharedMaterials): void {
  const floorTexture = woodPlankTexture(GREY_PLANKS);
  floorTexture.repeat.set(3, 4);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(WIDTH, 0.1, DEPTH),
    new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.55, metalness: 0.05 }),
  );
  floor.position.set(CENTER_X, -0.05, CENTER_Z);
  floor.receiveShadow = true;
  floor.name = "plank-floor";
  group.add(floor);

  // Exposed black ceiling far overhead
  addBox(group, WIDTH + 2 * WALL_T, 0.2, DEPTH + 2 * WALL_T, mats.matteBlack, CENTER_X, KB_HALL_CEILING + 0.1, CENTER_Z, "ceiling", false);

  // Structural walls
  addBox(group, WALL_T, KB_HALL_CEILING, DEPTH + 2 * WALL_T, mats.wallCharcoal, KB_MIN_X - WALL_T / 2, KB_HALL_CEILING / 2, CENTER_Z, "wall-left");
  addBox(group, WALL_T, KB_HALL_CEILING, DEPTH + 2 * WALL_T, mats.wallCharcoal, KB_MAX_X + WALL_T / 2, KB_HALL_CEILING / 2, CENTER_Z, "wall-right");
  addBox(group, WIDTH, KB_HALL_CEILING, WALL_T, mats.wallCharcoal, CENTER_X, KB_HALL_CEILING / 2, KB_BACK_WALL_Z - WALL_T / 2, "wall-back");
  addBox(group, WIDTH, KB_HALL_CEILING, WALL_T, mats.wallCharcoal, CENTER_X, KB_HALL_CEILING / 2, KB_REAR_WALL_Z + WALL_T / 2, "wall-rear");

  // Black pleated curtains on the inner faces (PlaneGeometry faces +Z before rotation)
  const curtainMat = new THREE.MeshStandardMaterial({ map: pleatedCurtainTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const hang = (w: number, h: number, x: number, y: number, z: number, rotY: number, name: string) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), curtainMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.name = name;
    group.add(mesh);
  };
  hang(WIDTH, KB_HALL_CEILING, CENTER_X, KB_HALL_CEILING / 2, KB_BACK_WALL_Z + 0.05, 0, "curtain-back");
  const rightLen = KB_REAR_WALL_Z - KB_WC_BLOCK.maxZ;
  hang(rightLen, KB_HALL_CEILING, KB_MAX_X - 0.05, KB_HALL_CEILING / 2, KB_WC_BLOCK.maxZ + rightLen / 2, -Math.PI / 2, "curtain-right");
  hang(DEPTH, KB_HALL_CEILING, KB_MIN_X + 0.05, KB_HALL_CEILING / 2, CENTER_Z, Math.PI / 2, "curtain-left");
  const upper = KB_HALL_CEILING - ACOUSTIC_TILE_TOP_Y;
  hang(WIDTH, upper, CENTER_X, ACOUSTIC_TILE_TOP_Y + upper / 2, KB_REAR_WALL_Z - 0.05, Math.PI, "curtain-rear");

  // Grey acoustic foam tiles on the rear wall beside the vestibule
  const tileWidth = KB_MAX_X - KB_VESTIBULE.maxX;
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(tileWidth, ACOUSTIC_TILE_TOP_Y), acousticTileMaterial(tileWidth, ACOUSTIC_TILE_TOP_Y));
  tiles.position.set(KB_VESTIBULE.maxX + tileWidth / 2, ACOUSTIC_TILE_TOP_Y / 2, KB_REAR_WALL_Z - 0.04);
  tiles.rotation.y = Math.PI;
  tiles.name = "acoustic-wall";
  group.add(tiles);

  // Cassette air-conditioning units recessed into the ceiling
  for (const [x, z] of [[2.5, -3.0], [2.5, 1.5], [-2.0, -1.0]] as const) {
    const unit = addBox(group, 0.95, 0.22, 0.95, mats.offWhite, x, KB_HALL_CEILING - 0.11, z, "air-con", false);
    addBox(unit, 0.55, 0.02, 0.55, mats.matteBlack, 0, -0.12, 0, "", false);
  }
}
