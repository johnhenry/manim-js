// ECharts parity demo 08: ref/08-candlestick.js — "ShangHai Index" (ECharts
// gallery, Apache-2.0). OHLC candlesticks over real 2013 ShangHai Composite
// data + MA5/MA10/MA20/MA30 moving-average overlay lines. Proves the
// Candlestick mobject (Axes subclass: Rectangle bodies + Line wicks, up/down
// coloring) and `movingAverage()` (src/core/array_utils.ts) feeding
// `chart.addMovingAverageLine()`.
//
// Data: the ref's full `data0` array (88 trading days, 2013/1/24-2013/6/13)
// copied verbatim below. Moving averages are computed over the FULL series
// (matching the ref's own `calculateMA`) so MA30 has real history by the
// time the displayed window starts; the window then SLICES both the candles
// and the MA arrays to the same 50-day range (index 30..79,
// "2013/3/13".."2013/5/29") so every visible MA line is fully populated
// (no leading NaN gap in-frame) and the render isn't absurdly wide/cramped.
//
// Honest divergence: the ref's `dataZoom` (pan/zoom slider + inside scroll)
// has no ecmanim equivalent (confirmed campaign-wide gap) — skipped;
// rendering a fixed 50-day slice stands in for it. `markPoint`/`markLine`
// (highest/lowest/average annotations) and the `title`/`legend`/`tooltip`
// widgets beyond a plain title+Legend mobject are also not reproduced 1:1 —
// out of scope for this mobject's feature set.
//
// CRITICAL: this campaign's harness renders on a WHITE background and Text
// defaults to WHITE fill (see 06-gauge.ts's commit message) — every Text
// and every Axes/Candlestick color config below is explicitly dark.

import {
  Scene, Candlestick, Legend, Text, VGroup,
  movingAverage, FadeIn, LaggedStart,
} from "../../src/node.ts";
import type { CandlestickPoint } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const AXIS_COLOR = "#333333";

