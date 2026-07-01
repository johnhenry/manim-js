import { test, before } from "node:test";
import assert from "node:assert/strict";
import {
  Axes,
  NumberPlane,
  PolarPlane,
  ComplexPlane,
} from "../src/mobject/coordinate_systems.ts";
import { LinearBase, LogBase } from "../src/mobject/graphing_scale.ts";
import { VGroup } from "../src/mobject/VMobject.ts";
import { Rectangle, Polygon, Circle } from "../src/mobject/geometry.ts";
import { initMathTex } from "../src/mobject/mathtex.ts";

// A vector font is needed for Text labels; MathJax for MathTex graph labels.
before(async () => {
  await (await import("../src/renderer/fonts-node.ts")).loadVectorFont();
  await initMathTex();
});

test("getRiemannRectangles returns a VGroup of Rectangles", () => {
  const ax = new Axes({ xRange: [0, 4, 1], yRange: [0, 16, 4] });
  const graph = ax.plot((x) => x * x, { xRange: [0, 4] });
  const rects = ax.getRiemannRectangles(graph, { dx: 0.5, inputSampleType: "center" });
  assert.ok(rects instanceof VGroup);
  assert.equal(rects.submobjects.length, 8); // (4-0)/0.5, center sampling => all nonzero
  for (const r of rects.submobjects) assert.ok(r instanceof Rectangle);
});

test("getArea builds a filled Polygon region", () => {
  const ax = new Axes({ xRange: [0, 3, 1], yRange: [0, 9, 3] });
  const graph = ax.plot((x) => x * x);
  const area = ax.getArea(graph, { xRange: [0, 2], opacity: 0.5 });
  assert.ok(area instanceof Polygon);
  assert.ok(area.points.length > 0);
  assert.ok(area.fillOpacity > 0);
});

test("slopeOfTangent of y=x^2 at x=1 is about 2", () => {
  const ax = new Axes();
  const graph = ax.plot((x) => x * x);
  assert.ok(Math.abs(ax.slopeOfTangent(1, graph) - 2) < 1e-3);
});

test("getGraphLabel places a label near the curve", () => {
  const ax = new Axes({ xRange: [0, 4, 1], yRange: [0, 16, 4] });
  const graph = ax.plot((x) => x * x, { xRange: [0, 4] });
  const label = ax.getGraphLabel(graph, "x^2", { x: 2 });
  assert.ok(label.submobjects.length > 0);
  const anchor = ax.inputToGraphPoint(2, graph);
  const c = label.getCenter();
  assert.ok(Math.hypot(c[0] - anchor[0], c[1] - anchor[1]) < 2.5);
});

test("getAxisLabels adds two labels", () => {
  const ax = new Axes();
  const labels = ax.getAxisLabels("x", "y");
  assert.ok(labels instanceof VGroup);
  assert.equal(labels.submobjects.length, 2);
});

test("addCoordinates adds number mobjects to both axes", () => {
  const ax = new Axes({ xRange: [-2, 2, 1], yRange: [-2, 2, 1] });
  ax.addCoordinates();
  assert.ok(ax.getXAxis().numbers.submobjects.length > 0);
  assert.ok(ax.getYAxis().numbers.submobjects.length > 0);
});

test("plotParametricCurve of a circle has finite points", () => {
  const ax = new Axes({ xRange: [-2, 2, 1], yRange: [-2, 2, 1] });
  const curve = ax.plotParametricCurve(
    (t) => [Math.cos(t), Math.sin(t)],
    { tRange: [0, 2 * Math.PI, 0.1] }
  );
  assert.ok(curve.points.length > 0);
  for (const p of curve.points) {
    assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }
});

test("PolarPlane builds concentric circles", () => {
  const pp = new PolarPlane({ size: 6, radiusMax: 3, radiusStep: 1 });
  assert.equal(pp.circles.submobjects.length, 3);
  for (const c of pp.circles.submobjects) assert.ok(c instanceof Circle);
  // c2p places r along the +x axis at azimuth 0.
  const p = pp.c2p(3, 0);
  assert.ok(p[0] > 0 && Math.abs(p[1]) < 1e-9);
});

test("LogBase functionOf(100) is 2 with base 10", () => {
  const lb = new LogBase(10);
  assert.ok(Math.abs(lb.functionOf(100) - 2) < 1e-9);
  assert.ok(Math.abs(lb.inverseFunctionOf(2) - 100) < 1e-6);
  const linear = new LinearBase();
  assert.equal(linear.functionOf(5), 5);
});

test("ComplexPlane n2p maps 1+1i up-right", () => {
  const cp = new ComplexPlane({ xRange: [-2, 2, 1], yRange: [-2, 2, 1] });
  const origin = cp.getOrigin();
  const p = cp.n2p({ re: 1, im: 1 });
  assert.ok(p[0] > origin[0], "real part moves right");
  assert.ok(p[1] > origin[1], "imaginary part moves up");
  const back = cp.p2n(p);
  assert.ok(Math.abs(back.re - 1) < 1e-6 && Math.abs(back.im - 1) < 1e-6);
});

test("NumberPlane with LogBase scaling maps 100 correctly", () => {
  const ax = new NumberPlane({
    xRange: [0, 4, 1],
    yAxisConfig: { scaling: new LogBase(10) },
    yRange: [1, 1000, 1],
  });
  // y=1000 => log10=3 is at the top; y=1 => log10=0 at the bottom.
  const pTop = ax.c2p(0, 1000);
  const pBot = ax.c2p(0, 1);
  assert.ok(pTop[1] > pBot[1]);
});
