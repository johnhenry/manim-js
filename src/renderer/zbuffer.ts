// Software rasterizer with a per-pixel depth buffer. Used for 3D scenes so that
// interpenetrating surfaces resolve correctly per pixel (a true z-test), which
// painter's-algorithm face sorting cannot do. Filled polygons become
// depth-tested triangles; strokes become depth-tested thick lines. Depth is the
// camera-space value from ThreeDCamera.projectionDepth (larger = nearer).

interface ZVertex {
  x: number;
  y: number;
  z: number;
  r?: number;
  g?: number;
  b?: number;
}

export class ZBuffer {
  // "Logical" size: what callers pass to the constructor/resize() and think
  // in terms of (matches the final output resolution). Every rasterization
  // method (triangle/triangleGouraud/line) still operates directly in this
  // logical pixel space -- ZBuffer itself handles the internal supersample
  // scale-up transparently, so no call site above this file needs to know
  // about it.
  logicalWidth!: number;
  logicalHeight!: number;
  // Internal supersample factor (>=1; 1 = no anti-aliasing, today's
  // pre-existing behavior). Confirmed bug: this rasterizer's hard binary
  // per-pixel edge tests (triangle()'s `w0 < 0 || w1 < 0 || w2 < 0` and
  // line()'s per-step pixel-square stamping) produce badly aliased output
  // for any 3D-scene geometry -- most visible on Text glyph outlines, but
  // confirmed identical on ordinary VMobject curve strokes too (a general
  // rasterizer limitation, not text-specific). Rendering internally at
  // `superSample`x linear resolution and box-filtering down in blitTo()
  // fixes this without touching the edge-test math at all. Opt-in (default
  // 1, byte-identical to pre-fix behavior) since it costs O(superSample^2)
  // more pixel work -- not free for a CPU software rasterizer.
  superSample: number;
  // Internal (possibly supersampled) buffer size -- what the rasterization
  // methods actually index into.
  width!: number;
  height!: number;
  color!: Uint8ClampedArray;
  depth!: Float32Array;

  constructor(width: number, height: number, superSample = 1) {
    this.superSample = Math.max(1, Math.round(superSample));
    this.resize(width, height);
  }

  resize(width: number, height: number, superSample?: number): void {
    const nextSuperSample = superSample != null ? Math.max(1, Math.round(superSample)) : this.superSample;
    if (this.logicalWidth === width && this.logicalHeight === height && this.superSample === nextSuperSample) return;
    this.superSample = nextSuperSample;
    this.logicalWidth = width;
    this.logicalHeight = height;
    this.width = width * this.superSample;
    this.height = height * this.superSample;
    this.color = new Uint8ClampedArray(this.width * this.height * 4);
    this.depth = new Float32Array(this.width * this.height);
  }

  clear(r: number, g: number, b: number): void {
    const { color, depth } = this;
    for (let i = 0; i < depth.length; i++) {
      const j = i * 4;
      color[j] = r; color[j + 1] = g; color[j + 2] = b; color[j + 3] = 255;
      depth[i] = -Infinity; // nothing drawn yet; larger depth wins
    }
  }

  _blend(idx: number, r: number, g: number, b: number, a: number): void {
    const j = idx * 4;
    const c = this.color;
    if (a >= 0.999) {
      c[j] = r; c[j + 1] = g; c[j + 2] = b; c[j + 3] = 255;
    } else {
      const ia = 1 - a;
      c[j] = r * a + c[j] * ia;
      c[j + 1] = g * a + c[j + 1] * ia;
      c[j + 2] = b * a + c[j + 2] * ia;
      c[j + 3] = 255;
    }
  }

  // Scale a vertex's x/y into the internal (possibly supersampled) buffer
  // space; z/r/g/b are untouched (z is only ever compared, never indexed).
  _s(v: ZVertex): ZVertex {
    const s = this.superSample;
    return s === 1 ? v : { ...v, x: v.x * s, y: v.y * s };
  }

