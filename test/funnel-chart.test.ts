// Tests for FunnelChart (Campaign 6 / ECharts parity gap-fill): a stack of
// tapering trapezoid stages, ported from ECharts' funnel series (see
// examples/echarts-parity/ref/07-funnel.js for the reference shape).

import { test } from "node:test";
import assert from "node:assert/strict";

import { FunnelChart } from "../src/mobject/funnel.ts";
import type { FunnelStage } from "../src/mobject/funnel.ts";
import { Polygon } from "../src/mobject/geometry.ts";

const STAGES: FunnelStage[] = [
  { name: "Visit", value: 60 },
  { name: "Inquiry", value: 40 },
  { name: "Order", value: 20 },
  { name: "Click", value: 80 },
  { name: "Show", value: 100 },
];

// Half-width of a trapezoid's TOP edge, from its 4 corners
// [topLeft, topRight, bottomRight, bottomLeft].
function topHalfWidth(stage: Polygon): number {
  const [topLeft, topRight] = stage.vertices;
  return (topRight[0] - topLeft[0]) / 2;
}

function bottomHalfWidth(stage: Polygon): number {
  const [, , bottomRight, bottomLeft] = stage.vertices;
  return (bottomRight[0] - bottomLeft[0]) / 2;
}

test("constructs N trapezoid stages for N input stages", () => {
  const chart = new FunnelChart(STAGES);
  assert.equal(chart.stages.length, STAGES.length);
  for (const stage of chart.stages) {
    assert.ok(stage instanceof Polygon);
    assert.equal(stage.vertices.length, 4);
  }
});

test("sorts descending by value by default", () => {
  const chart = new FunnelChart(STAGES);
  // Highest input value (100, "Show") should map to the largest top half-width,
  // and it should be the first rendered stage.
  assert.equal(chart.stagesData[0].name, "Show");
  const widths = chart.stages.map(topHalfWidth);
  const maxWidth = Math.max(...widths);
  assert.equal(widths[0], maxWidth);
  // Widths should be non-increasing down the funnel (values sorted descending).
  for (let i = 1; i < widths.length; i++) {
    assert.ok(widths[i] <= widths[i - 1] + 1e-9, `stage ${i} width ${widths[i]} > previous ${widths[i - 1]}`);
  }
});

test("sort: 'none' preserves input order", () => {
  const chart = new FunnelChart(STAGES, { sort: "none" });
  assert.deepEqual(
    chart.stagesData.map((s) => s.name),
    STAGES.map((s) => s.name),
  );
});

test("sort: 'ascending' orders lowest value first", () => {
  const chart = new FunnelChart(STAGES, { sort: "ascending" });
  assert.equal(chart.stagesData[0].name, "Order"); // value 20, the minimum
  assert.equal(chart.stagesData[chart.stagesData.length - 1].name, "Show"); // value 100, the maximum
});

test("each stage's top half-width is >= its bottom half-width for descending values (tapering direction)", () => {
  const chart = new FunnelChart(STAGES); // descending by default
  for (const stage of chart.stages) {
    assert.ok(
      topHalfWidth(stage) >= bottomHalfWidth(stage) - 1e-9,
      "trapezoid should taper inward (or stay level) going down the funnel",
    );
  }
});

test("setStages() preserves Polygon identity when stage count is unchanged, and updates geometry", () => {
  const chart = new FunnelChart(STAGES);
  const originalPolygons = [...chart.stages];
  const originalWidths = chart.stages.map(topHalfWidth);

  const doubled = STAGES.map((s) => ({ ...s, value: s.value * 2 }));
  chart.setStages(doubled);

  assert.equal(chart.stages.length, originalPolygons.length);
  chart.stages.forEach((stage, i) => {
    assert.equal(stage, originalPolygons[i], `stage ${i} identity should be preserved`);
  });
  // Geometry actually changed (values doubled -> same relative shape, but the
  // scale's max value changed too since it's still relative to max(values);
  // sanity check that widths were rewritten, not left stale/undefined).
  const newWidths = chart.stages.map(topHalfWidth);
  assert.equal(newWidths.length, originalWidths.length);
  for (const w of newWidths) assert.ok(Number.isFinite(w));
});

test("setStages() rebuilds the stage list when count changes", () => {
  const chart = new FunnelChart(STAGES);
  const fewer: FunnelStage[] = [
    { name: "A", value: 10 },
    { name: "B", value: 5 },
  ];
  chart.setStages(fewer);
  assert.equal(chart.stages.length, 2);
  assert.equal(chart.stagesData[0].name, "A");
});

test("labels array length matches stage count when showLabels is true (default)", () => {
  const chart = new FunnelChart(STAGES);
  assert.equal(chart.labels.length, STAGES.length);
});

test("labels array is empty when showLabels is false", () => {
  const chart = new FunnelChart(STAGES, { showLabels: false });
  assert.equal(chart.labels.length, 0);
});

test("minSizeRatio / maxSizeRatio scale half-widths relative to configured width", () => {
  const width = 10;
  const chart = new FunnelChart(STAGES, { width, minSizeRatio: 0, maxSizeRatio: 1 });
  const widths = chart.stages.map(topHalfWidth);
  const maxWidth = Math.max(...widths);
  // The largest stage (value === max) should hit maxSizeRatio * width / 2.
  assert.ok(Math.abs(maxWidth - width / 2) < 1e-9);
});
