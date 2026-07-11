// ECharts parity demo 05: ref/05-radar.js — "Basic Radar Chart" (ECharts
// gallery, Apache-2.0). Six independent-max indicator axes ("Sales" through
// "Marketing"), two overlaid series ("Allocated Budget" / "Actual Spending").
// Proves the RadarChart mobject (src/mobject/radar.ts): per-axis max
// normalization, polygon-per-series overlay, indicator labels.

import { Scene, RadarChart, Legend, Text, VGroup, FadeIn } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const INDICATORS = [
  { name: "Sales", max: 6500 },
  { name: "Administration", max: 16000 },
  { name: "Information Technology", max: 30000 },
  { name: "Customer Support", max: 38000 },
  { name: "Development", max: 52000 },
  { name: "Marketing", max: 25000 },
];

const SERIES_COLORS = ["#5470c6", "#91cc75"];

class BasicRadarChart extends Scene {
  async construct() {
    const title = new Text("Basic Radar Chart", { fontSize: 0.4, color: "#333333" });
    title.toCorner([-1, 1, 0], 0.4);
    this.add(title);

    const radar = new RadarChart(
      [
        { name: "Allocated Budget", values: [4200, 3000, 20000, 35000, 50000, 18000] },
        { name: "Actual Spending", values: [5000, 14000, 28000, 26000, 42000, 21000] },
      ],
      {
        indicators: INDICATORS,
        radius: 2.6,
        colors: SERIES_COLORS,
        strokeWidth: 2,
        fillOpacity: 0.25,
        labelFontSize: 0.28,
        labelColor: "#333333",
      },
    );
    radar.shift([-1.2, -0.5, 0]);

    const legend = new Legend(
      [
        { label: "Allocated Budget", color: SERIES_COLORS[0] },
        { label: "Actual Spending", color: SERIES_COLORS[1] },
      ],
      { orientation: "vertical", itemSpacing: 0.4, swatchSize: 0.25, fontSize: 0.28, textColor: "#333333" },
    );
    legend.toCorner([1, 1, 0], 0.5);

    await this.play(new FadeIn(new VGroup(radar, legend), { runTime: 1 }));
    await this.wait(0.8);
  }
}

await demoRender(BasicRadarChart, import.meta.url);