  // v0,v1,v2: {x, y, z} in LOGICAL pixel space (the resolution passed to the
  // constructor/resize()) with camera depth z. color: [r,g,b] 0-255.
  triangle(v0In: ZVertex, v1In: ZVertex, v2In: ZVertex, color: number[], alpha: number): void {
    const v0 = this._s(v0In), v1 = this._s(v1In), v2 = this._s(v2In);
    const { width, height, depth } = this;
    let minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
    let maxX = Math.min(width - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
    let minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
    let maxY = Math.min(height - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));
    if (minX > maxX || minY > maxY) return;

    const edge = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const area = edge(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y);
    if (area === 0) return;
    const inv = 1 / area;
    const [r, g, b] = color;

    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        let w0 = edge(v1.x, v1.y, v2.x, v2.y, px, py) * inv;
        let w1 = edge(v2.x, v2.y, v0.x, v0.y, px, py) * inv;
        let w2 = edge(v0.x, v0.y, v1.x, v1.y, px, py) * inv;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * v0.z + w1 * v1.z + w2 * v2.z;
        const idx = y * width + x;
        if (z > depth[idx]) {
          this._blend(idx, r, g, b, alpha);
          depth[idx] = z;
        }
      }
    }
  }

  // Like triangle(), but each vertex carries its own color {x,y,z,r,g,b} and the
  // color is barycentric-interpolated per pixel (Gouraud smooth shading).
  // v0,v1,v2 in LOGICAL pixel space, same as triangle().
  triangleGouraud(v0In: ZVertex, v1In: ZVertex, v2In: ZVertex, alpha: number): void {
    const v0 = this._s(v0In), v1 = this._s(v1In), v2 = this._s(v2In);
    const { width, height, depth } = this;
    let minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
    let maxX = Math.min(width - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
    let minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
    let maxY = Math.min(height - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));
    if (minX > maxX || minY > maxY) return;

    const edge = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const area = edge(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y);
    if (area === 0) return;
    const inv = 1 / area;

    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = edge(v1.x, v1.y, v2.x, v2.y, px, py) * inv;
        const w1 = edge(v2.x, v2.y, v0.x, v0.y, px, py) * inv;
        const w2 = edge(v0.x, v0.y, v1.x, v1.y, px, py) * inv;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * v0.z + w1 * v1.z + w2 * v2.z;
        const idx = y * width + x;
        if (z > depth[idx]) {
          const r = w0 * (v0.r ?? 0) + w1 * (v1.r ?? 0) + w2 * (v2.r ?? 0);
          const g = w0 * (v0.g ?? 0) + w1 * (v1.g ?? 0) + w2 * (v2.g ?? 0);
          const b = w0 * (v0.b ?? 0) + w1 * (v1.b ?? 0) + w2 * (v2.b ?? 0);
          this._blend(idx, r, g, b, alpha);
          depth[idx] = z;
        }
      }
    }
  }

  // Depth-tested thick line between LOGICAL pixel-space endpoints (with depth
  // z each) and a LOGICAL-pixel halfWidth -- both scaled into buffer space
  // here, same as triangle()/triangleGouraud().
  // `bias` nudges depth toward the viewer so edges sit atop the faces they trim.
  line(p0In: ZVertex, p1In: ZVertex, halfWidth: number, color: number[], alpha: number, bias = 0): void {
    const p0 = this._s(p0In), p1 = this._s(p1In);
    const { width, height, depth } = this;
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len));
    const hw = Math.max(0, Math.round(halfWidth * this.superSample));
    const [r, g, b] = color;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = Math.round(p0.x + dx * t);
      const cy = Math.round(p0.y + dy * t);
      const cz = p0.z + (p1.z - p0.z) * t + bias;
      for (let oy = -hw; oy <= hw; oy++) {
        const y = cy + oy;
        if (y < 0 || y >= height) continue;
        for (let ox = -hw; ox <= hw; ox++) {
          const x = cx + ox;
          if (x < 0 || x >= width) continue;
          const idx = y * width + x;
          if (cz > depth[idx]) {
            this._blend(idx, r, g, b, alpha);
            depth[idx] = cz;
          }
        }
      }
    }
  }

  // Copy the framebuffer into the 2D context, box-downsampling from the
  // internal (possibly supersampled) buffer to the logical resolution --
  // this box filter is what actually produces the anti-aliasing; everything
  // above just rasterizes at higher resolution with the same hard edges as
  // before.
  blitTo(ctx: CanvasRenderingContext2D): void {
    const { logicalWidth: lw, logicalHeight: lh, superSample: s } = this;
    if (s === 1) {
      const img = ctx.createImageData(this.width, this.height);
      img.data.set(this.color);
      ctx.putImageData(img, 0, 0);
      return;
    }
    const src = this.color;
    const out = new Uint8ClampedArray(lw * lh * 4);
    const n = s * s;
    for (let y = 0; y < lh; y++) {
      for (let x = 0; x < lw; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let sy = 0; sy < s; sy++) {
          const srcY = y * s + sy;
          for (let sx = 0; sx < s; sx++) {
            const srcIdx = (srcY * this.width + (x * s + sx)) * 4;
            r += src[srcIdx]; g += src[srcIdx + 1]; b += src[srcIdx + 2]; a += src[srcIdx + 3];
          }
        }
        const outIdx = (y * lw + x) * 4;
        out[outIdx] = r / n; out[outIdx + 1] = g / n; out[outIdx + 2] = b / n; out[outIdx + 3] = a / n;
      }
    }
    const img = ctx.createImageData(lw, lh);
    img.data.set(out);
    ctx.putImageData(img, 0, 0);
  }
}
