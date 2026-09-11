#!/usr/bin/env python3
"""Retarget canonical motion onto the chibi idol PersonPose + plantFoot targets."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np

from arm_retarget import ArmSolver, euler_xyz_matrix, lift_2d_direction
from common import load_json, save_json, stage_dir


def _joint(frame: dict[str, Any], name: str) -> np.ndarray | None:
    value = frame["joints"].get(name)
    if value is None:
        return None
    return np.array(value, dtype=np.float64)


def _first(*points: np.ndarray | None) -> np.ndarray | None:
    for point in points:
        if point is not None:
            return point
    return None


def facing_torso_channels(
    neck: np.ndarray | None,
    l_sh: np.ndarray | None,
    r_sh: np.ndarray | None,
    l_hip: np.ndarray | None,
    r_hip: np.ndarray | None,
    nose: np.ndarray | None,
    torso_rest: float,
) -> dict[str, float]:
    """Keep chest and face aimed at +Z. Front-facing video has no reliable yaw."""
    chest_z = 0.0
    chest_x = 0.0
    if neck is not None:
        chest_z = _clamp(math.atan2(float(neck[0]), max(float(neck[1]), 1e-4)), -0.7, 0.7)
        torso_len = float(np.linalg.norm(neck[:2]))
        if torso_rest > 0 and torso_len < torso_rest * 0.88:
            chest_x = _clamp(-0.35 * (1.0 - torso_len / torso_rest), -0.35, 0.1)
    if l_sh is not None and r_sh is not None:
        width = max(float(np.hypot(l_sh[0] - r_sh[0], l_sh[2] - r_sh[2])), 1e-4)
        chest_z = _clamp(chest_z + 0.45 * math.atan2(float(r_sh[1] - l_sh[1]), width), -0.7, 0.7)
    pelvis_z = 0.0
    if l_hip is not None and r_hip is not None:
        width = max(float(np.hypot(l_hip[0] - r_hip[0], l_hip[2] - r_hip[2])), 1e-4)
        pelvis_z = _clamp(0.5 * math.atan2(float(r_hip[1] - l_hip[1]), width), -0.45, 0.45)
    neck_x = -0.02
    neck_z = 0.0
    if nose is not None and neck is not None:
        head = nose - neck
        neck_z = _clamp(math.atan2(float(head[0]), max(float(head[1]), 1e-4)), -0.45, 0.45)
        neck_x = _clamp(-0.15 + 0.2 * float(head[2]), -0.55, 0.55)
    return {
        "chestX": chest_x,
        "chestY": 0.0,
        "chestZ": chest_z,
        "pelvisTwist": 0.0,
        "pelvisZ": pelvis_z,
        "neckX": neck_x,
        "neckY": 0.0,
        "neckZ": _clamp(neck_z - 0.6 * chest_z, -0.45, 0.45),
    }


def torso_parent_matrix(pose: dict[str, float]) -> np.ndarray:
    """Chest rotation in group space: body -> pelvis -> chest, each Three.js Euler XYZ."""
    body = euler_xyz_matrix(pose["bodyX"], pose["bodyYaw"], pose["bodyZ"])
    pelvis = euler_xyz_matrix(pose["pelvisX"], pose["pelvisTwist"], pose["pelvisZ"])
    chest = euler_xyz_matrix(pose["chestX"], pose["chestY"], pose["chestZ"])
    return body @ pelvis @ chest


def limb_reference_length(frames: list[dict[str, Any]], a: str, b: str) -> float:
    """Near-maximum projected length of a limb; shorter frames are foreshortened."""
    lengths = []
    for frame in frames:
        pa = _joint(frame, a)
        pb = _joint(frame, b)
        if pa is not None and pb is not None:
            lengths.append(float(np.hypot(pb[0] - pa[0], pb[1] - pa[1])))
    return float(np.percentile(lengths, 97)) if lengths else 0.0


def audience_foot_target(side: str, x: float, lift: float, z: float) -> tuple[float, float, float]:
    """Keep each foot on its own side and out of the audience's shin-forward K."""
    if side == "L":
        x = _clamp(x, -0.42, -0.06)
    else:
        x = _clamp(x, 0.06, 0.42)
    return x, _clamp(lift, 0.0, 0.28), _clamp(z, -0.10, 0.02)


