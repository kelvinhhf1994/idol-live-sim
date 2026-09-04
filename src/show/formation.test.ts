import { describe, expect, it } from "vitest";
import { formationPoints } from "./formation";

const line = { y: 0.7, z: -7.7, spacing: 1.15 };

describe("formationPoints", () => {
  it("centres the row on stage centre for odd and even counts", () => {
    for (const count of [1, 2, 3, 7]) {
      const xs = formationPoints(line, count).map((point) => point.x);

      expect(xs).toHaveLength(count);
      expect(xs.reduce((sum, x) => sum + x, 0)).toBeCloseTo(0, 10);
    }
    expect(formationPoints(line, 1)[0].x).toBe(0);
  });

  it("keeps a constant gap and the configured stage height and depth", () => {
    const points = formationPoints(line, 7);

    for (let index = 1; index < points.length; index += 1) {
      expect(points[index].x - points[index - 1].x).toBeCloseTo(line.spacing, 10);
    }
    for (const point of points) {
      expect(point.y).toBe(line.y);
      expect(point.z).toBe(line.z);
    }
  });
});
