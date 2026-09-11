import { describe, expect, it } from "vitest";
import { createPersonPose } from "../animation/personPose";
import { writeSitPose } from "./SitPose";

describe("writeSitPose", () => {
  it("folds both legs into a seated stance", () => {
    const pose = createPersonPose();
    writeSitPose(pose);
    expect(pose.leftHipX).toBeGreaterThan(1);
    expect(pose.rightHipX).toBeGreaterThan(1);
    expect(pose.leftKnee).toBeGreaterThan(1.2);
    expect(pose.rightKnee).toBeGreaterThan(1.2);
  });
});