def audience_foot_gap(left_x: float, right_x: float) -> tuple[float, float]:
    """Stop both feet occupying the same column, which makes a K-silhouette."""
    if right_x - left_x < 0.14:
        mid = 0.5 * (left_x + right_x)
        left_x = min(left_x, mid - 0.07)
        right_x = max(right_x, mid + 0.07)
    return _clamp(left_x, -0.42, -0.06), _clamp(right_x, 0.06, 0.42)


def _contact_states(
    lifts: np.ndarray,
    speeds: np.ndarray,
    contact_cfg: dict[str, Any],
) -> list[bool]:
    enter_h = float(contact_cfg["enterHeight"])
    exit_h = float(contact_cfg["exitHeight"])
    enter_v = float(contact_cfg["enterSpeed"])
    exit_v = float(contact_cfg["exitSpeed"])
    hold = int(contact_cfg["minHoldFrames"])
    planted = False
    pending = 0
    out: list[bool] = []
    for lift, speed in zip(lifts, speeds):
        if not planted:
            if lift <= enter_h and speed <= enter_v:
                pending += 1
                if pending >= hold:
                    planted = True
                    pending = 0
            else:
                pending = 0
        else:
            if lift >= exit_h or speed >= exit_v:
                pending += 1
                if pending >= hold:
                    planted = False
                    pending = 0
            else:
                pending = 0
        out.append(planted)
    return out


def _foot_speed(positions: np.ndarray, fps: float) -> np.ndarray:
    speed = np.zeros(len(positions))
    for i in range(1, len(positions)):
        if np.any(~np.isfinite(positions[i])) or np.any(~np.isfinite(positions[i - 1])):
            continue
        speed[i] = float(np.linalg.norm(positions[i] - positions[i - 1]) * fps)
    if len(speed) > 1:
        speed[0] = speed[1]
    return speed


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def rotate_y(vec: np.ndarray, yaw: float) -> np.ndarray:
    """Rotate a point around +Y. Positive yaw turns the character left."""
    cosine = math.cos(yaw)
    sine = math.sin(yaw)
    return np.array(
        [cosine * float(vec[0]) + sine * float(vec[2]), float(vec[1]), -sine * float(vec[0]) + cosine * float(vec[2])],
        dtype=np.float64,
    )


