import * as THREE from "three";

/** Outline thickness in metres, measured in the outlined mesh's own space. */
export const OUTLINE_THICKNESS = 0.003;

const outlineMaterial = new THREE.MeshBasicMaterial({
  color: 0x140f1a,
  side: THREE.BackSide,
});

/**
 * Inverted-hull outline: a back-faced shell sharing the source geometry.
 *
 * The shell is scaled from a fixed thickness rather than a fixed percentage so
 * that thin limbs and the head get the same visual line weight, and so the
 * silhouette only grows by `thickness`.
 */
export function addOutline(mesh: THREE.Mesh, thickness = OUTLINE_THICKNESS): THREE.Mesh {
  const geometry = mesh.geometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const radius = Math.max(geometry.boundingSphere?.radius ?? 1, 1e-4);

  const shell = new THREE.Mesh(geometry, outlineMaterial);
  shell.name = "outline";
  shell.scale.setScalar(1 + thickness / radius);
  shell.castShadow = false;
  shell.receiveShadow = false;
  mesh.add(shell);
  return shell;
}
