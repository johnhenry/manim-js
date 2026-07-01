// GPU signed-distance-field (SDF) stroke rendering for the Three.js backend.
//
// The default WebGL stroke path draws THREE.LineSegments with a 1px
// LineBasicMaterial — thin, aliased, and width-locked to a single device pixel
// regardless of the requested strokeWidth. This module provides a crisper
// alternative (inspired by maloyan/manim-web's BezierShaderMaterial): every
// polyline SEGMENT is expanded into a screen-aligned quad (two triangles) that
// is fattened by the half stroke-width, and a fragment shader computes the
// exact distance from each fragment to the segment. `smoothstep` on that
// distance yields anti-aliased edges plus round caps (the distance is measured
// to the nearest point on the segment, so the ends round off naturally).
//
// The expansion happens in the vertex shader in *clip/NDC* space so the stroke
// keeps a constant pixel width no matter the camera / depth: each vertex is
// projected, then offset perpendicular to the segment's screen-space direction
// by half the width (converted from pixels to NDC via the resolution uniform).
// The projected clip position is kept (z/w preserved) so the quad is still
// depth-tested and composes correctly with 3D geometry.
//
// THREE is injected (any) so this stays out of non-WebGL builds and is
// unit-testable with a mock.

export interface BezierStrokeOptions {
  width?: number;          // stroke width in pixels (screen-space)
  resolution?: [number, number]; // [pixelWidth, pixelHeight]
  color?: [number, number, number]; // default RGB 0..1 when no vertex colors
  antialias?: number;      // AA feather in pixels (default 1.0)
  transparent?: boolean;
  opacity?: number;
}

const VERT = /* glsl */ `
precision highp float;

// Per-vertex quad corner offset sign: x in {-1,+1} = which side of the line,
// y in {-1,+1} = which end (start/finish) so we can extend caps past the ends.
attribute vec2 corner;
// The two endpoints of this quad's segment, in world space.
attribute vec3 aStart;
attribute vec3 aEnd;
// Per-vertex color (shared across the quad's 6 verts for a given segment).
attribute vec3 instanceColor;

uniform vec2 uResolution;   // pixels
uniform float uWidth;       // stroke width in pixels
uniform float uAA;          // antialias feather in pixels

varying vec3 vColor;
varying vec2 vUv;           // fragment position in the segment's local frame (px)
varying float vHalf;        // half width + feather in px
varying float vLen;         // segment length in px

vec2 toScreen(vec4 clip) {
  return (clip.xy / clip.w) * 0.5 * uResolution;
}

void main() {
  vColor = instanceColor;

  vec4 clipS = projectionMatrix * modelViewMatrix * vec4(aStart, 1.0);
  vec4 clipE = projectionMatrix * modelViewMatrix * vec4(aEnd, 1.0);

  vec2 sS = toScreen(clipS);
  vec2 sE = toScreen(clipE);

  vec2 dir = sE - sS;
  float len = length(dir);
  vec2 t = len > 1e-6 ? dir / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);

  float hw = uWidth * 0.5 + uAA;

  // Pick which endpoint this vertex belongs to and extend the cap outward by
  // half-width so round caps have room; offset sideways for thickness.
  float endSel = corner.y * 0.5 + 0.5; // 0 at start, 1 at end
  vec4 clip = mix(clipS, clipE, endSel);
  vec2 base = mix(sS, sE, endSel);

  vec2 capOffset = t * corner.y * hw; // push start back, end forward
  vec2 sideOffset = n * corner.x * hw;
  vec2 screenPos = base + capOffset + sideOffset;

  // Local frame: x along the segment measured from the start, y perpendicular.
  vUv = vec2(dot(screenPos - sS, t), dot(screenPos - sS, n));
  vHalf = hw;
  vLen = len;

  // Convert the screen-space offset back into clip space (preserve depth).
  vec2 ndcOffset = ((screenPos - base) / (0.5 * uResolution)) * clip.w;
  gl_Position = vec4(clip.xy + ndcOffset, clip.z, clip.w);
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform float uWidth;   // stroke width in pixels
uniform float uAA;      // feather in pixels
uniform vec3  uColor;   // fallback color
uniform float uOpacity;

varying vec3 vColor;
varying vec2 vUv;
varying float vHalf;
varying float vLen;

void main() {
  // Distance from this fragment to the segment (a capsule SDF): clamp the
  // along-axis coordinate to [0, len] then measure to that nearest point.
  float x = clamp(vUv.x, 0.0, vLen);
  vec2 nearest = vec2(x, 0.0);
  float d = distance(vUv, nearest);

  float halfW = uWidth * 0.5;
  float aa = max(uAA, 1e-4);
  // 1 inside the stroke, 0 outside, smooth over the feather width at the edge.
  float alpha = 1.0 - smoothstep(halfW - aa, halfW + aa, d);
  if (alpha <= 0.0) discard;

  gl_FragColor = vec4(vColor, uOpacity * alpha);
}
`;