// Verbatim from ref/08-candlestick.js's `data0.values` (splitData output),
// re-paired with their category-date labels.
const ALL_POINTS: CandlestickPoint[] = [
  { label: "2013/1/24", open: 2320.26, close: 2320.26, low: 2287.3, high: 2362.94 },
  { label: "2013/1/25", open: 2300, close: 2291.3, low: 2288.26, high: 2308.38 },
  { label: "2013/1/28", open: 2295.35, close: 2346.5, low: 2295.35, high: 2346.92 },
  { label: "2013/1/29", open: 2347.22, close: 2358.98, low: 2337.35, high: 2363.8 },
  { label: "2013/1/30", open: 2360.75, close: 2382.48, low: 2347.89, high: 2383.76 },
  { label: "2013/1/31", open: 2383.43, close: 2385.42, low: 2371.23, high: 2391.82 },
  { label: "2013/2/1", open: 2377.41, close: 2419.02, low: 2369.57, high: 2421.15 },
  { label: "2013/2/4", open: 2425.92, close: 2428.15, low: 2417.58, high: 2440.38 },
  { label: "2013/2/5", open: 2411, close: 2433.13, low: 2403.3, high: 2437.42 },
  { label: "2013/2/6", open: 2432.68, close: 2434.48, low: 2427.7, high: 2441.73 },
  { label: "2013/2/7", open: 2430.69, close: 2418.53, low: 2394.22, high: 2433.89 },
  { label: "2013/2/8", open: 2416.62, close: 2432.4, low: 2414.4, high: 2443.03 },
  { label: "2013/2/18", open: 2441.91, close: 2421.56, low: 2415.43, high: 2444.8 },
  { label: "2013/2/19", open: 2420.26, close: 2382.91, low: 2373.53, high: 2427.07 },
  { label: "2013/2/20", open: 2383.49, close: 2397.18, low: 2370.61, high: 2397.94 },
  { label: "2013/2/21", open: 2378.82, close: 2325.95, low: 2309.17, high: 2378.82 },
  { label: "2013/2/22", open: 2322.94, close: 2314.16, low: 2308.76, high: 2330.88 },
  { label: "2013/2/25", open: 2320.62, close: 2325.82, low: 2315.01, high: 2338.78 },
  { label: "2013/2/26", open: 2313.74, close: 2293.34, low: 2289.89, high: 2340.71 },
  { label: "2013/2/27", open: 2297.77, close: 2313.22, low: 2292.03, high: 2324.63 },
  { label: "2013/2/28", open: 2322.32, close: 2365.59, low: 2308.92, high: 2366.16 },
  { label: "2013/3/1", open: 2364.54, close: 2359.51, low: 2330.86, high: 2369.65 },
  { label: "2013/3/4", open: 2332.08, close: 2273.4, low: 2259.25, high: 2333.54 },
  { label: "2013/3/5", open: 2274.81, close: 2326.31, low: 2270.1, high: 2328.14 },
  { label: "2013/3/6", open: 2333.61, close: 2347.18, low: 2321.6, high: 2351.44 },
  { label: "2013/3/7", open: 2340.44, close: 2324.29, low: 2304.27, high: 2352.02 },
  { label: "2013/3/8", open: 2326.42, close: 2318.61, low: 2314.59, high: 2333.67 },
  { label: "2013/3/11", open: 2314.68, close: 2310.59, low: 2296.58, high: 2320.96 },
  { label: "2013/3/12", open: 2309.16, close: 2286.6, low: 2264.83, high: 2333.29 },
  { label: "2013/3/13", open: 2282.17, close: 2263.97, low: 2253.25, high: 2286.33 },
  { label: "2013/3/14", open: 2255.77, close: 2270.28, low: 2253.31, high: 2276.22 },
  { label: "2013/3/15", open: 2269.31, close: 2278.4, low: 2250, high: 2312.08 },
  { label: "2013/3/18", open: 2267.29, close: 2240.02, low: 2239.21, high: 2276.05 },
  { label: "2013/3/19", open: 2244.26, close: 2257.43, low: 2232.02, high: 2261.31 },
  { label: "2013/3/20", open: 2257.74, close: 2317.37, low: 2257.42, high: 2317.86 },
  { label: "2013/3/21", open: 2318.21, close: 2324.24, low: 2311.6, high: 2330.81 },
  { label: "2013/3/22", open: 2321.4, close: 2328.28, low: 2314.97, high: 2332 },
  { label: "2013/3/25", open: 2334.74, close: 2326.72, low: 2319.91, high: 2344.89 },
  { label: "2013/3/26", open: 2318.58, close: 2297.67, low: 2281.12, high: 2319.99 },
  { label: "2013/3/27", open: 2299.38, close: 2301.26, low: 2289, high: 2323.48 },
  { label: "2013/3/28", open: 2273.55, close: 2236.3, low: 2232.91, high: 2273.55 },
  { label: "2013/3/29", open: 2238.49, close: 2236.62, low: 2228.81, high: 2246.87 },
  { label: "2013/4/1", open: 2229.46, close: 2234.4, low: 2227.31, high: 2243.95 },
  { label: "2013/4/2", open: 2234.9, close: 2227.74, low: 2220.44, high: 2253.42 },
  { label: "2013/4/3", open: 2232.69, close: 2225.29, low: 2217.25, high: 2241.34 },
  { label: "2013/4/8", open: 2196.24, close: 2211.59, low: 2180.67, high: 2212.59 },
  { label: "2013/4/9", open: 2215.47, close: 2225.77, low: 2215.47, high: 2234.73 },
  { label: "2013/4/10", open: 2224.93, close: 2226.13, low: 2212.56, high: 2233.04 },
  { label: "2013/4/11", open: 2236.98, close: 2219.55, low: 2217.26, high: 2242.48 },
  { label: "2013/4/12", open: 2218.09, close: 2206.78, low: 2204.44, high: 2226.26 },
  { label: "2013/4/15", open: 2199.91, close: 2181.94, low: 2177.39, high: 2204.99 },
  { label: "2013/4/16", open: 2169.63, close: 2194.85, low: 2165.78, high: 2196.43 },
  { label: "2013/4/17", open: 2195.03, close: 2193.8, low: 2178.47, high: 2197.51 },
  { label: "2013/4/18", open: 2181.82, close: 2197.6, low: 2175.44, high: 2206.03 },
  { label: "2013/4/19", open: 2201.12, close: 2244.64, low: 2200.58, high: 2250.11 },
  { label: "2013/4/22", open: 2236.4, close: 2242.17, low: 2232.26, high: 2245.12 },
  { label: "2013/4/23", open: 2242.62, close: 2184.54, low: 2182.81, high: 2242.62 },
  { label: "2013/4/24", open: 2187.35, close: 2218.32, low: 2184.11, high: 2226.12 },
  { label: "2013/4/25", open: 2213.19, close: 2199.31, low: 2191.85, high: 2224.63 },
  { label: "2013/4/26", open: 2203.89, close: 2177.91, low: 2173.86, high: 2210.58 },
  { label: "2013/5/2", open: 2170.78, close: 2174.12, low: 2161.14, high: 2179.65 },
  { label: "2013/5/3", open: 2179.05, close: 2205.5, low: 2179.05, high: 2222.81 },
  { label: "2013/5/6", open: 2212.5, close: 2231.17, low: 2212.5, high: 2236.07 },
  { label: "2013/5/7", open: 2227.86, close: 2235.57, low: 2219.44, high: 2240.26 },
  { label: "2013/5/8", open: 2242.39, close: 2246.3, low: 2235.42, high: 2255.21 },
  { label: "2013/5/9", open: 2246.96, close: 2232.97, low: 2221.38, high: 2247.86 },
  { label: "2013/5/10", open: 2228.82, close: 2246.83, low: 2225.81, high: 2247.67 },
  { label: "2013/5/13", open: 2247.68, close: 2241.92, low: 2231.36, high: 2250.85 },
  { label: "2013/5/14", open: 2238.9, close: 2217.01, low: 2205.87, high: 2239.93 },
  { label: "2013/5/15", open: 2217.09, close: 2224.8, low: 2213.58, high: 2225.19 },
  { label: "2013/5/16", open: 2221.34, close: 2251.81, low: 2210.77, high: 2252.87 },
  { label: "2013/5/17", open: 2249.81, close: 2282.87, low: 2248.41, high: 2288.09 },
  { label: "2013/5/20", open: 2286.33, close: 2299.99, low: 2281.9, high: 2309.39 },
  { label: "2013/5/21", open: 2297.11, close: 2305.11, low: 2290.12, high: 2305.3 },
  { label: "2013/5/22", open: 2303.75, close: 2302.4, low: 2292.43, high: 2314.18 },
  { label: "2013/5/23", open: 2293.81, close: 2275.67, low: 2274.1, high: 2304.95 },
  { label: "2013/5/24", open: 2281.45, close: 2288.53, low: 2270.25, high: 2292.59 },
  { label: "2013/5/27", open: 2286.66, close: 2293.08, low: 2283.94, high: 2301.7 },
  { label: "2013/5/28", open: 2293.4, close: 2321.32, low: 2281.47, high: 2322.1 },
  { label: "2013/5/29", open: 2323.54, close: 2324.02, low: 2321.17, high: 2334.33 },
  { label: "2013/5/30", open: 2316.25, close: 2317.75, low: 2310.49, high: 2325.72 },
  { label: "2013/5/31", open: 2320.74, close: 2300.59, low: 2299.37, high: 2325.53 },
  { label: "2013/6/3", open: 2300.21, close: 2299.25, low: 2294.11, high: 2313.43 },
  { label: "2013/6/4", open: 2297.1, close: 2272.42, low: 2264.76, high: 2297.1 },
  { label: "2013/6/5", open: 2270.71, close: 2270.93, low: 2260.87, high: 2276.86 },
  { label: "2013/6/6", open: 2264.43, close: 2242.11, low: 2240.07, high: 2266.69 },
  { label: "2013/6/7", open: 2242.26, close: 2210.9, low: 2205.07, high: 2250.63 },
  { label: "2013/6/13", open: 2190.1, close: 2148.35, low: 2126.22, high: 2190.1 },
];

