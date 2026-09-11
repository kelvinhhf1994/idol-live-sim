#!/usr/bin/env python3
"""Fit the chibi idol's Euler shoulder + one-axis elbow hinge to observed arm directions.

Rig facts (createChibiIdol + applyIdolDancePose):

- ``shoulder.rotation.set(-shoulderX, shoulderY, shoulderZ)`` with Three.js order XYZ,
  i.e. ``R = Rx(-shoulderX) @ Ry(shoulderY) @ Rz(shoulderZ)``.
- The upper arm rests along the shoulder's local -Y; the elbow joint sits at (0, -upperArm, 0).
- ``elbow.rotation.set(-elbow, 0, 0)`` bends the forearm toward the elbow's local +Z.

So for a shoulder rotation ``R`` the upper-arm direction is ``d = R @ (0, -1, 0)`` and the
forearm bends toward ``b = R @ (0, 0, 1)``. Given an observed upper-arm direction and an
observed forearm direction we build ``R`` from ``(d, b)`` and read the Euler angles back.
That reproduces raised, overhead and crossed arms instead of approximating them with a
fixed forward swing.
"""

from __future__ import annotations

import math

import numpy as np

# Minimum +Z component of the upper-arm direction (chest space) so the arm clears the chest mesh.
FORWARD_MIN = 0.18
# Extra forward bias when the arm crosses the body's midline.
ACROSS_FORWARD = 0.45
ELBOW_MAX = 2.4
ELBOW_REST = 0.35

_DOWN = np.array([0.0, -1.0, 0.0])
_FORWARD = np.array([0.0, 0.0, 1.0])
_RIGHT = np.array([1.0, 0.0, 0.0])


def _unit(vec: np.ndarray) -> np.ndarray | None:
    norm = float(np.linalg.norm(vec))
    if norm < 1e-9:
        return None
    return vec / norm


def _wrap_pi(angle: float) -> float:
    return (angle + math.pi) % (2.0 * math.pi) - math.pi