// Build a ShaderMaterial that renders thick, anti-aliased SDF strokes.
export function makeBezierStrokeMaterial(THREE: any, opts: BezierStrokeOptions = {}): any {
  const res = opts.resolution ?? [1, 1];
  const color = opts.color ?? [1, 1, 1];
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uResolution: { value: new THREE.Vector2(res[0], res[1]) },
      uWidth: { value: opts.width ?? 4 },
      uAA: { value: opts.antialias ?? 1.0 },
      uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
      uOpacity: { value: opts.opacity ?? 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: opts.transparent ?? true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return mat;
}

// Expand flat line-segment data into an SDF quad BufferGeometry.
//
//   segments: flat [ax,ay,az, bx,by,bz, ...] endpoint pairs (2 pts / segment)
//   widths:   optional per-segment width (unused geometrically here; the width
//             lives in the material uniform, but accepted for API symmetry)
//   colors:   flat per-endpoint RGB [ra,ga,ba, rb,gb,bb, ...] matching segments
//
// Each segment -> a quad = 2 triangles = 6 vertices. Positions are dummy (the
// vertex shader rebuilds each vertex from aStart/aEnd + corner), but a real
// `position` attribute is still provided so THREE frustum-culls / bounds sanely.
export function buildStrokeGeometry(THREE: any, segments: number[], _widths: number[] | null, colors: number[]): any {
  const nSeg = Math.floor(segments.length / 6);
  const g = new THREE.BufferGeometry();

  // Six corners per quad: two triangles (a,b,c)(a,c,d). corner = (side, end):
  //   side: -1 = left of line, +1 = right; end: -1 = start vertex, +1 = end.
  const quad: [number, number][] = [
    [-1, -1], [1, -1], [1, 1], // tri 1
    [-1, -1], [1, 1], [-1, 1], // tri 2
  ];

  const position: number[] = [];
  const corner: number[] = [];
  const aStart: number[] = [];
  const aEnd: number[] = [];
  const instanceColor: number[] = [];

  for (let s = 0; s < nSeg; s++) {
    const ax = segments[s * 6 + 0], ay = segments[s * 6 + 1], az = segments[s * 6 + 2];
    const bx = segments[s * 6 + 3], by = segments[s * 6 + 4], bz = segments[s * 6 + 5];
    const ca = colors ? [colors[s * 6 + 0], colors[s * 6 + 1], colors[s * 6 + 2]] : [1, 1, 1];
    const cb = colors ? [colors[s * 6 + 3], colors[s * 6 + 4], colors[s * 6 + 5]] : [1, 1, 1];

    for (const [side, end] of quad) {
      // Anchor the geometry position at the corresponding endpoint so bounds
      // are meaningful; the shader offsets it in screen space.
      if (end < 0) position.push(ax, ay, az);
      else position.push(bx, by, bz);
      corner.push(side, end);
      aStart.push(ax, ay, az);
      aEnd.push(bx, by, bz);
      // Interpolate color along the cap end so it blends start->end.
      const c = end < 0 ? ca : cb;
      instanceColor.push(c[0], c[1], c[2]);
    }
  }

  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("corner", new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute("aStart", new THREE.Float32BufferAttribute(aStart, 3));
  g.setAttribute("aEnd", new THREE.Float32BufferAttribute(aEnd, 3));
  g.setAttribute("instanceColor", new THREE.Float32BufferAttribute(instanceColor, 3));
  return g;
}
