export const vertexSource = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const fragmentSource = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_lightPos;
uniform float u_pillX;
uniform float u_pillWidth;
uniform float u_pillHeight;
uniform float u_navRadius;
uniform float u_transitionVel;
uniform float u_pressAmt;
uniform vec3 u_tintColor;

float sdRoundedBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec2 p = gl_FragCoord.xy - u_resolution * 0.5;

  // --- Nav shape ---
  vec2 navHalf = u_resolution * 0.5 - 1.0;
  float navDist = sdRoundedBox(p, navHalf, u_navRadius);
  float navMask = 1.0 - smoothstep(-1.0, 0.5, navDist);

  // Nav inner edge highlight
  float navEdge = smoothstep(2.5, 0.0, abs(navDist)) * navMask;

  // --- Pill shape (may extend beyond canvas when inflated) ---
  vec2 pillCenter = vec2(u_pillX - u_resolution.x * 0.5, 0.0);
  vec2 pillHalf = vec2(u_pillWidth * 0.5, u_pillHeight * 0.5);
  float pillR = min(pillHalf.x, pillHalf.y);
  float pillDist = sdRoundedBox(p - pillCenter, pillHalf, pillR);
  float pillMask = 1.0 - smoothstep(-1.0, 0.5, pillDist);

  // Pill inner edge
  float pillEdge = smoothstep(2.0, 0.0, abs(pillDist)) * pillMask;

  // --- Directional light bias ---
  float navYNorm = p.y / (u_resolution.y * 0.5);
  float pillYNorm = (p.y - pillCenter.y) / max(pillHalf.y, 1.0);

  float lightBias = u_lightPos.y * 0.25 + 0.15;
  float navTopWeight = clamp(navYNorm * 0.25 + 0.5 + lightBias, 0.15, 1.0);
  float pillTopWeight = clamp(pillYNorm * 0.3 + 0.5 + lightBias, 0.15, 1.0);

  // --- Soft specular ---
  vec2 lightDir2D = u_lightPos * 0.5 + vec2(0.0, 0.3);
  float lLen = length(lightDir2D);
  if (lLen > 0.001) lightDir2D /= lLen;

  float navAngle = dot(normalize(p + vec2(0.001)), lightDir2D) * 0.5 + 0.5;
  float navSpec = pow(navAngle, 5.0) * 0.04;

  vec2 pRel = (p - pillCenter) / max(pillHalf, vec2(1.0));
  float pillAngle = dot(normalize(pRel + vec2(0.001)), lightDir2D) * 0.5 + 0.5;
  float pillSpec = pow(pillAngle, 4.0) * 0.07;

  // --- Chromatic aberration (refraction) ---
  vec2 pFromPill = (p - pillCenter) / max(pillHalf, vec2(1.0));
  float pDist01 = length(pFromPill);
  float chromStrength = smoothstep(0.35, 1.0, pDist01) * pillMask;

  // Base white, blending toward tint color at pill edges
  vec3 color = vec3(1.0);
  vec3 edgeTint = mix(vec3(1.0), u_tintColor, chromStrength * 0.6);
  color = mix(color, edgeTint, pillMask);

  // RGB split (classic chromatic aberration)
  color.r += chromStrength * pFromPill.x * 0.18;
  color.b -= chromStrength * pFromPill.x * 0.18;
  color.g += chromStrength * abs(pFromPill.y) * 0.06;

  // Tinted edge glow — active color refracts at the pill boundary
  float edgeGlow = smoothstep(0.6, 1.0, pDist01) * pillMask;
  color += u_tintColor * edgeGlow * 0.2;

  // Nav-level chromatic at edges
  vec2 navNorm = p / (u_resolution * 0.5);
  float navChrom = smoothstep(0.6, 1.0, length(navNorm)) * navMask;
  color.r += navChrom * navNorm.x * 0.07;
  color.b -= navChrom * navNorm.x * 0.07;

  // --- Lens brightness ---
  float lensCenter = (1.0 - pDist01 * pDist01) * 0.04 * pillMask;

  // --- Press glow ---
  float pressGlow = u_pressAmt * 0.06 * pillMask;
  float pressEdge = u_pressAmt * pillEdge * 0.2;

  // --- Motion shimmer ---
  // Smooth specular arc during drag. Uses gradual velocity direction
  // (not binary sign()) to avoid flicker on small movements.
  float absVel = abs(u_transitionVel);
  // Threshold: only shimmer above meaningful velocity
  float motionSpeed = smoothstep(80.0, 400.0, absVel);
  // Gradual direction: blends smoothly through zero instead of flipping
  float velDir = clamp(u_transitionVel * 0.003, -1.0, 1.0);
  vec2 motionLight = normalize(vec2(-velDir * 0.8, 0.4));
  float motionDot = dot(normalize(pFromPill + vec2(0.001)), motionLight) * 0.5 + 0.5;
  // Broad highlight sweep
  float motionHighlight = pow(motionDot, 3.0) * motionSpeed * 0.15 * pillMask;
  // Tight specular streak
  float motionStreak = pow(motionDot, 12.0) * motionSpeed * 0.2 * pillMask;

  // Enhanced chromatic during motion
  float motionChrom = motionSpeed * chromStrength * 0.7;
  color.r += motionChrom * pFromPill.x * 0.12;
  color.b -= motionChrom * pFromPill.x * 0.12;

  // --- Compose ---
  float alpha = 0.0;

  // Nav
  alpha += navEdge * navTopWeight * 0.22;
  alpha += navSpec * navMask;

  // Pill
  alpha += pillMask * 0.025;
  alpha += pillEdge * pillTopWeight * 0.35;
  alpha += pillSpec * pillMask;
  alpha += lensCenter;

  // Press
  alpha += pressGlow;
  alpha += pressEdge;

  // Motion shimmer
  alpha += motionHighlight;
  alpha += motionStreak;

  alpha *= navMask;
  alpha = clamp(alpha, 0.0, 0.6);

  gl_FragColor = vec4(color * alpha, alpha);
}
`;
