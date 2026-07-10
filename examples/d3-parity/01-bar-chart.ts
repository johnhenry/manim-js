// Port of D3 gallery: Bar Chart (ref/bar-chart.js) — relative frequency of
// English letters, x sorted descending by frequency (groupSort), % y-axis.
// Data: alphabet.csv (Cryptological Mathematics, Robert Lewand).
// Surpass: bars grow in with a lagged stagger (the ref is static).

import {
  Scene, Rectangle, VGroup, scaleBand, scaleLinear, groupSort, max, format,
  LaggedStart, GrowFromEdge, DOWN,
} from "../../src/node.ts";
import { demoRender, loadCsv, svgFrame } from "./_run.ts";
import { axisLeft, axisBottom } from "./_axes.ts";

const alphabet = loadCsv("alphabet.csv") as Array<{ letter: string; frequency: number }>;

class BarChart extends Scene {
  async construct() {
    const width = 928, height = 500;
    const marginTop = 20, marginRight = 0, marginBottom = 30, marginLeft = 40;
    const f = svgFrame(width, height);

    // x sorted by descending frequency (the ref's groupSort call).
    const x = scaleBand(
      groupSort(alphabet, ([d]: any[]) => -d.frequency, (d: any) => d.letter),
      [marginLeft, width - marginRight],
    ).padding(0.1);
    const y = scaleLinear([0, max(alphabet, (d) => d.frequency)], [height - marginBottom, marginTop]);

    const bars = new VGroup();
    for (const d of alphabet) {
      const x0 = x(d.letter);
      const y1 = y(d.frequency);
      const bar = new Rectangle({
        width: f.len(x.bandwidth()),
        height: f.len(height - marginBottom - y1),
        fillColor: "steelblue", fillOpacity: 1, strokeWidth: 0,
      });
      // Anchor at the bar's center between baseline and top.
      const cx = x0 + x.bandwidth() / 2;
      const cy = (y1 + (height - marginBottom)) / 2;
      bar.moveTo(f.pt(cx, cy));
      bars.add(bar);
    }

    this.add(
      axisLeft(y, marginLeft, f, { format: format(".0%"), label: "↑ Frequency (%)", gridX: [marginLeft, width - marginRight] }),
      axisBottom(x, height - marginBottom, f),
    );
    await this.play(new LaggedStart(
      bars.submobjects.map((b) => new GrowFromEdge(b, DOWN)),
      { lagRatio: 0.05, runTime: 2 },
    ));
    await this.wait(1);
  }
}

await demoRender(BarChart, import.meta.url);
