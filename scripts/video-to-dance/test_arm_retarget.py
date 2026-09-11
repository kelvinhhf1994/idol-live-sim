#!/usr/bin/env python3
"""Arm retarget: shoulder Euler channels reproduce the observed upper-arm direction."""

from __future__ import annotations

import math
import unittest

import numpy as np

from arm_retarget import (
    ArmSolver,
    elbow_bend_direction,
    euler_xyz_from_matrix,
    euler_xyz_matrix,
    lift_2d_direction,
    shoulder_direction,
)


def _direction(pose: dict[str, float]) -> np.ndarray:
    return shoulder_direction(pose["x"], pose["y"], pose["z"])


class EulerTests(unittest.TestCase):
    def test_matrix_roundtrip(self) -> None:
        for angles in ((0.3, -0.2, 1.1), (2.0, 1.2, -2.9), (-1.0, 0.0, 3.0)):
            m = euler_xyz_matrix(*angles)
            back = euler_xyz_from_matrix(m)
            self.assertTrue(np.allclose(m, euler_xyz_matrix(*back), atol=1e-9), angles)

    def test_matches_three_js_convention(self) -> None:
        # Values checked against THREE.Vector3(0,-1,0).applyEuler(new Euler(-x, 0, z)).
        self.assertTrue(np.allclose(shoulder_direction(0.89, 0.0, -0.98), [-0.83, -0.35, 0.43], atol=0.01))
        self.assertTrue(np.allclose(shoulder_direction(0.0, 0.0, math.pi), [0.0, 1.0, 0.0], atol=1e-6))
        self.assertTrue(np.allclose(shoulder_direction(0.3, 0.0, math.pi), [0.0, 0.96, -0.30], atol=0.01))


class ArmSolverTests(unittest.TestCase):
    def test_overhead_arm_points_up(self) -> None:
        pose = ArmSolver("L").solve(np.array([0.0, 1.0, 0.0]), np.array([0.0, 1.0, 0.0]))
        d = _direction(pose)
        self.assertGreater(d[1], 0.95)
        self.assertGreaterEqual(d[2], 0.17)

    def test_side_raise_stays_horizontal(self) -> None:
        pose = ArmSolver("R").solve(np.array([1.0, 0.0, 0.0]), np.array([1.0, 0.0, 0.0]))
        d = _direction(pose)
        self.assertGreater(d[0], 0.95)
        self.assertAlmostEqual(d[1], 0.0, delta=0.05)

    def test_hanging_arm_keeps_forward_clearance(self) -> None:
        pose = ArmSolver("L").solve(np.array([0.0, -1.0, 0.0]), np.array([0.0, -1.0, 0.0]))
        d = _direction(pose)
        self.assertGreaterEqual(d[2], 0.17)
        self.assertLess(d[1], -0.9)

    def test_across_body_arm_gets_more_forward_room(self) -> None:
        # Left arm hangs at -X; pointing toward +X crosses the chest.
        pose = ArmSolver("L").solve(np.array([1.0, -0.2, 0.0]), None)
        d = _direction(pose)
        self.assertGreater(d[2], 0.5)
        self.assertGreater(d[0], 0.5)

    def test_elbow_bend_plane_follows_forearm(self) -> None:
        solver = ArmSolver("R")
        pose = None
        for _ in range(12):
            pose = solver.solve(np.array([1.0, 0.0, 0.0]), np.array([0.0, 1.0, 0.0]))
        assert pose is not None
        self.assertAlmostEqual(pose["elbow"], math.pi / 2, delta=0.2)
        bend = elbow_bend_direction(pose["x"], pose["y"], pose["z"])
        self.assertGreater(bend[1], 0.85)

    def test_windmill_keeps_euler_channels_continuous(self) -> None:
        solver = ArmSolver("L")
        poses = []
        for i in range(48):
            theta = -2.0 * math.pi * i / 48
            upper = np.array([math.sin(theta), -math.cos(theta), 0.0])
            poses.append(solver.solve(upper, upper))
        for a, b in zip(poses, poses[1:]):
            for key in ("x", "y", "z"):
                self.assertLess(abs(b[key] - a[key]), 0.6, key)
        # Direction fidelity all the way round.
        for i, pose in enumerate(poses):
            theta = -2.0 * math.pi * i / 48
            d = _direction(pose)
            error = (math.atan2(d[0], -d[1]) - theta + math.pi) % (2 * math.pi) - math.pi
            self.assertAlmostEqual(error, 0.0, delta=0.05)

    def test_hold_keeps_last_pose(self) -> None:
        solver = ArmSolver("R")
        first = solver.solve(np.array([1.0, 1.0, 0.0]), None)
        held = solver.hold()
        for key in ("x", "y", "z"):
            self.assertAlmostEqual(first[key], held[key])


class ForeshorteningTests(unittest.TestCase):
    def test_full_length_has_no_depth(self) -> None:
        d = lift_2d_direction(np.array([0.0, 0.3]), 0.3)
        self.assertAlmostEqual(d[2], 0.0, delta=1e-6)
        self.assertAlmostEqual(d[1], 1.0, delta=1e-6)

    def test_short_projection_lifts_toward_audience(self) -> None:
        d = lift_2d_direction(np.array([0.0, 0.12]), 0.3)
        self.assertGreater(d[2], 0.6)
        self.assertAlmostEqual(float(np.linalg.norm(d)), 1.0, delta=1e-6)


if __name__ == "__main__":
    unittest.main()
