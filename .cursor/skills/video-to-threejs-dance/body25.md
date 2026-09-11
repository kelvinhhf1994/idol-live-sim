# OpenPose BODY_25 named landmarks

Raw per-person `pose_keypoints_2d` is a flat `x, y, confidence` sequence. Index `i` occupies `[3i, 3i+1, 3i+2]`. Never treat `confidence === 0` as a coordinate.

| Index | Name | Notes |
|------:|------|--------|
| 0 | Nose | |
| 1 | Neck | |
| 2 | RShoulder | OpenPose R/L is the dancer's anatomical side |
| 3 | RElbow | |
| 4 | RWrist | |
| 5 | LShoulder | |
| 6 | LElbow | |
| 7 | LWrist | |
| 8 | MidHip | Use for pelvis / root 2D |
| 9 | RHip | |
| 10 | RKnee | |
| 11 | RAnkle | |
| 12 | LHip | |
| 13 | LKnee | |
| 14 | LAnkle | |
| 15 | REye | Face; skip unless requested |
| 16 | LEye | Face; skip unless requested |
| 17 | REar | Face; skip unless requested |
| 18 | LEar | Face; skip unless requested |
| 19 | LBigToe | Foot; enable for contact |
| 20 | LSmallToe | Foot; enable for contact |
| 21 | LHeel | Foot; enable for contact |
| 22 | RBigToe | Foot; enable for contact |
| 23 | RSmallToe | Foot; enable for contact |
| 24 | RHeel | Foot; enable for contact |

Image space: x right, y down, origin top-left.

Hands/face extra networks are off by default. Enable only when requested and the target rig has those joints.

Person identity: `people[0]` is not a stable dancer id. Track MidHip (and shoulders) across frames. On ambiguity, show an overlay and ask.

Combined landmarks file must be ordered by numeric frame index and include timestamp, selected identity, named points, confidence, and missing flags.