def retarget_motion(
    job_dir: Path,
    reconstructed_path: Path,
    rig_path: Path,
    config: dict[str, Any],
    *,
    root_mode: str,
    capture_mode: str,
) -> dict[str, Any]:
    motion = load_json(reconstructed_path)
    rig = load_json(rig_path)
    character = config["character"]
    frames = motion["frames"]
    fps = 1.0 / (frames[1]["timestamp"] - frames[0]["timestamp"]) if len(frames) > 1 else 30.0
    rest_l = float(character["restLeftFootX"])
    rest_r = float(character["restRightFootX"])
    upper = float(character["upperArm"])
    ankle_h = float(character["ankleHeight"])
    if capture_mode == "full-3d":
        return _retarget_full_3d(
            job_dir,
            motion,
            rig,
            character,
            frames,
            fps,
            rest_l,
            rest_r,
            upper,
            root_mode,
            config,
        )

    left_pos = np.zeros((len(frames), 3))
    right_pos = np.zeros((len(frames), 3))
    left_lift = np.zeros(len(frames))
    right_lift = np.zeros(len(frames))
    poses: list[dict[str, float]] = []
    timestamps: list[float] = []
    uncertain = list(motion.get("uncertainSpans") or [])
    left_arm = ArmSolver("L")
    right_arm = ArmSolver("R")
    ref_upper = {
        "L": limb_reference_length(frames, "LShoulder", "LElbow"),
        "R": limb_reference_length(frames, "RShoulder", "RElbow"),
    }
    ref_fore = {
        "L": limb_reference_length(frames, "LElbow", "LWrist"),
        "R": limb_reference_length(frames, "RElbow", "RWrist"),
    }

    standing_left = []
    standing_right = []
    image_left = []
    image_right = []
    for frame in frames:
        l_ankle = _first(_joint(frame, "LAnkle"), _joint(frame, "LHeel"))
        r_ankle = _first(_joint(frame, "RAnkle"), _joint(frame, "RHeel"))
        if l_ankle is not None:
            standing_left.append(l_ankle[1])
        if r_ankle is not None:
            standing_right.append(r_ankle[1])
        image = frame.get("image") or {}
        for key, bucket in (("LHeel", image_left), ("LAnkle", image_left), ("RHeel", image_right), ("RAnkle", image_right)):
            point = image.get(key)
            if point and point[2] > 0.2:
                bucket.append(point[1])
    stand_l = float(np.percentile(standing_left, 12)) if standing_left else 0.0
    stand_r = float(np.percentile(standing_right, 12)) if standing_right else 0.0
    stand_l_img = float(np.percentile(image_left, 92)) if image_left else 0.0
    stand_r_img = float(np.percentile(image_right, 92)) if image_right else 0.0
    meters_per_px = float(motion.get("metersPerPixel") or 0.006)

    for i, frame in enumerate(frames):
        timestamps.append(float(frame["timestamp"]))
        root = frame["root"]
        neck = _joint(frame, "Neck")
        l_sh = _joint(frame, "LShoulder")
        r_sh = _joint(frame, "RShoulder")
        l_el = _joint(frame, "LElbow")
        r_el = _joint(frame, "RElbow")
        l_wr = _joint(frame, "LWrist")
        r_wr = _joint(frame, "RWrist")
        l_hip = _joint(frame, "LHip")
        r_hip = _joint(frame, "RHip")
        nose = _joint(frame, "Nose")
        l_ankle = _first(_joint(frame, "LHeel"), _joint(frame, "LAnkle"))
        r_ankle = _first(_joint(frame, "RHeel"), _joint(frame, "RAnkle"))

        torso = facing_torso_channels(
            neck, l_sh, r_sh, l_hip, r_hip, nose, float(character["torsoHeight"])
        )
        chest_x = torso["chestX"]
        chest_y = torso["chestY"]
        chest_z = torso["chestZ"]
        pelvis_twist = torso["pelvisTwist"]
        pelvis_z = torso["pelvisZ"]
        neck_x = torso["neckX"]
        neck_y = torso["neckY"]
        neck_z = torso["neckZ"]
        if chest_x != 0.0:
            uncertain.append(
                {
                    "joint": "chest",
                    "startTime": frame["timestamp"],
                    "endTime": frame["timestamp"],
                    "reason": "torso-foreshortening-depth-approximate",
                }
            )

        torso_pose = {
            "bodyX": 0.0,
            "bodyYaw": 0.0,
            "bodyZ": 0.0,
            "pelvisX": 0.0,
            "pelvisTwist": pelvis_twist,
            "pelvisZ": pelvis_z,
            "chestX": chest_x,
            "chestY": chest_y,
            "chestZ": chest_z,
        }
        parent = torso_parent_matrix(torso_pose)

        def arm(sh, el, wr, solver: ArmSolver, side: str) -> dict[str, float]:
            # 2D canonical joints have no depth; lift each segment by its foreshortening.
            if sh is None or el is None:
                return solver.hold()
            upper_dir = lift_2d_direction(el - sh, ref_upper[side])
            if upper_dir[2] > 0.3:
                uncertain.append(
                    {
                        "joint": f"{side}Shoulder",
                        "startTime": frame["timestamp"],
                        "endTime": frame["timestamp"],
                        "reason": "foreshortened-arm-depth-approximate",
                    }
                )
            fore_dir = None if wr is None else lift_2d_direction(wr - el, ref_fore[side])
            return solver.solve(upper_dir, fore_dir, parent)

        l_arm = arm(l_sh, l_el, l_wr, left_arm, "L")
        r_arm = arm(r_sh, r_el, r_wr, right_arm, "R")

        def foot_from(
            ankle: np.ndarray | None,
            stand_y: float,
            rest_x: float,
            root_y: float,
            image_y: float | None,
            stand_img: float,
        ) -> tuple[float, float, float]:
            if ankle is None:
                return rest_x, 0.0, 0.0
            x = _clamp(float(ankle[0]), -0.48, 0.48)
            z = _clamp(float(ankle[2]), -0.22, 0.22)
            if image_y is not None and stand_img > 0:
                lift = _clamp((stand_img - image_y) * meters_per_px, 0.0, 0.32)
            else:
                lift = _clamp(root_y + float(ankle[1]) - stand_y, 0.0, 0.32)
            return x, lift, z

        image = frame.get("image") or {}
        l_img = image.get("LHeel") or image.get("LAnkle")
        r_img = image.get("RHeel") or image.get("RAnkle")
        lf_x, lf_y, lf_z = audience_foot_target(
            "L",
            *foot_from(
                l_ankle, stand_l, rest_l, float(root["y"]),
                None if l_img is None else float(l_img[1]), stand_l_img,
            ),
        )
        rf_x, rf_y, rf_z = audience_foot_target(
            "R",
            *foot_from(
                r_ankle, stand_r, rest_r, float(root["y"]),
                None if r_img is None else float(r_img[1]), stand_r_img,
            ),
        )
        lf_x, rf_x = audience_foot_gap(lf_x, rf_x)
        left_pos[i] = (lf_x, lf_y, lf_z)
        right_pos[i] = (rf_x, rf_y, rf_z)
        left_lift[i] = lf_y
        right_lift[i] = rf_y

        poses.append(
            {
                "bodyY": _clamp(float(root["y"]), -0.08, 0.2),
                "bodyPositionX": _clamp(float(root["x"]), -0.5, 0.5),
                "bodyX": 0.0,
                "bodyYaw": 0.0,
                "bodyZ": 0.0,
                "pelvisY": 0.0,
                "pelvisX": 0.0,
                "pelvisTwist": pelvis_twist,
                "pelvisZ": pelvis_z,
                "chestX": chest_x,
                "chestY": chest_y,
                "chestZ": chest_z,
                "neckX": neck_x,
                "neckY": neck_y,
                "neckZ": _clamp(neck_z - 0.6 * chest_z, -0.45, 0.45),
                "leftShoulderX": l_arm["x"],
                "leftShoulderY": l_arm["y"],
                "leftShoulderZ": l_arm["z"],
                "rightShoulderX": r_arm["x"],
                "rightShoulderY": r_arm["y"],
                "rightShoulderZ": r_arm["z"],
                "leftElbow": l_arm["elbow"],
                "rightElbow": r_arm["elbow"],
                "leftHipX": 0.0,
                "leftHipY": 0.0,
                "leftHipZ": 0.0,
                "rightHipX": 0.0,
                "rightHipY": 0.0,
                "rightHipZ": 0.0,
                "leftKnee": 0.0,
                "rightKnee": 0.0,
                "leftAnkleX": 0.0,
                "leftAnkleZ": 0.0,
                "rightAnkleX": 0.0,
                "rightAnkleZ": 0.0,
                "leftFootX": lf_x,
                "leftFootY": lf_y,
                "leftFootZ": lf_z,
                "rightFootX": rf_x,
                "rightFootY": rf_y,
                "rightFootZ": rf_z,
            }
        )

    left_contact = _contact_states(left_lift, _foot_speed(left_pos, fps), config["contact"])
    right_contact = _contact_states(right_lift, _foot_speed(right_pos, fps), config["contact"])

    locked_l: np.ndarray | None = None
    locked_r: np.ndarray | None = None
    for i, pose in enumerate(poses):
        if left_contact[i]:
            if locked_l is None:
                locked_l = left_pos[i].copy()
                locked_l[1] = 0.0
            lx, _ly, lz = audience_foot_target("L", float(locked_l[0]), 0.0, float(locked_l[2]))
            locked_l[0], locked_l[2] = lx, lz
            pose["leftFootX"] = lx
            pose["leftFootY"] = 0.0
            pose["leftFootZ"] = lz
        else:
            locked_l = None
        if right_contact[i]:
            if locked_r is None:
                locked_r = right_pos[i].copy()
                locked_r[1] = 0.0
            rx, _ry, rz = audience_foot_target("R", float(locked_r[0]), 0.0, float(locked_r[2]))
            locked_r[0], locked_r[2] = rx, rz
            pose["rightFootX"] = rx
            pose["rightFootY"] = 0.0
            pose["rightFootZ"] = rz
        else:
            locked_r = None
        if left_contact[i] or right_contact[i]:
            pose["leftFootX"], pose["rightFootX"] = audience_foot_gap(
                pose["leftFootX"], pose["rightFootX"]
            )
        if left_contact[i] and right_contact[i]:
            # Keep the lower body from sinking through the floor while both feet plant.
            pose["bodyY"] = max(pose["bodyY"], 0.0)

    duration = float(timestamps[-1] if timestamps else 0.0)
    clip = {
        "schemaVersion": 1,
        "duration": duration,
        "units": "meters",
        "coordinateSystem": {
            "x": "right",
            "y": "up",
            "z": "forward",
            "space": "target-rig-group",
        },
        "targetRig": "person-rig-chibi-idol",
        "captureMode": capture_mode,
        "rootMotionMode": root_mode,
        "localRotationConvention": "person-pose-euler-complete",
        "quaternionOrder": ["x", "y", "z", "w"],
        "timestamps": timestamps,
        "root": {
            "space": "target-rig-parent",
            "positions": [[p["bodyPositionX"], p["bodyY"], 0.0] for p in poses],
            "quaternions": [[0.0, 0.0, 0.0, 1.0] for _ in poses],
        },
        "poses": poses,
        "feet": {
            "space": "target-rig-group",
            "left": {
                "positions": [[p["leftFootX"], p["leftFootY"], p["leftFootZ"]] for p in poses],
                "contact": left_contact,
            },
            "right": {
                "positions": [[p["rightFootX"], p["rightFootY"], p["rightFootZ"]] for p in poses],
                "contact": right_contact,
            },
        },
        "quality": {
            "uncertainSpans": uncertain,
            "notes": [
                "Hip/knee Euler tracks are zero; applyIdolDancePose plantFoot owns the legs.",
                "Facing stays +Z. Turns in the source are not reconstructed in front-facing-2d.",
                "Shoulder X/Y/Z fit the observed upper-arm direction and elbow bend plane; depth comes from foreshortening.",
                "Chest/pelvis yaw stay 0 so a facing-camera dancer keeps body and face on +Z.",
                "Upper arms keep direction Z>=0.18 in chest space; feet stay uncrossed with Z<=0.02 to avoid K-poses.",
            ],
        },
        "rigMapping": rig,
    }
    dest = stage_dir(job_dir, "06-retargeted") / "dance.animation.json"
    save_json(dest, clip)
    save_json(stage_dir(job_dir, "06-retargeted") / "rig-mapping.json", rig)
    print(f"retargeted {len(poses)} poses duration={duration:.3f}s -> {dest}")
    return clip


