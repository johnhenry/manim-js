// ECharts parity demo 15: ref/15-waterfall.js — "Waterfall Chart" (ECharts
// gallery, Apache-2.0). ECharts has no native waterfall series; the gallery
// fakes one with two `stack: 'Total'` bar series — a transparent
// "Placeholder" spacer and the visible "Life Cost" bar — producing a
// running-total bar chart with floating bars. Pure composition here: no new
// mobject needed. d3-shape's stack()'s default bottom-up-cumulative offset
// IS the waterfall running-total math (keys ['Placeholder', 'Life Cost']),
// and bars are laid out the SAME scaleBand/scaleLinear + Rectangle
// positioning pattern as examples/d3-parity/03-stacked-to-grouped-bars.ts.
// The Placeholder series renders with fillOpacity: 0 (invisible spacer,
// matching ECharts' itemStyle: {color: 'transparent'}); only Life Cost is
// visibly colored, giving the "floating bars at different baselines" look.

import {
  Scene, Rectangle, Text, scaleBand, scaleLinear, stack, max, LaggedStart, FadeIn,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";
import { svgFrame } from "../d3-parity/_run.ts";
import { axisBottom, axisLeft } from "../d3-parity/_axes.ts";

const categories = ["Total", "Rent", "Utilities", "Transportation", "Meals", "Other"];
const placeholderData = [0, 1700, 1400, 1200, 300, 0];
const lifeCostData = [2900, 1200, 300, 200, 900, 300];
const BAR_COLOR = "#5470c6"; // ECharts default palette blue.

class WaterfallChart extends Scene {
  async construct() {
    const width = 928, height = 550;
    const marginTop = 70, marginRight = 40, marginBottom = 50, marginLeft = 60;
    const f = svgFrame(width, height);

    const rows = categories.map((category, i) => ({
      category, Placeholder: placeholderData[i], "Life Cost": lifeCostData[i],
    }));
    // Default order/offset ("none") is exactly bottom-up cumulative: series[0]
    // (Placeholder) runs [0, placeholder]; series[1] (Life Cost) runs
    // [placeholder, placeholder + lifeCost] — the floating-bar baseline.
    const series = stack({ keys: ["Placeholder", "Life Cost"] })(rows);
    const [placeholderSeries, lifeCostSeries] = series;

    const yMax = max(lifeCostSeries, (d) => d[1]);
    const x = scaleBand(categories, [marginLeft, width - marginRight]).padding(0.35);
    const y = scaleLinear([0, yMax], [height - marginBottom, marginTop]);

    const title = new Text("Waterfall Chart", { fontSize: f.len(20), color: "#333333" });
    title.moveTo(f.pt(marginLeft, 22));
    title.shift([title.getWidth() / 2, 0, 0]);
    this.add(title);

    this.add(axisBottom(x, height - marginBottom, f, { color: "#333333" }));
    this.add(axisLeft(y, marginLeft, f, { tickCount: 6, color: "#333333" }));

    const rects: Rectangle[] = [];
    const labels: Text[] = [];
    categories.forEach((category, j) => {
      const cx = x(category) + x.bandwidth() / 2;
      const bw = x.bandwidth();

      // Placeholder spacer: invisible, floats the visible bar to its running
      // total. No animation needed for an invisible mobject — add directly.
      const [ph0, ph1] = placeholderSeries[j];
      const phTop = y(ph1), phBot = y(ph0);
      const placeholder = new Rectangle({
        width: f.len(bw), height: f.len(Math.max(0.01, phBot - phTop)),
        fillOpacity: 0, strokeWidth: 0,
      });
      placeholder.moveTo(f.pt(cx, (phTop + phBot) / 2));
      this.add(placeholder);

      // Life Cost: the visible floating bar.
      const [lc0, lc1] = lifeCostSeries[j];
      const lcTop = y(lc1), lcBot = y(lc0);
      const rect = new Rectangle({
        width: f.len(bw), height: f.len(Math.max(0.01, lcBot - lcTop)),
        fillColor: BAR_COLOR, fillOpacity: 1, strokeWidth: 0,
      });
      rect.moveTo(f.pt(cx, (lcTop + lcBot) / 2));
      rects.push(rect);

      // In-bar value label (ECharts' label: {show: true, position: 'inside'}).
      // Explicit white — a deliberate contrast choice against the colored
      // bar underneath it (not Text's bare default, which would be
      // invisible only against the campaign's WHITE demo background, not
      // relevant here since this label sits over a colored rect).
      const label = new Text(String(lifeCostData[j]), { fontSize: f.len(13), color: "#ffffff" });
      label.moveTo(f.pt(cx, (lcTop + lcBot) / 2));
      labels.push(label);
    });

    await this.play(new LaggedStart(
      rects.map((r) => new FadeIn(r, { shift: [0, f.len(20), 0] })),
      { lagRatio: 0.15, runTime: 1.8 },
    ));
    await this.play(new LaggedStart(
      labels.map((l) => new FadeIn(l)),
      { lagRatio: 0.15, runTime: 1 },
    ));
    await this.wait(0.5);
  }
}

await demoRender(WaterfallChart, import.meta.url);
