import type { SpringState } from './types';

const STIFFNESS = 340;
const DAMPING = 26;
const SETTLE_THRESHOLD = 0.4;
const VELOCITY_THRESHOLD = 0.4;

export function createSpring(initial: number): SpringState {
  return { current: initial, target: initial, velocity: 0 };
}

export function updateSpring(
  s: SpringState,
  dt: number,
  stiffness = STIFFNESS,
  damping = DAMPING,
): void {
  const displacement = s.current - s.target;
  const springForce = -stiffness * displacement;
  const dampingForce = -damping * s.velocity;

  s.velocity += (springForce + dampingForce) * dt;
  s.current += s.velocity * dt;

  // Settle when close enough
  if (
    Math.abs(displacement) < SETTLE_THRESHOLD &&
    Math.abs(s.velocity) < VELOCITY_THRESHOLD
  ) {
    s.current = s.target;
    s.velocity = 0;
  }
}
