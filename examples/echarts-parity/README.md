# ECharts parity suite

**A business-dashboard chart library, animated.** Every mobject you'd reach
for to recreate an Apache ECharts gallery example — gauges, radars, funnels,
candlesticks, nightingale/rose pies, a visualMap gradient legend — now
renders headlessly to video on the same Canvas-2D path as everything else,
and 9 of the 15 gallery examples needed **zero new library code**: they
reuse the Campaign-2 (D3) scale/shape/layout/data-join layer directly.

```bash
ECMANIM_DEMO_QUALITY=low npx tsx examples/echarts-parity/06-gauge.ts
npm run demos:echarts   # everything
```

Corpus: each example's raw TS/JS option-config source, fetched live from
`echarts.apache.org/examples/examples/ts/*.ts` (Apache-2.0; verified
byte-identical against `github.com/apache/echarts-examples`), in
[`ref/`](./ref/) — provenance and a feature census in
[`ref/README.md`](./ref/README.md).

## Scorecard — 15/15 rendered & frame-verified

| # | Demo | Source | Proves |
|---|------|--------|--------|
| 01 | bar-race | Bar Race | ranked bars flip position — `dataJoin`/`rankFrame`/`interpolateFrames` (reused from the D3 campaign's bar-chart-race) |
| 02 | line-area-smooth | Area Chart with Time Axis | `smooth:true` line (`Axes.plotLineGraph({smooth:true})`, new this campaign) + `areaGen()` fill |
| 03 | bar-stack | Stacked Column Chart | two independent `stack()` groups beside an unstacked series, `markLine` |
| 04 | scatter-visualmap | Scatter Aqi Color | `visualMapContinuous()` driving both bubble size AND color lightness, `ColorBar` legend |
| 05 | radar | Basic Radar Chart | **RadarChart** — independent-max polygon axes, two overlaid series |
| 06 | gauge | Gauge Basic chart | **GaugeChart** — banded dial, needle sweep, tick/value labels |
| 07 | funnel | Funnel Chart | **FunnelChart** — value-tapered trapezoid stages, descending sort |
| 08 | candlestick | ShangHai Index | **Candlestick** (OHLC bodies+wicks) + `movingAverage()` feeding MA5/10/20/30 overlay lines |
| 09 | calendar-heatmap | Calendar Heatmap | GitHub-style day-cell grid (D3 calendar-view pattern) + `scaleQuantize` piecewise color |
| 10 | pie-rosetype | Nightingale Chart | **PieChart `roseType`** — `'radius'` vs `'area'` side by side |
| 11 | graph-force | Force Layout | `ForceSimulation` reused verbatim (Les Misérables co-occurrence graph) |
| 12 | sunburst | Basic Sunburst | `hierarchy()`/`partition()` reused verbatim (synthetic-root-wrapped family tree) |
| 13 | sankey | Basic Sankey | `sankey()` reused verbatim (name-keyed nodes, `iterations:0`) |
| 14 | themeriver | ThemeRiver | `stack({offset:"silhouette"})` reused verbatim (long-to-wide pivot, matching the streamgraph port) |
| 15 | waterfall | Waterfall Chart | pure `stack()` composition (transparent placeholder series) — **no new mobject** |

## The gap-fill (this campaign's library additions)

Assessment (3 parallel agents mapping all 15 examples against the existing
API, file:line-grounded) found 9 of 15 reproducible with zero new code —
confirming the roadmap's "cheap after D3" premise for graph/sunburst/sankey/
themeRiver/waterfall, plus bar/line/stack chart basics. The real gaps:

- **`RadarChart`** (`src/mobject/radar.ts`) — N independent-max polar axes,
  grid rings, per-series filled polygons, identity-preserving `setValues()`.
- **`GaugeChart`** (`src/mobject/gauge.ts`) — partial-arc color bands,
  rotating needle, tick labels, `setValue()` for per-frame updates.
- **`FunnelChart`** (`src/mobject/funnel.ts`) — sortable tapering-trapezoid
  stages.
- **`Candlestick`** (`src/mobject/candlestick.ts`, extends `Axes` like
  `BarChart`) — OHLC bodies+wicks, `addMovingAverageLine()`.
- **`Legend` + `ColorBar`** (`src/mobject/legend.ts`) — a categorical
  swatch legend and a gradient-swatch bar (reuses the existing
  `gradientColors`/`sheenDirection` mechanism, no new rendering code) for
  visualMap-style legends.
- **`PieChart.roseType`** (`'radius'|'area'`) — equal-angle slices with
  per-slice value-driven radius; extends the existing mobject, not a new one.
- **`scaleThreshold` + `visualMapContinuous`** (`src/core/scales.ts`) —
  arbitrary-cutpoint piecewise scale; bundles domain + size/color-range +
  clamp + outOfRange into one mapper (the roadmap's named "visualMap helper").
- **`movingAverage`** (`src/core/array_utils.ts`); **`Axes.plotLineGraph`
  gained a `smooth: boolean` option** (wires the existing
  `VMobject.setPointsSmoothly` in).

## Bugs found & fixed (reach every `Axes` consumer)

- **Y-axis label misplacement.** Two independent port agents (02, 08) hit
  the same bug: `yAxisConfig.includeNumbers: true` positioned tick labels
  *inside the plot area* instead of beside the axis. Root cause:
  `NumberLine._addNumbers()` places each label at a local offset assuming a
  horizontal line, but `Axes` rotates the y-axis 90° *after* construction —
  the offset rotates with it. `addCoordinates()` already had a correct
  world-space workaround for its own call path; the constructor now applies
  the same fix uniformly via a shared `_buildYNumbers()` helper, so any
  caller gets correct placement regardless of entry path.
- **`visualMapContinuous`'s `size()`** was feeding a normalized `[0,1]` t
  into a scale still keyed to the raw domain (caught by its own test suite
  before any port used it).

## Honest divergences

- `dataZoom` (pan/zoom viewport over a data range) has no ecmanim
  equivalent — 08-candlestick renders a representative 50-day slice of the
  real dataset instead of the full range + interactive zoom.
- `markPoint`/tooltip/`emphasis` hover chrome is interactive-only and
  dropped, matching every prior campaign's convention for rendered video.
- CJK glyphs (e.g. 08's "上证指数") render as tofu boxes — the vector text
  path has no CJK coverage; titles/labels are kept in English.
- 04's city names are translated to English for the same reason (no CJK
  glyph coverage).
