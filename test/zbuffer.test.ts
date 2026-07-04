import { test } from "node:test";
import assert from "node:assert/strict";
import { ZBuffer } from "../src/renderer/zbuffer.ts";
import { CanvasRenderer } from "../src/renderer/CanvasRenderer.ts";
import { ThreeDCamera } from "../src/scene/three_d.ts";
import { Circle } from "../src/mobject/geometry.ts";

// Read back an RGB pixel.
function px(zb, x, y) {
  const i = (y * zb.width + x) * 4;
  return [zb.color[i], zb.color[i + 1], zb.color[i + 2]];
}

test("per-pixel depth test resolves two crossing triangles", () => {
  const zb = new ZBuffer(20, 20);
  zb.clear(0, 0, 0);
  // Triangle A (red): near on the LEFT (z=10), far on the RIGHT (z=-10).
  const A = [
    { x: 0, y: 0, z: 10 }, { x: 0, y: 19, z: 10 }, { x: 19, y: 10, z: -10 },
  ];
  // Triangle B (green): far on the LEFT (z=-10), near on the RIGHT (z=10).
  const B = [
    { x: 19, y: 0, z: 10 }, { x: 19, y: 19, z: 10 }, { x: 0, y: 10, z: -10 },
  ];
  // Draw A then B; correct output must be independent of draw order per pixel.
  zb.triangle(A[0], A[1], A[2], [255, 0, 0], 1);
  zb.triangle(B[0], B[1], B[2], [0, 255, 0], 1);

  // Far left overlaps: A is near (red) there.
  assert.deepEqual(px(zb, 2, 10), [255, 0, 0]);
  // Far right overlaps: B is near (green) there.
  assert.deepEqual(px(zb, 17, 10), [0, 255, 0]);
});

test("draw order does not change the depth-resolved result", () => {
  const make = () => {
    const zb = new ZBuffer(10, 10);
    zb.clear(0, 0, 0);
    return zb;
  };
  const near = { a: { x: 0, y: 0, z: 5 }, b: { x: 9, y: 0, z: 5 }, c: { x: 5, y: 9, z: 5 } };
  const far = { a: { x: 0, y: 0, z: -5 }, b: { x: 9, y: 0, z: -5 }, c: { x: 5, y: 9, z: -5 } };

  const zb1 = make();
  zb1.triangle(near.a, near.b, near.c, [10, 20, 30], 1);
  zb1.triangle(far.a, far.b, far.c, [200, 100, 50], 1);

  const zb2 = make();
  zb2.triangle(far.a, far.b, far.c, [200, 100, 50], 1);
  zb2.triangle(near.a, near.b, near.c, [10, 20, 30], 1);

  // Both orders show the near triangle's color where they overlap.
  assert.deepEqual(px(zb1, 5, 3), [10, 20, 30]);
  assert.deepEqual(px(zb2, 5, 3), [10, 20, 30]);
});

test("lines respect the depth buffer", () => {
  const zb = new ZBuffer(20, 20);
  zb.clear(0, 0, 0);
  // A near horizontal blue line, then a far red line crossing it.
  zb.line({ x: 0, y: 10, z: 8 }, { x: 19, y: 10, z: 8 }, 1, [0, 0, 255], 1, 0);
  zb.line({ x: 10, y: 0, z: -8 }, { x: 10, y: 19, z: -8 }, 1, [255, 0, 0], 1, 0);
  // At the crossing the nearer (blue) line wins.
  assert.deepEqual(px(zb, 10, 10), [0, 0, 255]);
});

// Bug #7 (never filed as a GitHub issue -- documented only in the bundled
// "ecmanim" skill's known-bugs list): this rasterizer's hard binary per-pixel
// edge tests (triangle()'s `w0 < 0 || w1 < 0 || w2 < 0`, line()'s per-step
// pixel-square stamping) produce badly aliased 3D-scene output -- confirmed
// via a real rendered scene showing staircase-stepped Text glyph edges.
// Fixed via opt-in supersampling: ZBuffer renders internally at
// `superSample`x linear resolution (transparent to every triangle()/
// triangleGouraud()/line() call -- they still take LOGICAL pixel-space
// coordinates) and box-filters down to the logical resolution in blitTo().
function makeFakeCtx() {
  return {
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData(img) { this._lastImage = img; },
  };
}

