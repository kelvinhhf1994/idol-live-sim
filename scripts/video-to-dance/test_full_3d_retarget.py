#!/usr/bin/env python3
"""full-3d retarget writes yaw and rotates feet with the body."""

from __future__ import annotations

import math
import tempfile
import unittest
from pathlib import Path

from retarget_motion import _retarget_full_3d, rotate_y


def _joint(x: float, y: float, z: float) -> list[float]:
    return [x, y, z]


class Full3dRetargetTests(unittest.TestCase):
    def test_rotate_y_turns_left_foot_to_stage_right_after_pi(self) -> None:
        turned = rotate_y([ -0.14, 0.0, 0.0 ], math.pi)
        self.assertAlmostEqual(turned[0], 0.14, places=5)
        self.assertAlmostEqual(turned[2], 0.0, places=5)

    def test_clip_keeps_unwrapped_yaw_and_swaps_group_feet_after_turn(self) -> None:
        frames = []
        for i, yaw in enumerate((0.0, math.pi)):
            frames.append(
                {
                    "timestamp": i * 0.5,
                    "frameIndex": i,
                    "root": {"x": 0.0, "y": 0.0, "z": 0.0},
                    "facingYaw": yaw,
                    "joints": {
                        "Neck": _joint(0.0, 0.5, 0.0),
                        "Nose": _joint(0.0, 0.65, 0.05),
                        "LShoulder": _joint(-0.19, 0.48, 0.0),
                        "RShoulder": _joint(0.19, 0.48, 0.0),
                        "LElbow": _joint(-0.38, 0.25, 0.08),
                        "RElbow": _joint(0.38, 0.25, 0.08),
                        "LWrist": _joint(-0.4, 0.05, 0.1),
                        "RWrist": _joint(0.4, 0.05, 0.1),
                        "LHip": _joint(-0.11, 0.0, 0.0),
                        "RHip": _joint(0.11, 0.0, 0.0),
                        "LAnkle": _joint(-0.14, -0.8, 0.0),
                        "RAnkle": _joint(0.14, -0.8, 0.0),
                    },
                }
            )
        # Joints are already in world/character space, so a pi turn must
        # rotate the stored joints too or localize() would see a facing body.
        turned = frames[1]["joints"]
        for name, point in list(turned.items()):
            rotated = rotate_y(point, math.pi)
            turned[name] = [float(rotated[0]), float(rotated[1]), float(rotated[2])]

        character = {
            "torsoHeight": 0.526,
            "restLeftFootX": -0.14,
            "restRightFootX": 0.14,
            "upperArm": 0.265,
            "ankleHeight": 0.08,
        }
        config = {
            "contact": {
                "enterHeight": 0.028,
                "exitHeight": 0.05,
                "enterSpeed": 0.38,
                "exitSpeed": 0.62,
                "minHoldFrames": 1,
            }
        }
        with tempfile.TemporaryDirectory() as tmp:
            clip = _retarget_full_3d(
                Path(tmp),
                {"frames": frames, "uncertainSpans": []},
                {"targetRig": "person-rig-chibi-idol", "applyPath": "applyIdolDancePose"},
                character,
                frames,
                2.0,
                -0.14,
                0.14,
                0.265,
                "in-place",
                config,
            )
        self.assertEqual(clip["captureMode"], "full-3d")
        self.assertAlmostEqual(clip["poses"][0]["bodyYaw"], 0.0, places=5)
        self.assertAlmostEqual(clip["poses"][1]["bodyYaw"], math.pi, places=5)
        self.assertLess(clip["poses"][0]["leftFootX"], 0.0)
        self.assertGreater(clip["poses"][0]["rightFootX"], 0.0)
        self.assertGreater(clip["poses"][1]["leftFootX"], 0.0)
        self.assertLess(clip["poses"][1]["rightFootX"], 0.0)


if __name__ == "__main__":
    unittest.main()
