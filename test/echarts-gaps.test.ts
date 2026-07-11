// Phase-2 gap-fill for Campaign 6 (ECharts): the small shared-file additions
// that don't warrant their own mobject (unlike Radar/Gauge/Funnel/Candlestick,
// each covered by their own test file). Covers scaleThreshold, the visualMap
// bundling helper, movingAverage, plotLineGraph's smooth option, and
// PieChart's roseType extension.

import { test } from "node:test";
import assert from "node:assert/strict";

import { scaleThreshold, visualMapContinuous } from "../src/core/scales.ts";
import { movingAverage } from "../src/core/array_utils.ts";
import { Axes } from "../src/mobject/coordinate_systems.ts";
import { PieChart } from "../src/mobject/charts.ts";
import { Color } from "../src/core/color.ts";
import { TAU } from "../src/core/math/vector.ts";

test("scaleThreshold maps to the correct bucket at and around cut points", () => {
  const s = scaleThreshold<string>([0, 100], ["low", "mid", "high"]);
  assert.equal(s(-5), "low");
  assert.equal(s(0), "mid"); // >= cutpoint goes to the next bucket
  assert.equal(s(50), "mid");
  assert.equal(s(100), "high");
  assert.equal(s(1000), "high");
});

test("scaleThreshold.invertExtent returns the bucket's [lo, hi) bounds", () => {
  const s = scaleThreshold<string>([0, 100], ["low", "mid", "high"]);
  assert.deepEqual(s.invertExtent("mid"), [0, 100]);
  assert.deepEqual(s.invertExtent("low"), [undefined, 0]);
  assert.deepEqual(s.invertExtent("high"), [100, undefined]);
});

test("visualMapContinuous: symbolSize is linear over the domain and clamps out-of-range", () => {
  const vm = visualMapContinuous({
    domain: [0, 100],
    inRange: { symbolSize: [10, 70] },
  });
  assert.equal(vm.size(0), 10);
  assert.equal(vm.size(100), 70);
  assert.equal(vm.size(50), 40);
  // out of range with no outOfRange config: still returns a mapped (clamped) value
  assert.equal(vm.size(-50), 10);
  assert.equal(vm.size(500), 70);
});

test("visualMapContinuous: outOfRange overrides clamp behavior when provided", () => {
  const vm = visualMapContinuous({
    domain: [0, 100],
    inRange: { symbolSize: [10, 70], color: ["#000000", "#ffffff"] },
    outOfRange: { symbolSize: 2, color: "#ff0000" },
  });
  assert.equal(vm.size(-1), 2);
  assert.equal(vm.size(101), 2);
  assert.equal(Color.parse(vm.color(-1)!).toHex(), Color.parse("#ff0000").toHex());
});

test("visualMapContinuous: colorLightness interpolates a single base color", () => {
  const vm = visualMapContinuous({
    domain: [0, 1],
    inRange: { colorLightness: { base: "#3388ff", range: [0.9, 0.3] } },
  });
  const c0 = vm.color(0)!;
  const c1 = vm.color(1)!;
  assert.notEqual(Color.parse(c0).toHex(), Color.parse(c1).toHex());
});

test("visualMapContinuous: fixed color-pair interpolator lerps RGB", () => {
  const vm = visualMapContinuous({
    domain: [0, 10],
    inRange: { color: ["#000000", "#ffffff"] },
  });
  const mid = Color.parse(vm.color(5)!);
  assert.ok(mid.r > 0.3 && mid.r < 0.7, `expected mid-gray, got r=${mid.r}`);
});

test("movingAverage: NaN before the window fills, correct mean after", () => {
  const values = [1, 2, 3, 4, 5, 6];
  const ma = movingAverage(values, 3);
  assert.ok(Number.isNaN(ma[0]));
  assert.ok(Number.isNaN(ma[1]));
  assert.equal(ma[2], 2); // (1+2+3)/3
  assert.equal(ma[3], 3); // (2+3+4)/3
  assert.equal(ma[5], 5); // (4+5+6)/3
});

