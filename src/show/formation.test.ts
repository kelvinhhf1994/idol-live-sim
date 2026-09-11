import { describe, expect, it } from "vitest";
import { formationPoints } from "./formation";

const line = { y: 0.7, z: -7.7, spacing: 1.15 };
const step = line.spacing * 0.75;

describe("formationPoints", () => {
  it("centres the formation on stage centre for odd and even counts", () => {
    for (const count of [1, 2, 3, 7]) {
      const xs = formationPoints(line, count).map((point) => point.x);

      expect(xs).toHaveLength(count);
      expect(xs.reduce((sum, x) => sum + x, 0)).toBeCloseTo(0, 10);
    }
    expect(formationPoints(line, 1)[0].x).toBe(0);
  });

  it("keeps a constant x gap and the configured stage height", () => {
    const points = formationPoints(line, 7);

    for (let index = 1; index < points.length; index += 1) {
      expect(points[index].x - points[index - 1].x).toBeCloseTo(line.spacing, 10);
    }
    for (const point of points) {
      expect(point.y).toBe(line.y);
    }
  });

  it("parks a single idol and a duo on the front row", () => {
    expect(formationPoints(line, 1)[0].z).toBe(line.z);
    expect(formationPoints(line, 2).map((point) => point.z)).toEqual([line.z, line.z]);
  });

  it("forms a V for three to five idols: centre in front, outer ranks stepping back", () => {
    const trio = formationPoints(line, 3).map((point) => point.z);
    expect(trio[1]).toBe(line.z);
    expect(trio[0]).toBeCloseTo(line.z - step, 10);
    expect(trio[2]).toBeCloseTo(line.z - step, 10);

    const quartet = formationPoints(line, 4).map((point) => point.z);
    expect(quartet[1]).toBe(line.z);
    expect(quartet[2]).toBe(line.z);
    expect(quartet[0]).toBeCloseTo(line.z - step, 10);
    expect(quartet[3]).toBeCloseTo(line.z - step, 10);

    const quintet = formationPoints(line, 5).map((point) => point.z);
    expect(quintet[2]).toBe(line.z);
    expect(quintet[1]).toBeCloseTo(line.z - step, 10);
    expect(quintet[3]).toBeCloseTo(line.z - step, 10);
    expect(quintet[0]).toBeCloseTo(line.z - 2 * step, 10);
    expect(quintet[4]).toBeCloseTo(line.z - 2 * step, 10);
  });

  it("zigzags six or more idols across two rows with the centre idol in front", () => {
    for (const count of [6, 7, 12]) {
      const zs = formationPoints(line, count).map((point) => point.z);
      const centre = Math.floor((count - 1) / 2);

      expect(zs[centre]).toBe(line.z);
      for (let index = 0; index < count; index += 1) {
        const expected = (index - centre) % 2 === 0 ? line.z : line.z - step;
        expect(zs[index]).toBeCloseTo(expected, 10);
      }
      expect(new Set(zs.map((z) => z.toFixed(6))).size).toBe(2);
    }
  });
});
