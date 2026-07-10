// Port of Manim CE gallery: HeatDiagramPlot (ref/HeatDiagramPlot.py) —
// plot_line_graph with Tex axis labels and selected axis numbers.

import { Scene, Axes, Tex } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const arange = (a: number, b: number, step: number) => {
  const out: number[] = [];
  for (let x = a; x < b; x += step) out.push(x);
  return out;
};

class HeatDiagramPlot extends Scene {
  async construct() {
    const ax = new Axes({
      xRange: [0, 40, 5],
      yRange: [-8, 32, 5],
      xLength: 9,
      yLength: 6,
      xAxisConfig: { numbersToInclude: arange(0, 40, 5) },
      yAxisConfig: { numbersToInclude: arange(-5, 34, 5) },
      tips: false,
    });
    const labels = ax.getAxisLabels(
      new Tex("$\\Delta Q$"),
      new Tex("T[$^\\circ C$]"),
    );

    const xVals = [0, 8, 38, 39];
    const yVals = [20, 0, 0, -5];
    const graph = ax.plotLineGraph(xVals, yVals);

    this.add(ax, labels, graph);
    await this.wait(1);
  }
}

await demoRender(HeatDiagramPlot, import.meta.url);