def _rotation_between(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Minimal rotation taking unit vector ``a`` onto unit vector ``b`` (Rodrigues)."""
    axis = np.cross(a, b)
    sine = float(np.linalg.norm(axis))
    cosine = float(np.clip(np.dot(a, b), -1.0, 1.0))
    if sine < 1e-9:
        return np.eye(3)
    k = axis / sine
    kx = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]], dtype=np.float64)
    return np.eye(3) + sine * kx + (1.0 - cosine) * (kx @ kx)


def euler_xyz_matrix(x: float, y: float, z: float) -> np.ndarray:
    """Three.js Euler order XYZ: ``R = Rx @ Ry @ Rz``."""
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]], dtype=np.float64)
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], dtype=np.float64)
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]], dtype=np.float64)
    return rx @ ry @ rz


def euler_xyz_from_matrix(m: np.ndarray) -> tuple[float, float, float]:
    """Inverse of :func:`euler_xyz_matrix`; mirrors ``THREE.Euler.setFromRotationMatrix('XYZ')``."""
    m13 = float(np.clip(m[0, 2], -1.0, 1.0))
    y = math.asin(m13)
    if abs(m13) < 0.9999999:
        x = math.atan2(-float(m[1, 2]), float(m[2, 2]))
        z = math.atan2(-float(m[0, 1]), float(m[0, 0]))
    else:
        x = math.atan2(float(m[2, 1]), float(m[1, 1]))
        z = 0.0
    return x, y, z


def shoulder_matrix(pose_x: float, pose_y: float, pose_z: float) -> np.ndarray:
    """Shoulder rotation for PersonPose channels (applyIdolDancePose negates X)."""
    return euler_xyz_matrix(-pose_x, pose_y, pose_z)


def shoulder_direction(pose_x: float, pose_y: float, pose_z: float) -> np.ndarray:
    """Upper-arm direction in chest space for PersonPose shoulder channels."""
    return shoulder_matrix(pose_x, pose_y, pose_z) @ _DOWN


def elbow_bend_direction(pose_x: float, pose_y: float, pose_z: float) -> np.ndarray:
    """Direction the forearm swings toward when the elbow bends, in chest space."""
    return shoulder_matrix(pose_x, pose_y, pose_z) @ _FORWARD


def keep_arm_in_front(direction: np.ndarray, side: str, forward_min: float = FORWARD_MIN) -> np.ndarray:
    """Raise the +Z component to ``forward_min`` (plus an across-body bias) keeping the coronal angle.

    ``side`` is the anatomical side. The left arm hangs at -X on this rig, so a left
    arm with +X direction is crossing the chest and needs more forward room.
    """
    d = direction.copy()
    across_sign = 1.0 if side == "L" else -1.0
    across = float(np.clip(across_sign * d[0] / 0.35, 0.0, 1.0))
    z_min = min(0.95, forward_min + ACROSS_FORWARD * across)
    if d[2] >= z_min:
        return d
    coronal = math.hypot(float(d[0]), float(d[1]))
    scale = math.sqrt(max(0.0, 1.0 - z_min * z_min))
    if coronal < 1e-9:
        return np.array([0.0, -scale, z_min])
    return np.array([d[0] / coronal * scale, d[1] / coronal * scale, z_min])


def depth_from_foreshortening(length: float, reference: float, upward: bool) -> float:
    """Approximate the hidden depth (0..1) of a limb from its projected length.

    A limb that projects shorter than its reference length points toward or away
    from the camera. Front-facing video cannot tell which; we assume toward the
    audience and trust the estimate less when the limb hangs down.
    """
    if reference <= 1e-6:
        return 0.0
    ratio = min(1.0, length / (reference * 0.95))
    hidden = math.sqrt(max(0.0, 1.0 - ratio * ratio))
    return hidden * (0.9 if upward else 0.55)


def lift_2d_direction(vec2: np.ndarray, reference: float) -> np.ndarray:
    """Turn a canonical 2D limb vector (x right, y up) into a unit 3D direction with +Z depth."""
    planar = math.hypot(float(vec2[0]), float(vec2[1]))
    depth = depth_from_foreshortening(planar, reference, upward=float(vec2[1]) > 0.0)
    if planar < 1e-9:
        return np.array([0.0, 0.0, 1.0])
    scale = math.sqrt(max(0.0, 1.0 - depth * depth)) / planar
    return np.array([float(vec2[0]) * scale, float(vec2[1]) * scale, depth])


class ArmSolver:
    """Per-arm solver with temporal continuity for the Euler channels and the bend plane."""

    def __init__(self, side: str, *, forward_min: float = FORWARD_MIN) -> None:
        self.side = side
        self.forward_min = forward_min
        self.bend = _FORWARD.copy()
        self.prev_dir: np.ndarray | None = None
        self.prev_euler: tuple[float, float, float] | None = None
        self.prev_elbow = ELBOW_REST

    def hold(self) -> dict[str, float]:
        """No detection: keep the last shoulder and relax the elbow."""
        self.prev_elbow = ELBOW_REST + (self.prev_elbow - ELBOW_REST) * 0.85
        if self.prev_euler is None:
            rest = keep_arm_in_front(_DOWN, self.side, self.forward_min)
            self.prev_euler = euler_xyz_from_matrix(self._matrix(rest, self._bend_for(rest)))
        return self._pose(self.prev_euler, self.prev_elbow)

    def _bend_for(self, d: np.ndarray) -> np.ndarray:
        """Current bend plane made perpendicular to ``d``, with stable fallbacks."""
        bend = _unit(self.bend - np.dot(self.bend, d) * d)
        if bend is None:
            bend = _unit(_FORWARD - np.dot(_FORWARD, d) * d)
        if bend is None:
            bend = _unit(_RIGHT - np.dot(_RIGHT, d) * d)
        assert bend is not None
        return bend

    def solve(
        self,
        upper: np.ndarray,
        forearm: np.ndarray | None,
        parent: np.ndarray | None = None,
    ) -> dict[str, float]:
        """``upper`` = elbow - shoulder, ``forearm`` = wrist - elbow, both in group space.

        ``parent`` is the chest rotation in group space so the result is a local shoulder pose.
        """
        d = _unit(upper)
        if d is None:
            return self.hold()
        f = _unit(forearm) if forearm is not None else None
        if parent is not None:
            d = parent.T @ d
            if f is not None:
                f = parent.T @ f
        fronted = keep_arm_in_front(d, self.side, self.forward_min)
        # Move the whole arm with the clearance rotation so the elbow angle/plane are unchanged.
        clearance = _rotation_between(d, fronted)
        d = fronted
        if self.prev_dir is not None:
            # Carry the bend plane along with the arm so it stays defined when the arm
            # points at the camera and the projection of the old plane collapses.
            self.bend = _rotation_between(self.prev_dir, d) @ self.bend
        self.prev_dir = d

        elbow = ELBOW_REST + (self.prev_elbow - ELBOW_REST) * 0.85
        if f is not None:
            f = _unit(clearance @ f)
            assert f is not None
            cos = float(np.clip(np.dot(d, f), -1.0, 1.0))
            elbow = float(np.clip(math.acos(cos), 0.0, ELBOW_MAX))
            observed = _unit(f - np.dot(f, d) * d)
            if observed is not None and elbow > 0.2:
                # Relative segment depth is unobservable from one camera: never bend the
                # forearm behind the torso, and rotate the bend plane gradually.
                observed[2] = max(0.0, float(observed[2]))
                observed = _unit(observed - np.dot(observed, d) * d)
            if observed is not None and elbow > 0.2:
                weight = 0.3 * float(np.clip((elbow - 0.2) / 0.5, 0.0, 1.0))
                blended = _unit(self.bend * (1.0 - weight) + observed * weight + 0.1 * _FORWARD)
                if blended is not None:
                    self.bend = blended
        self.prev_elbow = elbow

        euler = self._continuous(euler_xyz_from_matrix(self._matrix(d, self._bend_for(d))))
        self.prev_euler = euler
        return self._pose(euler, elbow)

    @staticmethod
    def _matrix(d: np.ndarray, bend: np.ndarray) -> np.ndarray:
        # Columns: local X, local Y (-d because the arm rests along -Y), local Z (bend direction).
        col_y = -d
        col_z = bend
        col_x = np.cross(col_y, col_z)
        return np.column_stack((col_x, col_y, col_z))

    def _continuous(self, euler: tuple[float, float, float]) -> tuple[float, float, float]:
        """Pick the Euler dual and 2π multiples closest to the previous frame."""
        if self.prev_euler is None:
            return euler
        x, y, z = euler
        candidates = [(x, y, z), (x + math.pi, math.pi - y, z + math.pi)]
        best: tuple[float, float, float] | None = None
        best_cost = math.inf
        px, py, pz = self.prev_euler
        for cx, cy, cz in candidates:
            ux = px + _wrap_pi(cx - px)
            uy = py + _wrap_pi(cy - py)
            uz = pz + _wrap_pi(cz - pz)
            cost = abs(ux - px) + abs(uy - py) + abs(uz - pz)
            if cost < best_cost:
                best_cost = cost
                best = (ux, uy, uz)
        assert best is not None
        return best

    @staticmethod
    def _pose(euler: tuple[float, float, float], elbow: float) -> dict[str, float]:
        x, y, z = euler
        return {"x": -x, "y": y, "z": z, "elbow": float(np.clip(elbow, 0.0, ELBOW_MAX))}
