// ECharts parity demo 04: ref/04-scatter-visualmap.js — "Scatter Aqi Color"
// (ECharts gallery, Apache-2.0). Three cities' daily AQI rows plotted as
// bubbles on a date/AQI-index scatter, with TWO continuous visualMap
// dimensions: PM2.5 -> bubble size (`symbolSize: [10,70]`) and SO2 ->
// color lightness (`colorLightness: [0.9,0.5]` on a fixed base hue). Proves
// `visualMapContinuous()` (src/core/scales.ts) driving both a size and a
// color encoding off raw data dimensions, plus `ColorBar` as the visualMap
// legend widget.
//
// Data columns (per ref's `schema`): [date, AQIindex, PM25, PM10, CO, NO2, SO2, desc].
// Legend labels translated to English (Beijing/Shanghai/Guangzhou) rather
// than the ref's Chinese city names — this demo's font stack has no CJK
// coverage, so untranslated labels would render as invisible/missing glyphs.

import { Scene, Axes, Circle, Legend, ColorBar, VGroup, FadeIn, visualMapContinuous } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

// [date, AQIindex, PM25, PM10, CO, NO2, SO2, desc] — trimmed to the numeric
// columns actually used (dropping the trailing Chinese quality-label string).
const dataBJ = [
  [1, 55, 9, 56, 0.46, 18, 6], [2, 25, 11, 21, 0.65, 34, 9], [3, 56, 7, 63, 0.3, 14, 5],
  [4, 33, 7, 29, 0.33, 16, 6], [5, 42, 24, 44, 0.76, 40, 16], [6, 82, 58, 90, 1.77, 68, 33],
  [7, 74, 49, 77, 1.46, 48, 27], [8, 78, 55, 80, 1.29, 59, 29], [9, 267, 216, 280, 4.8, 108, 64],
  [10, 185, 127, 216, 2.52, 61, 27], [11, 39, 19, 38, 0.57, 31, 15], [12, 41, 11, 40, 0.43, 21, 7],
  [13, 64, 38, 74, 1.04, 46, 22], [14, 108, 79, 120, 1.7, 75, 41], [15, 108, 63, 116, 1.48, 44, 26],
  [16, 33, 6, 29, 0.34, 13, 5], [17, 94, 66, 110, 1.54, 62, 31], [18, 186, 142, 192, 3.88, 93, 79],
  [19, 57, 31, 54, 0.96, 32, 14], [20, 22, 8, 17, 0.48, 23, 10], [21, 39, 15, 36, 0.61, 29, 13],
  [22, 94, 69, 114, 2.08, 73, 39], [23, 99, 73, 110, 2.43, 76, 48], [24, 31, 12, 30, 0.5, 32, 16],
  [25, 42, 27, 43, 1, 53, 22], [26, 154, 117, 157, 3.05, 92, 58], [27, 234, 185, 230, 4.09, 123, 69],
  [28, 160, 120, 186, 2.77, 91, 50], [29, 134, 96, 165, 2.76, 83, 41], [30, 52, 24, 60, 1.03, 50, 21],
  [31, 46, 5, 49, 0.28, 10, 6],
];

const dataGZ = [
  [1, 26, 37, 27, 1.163, 27, 13], [2, 85, 62, 71, 1.195, 60, 8], [3, 78, 38, 74, 1.363, 37, 7],
  [4, 21, 21, 36, 0.634, 40, 9], [5, 41, 42, 46, 0.915, 81, 13], [6, 56, 52, 69, 1.067, 92, 16],
  [7, 64, 30, 28, 0.924, 51, 2], [8, 55, 48, 74, 1.236, 75, 26], [9, 76, 85, 113, 1.237, 114, 27],
  [10, 91, 81, 104, 1.041, 56, 40], [11, 84, 39, 60, 0.964, 25, 11], [12, 64, 51, 101, 0.862, 58, 23],
  [13, 70, 69, 120, 1.198, 65, 36], [14, 77, 105, 178, 2.549, 64, 16], [15, 109, 68, 87, 0.996, 74, 29],
  [16, 73, 68, 97, 0.905, 51, 34], [17, 54, 27, 47, 0.592, 53, 12], [18, 51, 61, 97, 0.811, 65, 19],
  [19, 91, 71, 121, 1.374, 43, 18], [20, 73, 102, 182, 2.787, 44, 19], [21, 73, 50, 76, 0.717, 31, 20],
  [22, 84, 94, 140, 2.238, 68, 18], [23, 93, 77, 104, 1.165, 53, 7], [24, 99, 130, 227, 3.97, 55, 15],
  [25, 146, 84, 139, 1.094, 40, 17], [26, 113, 108, 137, 1.481, 48, 15], [27, 81, 48, 62, 1.619, 26, 3],
  [28, 56, 48, 68, 1.336, 37, 9], [29, 82, 92, 174, 3.29, 0, 13], [30, 106, 116, 188, 3.628, 101, 16],
  [31, 118, 50, 0, 1.383, 76, 11],
];

