/**
 * Tracks pointer position (desktop) and device orientation (mobile)
 * to produce a normalized light direction for the shimmer effect.
 *
 * Returns a mutable [x, y] tuple in the range [-1, 1].
 */
export function createMotionTracker(
  container: HTMLElement,
): { lightPos: [number, number]; destroy: () => void } {
  const lightPos: [number, number] = [0, 0];

  // Smooth towards target to avoid jitter
  const target: [number, number] = [0, 0];
  const LERP = 0.08;
  let frame: number;

  function tick() {
    lightPos[0] += (target[0] - lightPos[0]) * LERP;
    lightPos[1] += (target[1] - lightPos[1]) * LERP;
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  // --- Pointer tracking (desktop) ---
  function onPointerMove(e: PointerEvent) {
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Map to [-1, 1] relative to container center, clamped to reasonable range
    target[0] = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * 0.5)));
    target[1] = Math.max(-1, Math.min(1, -(e.clientY - cy) / (window.innerHeight * 0.5)));
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // --- Device orientation (mobile) ---
  let orientationSupported = false;

  function onOrientation(e: DeviceOrientationEvent) {
    if (e.gamma == null || e.beta == null) return;
    orientationSupported = true;
    // gamma: left/right tilt (-90..90), beta: front/back tilt (-180..180)
    target[0] = Math.max(-1, Math.min(1, e.gamma / 45));
    target[1] = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
  }

  // Request permission on iOS 13+
  const doe = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof doe.requestPermission === 'function') {
    doe.requestPermission().then((state) => {
      if (state === 'granted') {
        window.addEventListener('deviceorientation', onOrientation, {
          passive: true,
        });
      }
    }).catch(() => {});
  } else {
    window.addEventListener('deviceorientation', onOrientation, {
      passive: true,
    });
  }

  function destroy() {
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('deviceorientation', onOrientation);
  }

  return { lightPos, destroy };
}
