// Port of Manim CE gallery: GraphAreaPlot (ref/GraphAreaPlot.py) — Riemann
// rectangles + bounded area + point-form vertical lines.

import { Scene, Axes, BLUE, YELLOW, GREY, BLUE_C, GREEN_B } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class GraphAreaPlot extends Scene {
  async construct() {
    const ax = new Axes({
      xRange: [0, 5],
      yRange: [0, 6],
      xAxisConfig: { numbersToInclude: [2, 3] },
      tips: false,
    });

    const labels = ax.getAxisLabels();

    const curve1 = ax.plot((x) => 4 * x - x ** 2, { xRange: [0, 4], color: BLUE_C });
    const curve2 = ax.plot((x) => 0.8 * x ** 2 - 3 * x + 4, { xRange: [0, 4], color: GREEN_B });

    const line1 = ax.getVerticalLine(ax.inputToGraphPoint(2, curve1), { color: YELLOW });
    const line2 = ax.getVerticalLine(ax.i2gp(3, curve1), { color: YELLOW });

    const riemannArea = ax.getRiemannRectangles(curve1, { xRange: [0.3, 0.6], dx: 0.03, color: BLUE, fillOpacity: 0.5 });
    const area = ax.getArea(curve2, { xRange: [2, 3], boundedGraph: curve1, color: GREY, opacity: 0.5 });

    this.add(ax, labels, curve1, curve2, line1, line2, riemannArea, area);
    await this.wait(1);
  }
}

await demoRender(GraphAreaPlot, import.meta.url);
