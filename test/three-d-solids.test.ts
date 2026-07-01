import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Dot3D,
  Line3D,
  Arrow3D,
  Cylinder,
  Cone,
  Prism,
  Cube,
  Surface,
} from "../src/mobject/surface.ts";
import * as V from "../src/core/math/vector.ts";

test("Dot3D is a small sphere centered at its point", () => {
  const d = new Dot3D({ point: [1, 1, 1], radius: 0.08 });
  const c = d.getCenter();
  assert.ok(V.equals(c, [1, 1, 1], 1e-6), "centered at [1,1,1]");
  // Small: diameter ~ 2*radius.
  assert.ok(d.getWidth() < 0.3 && d.getWidth() > 0.1, "small radius");
});

test("Line3D from origin to [0,0,2] ends at [0,0,2] and is oriented along z", () => {
  const l = new Line3D([0, 0, 0], [0, 0, 2]);
  assert.ok(V.equals(l.getEnd(), [0, 0, 2], 1e-6), "getEnd at [0,0,2]");
  assert.ok(V.equals(l.getStart(), [0, 0, 0], 1e-6), "getStart at origin");
  // Axis aligned with z: negligible x/y extent, ~2 in z.
  const bb = l.getBoundingBox();
  assert.ok(Math.abs((bb.max[2] - bb.min[2]) - 2) < 1e-6, "spans 2 in z");
  assert.ok(Math.abs(l.axisDirection[2]) > 0.99, "axis along z");
});

test("Line3D statics produce parallel and perpendicular lines", () => {
  const base = new Line3D([0, 0, 0], [1, 0, 0]);
  const par = Line3D.parallelTo(base, [0, 0, 0], 4);
  const parDir = V.normalize(V.sub(par.getEnd(), par.getStart()));
  assert.ok(Math.abs(Math.abs(parDir[0]) - 1) < 1e-6, "parallel is along x");
  const perp = Line3D.perpendicularTo(base, [0, 0, 0], 4);
  const perpDir = V.normalize(V.sub(perp.getEnd(), perp.getStart()));
  assert.ok(Math.abs(V.dot(perpDir, [1, 0, 0])) < 1e-6, "perpendicular is orthogonal to x");
});

test("Arrow3D has a Cone tip submobject reaching the end", () => {
  const a = new Arrow3D([0, 0, 0], [0, 0, 2]);
  assert.equal(a.submobjects.length, 2, "shaft + tip");
  assert.ok(a.tip instanceof Cone, "tip is a Cone");
  // The cone apex reaches the arrow end.
  assert.ok(V.equals(a.tip.getStart(), [0, 0, 2], 1e-6), "cone apex at end");
  assert.ok(V.equals(a.getEnd(), [0, 0, 2], 1e-6), "arrow end");
});

test("Cylinder showEnds adds cap submobjects and axis-aligned start/end", () => {
  const bare = new Cylinder({ radius: 1, height: 3, showEnds: false });
  const capped = new Cylinder({ radius: 1, height: 3, showEnds: true });
  assert.equal(capped.submobjects.length, bare.submobjects.length + 2, "two caps added");
  // Start/end are the centers of the two ends, along the axis.
  assert.ok(V.equals(capped.getStart(), [0, 0, 1.5], 1e-6), "top center");
  assert.ok(V.equals(capped.getEnd(), [0, 0, -1.5], 1e-6), "bottom center");
});

test("Cone showBase adds a base cap", () => {
  const bare = new Cone({ baseRadius: 1, height: 2, showBase: false });
  const based = new Cone({ baseRadius: 1, height: 2, showBase: true });
  assert.equal(based.submobjects.length, bare.submobjects.length + 1, "one base cap added");
});

test("Prism has the requested [w,h,d] bounding box", () => {
  const p = new Prism({ dimensions: [2, 1, 1] });
  const bb = p.getBoundingBox();
  assert.ok(Math.abs((bb.max[0] - bb.min[0]) - 2) < 1e-9, "width 2");
  assert.ok(Math.abs((bb.max[1] - bb.min[1]) - 1) < 1e-9, "height 1");
  assert.ok(Math.abs((bb.max[2] - bb.min[2]) - 1) < 1e-9, "depth 1");
  // Cube still works.
  assert.equal(new Cube({ sideLength: 2 }).submobjects.length, 6);
});

test("Surface.setFillByValue recolors faces by coordinate", () => {
  const s = new Surface((u, v) => [u, v, 0], {
    uRange: [0, 4],
    vRange: [0, 1],
    resolution: [4, 1],
    shade: false,
  });
  const before = (s.submobjects as any[]).map((f) => f.fillColor.r);
  s.setFillByValue({ colorscale: [["#000000", 0], ["#ff0000", 4]], axis: 0 });
  const after = (s.submobjects as any[]).map((f) => f.fillColor.r);
  assert.notDeepEqual(after, before, "colors changed");
  // Faces at larger x should be redder (larger r).
  assert.ok(after[after.length - 1] > after[0], "gradient increases with x");
});
