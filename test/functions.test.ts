import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ParametricFunction,
  FunctionGraph,
  ImplicitFunction,
} from "../src/mobject/functions.ts";

const TAU = Math.PI * 2;

test("ParametricFunction of a unit circle spans [-1,1]x[-1,1] with finite points", () => {
  const circle = new ParametricFunction(
    (t) => [Math.cos(t), Math.sin(t)],
    { tRange: [0, TAU, 0.05] },
  );
  assert.ok(circle.points.length > 0);
  assert.ok(circle.points.every((p) => p.every(Number.isFinite)));

  const xs = circle.points.map((p) => p[0]);
  const ys = circle.points.map((p) => p[1]);
  assert.ok(Math.max(...xs) > 0.95 && Math.min(...xs) < -0.95);
  assert.ok(Math.max(...ys) > 0.95 && Math.min(...ys) < -0.95);
});

test("FunctionGraph of x^2 reaches y~4 and getPointFromFunction(2)~[2,4]", () => {
  const g = new FunctionGraph((x) => x * x, { xRange: [-2, 2, 0.05] });
  const ys = g.points.map((p) => p[1]);
  assert.ok(Math.max(...ys) >= 3.9 && Math.max(...ys) <= 4.1);

  const pt = g.getPointFromFunction(2);
  assert.ok(Math.abs(pt[0] - 2) < 1e-9);
  assert.ok(Math.abs(pt[1] - 4) < 1e-9);
  // underlyingFunction stored for Axes-style helpers.
  assert.equal(g.underlyingFunction(3), 9);
});

test("ImplicitFunction of x^2+y^2-1=0 lies on the unit circle", () => {
  const impl = new ImplicitFunction((x, y) => x * x + y * y - 1, {
    xRange: [-2, 2],
    yRange: [-2, 2],
  });
  assert.ok(impl.points.length > 0);
  // Every sampled anchor must have radius ~1.
  for (const p of impl.points) {
    const r = Math.hypot(p[0], p[1]);
    assert.ok(Math.abs(r - 1) < 0.1, `radius ${r} off unit circle`);
  }
});

test("discontinuities split the curve into multiple subpaths", () => {
  const f = new ParametricFunction((t) => [t, t], {
    tRange: [-2, 2, 0.1],
    discontinuities: [0],
    useSmoothing: false,
  });
  assert.ok(f.subpathStarts.length >= 2, "expected >= 2 subpaths");
  assert.ok(f.getSubpaths().length >= 2);
});

test("useSmoothing:false builds straight corners", () => {
  const straight = new ParametricFunction((t) => [t, t], {
    tRange: [0, 1, 0.25],
    useSmoothing: false,
  });
  assert.equal(straight._straightPath, true);

  const smooth = new ParametricFunction((t) => [Math.cos(t), Math.sin(t)], {
    tRange: [0, TAU, 0.1],
    useSmoothing: true,
  });
  assert.equal(smooth._straightPath, false);
});

test("getPoint / getFunction expose the parametric function", () => {
  const fn = (t: number) => [t * 2, t * 3, 0];
  const pf = new ParametricFunction(fn, { tRange: [0, 1, 0.1] });
  assert.equal(pf.getFunction(), fn);
  const p = pf.getPoint(1);
  assert.deepEqual(p, [2, 3, 0]);
});
