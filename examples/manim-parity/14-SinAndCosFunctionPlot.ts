// Port of Manim CE gallery: SinAndCosFunctionPlot
// (ref/SinAndCosFunctionPlot.py) — the axes-depth showcase: selected axis
// numbers + elongated ticks, graph labels at x values, point-form vertical
// line (all added in the parity pass).

import {
  Scene, Axes, Line, VGroup,
  GREEN, BLUE, RED, YELLOW, WHITE, UP, UR, TAU,
} from "../../src/node.ts";
import * as V from "../../src/core/math/vector.ts";
import { demoRender } from "./_run.ts";

const arange = (a: number, b: number, step: number) => {
  const out: number[] = [];
  for (let x = a; x <= b; x += step) out.push(x);
  return out;
};

class SinAndCosFunctionPlot extends Scene {
  async construct() {
    const axes = new Axes({
      xRange: [-10, 10.3, 1],
      yRange: [-1.5, 1.5, 1],
      xLength: 10,
      axisConfig: { color: GREEN },
      xAxisConfig: {
        numbersToInclude: arange(-10, 10.01, 2),
        numbersWithElongatedTicks: arange(-10, 10.01, 2),
      },
      tips: false,
    });
    const axesLabels = axes.getAxisLabels();
    const sinGraph = axes.plot((x) => Math.sin(x), { color: BLUE });
    const cosGraph = axes.plot((x) => Math.cos(x), { color: RED });

    const sinLabel = axes.getGraphLabel(sinGraph, "\\sin(x)", { xVal: -10, direction: V.scale(UP, 0.5) });
    const cosLabel = axes.getGraphLabel(cosGraph, "\\cos(x)");

    const vertLine = axes.getVerticalLine(axes.i2gp(TAU, cosGraph), { color: YELLOW, lineFunc: Line } as any);
    const lineLabel = axes.getGraphLabel(cosGraph, "x=2\\pi", { xVal: TAU, direction: UR, color: WHITE });

    const plot = new VGroup(axes, sinGraph, cosGraph, vertLine);
    const labels = new VGroup(axesLabels, sinLabel, cosLabel, lineLabel);
    this.add(plot, labels);
    await this.wait(1);
  }
}

await demoRender(SinAndCosFunctionPlot, import.meta.url);
