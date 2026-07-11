// ECharts parity demo 07: ref/07-funnel.js — "Funnel Chart" (ECharts
// gallery, Apache-2.0). Five conversion stages (Show/Click/Visit/Inquiry/
// Order), `sort: 'descending'`, small inter-stage gap. Proves the
// FunnelChart mobject (src/mobject/funnel.ts): value-driven trapezoid
// tapering, descending sort, per-stage labels.
//
// Stage colors are an explicit palette (not FunnelChart's DEFAULT_STAGE_COLORS,
// which includes a pale YELLOW that white labels wash out against) chosen so
// a single white labelColor has good contrast against every stage.

import { Scene, FunnelChart, Legend, Text, VGroup, FadeIn } from "../../src/node.ts";
import type { FunnelStage } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

// Listed already in descending value order (matches the chart's own
// `sort: 'descending'` default) so the legend below can reuse the same
// name/color pairing without re-deriving the sort.
const STAGES: FunnelStage[] = [
  { name: "Show", value: 100 },
  { name: "Click", value: 80 },
  { name: "Visit", value: 60 },
  { name: "Inquiry", value: 40 },
  { name: "Order", value: 20 },
];

const STAGE_COLORS = ["#5470c6", "#91cc75", "#ee6666", "#73c0de", "#3ba272"];

class FunnelBasic extends Scene {
  async construct() {
    const title = new Text("Funnel", { fontSize: 0.5, color: "#333333" });
    title.toEdge([0, 1, 0], 0.4);
    this.add(title);

    const funnel = new FunnelChart(STAGES, {
      width: 5,
      height: 5,
      sort: "descending",
      gap: 0.08,
      // ECharts' minSize:'0%' (ratio 0) tapers the narrowest stage to a
      // sliver too thin for its label at any readable font size; widen the
      // floor so "Inquiry"/"Order" (the two narrowest stages) still fit.
      minSizeRatio: 0.3,
      colors: STAGE_COLORS,
      strokeColor: "#ffffff",
      strokeWidth: 1,
      labelFontSize: 0.22,
      labelColor: "#ffffff",
    });
    funnel.shift([-1.5, -0.5, 0]);

    const legend = new Legend(
      STAGES.map((s, i) => ({ label: s.name, color: STAGE_COLORS[i % STAGE_COLORS.length] })),
      { orientation: "vertical", itemSpacing: 0.4, swatchSize: 0.25, fontSize: 0.28, textColor: "#333333" },
    );
    legend.toCorner([1, 1, 0], 0.5);

    await this.play(new FadeIn(new VGroup(funnel, legend), { runTime: 1 }));
    await this.wait(0.8);
  }
}

await demoRender(FunnelBasic, import.meta.url);
