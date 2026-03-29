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
  const springSkew = useRef(createSpring(0));
  const springBulge = useRef(createSpring(0));

  const activeRef = useRef(activeItem);
  const initializedRef = useRef(false);
  const itemsRef = useRef(items);
  const onItemChangeRef = useRef(onItemChange);
  // Track which tab the pill is visually targeting (may differ from activeItem during press)
  const visualTargetRef = useRef(activeItem);

  activeRef.current = activeItem;
  itemsRef.current = items;
  onItemChangeRef.current = onItemChange;

  const drag = useRef<DragState>(emptyDrag());

  // Measure a tab by id and set spring targets to it
  const targetTab = useCallback(
    (tabId: string) => {
      const container = containerRef.current;
      if (!container) return;
      const idx = items.findIndex((i) => i.id === tabId);
      const btn = itemRefs.current[idx];
      if (!btn) return;

      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      const x = bRect.left - cRect.left + bRect.width / 2;
      const w = bRect.width + PILL_PADDING_X * 2;

      springX.current.target = x;
      springW.current.target = w;
      visualTargetRef.current = tabId;

      if (!initializedRef.current) {
        springX.current.current = x;
        springW.current.current = w;
        initializedRef.current = true;
      }
    },
    [items],
  );

  // Find which tab button is under a pointer position
  const findTabAt = useCallback((clientX: number, clientY: number): number => {
    for (let i = 0; i < itemRefs.current.length; i++) {
      const btn = itemRefs.current[i];
      if (!btn) continue;
      const r = btn.getBoundingClientRect();
      if (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      ) {
        return i;
      }
    }
    return -1;
  }, []);

  // Find nearest tab to current drag x position
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
  // Press on ANY tab: pill springs there, bubble inflates, drag begins.
  // onItemChange only fires on release.
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Find which tab was pressed
      const tabIdx = findTabAt(e.clientX, e.clientY);
      if (tabIdx < 0) return;

      const pressedItem = itemsRef.current[tabIdx];
      if (!pressedItem) return;

      // Capture pointer — all events go to the nav, prevents button click
      container.setPointerCapture(e.pointerId);

      // Spring the pill toward the pressed tab
      targetTab(pressedItem.id);

      // Measure where the pill will land (for drag start position)
      const cRect = container.getBoundingClientRect();
      const bRect = itemRefs.current[tabIdx]!.getBoundingClientRect();
      const tabCenterX = bRect.left - cRect.left + bRect.width / 2;

      drag.current = {
        active: true,
        moved: false,
        pointerId: e.pointerId,
        startPointerX: e.clientX,
        pillStartX: tabCenterX,
        currentX: tabCenterX,
        velocity: 0,
        prevX: e.clientX,
      };

      // Inflate bubble
      springBulge.current.target = 1;
    },
    [findTabAt, targetTab],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.pointerId) return;

    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();

    const dx = e.clientX - d.startPointerX;

    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true;
    }

    if (d.moved) {
      d.currentX = d.pillStartX + dx;
      const halfW = springW.current.current / 2;
      d.currentX = Math.max(
        halfW + 8,
        Math.min(cRect.width - halfW - 8, d.currentX),
      );
    }

    // Smooth velocity (EMA)
    const rawVel = e.clientX - d.prevX;
    d.velocity = d.velocity * (1 - VEL_SMOOTHING) + rawVel * VEL_SMOOTHING;
    d.prevX = e.clientX;
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d.active || e.pointerId !== d.pointerId) return;

      d.active = false;
      springBulge.current.target = 0;

      // Determine final tab: if dragged, use nearest to drag position.
      // If not dragged, use the tab we pressed on (visualTarget).
      let finalTab: string | null;
      if (d.moved) {
        finalTab = findNearestTab();
      } else {
        finalTab = visualTargetRef.current;
      }

      if (finalTab) {
        onItemChangeRef.current(finalTab);
        // Also fire per-item onClick if present
        const item = itemsRef.current.find((i) => i.id === finalTab);
        item?.onClick?.();
      }
    },
    [findNearestTab],
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
      targetTab(activeRef.current);
    });
    ro.observe(container);

    const rect = container.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    requestAnimationFrame(() => targetTab(activeRef.current));

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
      updateSpring(sBulge, dt, 260, 16);

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
        // Dragging: pill tracks pointer directly
        sx.current = d.currentX;
        const targetVel = d.velocity / Math.max(dt, 0.001);
        sx.velocity += (targetVel - sx.velocity) * 0.15;
        sw.current = sw.target;
      } else {
        // Spring toward target (pressed tab or active tab)
        updateSpring(sx, dt);
        updateSpring(sw, dt);
      }

      // --- Compute morph transforms ---
      const absSkew = Math.abs(skew);
      const morphScaleX = 1 + bulge * 0.12 + Math.min(absSkew * 0.005, 0.2);
      const morphScaleY =
        1 + bulge * 0.55 - Math.min(absSkew * 0.003, 0.12);
      const morphSkewDeg = Math.max(-14, Math.min(14, skew * 0.35));

      // --- Update pill DOM ---
      if (pillRef.current) {
        const pillX = sx.current - sw.current / 2;
        pillRef.current.style.transform = `translateX(${pillX}px) scaleX(${morphScaleX}) scaleY(${morphScaleY}) skewX(${morphSkewDeg}deg)`;
        pillRef.current.style.width = `${sw.current}px`;
      }

      // --- Render WebGL ---
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
  }, [targetTab]);

  // When activeItem changes (from external state), re-target the pill
  useEffect(() => {
    targetTab(activeItem);
  }, [activeItem, targetTab]);

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

      {/* Tab items — all pointer interaction handled by nav, not buttons */}
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
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
