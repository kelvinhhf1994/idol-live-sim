import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { getCelGradientMap, makeToonMaterial } from "./toonMaterials";

describe("toon materials", () => {
  it("shares one nearest-filtered three-step cel ramp", () => {
    const ramp = getCelGradientMap();

    expect(getCelGradientMap()).toBe(ramp);
    expect(ramp.image.width).toBe(3);
    expect(ramp.minFilter).toBe(THREE.NearestFilter);
    expect(ramp.magFilter).toBe(THREE.NearestFilter);
    expect(ramp.generateMipmaps).toBe(false);
  });

  it("builds toon materials wired to the cel ramp", () => {
    const material = makeToonMaterial(0xff397d);

    expect(material).toBeInstanceOf(THREE.MeshToonMaterial);
    expect(material.gradientMap).toBe(getCelGradientMap());
    expect(material.color.getHex()).toBe(0xff397d);
    expect(material.emissiveIntensity).toBe(0);
  });

  it("keeps emissive accents lit", () => {
    const material = makeToonMaterial(0xd6ff3f, 0xd6ff3f);

    expect(material.emissive.getHex()).toBe(0xd6ff3f);
    expect(material.emissiveIntensity).toBeGreaterThan(0);
  });
});
