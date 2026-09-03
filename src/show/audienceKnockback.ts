export type KnockbackMode = "mosh" | "lift";
export type AudienceKnockbackPhase = "home" | "airborne" | "down" | "getting-up" | "returning";

export interface KnockbackBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface AudienceKnockbackState {
  phase: AudienceKnockbackPhase;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  elapsed: number;
  phaseElapsed: number;
  bounced: boolean;
  readonly homeX: number;
  readonly homeY: number;
  readonly homeZ: number;
  readonly limbPhases: readonly [number, number, number, number];
}

export function createAudienceKnockbackState(
  index: number,
  homeX: number,
  homeZ: number,
  homeY = 0,
): AudienceKnockbackState {
  const base = index * 0.37;
  return {
    phase: "home",
    x: homeX,
    y: homeY,
    z: homeZ,
    vx: 0,
    vy: 0,
    vz: 0,
    elapsed: 0,
    phaseElapsed: 0,
    bounced: false,
    homeX,
    homeY,
    homeZ,
    limbPhases: [base, base + 0.91, base + 2.03, base + 3.17],
  };
}

export function tryHitAudience(
  state: AudienceKnockbackState,
  mode: KnockbackMode,
  movementX: number,
  movementZ: number,
  forwardX: number,
  forwardZ: number,
): boolean {
  if (state.phase !== "home") return false;

  let directionX = movementX;
  let directionZ = movementZ;
  let length = Math.hypot(directionX, directionZ);
  if (length < 0.05) {
    directionX = forwardX;
    directionZ = forwardZ;
    length = Math.hypot(directionX, directionZ);
  }
  if (length < 0.001) {
    directionX = 0;
    directionZ = -1;
    length = 1;
  }

  const horizontalImpulse = mode === "lift" ? 7 : 5;
  state.vx = (directionX / length) * horizontalImpulse;
  state.vz = (directionZ / length) * horizontalImpulse;
  state.vy = mode === "lift" ? 4 : 3;
  state.phase = "airborne";
  state.elapsed = 0;
  state.phaseElapsed = 0;
  state.bounced = false;
  return true;
}

export function stepAudienceKnockback(
  state: AudienceKnockbackState,
  dt: number,
  bounds: KnockbackBounds,
  groundHeightAt: (x: number, z: number) => number = flatGround,
): void {
  if (state.phase === "home") return;

  state.elapsed += dt;
  state.phaseElapsed += dt;

  if (state.phase === "airborne") {
    state.vy -= 12 * dt;
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    state.z += state.vz * dt;
    const damping = Math.exp(-1.8 * dt);
    state.vx *= damping;
    state.vz *= damping;

    const groundY = groundHeightAt(state.x, state.z);
    if (state.y <= groundY) {
      state.y = groundY;
      if (!state.bounced && Math.abs(state.vy) > 1) {
        state.vy = -state.vy * 0.16;
        state.bounced = true;
      } else {
        state.vy = 0;
        state.phase = "down";
        state.phaseElapsed = 0;
      }
    }
  }

  const minX = bounds.minX + 0.25;
  const maxX = bounds.maxX - 0.25;
  const minZ = bounds.minZ + 0.25;
  const maxZ = bounds.maxZ - 0.25;
  if (state.x < minX || state.x > maxX) {
    state.x = Math.min(maxX, Math.max(minX, state.x));
    state.vx = 0;
  }
  if (state.z < minZ || state.z > maxZ) {
    state.z = Math.min(maxZ, Math.max(minZ, state.z));
    state.vz = 0;
  }

  if ((state.phase === "airborne" || state.phase === "down") && state.elapsed >= 2) {
    state.phase = "getting-up";
    state.phaseElapsed = 0;
    state.y = groundHeightAt(state.x, state.z);
    state.vx = 0;
    state.vy = 0;
    state.vz = 0;
  } else if (state.phase === "getting-up" && state.phaseElapsed >= 0.3) {
    state.phase = "returning";
    state.phaseElapsed = 0;
  } else if (state.phase === "returning") {
    const dx = state.homeX - state.x;
    const dz = state.homeZ - state.z;
    const distance = Math.hypot(dx, dz);
    const step = 5.5 * dt;
    if (distance <= step || distance < 0.03) {
      state.x = state.homeX;
      state.y = state.homeY;
      state.z = state.homeZ;
      state.phase = "home";
      state.elapsed = 0;
      state.phaseElapsed = 0;
      return;
    }
    state.x += (dx / distance) * step;
    state.z += (dz / distance) * step;
    const returnY = state.homeY + Math.abs(Math.sin(state.phaseElapsed * 8)) * 0.18;
    state.y += (returnY - state.y) * Math.min(1, dt * 6);
  }
}

function flatGround(): number {
  return 0;
}
