# CLAUDE.md

## Project Overview

WebGL-powered Apple Liquid Glass navbar component for React. Ships as an npm package (`webgl-liquid-glass`).

## Architecture

The glass effect is composited from three layers:
1. **CSS `backdrop-filter`** on the nav — real frosted glass blur
2. **CSS pill element** with brightness/saturation `backdrop-filter` — refraction contrast
3. **WebGL canvas overlay** — SDF-based edge highlights, specular, chromatic aberration, motion shimmer

Spring physics drive all animations (pill position, bubble morph, skew/stretch). No animation library dependencies.

## Key Files

- `src/shaders.ts` — GLSL vertex + fragment shaders (SDF rounded box, Blinn-Phong specular, chromatic aberration)
- `src/renderer.ts` — WebGL context, shader compilation, uniform management
- `src/LiquidGlassNav.tsx` — Main React component, pointer handling, animation loop
- `src/spring.ts` — Damped spring physics with configurable stiffness/damping
- `src/motion.ts` — Pointer + gyroscope light position tracking
- `example/` — Vite-served demo app (not part of the npm package)

## Commands

- `npm run dev` — Start Vite dev server with example app
- `npm run build` — Build library with tsup (CJS + ESM + .d.ts)
- `npm run typecheck` — Run `tsc --noEmit`

## Conventions

- All animation state lives in refs (no React re-renders during 60fps animation loop)
- Shader uniforms are in CSS pixels, scaled by `devicePixelRatio` in the renderer
- Spring physics use `updateSpring(state, dt, stiffness?, damping?)` — optional params for per-spring tuning
- The pill's CSS transforms (scale, skew) are driven by dedicated morph springs (`springSkew`, `springBulge`)
- Velocity tracking uses exponential moving average to prevent shader flicker