def _retarget_full_3d(
    job_dir: Path,
    motion: dict[str, Any],
    rig: dict[str, Any],
    character: dict[str, Any],
    frames: list[dict[str, Any]],
    fps: float,
    rest_l: float,
    rest_r: float,
    upper: float,
    root_mode: str,
    config: dict[str, Any],
) -> dict[str, Any]:
    """Retarget MotionBERT joints: localize by facing yaw, then apply bodyYaw."""
    left_pos = np.zeros((len(frames), 3))
    right_pos = np.zeros((len(frames), 3))
    left_lift = np.zeros(len(frames))
    right_lift = np.zeros(len(frames))
    poses: list[dict[str, float]] = []
    timestamps: list[float] = []
    uncertain = list(motion.get("uncertainSpans") or [])
    # Real depth is available; only keep the arm clear of the chest mesh.
    left_arm = ArmSolver("L", forward_min=0.08)
    right_arm = ArmSolver("R", forward_min=0.08)

    standing_left = []
    standing_right = []
    for frame in frames:
        l_ankle = _first(_joint(frame, "LAnkle"), _joint(frame, "LHeel"))
        r_ankle = _first(_joint(frame, "RAnkle"), _joint(frame, "RHeel"))
        if l_ankle is not None:
            standing_left.append(l_ankle[1])
        if r_ankle is not None:
            standing_right.append(r_ankle[1])
    stand_l = float(np.percentile(standing_left, 12)) if standing_left else 0.0
    stand_r = float(np.percentile(standing_right, 12)) if standing_right else 0.0

    def localize(point: np.ndarray | None, yaw: float) -> np.ndarray | None:
        if point is None:
            return None
        return rotate_y(point, -yaw)

    for i, frame in enumerate(frames):
        timestamps.append(float(frame["timestamp"]))
        root = frame["root"]
        yaw = float(frame.get("facingYaw") or 0.0)
        neck = localize(_joint(frame, "Neck"), yaw)
        l_sh = localize(_joint(frame, "LShoulder"), yaw)
        r_sh = localize(_joint(frame, "RShoulder"), yaw)
        l_el = localize(_joint(frame, "LElbow"), yaw)
        r_el = localize(_joint(frame, "RElbow"), yaw)
        l_wr = localize(_joint(frame, "LWrist"), yaw)
        r_wr = localize(_joint(frame, "RWrist"), yaw)
        l_hip = localize(_joint(frame, "LHip"), yaw)
        r_hip = localize(_joint(frame, "RHip"), yaw)
        nose = localize(_joint(frame, "Nose"), yaw)
        l_ankle = localize(_first(_joint(frame, "LHeel"), _joint(frame, "LAnkle")), yaw)
        r_ankle = localize(_first(_joint(frame, "RHeel"), _joint(frame, "RAnkle")), yaw)

        torso = facing_torso_channels(
            neck, l_sh, r_sh, l_hip, r_hip, nose, float(character["torsoHeight"])
        )

        # Joints are already localized by yaw, so the parent chain is pelvis -> chest only.
        parent = torso_parent_matrix(
            {
                "bodyX": 0.0,
                "bodyYaw": 0.0,
                "bodyZ": 0.0,
                "pelvisX": 0.0,
                "pelvisTwist": torso["pelvisTwist"],
                "pelvisZ": torso["pelvisZ"],
                "chestX": torso["chestX"],
                "chestY": torso["chestY"],
                "chestZ": torso["chestZ"],
            }
        )

        def arm(sh, el, wr, solver: ArmSolver) -> dict[str, float]:
            if sh is None or el is None:
                return solver.hold()
            return solver.solve(el - sh, None if wr is None else wr - el, parent)

        l_arm = arm(l_sh, l_el, l_wr, left_arm)
        r_arm = arm(r_sh, r_el, r_wr, right_arm)

        def local_foot(ankle: np.ndarray | None, stand_y: float, rest_x: float, side: str) -> np.ndarray:
            if ankle is None:
                return np.array([rest_x, 0.0, 0.0], dtype=np.float64)
            x = float(ankle[0])
            if side == "L":
                x = _clamp(min(x, -0.05), -0.45, -0.05)
            else:
                x = _clamp(max(x, 0.05), 0.05, 0.45)
            lift = _clamp(float(root["y"]) + float(ankle[1]) - stand_y, 0.0, 0.32)
            z = _clamp(float(ankle[2]), -0.22, 0.16)
            return np.array([x, lift, z], dtype=np.float64)

        local_l = local_foot(l_ankle, stand_l, rest_l, "L")
        local_r = local_foot(r_ankle, stand_r, rest_r, "R")
        if local_r[0] - local_l[0] < 0.12:
            mid = 0.5 * (local_l[0] + local_r[0])
            local_l[0] = min(local_l[0], mid - 0.06)
            local_r[0] = max(local_r[0], mid + 0.06)
        group_l = rotate_y(local_l, yaw)
        group_r = rotate_y(local_r, yaw)
        lf_x = _clamp(float(group_l[0]) + float(root["x"]), -0.5, 0.5)
        rf_x = _clamp(float(group_r[0]) + float(root["x"]), -0.5, 0.5)
        lf_y, rf_y = float(local_l[1]), float(local_r[1])
        lf_z = _clamp(float(group_l[2]), -0.38, 0.38)
        rf_z = _clamp(float(group_r[2]), -0.38, 0.38)
        left_pos[i] = (lf_x, lf_y, lf_z)
        right_pos[i] = (rf_x, rf_y, rf_z)
        left_lift[i] = lf_y
        right_lift[i] = rf_y

        poses.append(
            {
                "bodyY": _clamp(float(root["y"]), -0.08, 0.2),
                "bodyPositionX": _clamp(float(root["x"]), -0.5, 0.5),
                "bodyX": 0.0,
                "bodyYaw": yaw,
                "bodyZ": 0.0,
                "pelvisY": 0.0,
                "pelvisX": 0.0,
                "pelvisTwist": torso["pelvisTwist"],
                "pelvisZ": torso["pelvisZ"],
                "chestX": torso["chestX"],
                "chestY": torso["chestY"],
                "chestZ": torso["chestZ"],
                "neckX": torso["neckX"],
                "neckY": torso["neckY"],
                "neckZ": torso["neckZ"],
                "leftShoulderX": l_arm["x"],
                "leftShoulderY": l_arm["y"],
                "leftShoulderZ": l_arm["z"],
                "rightShoulderX": r_arm["x"],
                "rightShoulderY": r_arm["y"],
                "rightShoulderZ": r_arm["z"],
                "leftElbow": l_arm["elbow"],
                "rightElbow": r_arm["elbow"],
                "leftHipX": 0.0,
                "leftHipY": 0.0,
                "leftHipZ": 0.0,
                "rightHipX": 0.0,
                "rightHipY": 0.0,
                "rightHipZ": 0.0,
                "leftKnee": 0.0,
                "rightKnee": 0.0,
                "leftAnkleX": 0.0,
                "leftAnkleZ": 0.0,
                "rightAnkleX": 0.0,
                "rightAnkleZ": 0.0,
                "leftFootX": lf_x,
                "leftFootY": lf_y,
                "leftFootZ": lf_z,
                "rightFootX": rf_x,
                "rightFootY": rf_y,
                "rightFootZ": rf_z,
            }
        )

    left_contact = _contact_states(left_lift, _foot_speed(left_pos, fps), config["contact"])
    right_contact = _contact_states(right_lift, _foot_speed(right_pos, fps), config["contact"])

    locked_l: np.ndarray | None = None
    locked_r: np.ndarray | None = None
    for i, pose in enumerate(poses):
        if left_contact[i]:
            if locked_l is None:
                locked_l = left_pos[i].copy()
                locked_l[1] = 0.0
            pose["leftFootX"] = float(locked_l[0])
            pose["leftFootY"] = 0.0
            pose["leftFootZ"] = float(locked_l[2])
        else:
            locked_l = None
        if right_contact[i]:
            if locked_r is None:
                locked_r = right_pos[i].copy()
                locked_r[1] = 0.0
            pose["rightFootX"] = float(locked_r[0])
            pose["rightFootY"] = 0.0
            pose["rightFootZ"] = float(locked_r[2])
        else:
            locked_r = None
        if left_contact[i] and right_contact[i]:
            pose["bodyY"] = max(pose["bodyY"], 0.0)

    duration = float(timestamps[-1] if timestamps else 0.0)
    clip = {
        "schemaVersion": 1,
        "duration": duration,
        "units": "meters",
        "coordinateSystem": {
            "x": "right",
            "y": "up",
            "z": "forward",
            "space": "target-rig-group",
        },
        "targetRig": "person-rig-chibi-idol",
        "captureMode": "full-3d",
        "rootMotionMode": root_mode,
        "localRotationConvention": "person-pose-euler-complete",
        "quaternionOrder": ["x", "y", "z", "w"],
        "timestamps": timestamps,
        "root": {
            "space": "target-rig-parent",
            "positions": [[p["bodyPositionX"], p["bodyY"], 0.0] for p in poses],
            "quaternions": [[0.0, 0.0, 0.0, 1.0] for _ in poses],
        },
        "poses": poses,
        "feet": {
            "space": "target-rig-group",
            "left": {
                "positions": [[p["leftFootX"], p["leftFootY"], p["leftFootZ"]] for p in poses],
                "contact": left_contact,
            },
            "right": {
                "positions": [[p["rightFootX"], p["rightFootY"], p["rightFootZ"]] for p in poses],
                "contact": right_contact,
            },
        },
        "quality": {
            "uncertainSpans": uncertain,
            "notes": [
                "Hip/knee Euler tracks are zero; applyIdolDancePose plantFoot owns the legs.",
                "full-3d writes unwrapped bodyYaw so the character can turn.",
                "Joints are rotated into the body frame before arm/foot retarget, then feet go back to group space.",
                "2D audience locks (yaw=0, left foot always -X) are not applied.",
            ],
        },
        "rigMapping": rig,
    }
    dest = stage_dir(job_dir, "06-retargeted") / "dance.animation.json"
    save_json(dest, clip)
    save_json(stage_dir(job_dir, "06-retargeted") / "rig-mapping.json", rig)
    print(f"retargeted-3d {len(poses)} poses duration={duration:.3f}s -> {dest}")
    return clip


if __name__ == "__main__":
    raise SystemExit("use orchestrator.py")
