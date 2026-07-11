// Tests for Legend and ColorBar (src/mobject/legend.ts) — Campaign 6 (ECharts)
// Phase 2 gap-fill. Legend is the categorical color-swatch + label list used
// across many chart ports; ColorBar is the gradient swatch + tick-label
// widget behind ECharts' `visualMap` (examples/echarts-parity/ref/04-scatter-visualmap.js).

import { test } from "node:test";
import assert from "node:assert/strict";

import { Legend, ColorBar } from "../src/mobject/legend.ts";
import { Color } from "../src/core/color.ts";

test("Legend: constructs one swatch + one label per item", () => {
  const legend = new Legend([
    { label: "Beijing", color: "#dd4444" },
    { label: "Shanghai", color: "#fec42c" },
    { label: "Guangzhou", color: "#80F1BE" },
  ]);
  assert.equal(legend.swatches.length, 3);
  assert.equal(legend.labels.length, 3);
});

test("Legend: vertical orientation spreads swatches along y, not x", () => {
  const legend = new Legend(
    [
      { label: "A", color: "#ff0000" },
      { label: "B", color: "#00ff00" },
      { label: "C", color: "#0000ff" },
    ],
    { orientation: "vertical" },
  );
  const xs = legend.swatches.map((s) => s.getCenter()[0]);
  const ys = legend.swatches.map((s) => s.getCenter()[1]);
  // All swatch x-centers equal (single column)...
  assert.ok(xs.every((x) => Math.abs(x - xs[0]) < 1e-9));
  // ...but y-centers differ (stacked rows).
  const uniqueYs = new Set(ys.map((y) => Math.round(y * 1e6)));
  assert.equal(uniqueYs.size, 3);
});

test("Legend: horizontal orientation spreads swatches along x, not y", () => {
  const legend = new Legend(
    [
      { label: "A", color: "#ff0000" },
      { label: "B", color: "#00ff00" },
      { label: "C", color: "#0000ff" },
    ],
    { orientation: "horizontal" },
  );
  const xs = legend.swatches.map((s) => s.getCenter()[0]);
  const ys = legend.swatches.map((s) => s.getCenter()[1]);
  const uniqueXs = new Set(xs.map((x) => Math.round(x * 1e6)));
  assert.equal(uniqueXs.size, 3);
  assert.ok(ys.every((y) => Math.abs(y - ys[0]) < 1e-9));
});

test("Legend: setItems() preserves swatch identity when item count is unchanged", () => {
  const legend = new Legend([
    { label: "A", color: "#ff0000" },
    { label: "B", color: "#00ff00" },
  ]);
  const [swatch0, swatch1] = legend.swatches;
  legend.setItems([
    { label: "A2", color: "#0000ff" },
    { label: "B2", color: "#ffff00" },
  ]);
  assert.equal(legend.swatches.length, 2);
  // Same object references, not replacements.
  assert.equal(legend.swatches[0], swatch0);
  assert.equal(legend.swatches[1], swatch1);
  // But the geometry/color actually updated.
  assert.equal(legend.swatches[0].fillColor.toHex(), Color.parse("#0000ff").toHex());
  assert.equal(legend.swatches[1].fillColor.toHex(), Color.parse("#ffff00").toHex());
  // Labels reflect the new text.
  assert.equal(legend.items[0].label, "A2");
  assert.equal(legend.items[1].label, "B2");
});

test("Legend: setItems() rebuilds arrays when item count changes", () => {
  const legend = new Legend([{ label: "A", color: "#ff0000" }]);
  legend.setItems([
    { label: "A", color: "#ff0000" },
    { label: "B", color: "#00ff00" },
    { label: "C", color: "#0000ff" },
  ]);
  assert.equal(legend.swatches.length, 3);
  assert.equal(legend.labels.length, 3);
});

test("ColorBar: constructs the expected number of tick labels (default tickCount)", () => {
  const bar = new ColorBar();
  assert.equal(bar.ticks.length, 5);
});

test("ColorBar: constructs a custom tickCount of tick labels", () => {
  const bar = new ColorBar({ tickCount: 7 });
  assert.equal(bar.ticks.length, 7);
});

test("ColorBar: setDomain() updates the displayed tick text", () => {
  const bar = new ColorBar({ domain: [0, 100], tickCount: 3 });
  const before = bar.ticks.map((t) => t.text);
  assert.deepEqual(before, ["0", "50", "100"]);
  bar.setDomain([0, 200]);
  const after = bar.ticks.map((t) => t.text);
  assert.deepEqual(after, ["0", "100", "200"]);
  assert.notDeepEqual(before, after);
});

test("ColorBar: default domain [0,1] with tickFormat renders fractional ticks", () => {
  const bar = new ColorBar({ tickCount: 3, tickFormat: (v) => v.toFixed(2) });
  assert.deepEqual(bar.ticks.map((t) => t.text), ["0.00", "0.50", "1.00"]);
});

test("ColorBar: gradient fill samples the interpolator (spot-check endpoints)", () => {
  const interpolator = (t: number) => Color.fromHsv(t, 1, 1).toHex();
  const bar = new ColorBar({ interpolator });
  const stops = bar.bar.gradientColors!;
  assert.ok(stops.length > 2, "expects many sampled stops, not just 2");
  const start = Color.parse(interpolator(0)).toHex();
  const end = Color.parse(interpolator(1)).toHex();
  const stopHexes = stops.map((c) => c.toHex());
  assert.equal(stopHexes[0], start);
  assert.equal(stopHexes[stopHexes.length - 1], end);
});

test("ColorBar: orientation controls sheenDirection so the ramp runs along the bar's long axis", () => {
  const vertical = new ColorBar({ orientation: "vertical" });
  const horizontal = new ColorBar({ orientation: "horizontal" });
  assert.deepEqual(vertical.bar.sheenDirection, [0, 1, 0]);
  assert.deepEqual(horizontal.bar.sheenDirection, [1, 0, 0]);
});

test("ColorBar: optional label produces a Text child", () => {
  const bar = new ColorBar({ label: "PM2.5" });
  assert.ok(bar.label);
  assert.equal(bar.label!.text, "PM2.5");
});
