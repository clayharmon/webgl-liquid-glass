import { useRef, useEffect, useCallback } from 'react';
import { LiquidGlassRenderer } from './renderer';
import { createSpring, updateSpring } from './spring';
import { createMotionTracker } from './motion';
import type { LiquidGlassNavProps } from './types';

const NAV_HEIGHT = 56;
const NAV_RADIUS = 28;
const PILL_PADDING_X = 0;
const PILL_HEIGHT = 44;
const DRAG_THRESHOLD = 4;
const VEL_SMOOTHING = 0.25;

interface DragState {
  active: boolean;
  moved: boolean;
  pointerId: number;
  startPointerX: number;
  pillStartX: number;
  currentX: number;
  velocity: number;
  prevX: number;
}

function emptyDrag(): DragState {
  return {
    active: false,
    moved: false,
    pointerId: -1,
    startPointerX: 0,
    pillStartX: 0,
    currentX: 0,
    velocity: 0,
    prevX: 0,
  };
}

export function LiquidGlassNav({
  items,
  activeItem,
  onItemChange,
  className,
  style,
  activeColor = 'rgba(255, 255, 255, 0.95)',
  inactiveColor = 'rgba(255, 255, 255, 0.5)',
}: LiquidGlassNavProps) {
  const containerRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const springX = useRef(createSpring(0));
  const springW = useRef(createSpring(0));
  // Morph springs — drive the liquid/momentum deformation
  const springSkew = useRef(createSpring(0));
  const springBulge = useRef(createSpring(0));

  const activeRef = useRef(activeItem);
  const initializedRef = useRef(false);
  const itemsRef = useRef(items);
  const onItemChangeRef = useRef(onItemChange);

  activeRef.current = activeItem;
  itemsRef.current = items;
  onItemChangeRef.current = onItemChange;

  const drag = useRef<DragState>(emptyDrag());
  const didDragRef = useRef(false);

  // Measure active tab and set spring targets
  const measureAndTarget = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const idx = items.findIndex((i) => i.id === activeRef.current);
    const btn = itemRefs.current[idx];
    if (!btn) return;

    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    const x = bRect.left - cRect.left + bRect.width / 2;
    const w = bRect.width + PILL_PADDING_X * 2;

    springX.current.target = x;
    springW.current.target = w;

    if (!initializedRef.current) {
      springX.current.current = x;
      springW.current.current = w;
      initializedRef.current = true;
    }
  }, [items]);

  // Find nearest tab to current drag position
  const findNearestTab = useCallback((): string | null => {
    const container = containerRef.current;
    if (!container) return null;
    const cRect = container.getBoundingClientRect();
    const x = drag.current.currentX;

    let bestId: string | null = null;
    let bestDist = Infinity;

    itemRefs.current.forEach((btn, i) => {
      if (!btn) return;
      const bRect = btn.getBoundingClientRect();
      const center = bRect.left - cRect.left + bRect.width / 2;
      const dist = Math.abs(x - center);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = itemsRef.current[i]?.id ?? null;
      }
    });

    return bestId;
  }, []);

  // --- Pointer handlers ---
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    // Hit-test against the ACTIVE TAB BUTTON (not the pill div)
    // This gives a reliable, large touch target
    const activeIdx = itemsRef.current.findIndex(
      (i) => i.id === activeRef.current,
    );
    const activeBtn = itemRefs.current[activeIdx];
    if (!activeBtn) return;

    const btnRect = activeBtn.getBoundingClientRect();
    const pad = 10;
    const isOnActiveTab =
      e.clientX >= btnRect.left - pad &&
      e.clientX <= btnRect.right + pad &&
      e.clientY >= btnRect.top - pad &&
      e.clientY <= btnRect.bottom + pad;

    if (!isOnActiveTab) return;

    // Capture pointer on the container — all future pointer events go here
    // This also prevents the button's onClick from firing
    container.setPointerCapture(e.pointerId);

    drag.current = {
      active: true,
      moved: false,
      pointerId: e.pointerId,
      startPointerX: e.clientX,
      pillStartX: springX.current.current,
      currentX: springX.current.current,
      velocity: 0,
      prevX: e.clientX,
    };
    didDragRef.current = false;

    // Start bulge (inflate)
    springBulge.current.target = 1;
    springX.current.velocity = 0;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.pointerId) return;

    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();

    const dx = e.clientX - d.startPointerX;

    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true;
      didDragRef.current = true;
    }

    if (d.moved) {
      d.currentX = d.pillStartX + dx;
      const halfW = springW.current.current / 2;
      d.currentX = Math.max(
        halfW + 8,
        Math.min(cRect.width - halfW - 8, d.currentX),
      );
    }

    // Smooth velocity (EMA) — prevents per-pixel flicker in shader
    const rawVel = e.clientX - d.prevX;
    d.velocity = d.velocity * (1 - VEL_SMOOTHING) + rawVel * VEL_SMOOTHING;
    d.prevX = e.clientX;
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d.active || e.pointerId !== d.pointerId) return;

      d.active = false;
      // Release bulge
      springBulge.current.target = 0;

      if (d.moved) {
        const nearest = findNearestTab();
        if (nearest) {
          onItemChangeRef.current(nearest);
        }
      }

      requestAnimationFrame(() => {
        didDragRef.current = false;
      });
    },
    [findNearestTab],
  );

  const onButtonClick = useCallback(
    (item: { id: string; onClick?: () => void }) => {
      if (didDragRef.current) return;
      onItemChange(item.id);
      item.onClick?.();
    },
    [onItemChange],
  );

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderer = new LiquidGlassRenderer(canvas);
    const motion = createMotionTracker(container);

    let lastTime = performance.now();
    let frame: number;
    let running = true;

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);
      measureAndTarget();
    });
    ro.observe(container);

    const rect = container.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    requestAnimationFrame(() => measureAndTarget());

    function loop() {
      if (!running) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.064);
      lastTime = now;

      const d = drag.current;
      const sx = springX.current;
      const sw = springW.current;
      const sSkew = springSkew.current;
      const sBulge = springBulge.current;

      // --- Morph springs ---
      // Bulge: inflates on press, loose spring for bouncy release
      updateSpring(sBulge, dt, 260, 16);

      // Skew: follows drag velocity with lots of wobble
      if (d.active && d.moved) {
        sSkew.target = d.velocity * 0.6;
      } else {
        sSkew.target = 0;
      }
      updateSpring(sSkew, dt, 150, 7);

      const bulge = sBulge.current;
      const skew = sSkew.current;

      // --- Position / width springs ---
      if (d.active && d.moved) {
        sx.current = d.currentX;
        // Smooth velocity for shader — lerp toward target to avoid jitter
        const targetVel = d.velocity / Math.max(dt, 0.001);
        sx.velocity += (targetVel - sx.velocity) * 0.15;
        sw.current = sw.target;
      } else {
        updateSpring(sx, dt);
        updateSpring(sw, dt);
      }

      // --- Compute morph transforms ---
      // Big bubble inflate on press, velocity-based stretch/squish
      const absSkew = Math.abs(skew);
      const morphScaleX = 1 + bulge * 0.12 + Math.min(absSkew * 0.005, 0.2);
      // Grow MUCH taller on press (bubble breaks out of nav)
      const morphScaleY = 1 + bulge * 0.55 - Math.min(absSkew * 0.003, 0.12);
      // Skew for momentum feel
      const morphSkewDeg = Math.max(-14, Math.min(14, skew * 0.35));

      // --- Update pill DOM ---
      if (pillRef.current) {
        const pillX = sx.current - sw.current / 2;
        pillRef.current.style.transform =
          `translateX(${pillX}px) scaleX(${morphScaleX}) scaleY(${morphScaleY}) skewX(${morphSkewDeg}deg)`;
        pillRef.current.style.width = `${sw.current}px`;
      }

      // --- Render WebGL (pass effective pill dimensions) ---
      renderer.render({
        time: now / 1000,
        lightPos: motion.lightPos,
        pillX: sx.current,
        pillWidth: sw.current * morphScaleX,
        pillHeight: PILL_HEIGHT * morphScaleY,
        navRadius: NAV_RADIUS,
        transitionVel: sx.velocity,
        pressAmt: bulge,
      });

      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      motion.destroy();
      renderer.destroy();
    };
  }, [measureAndTarget]);

  useEffect(() => {
    measureAndTarget();
  }, [activeItem, measureAndTarget]);

  return (
    <nav
      ref={containerRef}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        height: NAV_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        borderRadius: NAV_RADIUS,
        backdropFilter: 'blur(40px) saturate(170%)',
        WebkitBackdropFilter: 'blur(40px) saturate(170%)',
        background: 'rgba(255, 255, 255, 0.14)',
        boxShadow:
          '0 8px 32px rgba(0, 0, 0, 0.18), inset 0 0 0 0.5px rgba(255, 255, 255, 0.2)',
        overflow: 'visible',
        zIndex: 9999,
        userSelect: 'none',
        touchAction: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {/* Pill — refraction + glass highlight */}
      <div
        ref={pillRef}
        style={{
          position: 'absolute',
          top: (NAV_HEIGHT - PILL_HEIGHT) / 2,
          left: 0,
          height: PILL_HEIGHT,
          borderRadius: PILL_HEIGHT / 2,
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'brightness(1.2) saturate(1.4)',
          WebkitBackdropFilter: 'brightness(1.2) saturate(1.4)',
          boxShadow:
            'inset 0 1px 1px rgba(255, 255, 255, 0.25), inset 0 -0.5px 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.1)',
          pointerEvents: 'none',
          willChange: 'transform, width',
          transformOrigin: 'center center',
        }}
      />

      {/* WebGL overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: NAV_RADIUS,
          pointerEvents: 'none',
        }}
      />

      {/* Tab items */}
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          onClick={() => onButtonClick(item)}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            padding: '6px 20px',
            border: 'none',
            background: 'none',
            // Active tab: pointer-events none so pill drag works
            pointerEvents: item.id === activeItem ? 'none' : 'auto',
            color: item.id === activeItem ? activeColor : inactiveColor,
            fontSize: 10,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
            fontWeight: item.id === activeItem ? 600 : 400,
            cursor: 'pointer',
            transition: 'color 0.2s ease, font-weight 0.2s ease',
            WebkitTapHighlightColor: 'transparent',
            lineHeight: 1,
          }}
        >
          {item.icon && (
            <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
