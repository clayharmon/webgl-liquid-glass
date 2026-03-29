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

let _parseCtx: CanvasRenderingContext2D | null = null;
function parseColor(color: string): [number, number, number] {
  if (!_parseCtx) {
    _parseCtx = document.createElement('canvas').getContext('2d')!;
  }
  _parseCtx.fillStyle = '#000';
  _parseCtx.fillStyle = color;
  const c = _parseCtx.fillStyle;
  if (c.startsWith('#')) {
    return [
      parseInt(c.slice(1, 3), 16) / 255,
      parseInt(c.slice(3, 5), 16) / 255,
      parseInt(c.slice(5, 7), 16) / 255,
    ];
  }
  const m = c.match(/[\d.]+/g);
  if (m && m.length >= 3) {
    return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  }
  return [1, 1, 1];
}

const BUTTON_STYLE = {
  display: 'flex' as const,
  flexDirection: 'column' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 2,
  padding: '6px 20px',
  border: 'none',
  background: 'none',
  fontSize: 10,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  WebkitUserSelect: 'none' as const,
  userSelect: 'none' as const,
  lineHeight: 1,
};

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
  const activeClipRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const springX = useRef(createSpring(0));
  const springW = useRef(createSpring(0));
  const springSkew = useRef(createSpring(0));
  const springBulge = useRef(createSpring(0));

  const activeRef = useRef(activeItem);
  const initializedRef = useRef(false);
  const itemsRef = useRef(items);
  const onItemChangeRef = useRef(onItemChange);
  const visualTargetRef = useRef(activeItem);
  const tintColorRef = useRef<[number, number, number]>(parseColor(activeColor));
  const navWidthRef = useRef(0);

  activeRef.current = activeItem;
  itemsRef.current = items;
  onItemChangeRef.current = onItemChange;
  tintColorRef.current = parseColor(activeColor);

  const drag = useRef<DragState>(emptyDrag());

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
      navWidthRef.current = cRect.width;

      if (!initializedRef.current) {
        springX.current.current = x;
        springW.current.current = w;
        initializedRef.current = true;
      }
    },
    [items],
  );

  const findTabAt = useCallback(
    (clientX: number, clientY: number): number => {
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
    },
    [],
  );

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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const tabIdx = findTabAt(e.clientX, e.clientY);
      if (tabIdx < 0) return;

      const pressedItem = itemsRef.current[tabIdx];
      if (!pressedItem) return;

      container.setPointerCapture(e.pointerId);
      targetTab(pressedItem.id);

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

      let finalTab: string | null;
      if (d.moved) {
        finalTab = findNearestTab();
      } else {
        finalTab = visualTargetRef.current;
      }

      if (finalTab) {
        onItemChangeRef.current(finalTab);
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
      navWidthRef.current = rect.width;
      targetTab(activeRef.current);
    });
    ro.observe(container);

    const rect = container.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    navWidthRef.current = rect.width;
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
        sx.current = d.currentX;
        const targetVel = d.velocity / Math.max(dt, 0.001);
        sx.velocity += (targetVel - sx.velocity) * 0.15;
        sw.current = sw.target;
      } else {
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

      // --- Clip active layer to pill shape ---
      if (activeClipRef.current) {
        const effW = sw.current * morphScaleX;
        const effH = PILL_HEIGHT * morphScaleY;
        const cw = navWidthRef.current;
        const effLeft = sx.current - effW / 2;
        const effTop = (NAV_HEIGHT - effH) / 2;
        const effRight = cw - effLeft - effW;
        const effBottom = NAV_HEIGHT - effTop - effH;
        const effRadius = Math.min(effW, effH) / 2;

        activeClipRef.current.style.clipPath = `inset(${effTop}px ${effRight}px ${effBottom}px ${effLeft}px round ${effRadius}px)`;
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
        tintColor: tintColorRef.current,
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

  useEffect(() => {
    targetTab(activeItem);
  }, [activeItem, targetTab]);

  // Shared tab content renderer
  const tabContent = (item: (typeof items)[number]) => (
    <>
      {item.icon && (
        <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
      )}
      <span style={{ display: 'grid' }}>
        <span style={{ gridArea: '1 / 1' }}>{item.label}</span>
        <span
          aria-hidden
          style={{
            gridArea: '1 / 1',
            fontWeight: 600,
            visibility: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {item.label}
        </span>
      </span>
    </>
  );

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
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {/* Pill */}
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

      {/* Inactive layer (always visible, full width) */}
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          style={{
            ...BUTTON_STYLE,
            position: 'relative',
            zIndex: 1,
            color: inactiveColor,
            fontWeight: 400,
          }}
        >
          {tabContent(item)}
        </button>
      ))}

      {/* Active layer (clipped to pill shape — hard edge) */}
      <div
        ref={activeClipRef}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          pointerEvents: 'none',
          zIndex: 2,
          clipPath: 'inset(100% 100% 100% 100%)',
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              ...BUTTON_STYLE,
              color: activeColor,
              fontWeight: 600,
            }}
          >
            {tabContent(item)}
          </div>
        ))}
      </div>
    </nav>
  );
}