// Compute MA5/10/20/30 over the FULL series (matches the ref's calculateMA
// running over the whole data0), then slice everything to the same 50-day
// display window so the visible MAs are fully populated.
const closes = ALL_POINTS.map((p) => p.close);
const ma5Full = movingAverage(closes, 5);
const ma10Full = movingAverage(closes, 10);
const ma20Full = movingAverage(closes, 20);
const ma30Full = movingAverage(closes, 30);

const WINDOW_START = 30; // "2013/3/13"
const WINDOW_END = 80; // exclusive -> "2013/5/29" (index 79) inclusive, 50 days
const points = ALL_POINTS.slice(WINDOW_START, WINDOW_END);
const ma5 = ma5Full.slice(WINDOW_START, WINDOW_END);
const ma10 = ma10Full.slice(WINDOW_START, WINDOW_END);
const ma20 = ma20Full.slice(WINDOW_START, WINDOW_END);
const ma30 = ma30Full.slice(WINDOW_START, WINDOW_END);

// A handful of evenly-spaced date labels stand in for the x category axis
// (Candlestick's Axes-inherited numeric ticks would show 0..49, not dates).
const DATE_TICK_STEP = 10;

class CandlestickShanghai extends Scene {
  async construct() {
    const chart = new Candlestick(points, {
      color: AXIS_COLOR,
      xLength: 11.5,
      yLength: 4.6,
      upColor: "#ec0000",
      downColor: "#00da3c",
      xAxisConfig: { color: AXIS_COLOR, includeNumbers: false },
      yAxisConfig: { color: AXIS_COLOR, includeNumbers: false },
    });
    chart.shift([0, -0.6, 0]);

    // MA overlay lines (distinct colors; the ref leaves these to ECharts'
    // default series palette, which we approximate with a 4-color set).
    chart.addMovingAverageLine(ma5, { color: "#5470c6", smooth: true });
    chart.addMovingAverageLine(ma10, { color: "#91cc75", smooth: true });
    chart.addMovingAverageLine(ma20, { color: "#fac858", smooth: true });
    chart.addMovingAverageLine(ma30, { color: "#9a60b4", smooth: true });

    // Y-axis price labels: built by hand (not `yAxisConfig.includeNumbers` /
    // `addCoordinates()`'s x-side) because NumberLine._addNumbers() offsets
    // labels for a HORIZONTAL line -- on the y-axis (rotated 90deg by Axes)
    // that offset stacks every label on top of the axis instead of beside
    // it. Free-standing labels positioned via coordsToPoint match how
    // Axes.addCoordinates() itself special-cases the y side.
    const priceLabels = new VGroup();
    for (const y of chart.yAxis.getTickRange()) {
      const p = chart.coordsToPoint(0, y);
      const label = new Text(String(Math.round(y)), { fontSize: 0.22, color: AXIS_COLOR });
      label.moveTo([p[0] - 0.75, p[1], 0]);
      priceLabels.add(label);
    }

    // A few date labels under the x-axis (stand-in for the category axis).
    const dateLabels = new VGroup();
    for (let i = 0; i < points.length; i += DATE_TICK_STEP) {
      const p = chart.coordsToPoint(i + 0.5, chart.yRange[0]);
      const label = new Text(points[i].label, { fontSize: 0.2, color: AXIS_COLOR });
      label.moveTo([p[0], p[1] - 0.3, 0]);
      dateLabels.add(label);
    }

    const title = new Text("ShangHai Index", {
      fontSize: 0.4,
      color: AXIS_COLOR,
    });
    title.moveTo([-4.9, 3.6, 0]);

    const legend = new Legend(
      [
        { label: "K-line", color: "#ec0000", shape: "rect" },
        { label: "MA5", color: "#5470c6", shape: "line" },
        { label: "MA10", color: "#91cc75", shape: "line" },
        { label: "MA20", color: "#fac858", shape: "line" },
        { label: "MA30", color: "#9a60b4", shape: "line" },
      ],
      { orientation: "horizontal", itemSpacing: 1.5, fontSize: 0.22, textColor: AXIS_COLOR },
    );
    legend.moveTo([0.2, 3.15, 0]);

    this.add(title, legend, chart, priceLabels, dateLabels);

    await this.play(new LaggedStart(
      [new FadeIn(chart), new FadeIn(priceLabels), new FadeIn(dateLabels)],
      { lagRatio: 0.3, runTime: 1.5 },
    ));
    await this.wait(0.5);
  }
}

await demoRender(CandlestickShanghai, import.meta.url);
