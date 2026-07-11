// Candlestick (src/mobject/candlestick.ts): candle body/wick geometry per
// OHLC point, up/down coloring, wick span, setPoints identity preservation,
// and the addMovingAverageLine overlay.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Candlestick } from "../src/mobject/candlestick.ts";
import type { CandlestickPoint } from "../src/mobject/candlestick.ts";
import { VGroup } from "../src/mobject/VMobject.ts";
import { Line, Rectangle } from "../src/mobject/geometry.ts";

const POINTS: CandlestickPoint[] = [
  { label: "d0", open: 10, close: 12, low: 9, high: 13 }, // bullish (close > open)
  { label: "d1", open: 15, close: 11, low: 10, high: 16 }, // bearish (close < open)
  { label: "d2", open: 8, close: 8, low: 7, high: 9 }, // flat (close == open) -> up by convention
];

test("constructs N candle bodies + N wicks for N input points", () => {
  const chart = new Candlestick(POINTS);
  assert.equal(chart.candles.length, POINTS.length);
  assert.equal(chart.wicks.length, POINTS.length);
  for (const body of chart.candles) assert.ok(body instanceof Rectangle);
  for (const wick of chart.wicks) assert.ok(wick instanceof Line);
});

test("bullish candle gets upColor, bearish candle gets downColor", () => {
  const chart = new Candlestick(POINTS, { upColor: "#00ff00", downColor: "#ff0000" });
  const bullish = chart.candles[0];
  const bearish = chart.candles[1];
  assert.equal(bullish.fillColor.toHex().toLowerCase(), "#00ff00");
  assert.equal(bearish.fillColor.toHex().toLowerCase(), "#ff0000");
});

test("wick spans from low to high (matches coordsToPoint within epsilon)", () => {
  const chart = new Candlestick(POINTS);
  for (let i = 0; i < POINTS.length; i++) {
    const p = POINTS[i];
    const xCenter = i + 0.5;
    const expectedLow = chart.coordsToPoint(xCenter, p.low);
    const expectedHigh = chart.coordsToPoint(xCenter, p.high);
    const wick = chart.wicks[i];
    const start = wick.getStart();
    const end = wick.getEnd();
    // Wick endpoints should match {low, high} as an unordered pair (Line's
    // start/end order corresponds to construction order: low -> high here).
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(start[axis] - expectedLow[axis]) < 1e-9, `start[${axis}]`);
      assert.ok(Math.abs(end[axis] - expectedHigh[axis]) < 1e-9, `end[${axis}]`);
    }
  }
});

test("setPoints() preserves candle/wick identity when count is unchanged", () => {
  const chart = new Candlestick(POINTS);
  const bodiesBefore = [...chart.candles];
  const wicksBefore = [...chart.wicks];

  const updated: CandlestickPoint[] = POINTS.map((p) => ({ ...p, close: p.close + 1, high: p.high + 1 }));
  chart.setPoints(updated);

  assert.equal(chart.candles.length, bodiesBefore.length);
  assert.equal(chart.wicks.length, wicksBefore.length);
  for (let i = 0; i < bodiesBefore.length; i++) {
    assert.equal(chart.candles[i], bodiesBefore[i], `candle ${i} identity preserved`);
    assert.equal(chart.wicks[i], wicksBefore[i], `wick ${i} identity preserved`);
  }

  // Geometry actually changed to reflect the new high.
  const xCenter = 0.5;
  const expectedHigh = chart.coordsToPoint(xCenter, updated[0].high);
  const end = chart.wicks[0].getEnd();
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(end[axis] - expectedHigh[axis]) < 1e-9);
  }
});

test("setPoints() replaces the candle/wick lists when point count changes", () => {
  const chart = new Candlestick(POINTS);
  const fewer = POINTS.slice(0, 1);
  chart.setPoints(fewer);
  assert.equal(chart.candles.length, 1);
  assert.equal(chart.wicks.length, 1);
});

test("addMovingAverageLine() returns a VGroup and becomes a submobject of the chart", () => {
  const chart = new Candlestick(POINTS);
  const ma = chart.addMovingAverageLine([10, 11, 12]);
  assert.ok(ma instanceof VGroup);
  assert.ok(chart.submobjects.includes(ma), "moving-average group added to chart");
});

test("addMovingAverageLine() skips non-finite placeholder values ('-' style gaps)", () => {
  const chart = new Candlestick(POINTS);
  const ma = chart.addMovingAverageLine([NaN, 11, 12] as any);
  assert.ok(ma instanceof VGroup);
  // Only 2 finite values -> 2 vertex points on the underlying line.
  assert.equal((ma as any).lineGraphPoints.length, 2);
});
