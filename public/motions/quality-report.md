# Dance validation

- ok: True
- frames: 639
- duration: 21.266666666666666
- apply path: applyIdolDancePose
- uncertain spans: 777

## Errors
- none

## Warnings
- none

## Known limits
- front-facing-2d does not reconstruct turns or reliable depth.
- Legs use plantFoot IK; hip/knee Euler tracks are zero by design.
- Shoulders fit the observed upper-arm direction and elbow bend plane; Euler channels are unwrapped for continuity.
- Front-facing-2d locks chest/pelvis yaw at 0 so body and face stay toward the audience.
- Front-facing-2d keeps the upper arm in front of the chest (direction Z >= 0.18) and rejects K-poses.
- full-3d keeps bodyYaw so the character can turn; 2D audience locks do not apply.
- Title cards and other empty detections are not interpolated across long gaps.
- Browser playback must be checked separately.
