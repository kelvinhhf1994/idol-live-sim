import * as THREE from "three";
import type { VenueDefinition } from "../config/venue";
import type { Aabb2 } from "../core/collision";
import type { PlayerController } from "./PlayerController";

export type CameraMode = "first" | "third";

export class CameraController {
  mode: CameraMode = "third";
  yaw = Math.PI;
  private pitch = -0.12;
  private activePointer: number | null = null;
  private lastPoint = { x: 0, y: 0 };
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly lookZone: HTMLElement,
    private readonly venue: VenueDefinition,
    private readonly colliders: readonly Aabb2[],
    private readonly player: PlayerController,
  ) {
    this.yaw = venue.spawn.yaw;
    lookZone.addEventListener("pointerdown", this.handlePointerDown);
    lookZone.addEventListener("pointermove", this.handlePointerMove);
    lookZone.addEventListener("pointerup", this.handlePointerEnd);
    lookZone.addEventListener("pointercancel", this.handlePointerEnd);
    lookZone.addEventListener("lostpointercapture", this.handleLostCapture);
  }

  toggleMode(): CameraMode {
    this.mode = this.mode === "third" ? "first" : "third";
    if (this.mode === "third") {
      this.player.setVisible(false);
      this.updateThirdPerson(1, this.player.position);
      this.player.setVisible(true);
    } else {
      this.player.setVisible(false);
    }
    return this.mode;
  }

  debugSetView(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = THREE.MathUtils.clamp(pitch, -0.7, 0.55);
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    if (this.mode === "first") {
      this.updateFirstPerson(dt, playerPosition);
    } else {
      this.updateThirdPerson(dt, playerPosition);
    }
  }

  dispose(): void {
    this.lookZone.removeEventListener("pointerdown", this.handlePointerDown);
    this.lookZone.removeEventListener("pointermove", this.handlePointerMove);
    this.lookZone.removeEventListener("pointerup", this.handlePointerEnd);
    this.lookZone.removeEventListener("pointercancel", this.handlePointerEnd);
    this.lookZone.removeEventListener("lostpointercapture", this.handleLostCapture);
  }

  private updateFirstPerson(dt: number, playerPosition: THREE.Vector3): void {
    this.desiredPosition.set(playerPosition.x, playerPosition.y + 1.55, playerPosition.z);
    this.camera.position.lerp(this.desiredPosition, 1 - Math.exp(-dt * 24));
    this.lookTarget.set(
      this.camera.position.x - Math.sin(this.yaw) * Math.cos(this.pitch),
      this.camera.position.y + Math.sin(this.pitch),
      this.camera.position.z - Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.camera.lookAt(this.lookTarget);
  }

  private updateThirdPerson(dt: number, playerPosition: THREE.Vector3): void {
    const formationVisible = this.player.supporterVisible;
    const targetHeight = formationVisible ? 0.45 : 1.3;
    this.lookTarget.set(
      playerPosition.x,
      playerPosition.y + targetHeight + Math.sin(this.pitch) * 1.5,
      playerPosition.z,
    );
    const desiredDistance = formationVisible ? 5.1 : 4.2;
    this.desiredPosition.set(
      this.lookTarget.x + Math.sin(this.yaw) * desiredDistance,
      playerPosition.y + 2.3,
      this.lookTarget.z + Math.cos(this.yaw) * desiredDistance,
    );
    clampCameraDestination(this.desiredPosition, this.venue.cameraBounds);
    const fullDistance = this.lookTarget.distanceTo(this.desiredPosition);
    const safeDistance = resolveCameraDistance(
      this.lookTarget,
      this.desiredPosition,
      this.colliders,
    );
    if (safeDistance < fullDistance) {
      this.desiredPosition.lerpVectors(
        this.lookTarget,
        this.desiredPosition,
        safeDistance / fullDistance,
      );
    }
    this.camera.position.lerp(this.desiredPosition, 1 - Math.exp(-dt * 12));
    this.camera.lookAt(this.lookTarget);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.activePointer !== null) return;
    this.activePointer = event.pointerId;
    this.lastPoint = { x: event.clientX, y: event.clientY };
    try {
      this.lookZone.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic touch tests do not create a browser-managed active pointer.
    }
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return;
    const deltaX = event.clientX - this.lastPoint.x;
    const deltaY = event.clientY - this.lastPoint.y;
    this.lastPoint = { x: event.clientX, y: event.clientY };
    this.yaw -= deltaX * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch - deltaY * 0.004, -0.7, 0.55);
    event.preventDefault();
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return;
    if (this.lookZone.hasPointerCapture(event.pointerId)) {
      try {
        this.lookZone.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }
    }
    this.activePointer = null;
  };

  private readonly handleLostCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointer) this.activePointer = null;
  };
}

export function resolveCameraDistance(
  target: THREE.Vector3,
  desired: THREE.Vector3,
  colliders: readonly Aabb2[],
): number {
  const sampleCount = 24;
  const desiredDistance = target.distanceTo(desired);
  for (let step = 1; step <= sampleCount; step += 1) {
    const progress = step / sampleCount;
    const x = target.x + (desired.x - target.x) * progress;
    const y = target.y + (desired.y - target.y) * progress;
    const z = target.z + (desired.z - target.z) * progress;
    const blocked = colliders.some(
      (collider) =>
        x > collider.minX - 0.2 &&
        x < collider.maxX + 0.2 &&
        z > collider.minZ - 0.2 &&
        z < collider.maxZ + 0.2 &&
        (collider.maxY === undefined || y < collider.maxY + 0.2),
    );
    if (blocked) {
      return Math.max(0.15, (desiredDistance * (step - 1)) / sampleCount);
    }
  }
  return desiredDistance;
}

export function clampCameraDestination(
  destination: THREE.Vector3,
  bounds: VenueDefinition["cameraBounds"],
): void {
  destination.x = THREE.MathUtils.clamp(destination.x, bounds.minX, bounds.maxX);
  destination.z = THREE.MathUtils.clamp(destination.z, bounds.minZ, bounds.maxZ);
}
