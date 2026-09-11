export interface RigMapping {
  targetRig: "person-rig-chibi-idol";
  constructor: "createChibiIdol";
  applyPath: "applyIdolDancePose";
  localRotationConvention: "person-pose-euler-complete";
  quaternionOrder: readonly ["x", "y", "z", "w"];
}

export const CHIBI_IDOL_RIG_MAPPING: RigMapping = {
  targetRig: "person-rig-chibi-idol",
  constructor: "createChibiIdol",
  applyPath: "applyIdolDancePose",
  localRotationConvention: "person-pose-euler-complete",
  quaternionOrder: ["x", "y", "z", "w"],
};
