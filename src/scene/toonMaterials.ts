import * as THREE from "three";

/** Shadow / mid / light steps of the cel ramp, as 0-255 luminance. */
const CEL_STEPS = new Uint8Array([84, 186, 255]);

let celGradientMap: THREE.DataTexture | null = null;

/**
 * Three-step ramp sampled with NearestFilter so lighting breaks into hard
 * bands instead of a smooth falloff. Shared by every toon material.
 */
export function getCelGradientMap(): THREE.DataTexture {
  if (celGradientMap) return celGradientMap;

  const texture = new THREE.DataTexture(CEL_STEPS, CEL_STEPS.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  celGradientMap = texture;
  return texture;
}

export function makeToonMaterial(color: number, emissive = 0x000000): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    emissive,
    emissiveIntensity: emissive === 0 ? 0 : 0.45,
    gradientMap: getCelGradientMap(),
  });
}