const dataSH = [
  [1, 91, 45, 125, 0.82, 34, 23], [2, 65, 27, 78, 0.86, 45, 29], [3, 83, 60, 84, 1.09, 73, 27],
  [4, 109, 81, 121, 1.28, 68, 51], [5, 106, 77, 114, 1.07, 55, 51], [6, 109, 81, 121, 1.28, 68, 51],
  [7, 106, 77, 114, 1.07, 55, 51], [8, 89, 65, 78, 0.86, 51, 26], [9, 53, 33, 47, 0.64, 50, 17],
  [10, 80, 55, 80, 1.01, 75, 24], [11, 117, 81, 124, 1.03, 45, 24], [12, 99, 71, 142, 1.1, 62, 42],
  [13, 95, 69, 130, 1.28, 74, 50], [14, 116, 87, 131, 1.47, 84, 40], [15, 108, 80, 121, 1.3, 85, 37],
  [16, 134, 83, 167, 1.16, 57, 43], [17, 79, 43, 107, 1.05, 59, 37], [18, 71, 46, 89, 0.86, 64, 25],
  [19, 97, 71, 113, 1.17, 88, 31], [20, 84, 57, 91, 0.85, 55, 31], [21, 87, 63, 101, 0.9, 56, 41],
  [22, 104, 77, 119, 1.09, 73, 48], [23, 87, 62, 100, 1, 72, 28], [24, 168, 128, 172, 1.49, 97, 56],
  [25, 65, 45, 51, 0.74, 39, 17], [26, 39, 24, 38, 0.61, 47, 17], [27, 39, 24, 39, 0.59, 50, 19],
  [28, 93, 68, 96, 1.05, 79, 29], [29, 188, 143, 197, 1.66, 99, 51], [30, 174, 131, 174, 1.55, 108, 50],
  [31, 187, 143, 201, 1.39, 89, 53],
];

const SERIES: Array<{ name: string; color: string; data: number[][] }> = [
  { name: "Beijing", color: "#dd4444", data: dataBJ },
  { name: "Shanghai", color: "#fec42c", data: dataSH },
  { name: "Guangzhou", color: "#80F1BE", data: dataGZ },
];

class ScatterAqiColor extends Scene {
  async construct() {
    const axes = new Axes({
      xRange: [0, 32, 5],
      yRange: [0, 300, 50],
      xLength: 8,
      yLength: 6,
      color: "#333333",
      axisConfig: { includeNumbers: true, fontSize: 0.22 },
    });
    axes.shift([-1.5, -0.3, 0]);
    this.add(axes);

    // visualMap #1: PM2.5 (dim 2) -> bubble size, [0,250] -> symbolSize [10,70].
    const sizeMap = visualMapContinuous({ domain: [0, 250], inRange: { symbolSize: [10, 70] } });
    // visualMap #2: SO2 (dim 6) -> color lightness, [0,50] -> lightness [0.9,0.5]
    // on a fixed base hue (matching ref's controller.inRange.color '#c23531').
    const colorMap = visualMapContinuous({
      domain: [0, 50],
      inRange: { colorLightness: { base: "#c23531", range: [0.9, 0.5] } },
    });

    const bubbles = new VGroup();
    for (const series of SERIES) {
      for (const row of series.data) {
        const [date, aqi, pm25, , , , so2] = row;
        const size = sizeMap.size(pm25) ?? 10;
        const radius = size / 40; // px-scale symbolSize -> world-unit radius
        const color = colorMap.color(so2) ?? series.color;
        const circle = new Circle({
          point: axes.c2p(date, aqi),
          radius,
          fillColor: color,
          fillOpacity: 0.8,
          strokeWidth: 0,
        });
        bubbles.add(circle);
      }
    }

    const legend = new Legend(
      SERIES.map((s) => ({ label: s.name, color: s.color })),
      { orientation: "horizontal", itemSpacing: 1.1, swatchSize: 0.22, fontSize: 0.25, textColor: "#333333" },
    );
    // Center horizontally first (a horizontal Legend's bounding box isn't
    // centered on its own origin — it grows rightward from item 0), THEN
    // align to the top edge, so it doesn't run off the right side of frame.
    legend.center();
    legend.toEdge([0, 1, 0], 0.3);
    this.add(legend);

    const colorBar = new ColorBar({
      domain: colorMap.domain,
      interpolator: colorMap.interpolator,
      orientation: "vertical",
      length: 3.5,
      width: 0.35,
      tickCount: 5,
      tickFontSize: 0.22,
      textColor: "#333333",
      label: "SO2",
      labelFontSize: 0.25,
    });
    colorBar.toEdge([1, 0, 0], 0.6);
    this.add(colorBar);

    await this.play(new FadeIn(new VGroup(bubbles, legend, colorBar), { runTime: 1 }));
    await this.wait(0.8);
  }
}

await demoRender(ScatterAqiColor, import.meta.url);