test("movingAverage: output length always matches input length", () => {
  assert.equal(movingAverage([1, 2, 3], 5).length, 3);
  assert.equal(movingAverage([], 3).length, 0);
});

test("plotLineGraph smooth:true produces a curved (non-corner) VMobject", () => {
  const axes = new Axes({ xRange: [0, 10, 1], yRange: [0, 10, 1] });
  const xs = [0, 1, 2, 3, 4];
  const ys = [0, 5, 0, 5, 0];
  const straight = axes.plotLineGraph(xs, ys, { addVertexDots: false });
  const smooth = axes.plotLineGraph(xs, ys, { addVertexDots: false, smooth: true });
  const straightLine = straight.submobjects[0] as any;
  const smoothLine = smooth.submobjects[0] as any;
  assert.equal(straightLine._straightPath, true);
  assert.equal(smoothLine._straightPath, false);
});

test("PieChart roseType 'radius': equal angle per slice, radius linear in value", () => {
  const chart = new PieChart([10, 30, 60], { roseType: "radius", radius: 3 });
  assert.equal(chart.slices.length, 3);
  // Equal angle per slice: TAU/3 each (verify via AnnularSector.angle).
  for (const slice of chart.slices as any[]) {
    assert.ok(Math.abs(Math.abs(slice.angle) - TAU / 3) < 1e-9, `expected equal ${TAU / 3} angle, got ${slice.angle}`);
  }
  // Radius linear in value: largest value (60) slice should have the largest outerRadius.
  const radii = (chart.slices as any[]).map((s) => s.outerRadius);
  assert.ok(radii[2] > radii[1] && radii[1] > radii[0], `expected increasing radii, got ${radii}`);
  assert.ok(Math.abs(radii[2] - 3) < 1e-9, "max value should reach the configured outer radius");
});

test("PieChart roseType 'area': radius grows sub-linearly (sqrt) vs 'radius' mode", () => {
  const values = [10, 40];
  const byRadius = new PieChart(values, { roseType: "radius", radius: 4 });
  const byArea = new PieChart(values, { roseType: "area", radius: 4 });
  const rRadius = (byRadius.slices as any[]).map((s) => s.outerRadius);
  const rArea = (byArea.slices as any[]).map((s) => s.outerRadius);
  // area mode: radius ratio should be sqrt(value ratio) = sqrt(4) = 2, not 4.
  const ratioRadius = rRadius[1] / rRadius[0];
  const ratioArea = rArea[1] / rArea[0];
  assert.ok(Math.abs(ratioRadius - 4) < 1e-6, `radius mode ratio should be 4, got ${ratioRadius}`);
  assert.ok(Math.abs(ratioArea - 2) < 1e-6, `area mode ratio should be 2 (sqrt of 4), got ${ratioArea}`);
});

test("PieChart without roseType is unchanged (classic angle-proportional pie)", () => {
  const chart = new PieChart([25, 75]);
  const angles = (chart.slices as any[]).map((s) => Math.abs(s.angle));
  assert.ok(Math.abs(angles[0] - TAU * 0.25) < 1e-9);
  assert.ok(Math.abs(angles[1] - TAU * 0.75) < 1e-9);
  const radii = (chart.slices as any[]).map((s) => s.outerRadius);
  assert.equal(radii[0], radii[1]); // shared radius, not value-driven
});

test("PieChart.setValues preserves slice identity under roseType and updates radius", () => {
  const chart = new PieChart([10, 20], { roseType: "radius", radius: 3 });
  const slice0 = chart.slices[0];
  chart.setValues([50, 20]);
  assert.equal(chart.slices[0], slice0, "slice identity preserved");
  assert.ok((slice0 as any).outerRadius > 1, "radius updated for the new larger value");
});
