// ECharts parity demo 10: ref/10-pie-rosetype.js — "Nightingale Chart"
// (ECharts gallery, Apache-2.0). Two side-by-side rose/nightingale pies:
// left uses `roseType: 'radius'` (8 slices, values [40,33,28,22,20,15,12,10]),
// right uses `roseType: 'area'` (8 slices, values [30,28,26,24,22,20,18,16]).
// Proves PieChart's `roseType` config (JUST added this campaign, src/mobject
// /charts.ts's PieChartConfig): equal angle per slice, radius linear in
// value for 'radius' / radius ∝ sqrt(value) for 'area' — see
// test/echarts-gaps.test.ts for the underlying geometry assertions.
//
// Honest divergence: `toolbox` (mark/dataView/restore/saveAsImage) and
// `tooltip` are UI chrome with no ecmanim equivalent and are skipped. The
// ref's radius-mode series sets `label: {show: false}` (revealed only on
// hover via `emphasis.label.show: true`, meaningless in a static render) —
// kept OFF here too, since radius mode's steep value spread (40 down to 10)
// packs the small slices' labels into an unreadable pile at the center
// regardless of font size; a shared Legend (matching the ref's own `legend`
// widget) identifies every slice by color for both pies instead. Area
// mode's much gentler sqrt-compressed spread has no such crowding, so its
// per-slice labels (ECharts' default: shown) are kept on.
//
// CRITICAL: this campaign's harness renders on a WHITE background and Text
// defaults to WHITE fill (see 06-gauge.ts's commit message) — PieChart's
// `labelColor` is explicitly set dark, and every raw Text below too.

import {
  Scene, PieChart, Legend, Text, FadeIn, LaggedStart,
  BLUE, YELLOW, RED, GREEN, PURPLE, ORANGE, TEAL, PINK,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const AXIS_COLOR = "#333333";

// PieChart's default 8-color slice cycle (src/mobject/charts.ts's
// DEFAULT_SLICE_COLORS) — matches the ref's 8-slice series exactly, so both
// pies use it as-is (no `colors` override); reproduced here only so the
// Legend swatches can mirror it.
const SLICE_COLORS = [BLUE, YELLOW, RED, GREEN, PURPLE, ORANGE, TEAL, PINK];
const ROSE_NAMES = ["rose 1", "rose 2", "rose 3", "rose 4", "rose 5", "rose 6", "rose 7", "rose 8"];

const RADIUS_VALUES = [40, 33, 28, 22, 20, 15, 12, 10];
const AREA_VALUES = [30, 28, 26, 24, 22, 20, 18, 16];

class PieRoseType extends Scene {
  async construct() {
    const title = new Text("Nightingale Chart", { fontSize: 0.5, color: AXIS_COLOR });
    title.moveTo([0, 3.5, 0]);
    const subtitle = new Text("Fake Data", { fontSize: 0.26, color: AXIS_COLOR });
    subtitle.moveTo([0, 2.95, 0]);

    const radiusLabel = new Text("Radius Mode", { fontSize: 0.32, color: AXIS_COLOR });
    radiusLabel.moveTo([-3.7, 2.3, 0]);
    const areaLabel = new Text("Area Mode", { fontSize: 0.32, color: AXIS_COLOR });
    areaLabel.moveTo([3.7, 2.3, 0]);

    const radiusPie = new PieChart(RADIUS_VALUES, {
      roseType: "radius",
      radius: 2.1,
      innerRadius: 0.25,
    });
    radiusPie.moveTo([-3.7, -0.6, 0]);

    const areaPie = new PieChart(AREA_VALUES, {
      roseType: "area",
      radius: 2.1,
      innerRadius: 0.25,
      labelFormat: (_v, i) => ROSE_NAMES[i],
      labelFontSize: 0.22,
      labelColor: AXIS_COLOR,
    });
    areaPie.moveTo([3.7, -0.6, 0]);

    // Two rows of 4 (a single 8-item horizontal row overruns the frame
    // width) — one Legend per row, sharing the same color cycle/order.
    const legendRow1 = new Legend(
      ROSE_NAMES.slice(0, 4).map((label, i) => ({ label, color: SLICE_COLORS[i], shape: "rect" as const })),
      { orientation: "horizontal", itemSpacing: 1.1, swatchSize: 0.16, fontSize: 0.16, textColor: AXIS_COLOR },
    );
    legendRow1.moveTo([0, -3.15, 0]);
    const legendRow2 = new Legend(
      ROSE_NAMES.slice(4, 8).map((label, i) => ({ label, color: SLICE_COLORS[i + 4], shape: "rect" as const })),
      { orientation: "horizontal", itemSpacing: 1.1, swatchSize: 0.16, fontSize: 0.16, textColor: AXIS_COLOR },
    );
    legendRow2.moveTo([0, -3.55, 0]);

    this.add(title, subtitle, radiusLabel, areaLabel, legendRow1, legendRow2, radiusPie, areaPie);

    await this.play(new LaggedStart(
      [new FadeIn(radiusPie), new FadeIn(areaPie)],
      { lagRatio: 0.3, runTime: 1.5 },
    ));
    await this.wait(0.5);
  }
}

await demoRender(PieRoseType, import.meta.url);
