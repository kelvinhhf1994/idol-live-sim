#!/usr/bin/env python3
"""Audience-facing generation: hands come forward, feet do not make a K-pose."""

from __future__ import annotations

import math
import unittest

import numpy as np

from arm_retarget import FORWARD_MIN, ArmSolver, keep_arm_in_front, shoulder_direction
from retarget_motion import audience_foot_gap, audience_foot_target


class AudienceFacingTests(unittest.TestCase):
    def test_upper_arm_never_goes_behind_the_chest(self) -> None:
        for side in ("L", "R"):
            solver = ArmSolver(side)
            for theta in (-2.4, -1.0, 0.0, 0.8, 2.2, 3.1):
                upper = np.array([math.sin(theta), -math.cos(theta), -0.6])
                pose = solver.solve(upper, None)
                d = shoulder_direction(pose["x"], pose["y"], pose["z"])
                self.assertGreaterEqual(d[2], FORWARD_MIN - 1e-6, (side, theta))

    def test_keep_arm_in_front_preserves_coronal_angle(self) -> None:
        d = keep_arm_in_front(np.array([0.6, -0.8, -0.3]), "R")
        self.assertGreaterEqual(d[2], FORWARD_MIN - 1e-9)
        self.assertAlmostEqual(math.atan2(d[0], -d[1]), math.atan2(0.6, 0.8), delta=1e-6)
        self.assertAlmostEqual(float(np.linalg.norm(d)), 1.0, delta=1e-6)

    def test_feet_stay_on_their_own_side(self) -> None:
        lx, _ly, lz = audience_foot_target("L", 0.31, 0.1, 0.18)
        rx, _ry, rz = audience_foot_target("R", -0.28, 0.1, 0.18)
        self.assertLess(lx, -0.05)
        self.assertGreater(rx, 0.05)
        self.assertLessEqual(lz, 0.02)
        self.assertLessEqual(rz, 0.02)

    def test_feet_keep_a_gap_so_legs_do_not_make_a_k(self) -> None:
        lx, rx = -0.02, 0.01
        lx, rx = audience_foot_gap(lx, rx)
        self.assertLessEqual(lx, -0.06)
        self.assertGreaterEqual(rx, 0.06)
        self.assertGreaterEqual(rx - lx, 0.14)


if __name__ == "__main__":
    unittest.main()
