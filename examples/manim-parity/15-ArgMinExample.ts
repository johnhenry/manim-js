// Port of Manim CE gallery: ArgMinExample (ref/ArgMinExample.py).

import { Scene, Axes, Dot, ValueTracker, MAROON } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class ArgMinExample extends Scene {
  async construct() {
    const ax = new Axes({
      xRange: [0, 10], yRange: [0, 100, 10], axisConfig: { includeTip: false },
    });
    const labels = ax.getAxisLabels("x", "f(x)");

    const t = new ValueTracker(0);

    const func = (x: number) => 2 * (x - 5) ** 2;
    const graph = ax.plot(func, { color: MAROON });

    const dot = new Dot({ point: ax.coordsToPoint(t.getValue(), func(t.getValue())) });
    dot.addUpdater((x: any) => x.moveTo(ax.c2p(t.getValue(), func(t.getValue()))));

    // np.linspace + argmin, in plain JS.
    const xSpace = Array.from({ length: 200 }, (_, i) => (10 * i) / 199);
    const minimumIndex = xSpace.reduce((best, _, i) => (func(xSpace[i]) < func(xSpace[best]) ? i : best), 0);

    this.add(ax, labels, graph, dot);
    await this.play(t.animate.setValue(xSpace[minimumIndex]));
    await this.wait(1);
  }
}

await demoRender(ArgMinExample, import.meta.url);
