// Tests for RadarChart (Campaign 6 / Phase 2 gap-fill): a polar multi-axis
// chart mobject alongside PieChart in src/mobject/charts.ts. Backs
// examples/echarts-parity/ref/05-radar.js (N-indicator radar, per-series
// filled polygons).

import { test } from "node:test";
import assert from "node:assert/strict";

import { RadarChart } from "../src/mobject/radar.ts";
import { Polygon } from "../src/mobject/geometry.ts";
import { TAU } from "../src/core/math/vector.ts";

const INDICATORS = [
  { name: "Sales", max: 100 },
  { name: "Admin", max: 200 },
  { name: "IT", max: 300 },
  { name: "Support", max: 400 },
];

test("constructs N spokes and N*rings grid ring segments for a given indicator count", () => {
  const chart = new RadarChart(
    [{ name: "A", values: [10, 20, 30, 40] }],
    { indicators: INDICATORS, rings: 5 },
  );
  // grid = rings ring-polygons + N spokes
  assert.equal(chart.grid.submobjects.length, 5 + INDICATORS.length);
});

test("each series polygon has exactly indicators.length vertices", () => {
  const chart = new RadarChart(
    [
      { name: "A", values: [10, 20, 30, 40] },
      { name: "B", values: [50, 60, 70, 80] },
    ],
    { indicators: INDICATORS },
  );
  assert.equal(chart.seriesPolygons.length, 2);
  for (const poly of chart.seriesPolygons) {
    assert.equal(poly.getVertices().length, INDICATORS.length);
  }
});

test("a value at an axis's max lands exactly `radius` away from center on that axis's angle", () => {
  const radius = 2;
  const startAngle = TAU / 4; // 12 o'clock, matches default
  const chart = new RadarChart(
    [{ name: "A", values: [100, 0, 0, 0] }], // axis 0 at its max
    { indicators: INDICATORS, radius, startAngle },
  );
  const vertex = chart.seriesPolygons[0].getVertices()[0];
  const expected = [radius * Math.cos(startAngle), radius * Math.sin(startAngle), 0];
  const EPS = 1e-9;
  assert.ok(Math.abs(vertex[0] - expected[0]) < EPS, `x: ${vertex[0]} vs ${expected[0]}`);
  assert.ok(Math.abs(vertex[1] - expected[1]) < EPS, `y: ${vertex[1]} vs ${expected[1]}`);
  const dist = Math.hypot(vertex[0], vertex[1], vertex[2]);
  assert.ok(Math.abs(dist - radius) < EPS, `distance from center: ${dist} vs ${radius}`);
});

test("setValues() preserves polygon object identity when series count is unchanged, and updates geometry", () => {
  const chart = new RadarChart(
    [{ name: "A", values: [10, 20, 30, 40] }],
    { indicators: INDICATORS, radius: 2 },
  );
  const polyBefore = chart.seriesPolygons[0];
  const before = polyBefore.getVertices()[0].slice();

  chart.setValues([{ name: "A", values: [100, 200, 300, 400] }]); // all maxed out

  assert.equal(chart.seriesPolygons[0], polyBefore, "same Polygon object reference");
  assert.equal(chart.seriesPolygons.length, 1);
  const after = chart.seriesPolygons[0].getVertices()[0];
  assert.notDeepEqual(after, before, "geometry actually changed");
  const dist = Math.hypot(after[0], after[1], after[2]);
  assert.ok(Math.abs(dist - 2) < 1e-9, "axis-0 vertex now sits at full radius (value == max)");
});

test("setValues() replaces the polygon list when series count changes", () => {
  const chart = new RadarChart(
    [{ name: "A", values: [10, 20, 30, 40] }],
    { indicators: INDICATORS },
  );
  const polyBefore = chart.seriesPolygons[0];
  chart.setValues([
    { name: "A", values: [10, 20, 30, 40] },
    { name: "B", values: [15, 25, 35, 45] },
  ]);
  assert.equal(chart.seriesPolygons.length, 2);
  assert.notEqual(chart.seriesPolygons[0], polyBefore);
});

test("constructor throws when a series' values.length doesn't match indicators.length", () => {
  assert.throws(
    () => new RadarChart([{ name: "Bad", values: [1, 2, 3] }], { indicators: INDICATORS }),
    /values\.length must match indicators\.length|4 indicator/,
  );
});

test("setValues() throws when a series' values.length doesn't match indicators.length", () => {
  const chart = new RadarChart(
    [{ name: "A", values: [10, 20, 30, 40] }],
    { indicators: INDICATORS },
  );
  assert.throws(() => chart.setValues([{ name: "Bad", values: [1, 2] }]));
});

test("showLabels: false skips axis name labels", () => {
  const chart = new RadarChart(
    [{ name: "A", values: [10, 20, 30, 40] }],
    { indicators: INDICATORS, showLabels: false },
  );
  assert.equal(chart.labels.length, 0);
});

test("showLabels defaults to true and creates one label per indicator", () => {
  const chart = new RadarChart(
    [{ name: "A", values: [10, 20, 30, 40] }],
    { indicators: INDICATORS },
  );
  assert.equal(chart.labels.length, INDICATORS.length);
});

test("circle grid shape uses Circle rings instead of Polygon rings", () => {
  const chart = new RadarChart(
    [{ name: "A", values: [10, 20, 30, 40] }],
    { indicators: INDICATORS, shape: "circle", rings: 3 },
  );
  const rings = chart.grid.submobjects.filter((m) => !(m instanceof Polygon));
  assert.ok(rings.length >= 3, "at least `rings` non-Polygon (Circle) grid members");
});
