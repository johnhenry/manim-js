import { test } from "node:test";
import assert from "node:assert/strict";

import { BarChart, SampleSpace } from "../src/mobject/probability.ts";
import { ArrowVectorField, StreamLines } from "../src/mobject/vector_field.ts";
import * as V from "../src/core/math/vector.ts";

test("BarChart builds one bar per value with heights proportional to values", () => {
  const chart = new BarChart([1, 2, 3]);
  const bars = chart.getBars();
  assert.equal(bars.submobjects.length, 3, "three bars");

  const h1 = bars.submobjects[0].getHeight();
  const h3 = bars.submobjects[2].getHeight();
  assert.ok(h3 > h1, "bar for value 3 taller than bar for value 1");
  // Proportionality: value 3 bar ~3x the value 1 bar.
  assert.ok(Math.abs(h3 / h1 - 3) < 0.2, "heights roughly proportional (3:1)");
});

test("BarChart.changeBarValues updates heights", () => {
  const chart = new BarChart([1, 2, 3]);
  const before = chart.getBars().submobjects[0].getHeight();
  chart.changeBarValues([5, 5, 5]);
  const bars = chart.getBars();
  assert.equal(bars.submobjects.length, 3, "still three bars after change");
  const after = bars.submobjects[0].getHeight();
  assert.ok(after > before, "first bar taller after raising its value");
});

test("SampleSpace.divideHorizontally yields proportioned sub-rects", () => {
  const space = new SampleSpace({ width: 3, height: 3 });
  const parts = space.divideHorizontally([0.3, 0.7]);
  assert.equal(parts.submobjects.length, 2, "two sub-rects");
  const h0 = parts.submobjects[0].getHeight();
  const h1 = parts.submobjects[1].getHeight();
  // Ratio of heights should be ~3:7.
  const ratio = h0 / h1;
  assert.ok(Math.abs(ratio - 3 / 7) < 0.05, `height ratio ~3:7 (got ${ratio})`);
});

test("ArrowVectorField of rotational field: arrows perpendicular to position", () => {
  // func = (x,y) -> (-y, x): a pure rotation field.
  const field = new ArrowVectorField(([x, y]: any) => [-y, x, 0], {
    xRange: [-2, 2, 1],
    yRange: [-2, 2, 1],
  });
  const arrows = field.submobjects;
  assert.ok(arrows.length > 0, "produces at least one arrow");

  let checked = 0;
  for (const arrow of arrows) {
    const pos = (arrow as any).fieldPoint as number[];
    const vec = (arrow as any).fieldVector as number[];
    if (V.length(pos) < 1e-9 || V.length(vec) < 1e-9) continue;
    const d = V.dot(pos, vec);
    // dot(pos, [-y,x]) = -xy + yx = 0 exactly.
    assert.ok(Math.abs(d) < 1e-6, `vector perpendicular to position (dot=${d})`);
    checked++;
  }
  assert.ok(checked > 0, "checked at least one non-origin arrow");
});

test("ArrowVectorField colors vectors by magnitude (multiple distinct colors)", () => {
  const field = new ArrowVectorField(([x, y]: any) => [-y, x, 0], {
    xRange: [-2, 2, 1],
    yRange: [-2, 2, 1],
  });
  const colors = new Set<string>();
  for (const arrow of field.submobjects) {
    colors.add((arrow as any).strokeColor.toHex());
  }
  assert.ok(colors.size > 1, `more than one distinct color (got ${colors.size})`);
});

test("StreamLines builds polylines with finite points", () => {
  const lines = new StreamLines(([x, y]: any) => [-y, x, 0], {
    xRange: [-2, 2, 1],
    yRange: [-2, 2, 1],
    virtualTime: 2,
    dt: 0.1,
  });
  const built = lines.getLines();
  assert.ok(built.length > 0, "builds at least one polyline");

  const first = built[0];
  assert.ok(first.points.length >= 2, "polyline has at least two points");
  for (const p of first.points) {
    assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]), "finite point");
  }
});