test("superSample defaults to 1 -- byte-identical to pre-fix behavior", () => {
  const zb = new ZBuffer(20, 20);
  assert.equal(zb.superSample, 1);
  assert.equal(zb.width, 20);
  assert.equal(zb.height, 20);
  assert.equal(zb.logicalWidth, 20);
  assert.equal(zb.logicalHeight, 20);
});

test("superSample:N allocates an internal buffer N times larger per axis, but exposes the same logical size", () => {
  const zb = new ZBuffer(20, 10, 3);
  assert.equal(zb.width, 60);
  assert.equal(zb.height, 30);
  assert.equal(zb.logicalWidth, 20);
  assert.equal(zb.logicalHeight, 10);
});

test("resize() rebuilds buffers when only the supersample factor changes, even if logical dimensions don't", () => {
  const zb = new ZBuffer(10, 10, 1);
  assert.equal(zb.width, 10);
  zb.resize(10, 10, 4);
  assert.equal(zb.superSample, 4);
  assert.equal(zb.width, 40);
  assert.equal(zb.logicalWidth, 10);
});

test("a triangle edge crossing a pixel produces a blended (anti-aliased) color at superSample>1, but a hard binary color at superSample=1", () => {
  // A big white triangle covering roughly the right two-thirds of a small
  // buffer, black background -- the vertical-ish edge crosses pixel column 6
  // at a fractional x, so column 6 is the edge pixel to inspect.
  const tri = [{ x: 6.4, y: -1, z: 0 }, { x: 6.4, y: 21, z: 0 }, { x: 20, y: 10, z: 0 }];

  const aliased = new ZBuffer(20, 20, 1);
  aliased.clear(0, 0, 0);
  aliased.triangle(tri[0], tri[1], tri[2], [255, 255, 255], 1);
  const aliasedCtx = makeFakeCtx();
  aliased.blitTo(aliasedCtx);
  const aIdx = (10 * 20 + 6) * 4;
  const aliasedVal = aliasedCtx._lastImage.data[aIdx];
  assert.ok(aliasedVal === 0 || aliasedVal === 255, `aliased edge pixel should be pure binary, got ${aliasedVal}`);

  const smooth = new ZBuffer(20, 20, 8);
  smooth.clear(0, 0, 0);
  smooth.triangle(tri[0], tri[1], tri[2], [255, 255, 255], 1);
  const smoothCtx = makeFakeCtx();
  smooth.blitTo(smoothCtx);
  const sIdx = (10 * 20 + 6) * 4;
  const smoothVal = smoothCtx._lastImage.data[sIdx];
  assert.ok(smoothVal > 0 && smoothVal < 255, `supersampled edge pixel should be a blended gray, got ${smoothVal}`);
});

test("blitTo() output is the correct logical size regardless of supersample factor", () => {
  const zb = new ZBuffer(15, 9, 4);
  zb.clear(10, 20, 30);
  const ctx = makeFakeCtx();
  zb.blitTo(ctx);
  assert.equal(ctx._lastImage.width, 15);
  assert.equal(ctx._lastImage.height, 9);
  // A uniform clear color should downsample to the exact same flat color.
  assert.equal(ctx._lastImage.data[0], 10);
  assert.equal(ctx._lastImage.data[1], 20);
  assert.equal(ctx._lastImage.data[2], 30);
});

test("CanvasRenderer.renderScene3D() wires camera.superSample into its internal ZBuffer", () => {
  const fakeCtx: any = {
    createImageData(w: number, h: number) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() {},
  };
  const camera = new ThreeDCamera({ pixelWidth: 20, pixelHeight: 20, frameWidth: 8, frameHeight: 8, superSample: 3 });
  camera.setCameraOrientation?.({ phi: 0.6, theta: -0.6 });
  const renderer = new CanvasRenderer(fakeCtx, camera);
  renderer.renderScene3D([new Circle({ radius: 1 })]);
  assert.equal(renderer._zb.superSample, 3);
  assert.equal(renderer._zb.logicalWidth, 20);
  assert.equal(renderer._zb.width, 60);
});

test("CanvasRenderer.renderScene3D() defaults to superSample 1 when unset (byte-identical to pre-fix behavior)", () => {
  const fakeCtx: any = {
    createImageData(w: number, h: number) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() {},
  };
  const camera = new ThreeDCamera({ pixelWidth: 20, pixelHeight: 20, frameWidth: 8, frameHeight: 8 });
  const renderer = new CanvasRenderer(fakeCtx, camera);
  renderer.renderScene3D([new Circle({ radius: 1 })]);
  assert.equal(renderer._zb.superSample, 1);
  assert.equal(renderer._zb.width, 20);
});
