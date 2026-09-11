#!/usr/bin/env python3
"""Front-facing video: lock yaw so chest and face stay toward the audience."""

from __future__ import annotations

import math
import unittest

import numpy as np

from retarget_motion import facing_torso_channels


class FacingTorsoTests(unittest.TestCase):
    def test_level_shoulders_do_not_yaw_the_chest(self) -> None:
        neck = np.array([0.0, 0.52, 0.0])
        l_sh = np.array([-0.19, 0.48, 0.0])
        r_sh = np.array([0.19, 0.48, 0.0])
        l_hip = np.array([-0.11, 0.0, 0.0])
        r_hip = np.array([0.11, 0.0, 0.0])
        out = facing_torso_channels(neck, l_sh, r_sh, l_hip, r_hip, None, 0.526)
        self.assertEqual(out["chestY"], 0.0)
        self.assertEqual(out["pelvisTwist"], 0.0)
        self.assertEqual(out["neckY"], 0.0)
        self.assertLess(abs(out["chestZ"]), 0.05)

    def test_left_shoulder_high_rolls_instead_of_yawing(self) -> None:
        neck = np.array([0.0, 0.52, 0.0])
        l_sh = np.array([-0.19, 0.58, 0.0])
        r_sh = np.array([0.19, 0.42, 0.0])
        out = facing_torso_channels(neck, l_sh, r_sh, None, None, None, 0.526)
        self.assertEqual(out["chestY"], 0.0)
        self.assertLess(out["chestZ"], -0.05)

    def test_neck_to_the_right_is_side_lean_not_turn(self) -> None:
        neck = np.array([0.12, 0.50, 0.0])
        out = facing_torso_channels(neck, None, None, None, None, None, 0.526)
        self.assertEqual(out["chestY"], 0.0)
        self.assertGreater(out["chestZ"], 0.1)

    def test_old_shoulder_line_atan2_looks_like_a_half_turn(self) -> None:
        line = np.array([-0.38, 0.0, 0.0])
        heading = math.atan2(-line[1], line[0] + 1e-6)
        self.assertGreater(abs(heading), 2.5)


if __name__ == "__main__":
    unittest.main()
