// PieChart (src/mobject/charts.ts): slice geometry proportionality, donut
// mode, gap handling, labels, and setValues identity preservation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PieChart } from "../src/mobject/charts.ts";
import { Sector, AnnularSector } from "../src/mobject/arcs.ts";
import { TAU } from "../src/core/math/vector.ts";

const sliceAngles = (chart: PieChart): number[] =>
  chart.slices.map((s) => (s as AnnularSector).angle);

test("one slice per value; angles proportional and summing to TAU", () => {
  const chart = new PieChart([1, 2, 1]);
  assert.equal(chart.slices.length, 3);
  const angles = sliceAngles(chart);
  assert.ok(Math.abs(angles[0] - TAU / 4) < 1e-9);
  assert.ok(Math.abs(angles[1] - TAU / 2) < 1e-9);
  assert.ok(Math.abs(angles[2] - TAU / 4) < 1e-9);
  assert.ok(Math.abs(angles.reduce((a, b) => a + b, 0) - TAU) < 1e-9);
  // Full pie → Sector slices (innerRadius 0).
  assert.ok(chart.slices[0] instanceof Sector);
});

test("slices are laid out clockwise from startAngle", () => {
  const chart = new PieChart([1, 1], { startAngle: TAU / 4 });
  const s0 = chart.slices[0] as Sector;
  const s1 = chart.slices[1] as Sector;
  // First slice spans [startAngle - sweep, startAngle]; second continues on.
  assert.ok(Math.abs(s0.startAngle - (TAU / 4 - TAU / 2)) < 1e-9);
  assert.ok(Math.abs(s1.startAngle - (TAU / 4 - TAU)) < 1e-9);
});

test("innerRadius > 0 builds a donut of AnnularSectors with a hole", () => {
  const chart = new PieChart([3, 1], { radius: 2, innerRadius: 1 });
  for (const s of chart.slices) {
    assert.ok(s instanceof AnnularSector && !(s instanceof Sector));
    assert.equal((s as AnnularSector).innerRadius, 1);
    assert.equal((s as AnnularSector).outerRadius, 2);
  }
});

test("gapAngle trims each slice symmetrically", () => {
  const gap = 0.1;
  const chart = new PieChart([1, 1, 1, 1], { gapAngle: gap });
  for (const a of sliceAngles(chart)) {
    assert.ok(Math.abs(a - (TAU / 4 - gap)) < 1e-9);
  }
});

test("labels: percent default, explicit strings, and labelFormat", () => {
  const pct = new PieChart([1, 3], { labels: true });
  assert.deepEqual(pct.labels.map((l) => l.text), ["25%", "75%"]);
  const named = new PieChart([1, 1], { labels: ["Cats", "Dogs"] });
  assert.deepEqual(named.labels.map((l) => l.text), ["Cats", "Dogs"]);
  const custom = new PieChart([2, 6], { labelFormat: (v, i, f) => `${v} (${f * 100}%)` });
  assert.deepEqual(custom.labels.map((l) => l.text), ["2 (25%)", "6 (75%)"]);
  // Labels sit inside the outer radius.
  const chart = new PieChart([1, 1], { radius: 2, labels: true });
  for (const l of chart.labels) {
    const c = l.getCenter();
    assert.ok(Math.hypot(c[0], c[1]) < 2);
  }
});

test("setValues with the same count preserves slice identity and updates geometry", () => {
  const chart = new PieChart([1, 1], { labels: true });
  const before = [...chart.slices];
  chart.setValues([1, 3]);
  assert.equal(chart.slices[0], before[0], "slice mobjects keep their identity");
  assert.equal(chart.slices[1], before[1]);
  const angles = sliceAngles(chart);
  assert.ok(Math.abs(angles[0] - TAU / 4) < 1e-9);
  assert.ok(Math.abs(angles[1] - (3 * TAU) / 4) < 1e-9);
  assert.deepEqual(chart.labels.map((l) => l.text), ["25%", "75%"]);
});

test("setValues with a different count rebuilds the slice list", () => {
  const chart = new PieChart([1, 1]);
  chart.setValues([1, 1, 2]);
  assert.equal(chart.slices.length, 3);
  const angles = sliceAngles(chart);
  assert.ok(Math.abs(angles.reduce((a, b) => a + b, 0) - TAU) < 1e-9);
  assert.ok(Math.abs(angles[2] - TAU / 2) < 1e-9);
});

test("zero and negative values collapse to empty slices without breaking the sum", () => {
  const chart = new PieChart([0, 2, -5, 2]);
  const angles = sliceAngles(chart);
  assert.equal(angles[0], 0);
  assert.equal(angles[2], 0);
  assert.ok(Math.abs(angles[1] - TAU / 2) < 1e-9);
  assert.ok(Math.abs(angles[3] - TAU / 2) < 1e-9);
});
